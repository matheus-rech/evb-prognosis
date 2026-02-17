// -- Core domain types --

export type ContactMode = 'copilot' | 'auto' | 'human_only'
export type ToneProfile = 'pt_br_direct' | 'pt_br_warm' | 'en_us_terse' | 'en_us_friendly'
export type MessageDirection = 'inbound' | 'draft' | 'outbound' | 'human' | 'discarded'
export type MessageFeedback = 'thumbs_up' | 'thumbs_down' | 'edited' | null
export type OrchestratorIntent =
  | 'support_request'
  | 'sales_question'
  | 'small_talk'
  | 'complaint'
  | 'need_clarification'
  | 'other'

export interface Contact {
  id: number
  phone: string
  name: string | null
  mode: ContactMode
  language: string
  tone_profile: ToneProfile
  is_vip: boolean
  bot_paused: boolean
  paused_at: Date | null
  last_ai_reply_at: Date | null
  created_at: Date
  updated_at: Date
}

export interface Message {
  id: number
  contact_id: number
  direction: MessageDirection
  text: string
  meta: MessageMeta
  feedback: MessageFeedback
  is_complaint: boolean
  slack_ts: string | null
  created_at: Date
}

export interface MessageMeta {
  origin?: 'ai' | 'human'
  model?: string
  confidence?: number
  original_draft?: string
  final_sent?: string
  edited_by?: string
}

export interface KbChunk {
  id: number
  source_id: string
  chunk_index: number
  language: string
  scope: string
  contact_id: number | null
  title: string | null
  text: string
  tags: string[]
  entities: Record<string, unknown> | null
  similarity?: number
}

export interface OrchestratorOutput {
  reply: string
  language: string
  tone_profile_used: ToneProfile
  intent: OrchestratorIntent
  confidence: number
  handoff_recommended: boolean
  unsafe_or_out_of_scope: boolean
  reasons: string
}

// -- WhatsApp webhook types --

export interface WhatsAppMediaInfo {
  id: string
  mime_type: string
  sha256?: string
}

export interface WhatsAppMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  image?: WhatsAppMediaInfo & { caption?: string }
  audio?: WhatsAppMediaInfo
  video?: WhatsAppMediaInfo & { caption?: string }
  document?: WhatsAppMediaInfo & { filename?: string; caption?: string }
  sticker?: WhatsAppMediaInfo
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
}

export interface WhatsAppWebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: Array<{
          profile: { name: string }
          wa_id: string
        }>
        messages?: WhatsAppMessage[]
        statuses?: Array<{
          id: string
          status: string
          timestamp: string
          recipient_id: string
        }>
      }
      field: string
    }>
  }>
}

// -- Routing decision --

export type RoutingAction = 'auto_send' | 'slack_approval' | 'human_handoff' | 'ignore'

export interface RoutingDecision {
  action: RoutingAction
  reason: string
}
