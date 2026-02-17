import { Router, Request, Response } from 'express'
import { logger } from '../utils/logger'
import { getMessage, updateMessageDirection, updateMessageFeedback } from '../services/message'
import { sendWhatsAppMessage } from '../services/whatsapp-api'
import { updateSlackApproval } from '../services/slack-api'
import { pauseBot, resumeBot, getContactByPhone, updateContactMode } from '../services/contact'

export const slackRouter = Router()

/**
 * POST /slack/interactions -- Handle Slack interactive components
 * (approval buttons, edit modals, etc.)
 */
slackRouter.post('/interactions', async (req: Request, res: Response) => {
  // Always respond 200 first to prevent Slack retries
  res.sendStatus(200)

  try {
    const payload = JSON.parse(req.body.payload ?? '{}')
    const { type, user, actions, channel, message, view } = payload

    if (type === 'block_actions' && actions?.length > 0) {
      const action = actions[0]
      const actionData = JSON.parse(action.value ?? '{}')

      switch (action.action_id) {
        case 'approve_send':
          await handleApprove(actionData, user, channel, message)
          break

        case 'edit_draft':
          await handleEditTrigger(actionData, payload.trigger_id, channel, message)
          break

        case 'reject_draft':
          await handleReject(actionData, user, channel, message)
          break

        default:
          logger.warn({ actionId: action.action_id }, 'Unknown Slack action')
      }
    }

    if (type === 'view_submission' && view) {
      await handleEditSubmission(view, user)
    }
  } catch (err) {
    logger.error({ err }, 'Error handling Slack interaction')
  }
})

/**
 * POST /slack/commands -- Handle slash commands
 * /bot pause <phone>, /bot resume <phone>, /bot mode <phone> <mode>
 */
slackRouter.post('/commands', async (req: Request, res: Response) => {
  const { command, text, user_name } = req.body

  if (command !== '/bot') {
    res.json({ text: 'Unknown command' })
    return
  }

  const parts = text.trim().split(/\s+/)
  const subcommand = parts[0]
  const phone = parts[1]

  if (!phone) {
    res.json({ text: 'Usage: /bot <pause|resume|mode> <phone> [mode]' })
    return
  }

  try {
    const contact = await getContactByPhone(phone)

    if (!contact) {
      res.json({ text: `Contact ${phone} not found` })
      return
    }

    switch (subcommand) {
      case 'pause':
        await pauseBot(contact.id)
        res.json({ text: `:pause_button: Bot paused for ${contact.name ?? phone} by @${user_name}` })
        break

      case 'resume':
        await resumeBot(contact.id)
        res.json({ text: `:arrow_forward: Bot resumed for ${contact.name ?? phone} by @${user_name}` })
        break

      case 'mode': {
        const newMode = parts[2]
        if (!['copilot', 'auto', 'human_only'].includes(newMode)) {
          res.json({ text: 'Valid modes: copilot, auto, human_only' })
          return
        }
        await updateContactMode(contact.id, newMode as any, `Manual override by @${user_name}`)
        res.json({ text: `:gear: Mode changed to *${newMode}* for ${contact.name ?? phone} by @${user_name}` })
        break
      }

      default:
        res.json({ text: 'Usage: /bot <pause|resume|mode> <phone> [mode]' })
    }
  } catch (err) {
    logger.error({ err, subcommand, phone }, 'Slash command error')
    res.json({ text: 'Error processing command' })
  }
})

// -- Internal handlers --

async function handleApprove(
  data: { draftId: number; phone: string },
  user: { username: string },
  channel: { id: string },
  message: { ts: string }
) {
  const draft = await getMessage(data.draftId)
  if (!draft) return

  await updateMessageDirection(data.draftId, 'outbound')
  await updateMessageFeedback(data.draftId, 'thumbs_up')
  await sendWhatsAppMessage(data.phone, draft.text)
  await updateSlackApproval(channel.id, message.ts, 'approved', user.username)

  logger.info({ draftId: data.draftId, approvedBy: user.username }, 'Draft approved and sent')
}

async function handleEditTrigger(
  data: { draftId: number; phone: string },
  triggerId: string,
  channel: { id: string },
  message: { ts: string }
) {
  const draft = await getMessage(data.draftId)
  if (!draft) return

  const { WebClient } = await import('@slack/web-api')
  const slack = new WebClient((await import('../config')).config.SLACK_BOT_TOKEN)

  // Store channel + ts in private_metadata so edit submission can update the Slack message
  await slack.views.open({
    trigger_id: triggerId,
    view: {
      type: 'modal',
      callback_id: 'edit_draft_modal',
      private_metadata: JSON.stringify({
        draftId: data.draftId,
        phone: data.phone,
        channelId: channel.id,
        messageTs: message.ts,
      }),
      title: { type: 'plain_text', text: 'Edit Reply' },
      submit: { type: 'plain_text', text: 'Send Edited' },
      blocks: [
        {
          type: 'input',
          block_id: 'edited_text_block',
          element: {
            type: 'plain_text_input',
            action_id: 'edited_text',
            initial_value: draft.text,
            multiline: true,
          },
          label: { type: 'plain_text', text: 'Edit the AI draft:' },
        },
      ],
    },
  })
}

async function handleEditSubmission(
  view: any,
  user: { username: string }
) {
  const meta = JSON.parse(view.private_metadata ?? '{}')
  const editedText = view.state?.values?.edited_text_block?.edited_text?.value

  if (!meta.draftId || !editedText) return

  await updateMessageDirection(meta.draftId, 'outbound')
  await updateMessageFeedback(meta.draftId, 'edited', editedText)
  await sendWhatsAppMessage(meta.phone, editedText)

  // Update Slack message with edit confirmation
  if (meta.channelId && meta.messageTs) {
    await updateSlackApproval(meta.channelId, meta.messageTs, 'edited', user.username)
  }

  logger.info({ draftId: meta.draftId, editedBy: user.username }, 'Draft edited and sent')
}

async function handleReject(
  data: { draftId: number },
  user: { username: string },
  channel: { id: string },
  message: { ts: string }
) {
  await updateMessageDirection(data.draftId, 'discarded')
  await updateMessageFeedback(data.draftId, 'thumbs_down')
  await updateSlackApproval(channel.id, message.ts, 'rejected', user.username)

  logger.info({ draftId: data.draftId, rejectedBy: user.username }, 'Draft rejected')
}
