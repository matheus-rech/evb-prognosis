import { query, queryOne } from '../db/pool'
import { logger } from '../utils/logger'
import type { Contact } from '../types'

export async function getOrCreateContact(
  phone: string,
  name: string | null
): Promise<Contact> {
  // Try to find existing contact
  const existing = await queryOne<Contact>(
    'SELECT * FROM contacts WHERE phone = $1',
    [phone]
  )

  if (existing) {
    // Update name if we got one and it changed
    if (name && name !== existing.name) {
      await query(
        'UPDATE contacts SET name = $1 WHERE id = $2',
        [name, existing.id]
      )
      existing.name = name
    }
    return existing
  }

  // Create new contact (defaults: copilot mode, pt-BR, warm tone)
  const [newContact] = await query<Contact>(
    `INSERT INTO contacts (phone, name, mode, language, tone_profile)
     VALUES ($1, $2, 'copilot', 'pt-BR', 'pt_br_warm')
     RETURNING *`,
    [phone, name]
  )

  logger.info({ contactId: newContact.id, phone }, 'New contact created')
  return newContact
}

export async function getContact(id: number): Promise<Contact | null> {
  return queryOne<Contact>('SELECT * FROM contacts WHERE id = $1', [id])
}

export async function getContactByPhone(phone: string): Promise<Contact | null> {
  return queryOne<Contact>('SELECT * FROM contacts WHERE phone = $1', [phone])
}

export async function updateContactMode(
  contactId: number,
  mode: Contact['mode'],
  reason: string
): Promise<void> {
  const contact = await getContact(contactId)
  if (!contact) return

  await query(
    'UPDATE contacts SET mode = $1 WHERE id = $2',
    [mode, contactId]
  )

  await query(
    `INSERT INTO mode_change_log (contact_id, from_mode, to_mode, reason)
     VALUES ($1, $2, $3, $4)`,
    [contactId, contact.mode, mode, reason]
  )

  logger.info({ contactId, from: contact.mode, to: mode, reason }, 'Contact mode changed')
}

export async function pauseBot(contactId: number): Promise<void> {
  await query(
    'UPDATE contacts SET bot_paused = TRUE, paused_at = NOW() WHERE id = $1',
    [contactId]
  )
}

export async function resumeBot(contactId: number): Promise<void> {
  await query(
    'UPDATE contacts SET bot_paused = FALSE, paused_at = NULL WHERE id = $1',
    [contactId]
  )
}
