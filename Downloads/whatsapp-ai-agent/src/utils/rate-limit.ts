import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory rate limiter middleware.
 * Keys requests by IP address and enforces a sliding window.
 *
 * For multi-instance deployments, replace with Redis-based limiter.
 */
export function rateLimiter(opts: {
  windowMs: number
  maxRequests: number
  keyPrefix?: string
}) {
  const store = new Map<string, RateLimitEntry>()

  // Clean expired entries every minute
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key)
    }
  }, 60_000)

  // Allow GC to collect the timer if the process is shutting down
  cleanupInterval.unref()

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const key = `${opts.keyPrefix ?? 'rl'}:${ip}`
    const now = Date.now()

    const entry = store.get(key)

    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs })
      return next()
    }

    entry.count++

    if (entry.count > opts.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
      logger.warn({ ip, key, count: entry.count }, 'Rate limit exceeded')
      res.set('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Too many requests', retryAfter })
      return
    }

    next()
  }
}
