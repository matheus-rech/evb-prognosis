import express from 'express'
import { config } from './config'
import { logger } from './utils/logger'
import { healthCheck } from './db/pool'
import { rateLimiter } from './utils/rate-limit'
import { whatsappRouter } from './routes/whatsapp'
import { slackRouter } from './routes/slack'
import { adminRouter } from './routes/admin'

const app = express()

// Parse JSON body (raw body also needed for webhook signature verification)
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf
  }
}))

// Slack sends interactions as URL-encoded form data
app.use(express.urlencoded({ extended: true }))

// Health check (no rate limiting)
app.get('/health', async (_req, res) => {
  const dbOk = await healthCheck()
  const status = dbOk ? 200 : 503
  res.status(status).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  })
})

// WhatsApp webhook -- generous limit (Meta sends batches)
app.use('/webhook', rateLimiter({ windowMs: 60_000, maxRequests: 120, keyPrefix: 'wh' }), whatsappRouter)

// Slack events and interactions
app.use('/slack', rateLimiter({ windowMs: 60_000, maxRequests: 60, keyPrefix: 'sl' }), slackRouter)

// Admin routes -- tighter limit
app.use('/admin', rateLimiter({ windowMs: 60_000, maxRequests: 30, keyPrefix: 'ad' }), adminRouter)

// Start server
app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server started')
})

export default app
