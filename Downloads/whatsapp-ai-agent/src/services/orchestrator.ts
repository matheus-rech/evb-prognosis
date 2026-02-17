import Anthropic from '@anthropic-ai/sdk'
import { config, ORCHESTRATOR_MODEL, RAG_TOP_K, HISTORY_LIMIT } from '../config'
import { logger } from '../utils/logger'
import { searchKnowledgeBase } from './rag'
import type { Contact, Message, OrchestratorOutput, ToneProfile } from '../types'

const anthropic = new Anthropic({
  apiKey: config.ANTHROPIC_API_KEY,
})

const TONE_INSTRUCTIONS: Record<ToneProfile, string> = {
  pt_br_direct: 'Responda em portugues brasileiro, de forma objetiva e direta. Use "voce". Sem emojis excessivos.',
  pt_br_warm: 'Responda em portugues brasileiro, de forma calorosa e atenciosa. Use "voce". Um emoji por mensagem no maximo.',
  en_us_terse: 'Reply in English. Be concise and professional. No emojis.',
  en_us_friendly: 'Reply in English. Be warm and friendly. One emoji max.',
}

function buildSystemPrompt(contact: Contact, kbContext: string): string {
  const toneInstruction = TONE_INSTRUCTIONS[contact.tone_profile]

  return `You are a business customer support assistant communicating via WhatsApp.

## Identity
- You represent the business. Never reveal you are an AI.
- Never mention Slack, internal systems, or technical infrastructure.
- Your name and the business details come from the knowledge base below.

## Tone
${toneInstruction}

## Knowledge Base Context
${kbContext || 'No specific knowledge base content available. Use general helpfulness.'}

## Rules
1. Answer based on the knowledge base when possible. If the answer is not there, say you will check and get back to them.
2. Keep replies short and WhatsApp-appropriate (1-3 paragraphs max).
3. If the customer seems upset or the question is complex/sensitive, recommend handoff.
4. If the message is clearly not a business inquiry (spam, wrong number), note that.
5. Never invent prices, policies, or product details not in the knowledge base.

## Output Format
You MUST respond with valid JSON matching this exact schema:
{
  "reply": "The message to send to the customer",
  "language": "pt-BR or en-US",
  "tone_profile_used": "${contact.tone_profile}",
  "intent": "support_request | sales_question | small_talk | complaint | need_clarification | other",
  "confidence": 0.0 to 1.0,
  "handoff_recommended": true/false,
  "unsafe_or_out_of_scope": true/false,
  "reasons": "Brief explanation of your routing decision"
}

Confidence guidelines:
- 0.9+: Direct answer from knowledge base, clear intent
- 0.7-0.9: Reasonable answer but some ambiguity
- 0.5-0.7: Unsure, partially relevant KB content
- <0.5: No relevant KB content, complex/sensitive topic`
}

function buildConversationMessages(
  inboundText: string,
  history: Message[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []

  // Add history (use config-driven limit)
  for (const msg of history.slice(-HISTORY_LIMIT)) {
    if (msg.direction === 'inbound') {
      messages.push({ role: 'user', content: msg.text })
    } else if (msg.direction === 'outbound' || msg.direction === 'human') {
      messages.push({ role: 'assistant', content: msg.text })
    }
  }

  // Add current inbound message (history is fetched BEFORE saving inbound,
  // so this is the only place the current message appears)
  messages.push({ role: 'user', content: inboundText })

  return messages
}

export async function runOrchestrator(
  contact: Contact,
  inboundText: string,
  history: Message[]
): Promise<OrchestratorOutput> {
  const startTime = Date.now()

  // 1. Retrieve KB context via RAG
  let kbContext = ''
  try {
    const chunks = await searchKnowledgeBase(inboundText, contact.language, RAG_TOP_K)
    if (chunks.length > 0) {
      kbContext = chunks
        .map((c, i) => `[${i + 1}] (${c.source_id}) ${c.text}`)
        .join('\n\n')
    }
  } catch (err) {
    logger.warn({ err }, 'RAG search failed, proceeding without KB context')
  }

  // 2. Build prompt
  const systemPrompt = buildSystemPrompt(contact, kbContext)
  const conversationMessages = buildConversationMessages(inboundText, history)

  // 3. Call Claude
  try {
    const response = await anthropic.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
    })

    const duration = Date.now() - startTime
    const rawText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')

    logger.debug({ duration, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }, 'LLM call completed')

    // 4. Parse structured output
    return parseOrchestratorOutput(rawText, contact.tone_profile)
  } catch (err) {
    logger.error({ err }, 'Orchestrator LLM call failed')

    // Return safe fallback
    return {
      reply: contact.language === 'pt-BR'
        ? 'Desculpe, estou com uma dificuldade tecnica. Um atendente vai te ajudar em breve.'
        : 'Sorry, I am experiencing a technical issue. A team member will assist you shortly.',
      language: contact.language,
      tone_profile_used: contact.tone_profile,
      intent: 'other',
      confidence: 0,
      handoff_recommended: true,
      unsafe_or_out_of_scope: false,
      reasons: 'LLM call failed, triggering human handoff',
    }
  }
}

function parseOrchestratorOutput(raw: string, fallbackTone: ToneProfile): OrchestratorOutput {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      reply: String(parsed.reply ?? ''),
      language: String(parsed.language ?? 'pt-BR'),
      tone_profile_used: parsed.tone_profile_used ?? fallbackTone,
      intent: parsed.intent ?? 'other',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence ?? 0))),
      handoff_recommended: Boolean(parsed.handoff_recommended),
      unsafe_or_out_of_scope: Boolean(parsed.unsafe_or_out_of_scope),
      reasons: String(parsed.reasons ?? ''),
    }
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 200) }, 'Failed to parse orchestrator output')

    return {
      reply: raw.slice(0, 500),
      language: 'pt-BR',
      tone_profile_used: fallbackTone,
      intent: 'other',
      confidence: 0.3,
      handoff_recommended: true,
      unsafe_or_out_of_scope: false,
      reasons: 'JSON parse failed, sending to human review',
    }
  }
}
