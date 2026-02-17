import { Router, Request, Response } from 'express'
import { query, queryOne } from '../db/pool'
import { logger } from '../utils/logger'

export const adminRouter = Router()

/**
 * GET /admin/stats -- Overview statistics
 */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [stats] = await query<{
      total_contacts: string
      active_contacts: string
      total_messages: string
      ai_messages: string
      pending_drafts: string
      thumbs_up: string
      thumbs_down: string
      edited: string
    }>(
      `SELECT
         (SELECT COUNT(*) FROM contacts) AS total_contacts,
         (SELECT COUNT(*) FROM contacts WHERE bot_paused = FALSE) AS active_contacts,
         (SELECT COUNT(*) FROM messages) AS total_messages,
         (SELECT COUNT(*) FROM messages WHERE (meta->>'origin') = 'ai') AS ai_messages,
         (SELECT COUNT(*) FROM messages WHERE direction = 'draft') AS pending_drafts,
         (SELECT COUNT(*) FROM messages WHERE feedback = 'thumbs_up') AS thumbs_up,
         (SELECT COUNT(*) FROM messages WHERE feedback = 'thumbs_down') AS thumbs_down,
         (SELECT COUNT(*) FROM messages WHERE feedback = 'edited') AS edited`
    )

    res.json({
      contacts: {
        total: parseInt(stats.total_contacts, 10),
        active: parseInt(stats.active_contacts, 10),
      },
      messages: {
        total: parseInt(stats.total_messages, 10),
        ai_generated: parseInt(stats.ai_messages, 10),
        pending_drafts: parseInt(stats.pending_drafts, 10),
      },
      feedback: {
        thumbs_up: parseInt(stats.thumbs_up, 10),
        thumbs_down: parseInt(stats.thumbs_down, 10),
        edited: parseInt(stats.edited, 10),
      },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch admin stats')
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /admin/contacts -- List all contacts with pagination
 */
adminRouter.get('/contacts', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 100)
  const offset = parseInt(String(req.query.offset ?? '0'), 10)

  try {
    const contacts = await query(
      `SELECT id, phone, name, mode, language, tone_profile, is_vip, bot_paused, last_ai_reply_at, created_at
       FROM contacts
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) AS count FROM contacts')

    res.json({
      contacts,
      pagination: { total: parseInt(count, 10), limit, offset },
    })
  } catch (err) {
    logger.error({ err }, 'Failed to fetch contacts')
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * GET /admin/contact/:id/messages -- Message history for a contact
 */
adminRouter.get('/contact/:id/messages', async (req: Request, res: Response) => {
  const contactId = parseInt(req.params.id, 10)
  if (isNaN(contactId)) {
    res.status(400).json({ error: 'Invalid contact ID' })
    return
  }

  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10), 200)
  const offset = parseInt(String(req.query.offset ?? '0'), 10)

  try {
    const contact = await queryOne('SELECT * FROM contacts WHERE id = $1', [contactId])
    if (!contact) {
      res.status(404).json({ error: 'Contact not found' })
      return
    }

    const messages = await query(
      `SELECT id, direction, text, meta, feedback, is_complaint, slack_ts, created_at
       FROM messages
       WHERE contact_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [contactId, limit, offset]
    )

    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM messages WHERE contact_id = $1',
      [contactId]
    )

    res.json({
      contact,
      messages,
      pagination: { total: parseInt(count, 10), limit, offset },
    })
  } catch (err) {
    logger.error({ err, contactId }, 'Failed to fetch contact messages')
    res.status(500).json({ error: 'Internal server error' })
  }
})
