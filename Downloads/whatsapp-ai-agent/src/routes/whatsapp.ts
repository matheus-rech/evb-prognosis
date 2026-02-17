import { Router, Request, Response } from 'express'
import { config, ORCHESTRATOR_MODEL } from '../config'
import { logger } from '../utils/logger'
import { getOrCreateContact } from '../services/contact'
import { saveMessage, getConversationHistory } from '../services/message'
import { runOrchestrator } from '../services/orchestrator'
import { routeDecision } from '../services/router'
import { sendWhatsAppMessage, markAsRead } from '../services/whatsapp-api'
import { postSlackApproval, notifyHumanHandoff } from '../services/slack-api'
import type { WhatsAppWebhookPayload, WhatsAppMessage } from '../types'

export const whatsappRouter = Router()

// GET /webhook -- Meta verification challenge
whatsappRouter.get('/', (req: Request, res: Response) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === config.WHATSAPP_VERIFY_TOKEN) {
    logger.info('Webhook verification succeeded')
    res.status(200).send(challenge)
  } else {
    logger.warn('Webhook verification failed')
    res.sendStatus(403)
  }
})

// POST /webhook -- Inbound messages from WhatsApp
whatsappRouter.post('/', async (req: Request, res: Response) => {
  // Always respond 200 immediately to avoid retries
  res.sendStatus(200)

  try {
    const payload = req.body as WhatsAppWebhookPayload

    if (payload.object !== 'whatsapp_business_account') return

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') continue

        const messages = change.value.messages
        const contacts = change.value.contacts
        if (!messages || !contacts) continue

        for (const msg of messages) {
          // Find matching contact name by wa_id, fall back to first contact
          const matchedContact = contacts.find(c => c.wa_id === msg.from)
          const senderName = matchedContact?.profile?.name ?? contacts[0]?.profile?.name ?? null

          if (msg.type === 'text' && msg.text?.body) {
            await handleInboundMessage(msg.from, msg.text.body, senderName, msg.id)
          } else if (['image', 'audio', 'video', 'document', 'sticker', 'location'].includes(msg.type)) {
            await handleMediaMessage(msg, senderName)
          }
          // Silently ignore reactions, system messages, etc.
        }
      }
    }
  } catch (err) {
    logger.error({ err }, 'Error processing webhook')
  }
})

async function handleInboundMessage(
  phone: string,
  text: string,
  senderName: string | null,
  waMessageId: string
) {
  const logCtx = { phone, waMessageId, textPreview: text.slice(0, 50) }
  logger.info(logCtx, 'Inbound message received')

  // 1. Get or create contact
  const contact = await getOrCreateContact(phone, senderName)

  // 2. Mark as read (blue ticks)
  markAsRead(waMessageId).catch(() => {})

  // 3. If bot is paused, skip processing
  if (contact.bot_paused) {
    logger.info({ contactId: contact.id }, 'Bot paused for contact, skipping')
    return
  }

  // 4. Get conversation history BEFORE saving inbound (avoids duplicate in LLM context)
  const history = await getConversationHistory(contact.id)

  // 5. Save inbound message
  await saveMessage({
    contact_id: contact.id,
    direction: 'inbound',
    text,
    meta: { wa_message_id: waMessageId },
  })

  // 6. Run orchestrator (LLM call)
  const output = await runOrchestrator(contact, text, history)

  // 7. Route the response
  const decision = routeDecision(contact, output)
  logger.info({ contactId: contact.id, action: decision.action, reason: decision.reason }, 'Routing decision')

  switch (decision.action) {
    case 'auto_send': {
      await saveMessage({
        contact_id: contact.id,
        direction: 'outbound',
        text: output.reply,
        meta: {
          origin: 'ai',
          model: ORCHESTRATOR_MODEL,
          confidence: output.confidence,
        },
      })
      await sendWhatsAppMessage(phone, output.reply)
      break
    }

    case 'slack_approval': {
      const draftMsg = await saveMessage({
        contact_id: contact.id,
        direction: 'draft',
        text: output.reply,
        meta: {
          origin: 'ai',
          model: ORCHESTRATOR_MODEL,
          confidence: output.confidence,
        },
      })
      await postSlackApproval(contact, text, output, draftMsg.id)
      break
    }

    case 'human_handoff': {
      await notifyHumanHandoff(contact, text, output.reasons)
      break
    }

    case 'ignore':
    default:
      logger.info({ contactId: contact.id }, 'Message ignored (bot paused or human_only)')
      break
  }
}

async function handleMediaMessage(
  msg: WhatsAppMessage,
  senderName: string | null
) {
  const phone = msg.from
  const logCtx = { phone, waMessageId: msg.id, type: msg.type }
  logger.info(logCtx, 'Media message received')

  const contact = await getOrCreateContact(phone, senderName)

  markAsRead(msg.id).catch(() => {})

  // Build a text description for the media message
  const caption = msg.image?.caption ?? msg.document?.caption ?? null
  let description: string

  switch (msg.type) {
    case 'image':
      description = caption ? `[Image: ${caption}]` : '[Image sent]'
      break
    case 'audio':
      description = '[Voice message sent]'
      break
    case 'video':
      description = caption ? `[Video: ${caption}]` : '[Video sent]'
      break
    case 'document':
      description = `[Document: ${msg.document?.filename ?? 'file'}]${caption ? ` -- ${caption}` : ''}`
      break
    case 'sticker':
      description = '[Sticker sent]'
      break
    case 'location':
      description = msg.location?.name
        ? `[Location: ${msg.location.name}${msg.location.address ? `, ${msg.location.address}` : ''}]`
        : `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`
      break
    default:
      description = `[${msg.type} message sent]`
  }

  // Save as inbound with media metadata
  await saveMessage({
    contact_id: contact.id,
    direction: 'inbound',
    text: description,
    meta: {
      wa_message_id: msg.id,
      media_type: msg.type,
      media_id: msg.image?.id ?? msg.audio?.id ?? msg.video?.id ?? msg.document?.id ?? undefined,
      media_mime_type: msg.image?.mime_type ?? msg.audio?.mime_type ?? msg.video?.mime_type ?? msg.document?.mime_type ?? undefined,
      media_filename: msg.document?.filename ?? undefined,
    },
  })

  if (contact.bot_paused) return

  // For messages with captions, treat caption as text and run through orchestrator
  if (caption) {
    const history = await getConversationHistory(contact.id)
    const output = await runOrchestrator(contact, caption, history)
    const decision = routeDecision(contact, output)

    switch (decision.action) {
      case 'auto_send':
        await saveMessage({
          contact_id: contact.id,
          direction: 'outbound',
          text: output.reply,
          meta: { origin: 'ai', model: ORCHESTRATOR_MODEL, confidence: output.confidence },
        })
        await sendWhatsAppMessage(phone, output.reply)
        break
      case 'slack_approval': {
        const draftMsg = await saveMessage({
          contact_id: contact.id,
          direction: 'draft',
          text: output.reply,
          meta: { origin: 'ai', model: ORCHESTRATOR_MODEL, confidence: output.confidence },
        })
        await postSlackApproval(contact, caption, output, draftMsg.id)
        break
      }
      case 'human_handoff':
        await notifyHumanHandoff(contact, description, output.reasons)
        break
    }
    return
  }

  // For media without captions, send acknowledgement and notify team
  const ackText = contact.language === 'pt-BR'
    ? 'Recebemos seu arquivo! Um atendente vai analisar e te responder em breve.'
    : 'We received your file! A team member will review it and get back to you shortly.'

  await saveMessage({
    contact_id: contact.id,
    direction: 'outbound',
    text: ackText,
    meta: { origin: 'ai', model: 'system', confidence: 1 },
  })
  await sendWhatsAppMessage(phone, ackText)
  await notifyHumanHandoff(contact, description, 'Media message received -- requires human review')
}
