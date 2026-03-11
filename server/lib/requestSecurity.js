const DEFAULT_PRUNE_INTERVAL_MS = 60 * 1000

function normalizeIp(rawValue) {
  const raw = String(rawValue || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean)

  if (!raw) return 'unknown'
  if (raw.startsWith('::ffff:')) return raw.slice(7)
  return raw
}

function pruneExpiredEntries(store, now = Date.now()) {
  const entries = store?.entries
  if (!(entries instanceof Map)) return
  if (store.lastPrunedAt && (now - store.lastPrunedAt) < DEFAULT_PRUNE_INTERVAL_MS && entries.size < 5000) {
    return
  }

  for (const [key, value] of entries.entries()) {
    if (!value?.resetAt || value.resetAt <= now) {
      entries.delete(key)
    }
  }

  store.lastPrunedAt = now
}

export function getClientIp(req) {
  const forwarded = normalizeIp(req.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'])
  if (forwarded !== 'unknown') return forwarded
  return normalizeIp(req.ip || req.socket?.remoteAddress)
}

export function applyBasicSecurityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  next()
}

export function createRateLimitStore(name = 'default') {
  return {
    name,
    entries: new Map(),
    lastPrunedAt: 0,
  }
}

export function getRateLimitSnapshot(store, key, { windowMs, max, now = Date.now() }) {
  pruneExpiredEntries(store, now)

  const entry = store?.entries?.get(key)
  const resetAt = entry?.resetAt && entry.resetAt > now ? entry.resetAt : (now + windowMs)
  const count = entry?.resetAt && entry.resetAt > now ? Number(entry.count || 0) : 0
  const allowed = count < max
  const retryAfterSeconds = allowed ? 0 : Math.max(0, Math.ceil((resetAt - now) / 1000))

  return {
    allowed,
    count,
    remaining: Math.max(0, max - count),
    retryAfterSeconds,
    resetAt,
  }
}

export function consumeRateLimit(store, key, { windowMs, max, now = Date.now() }) {
  const snapshot = getRateLimitSnapshot(store, key, { windowMs, max, now })
  const nextCount = snapshot.count + 1

  store.entries.set(key, {
    count: nextCount,
    resetAt: snapshot.resetAt,
  })

  return {
    allowed: nextCount <= max,
    count: nextCount,
    remaining: Math.max(0, max - nextCount),
    retryAfterSeconds: nextCount <= max ? 0 : Math.max(0, Math.ceil((snapshot.resetAt - now) / 1000)),
    resetAt: snapshot.resetAt,
  }
}

export function createRateLimitMiddleware({
  store = createRateLimitStore('api'),
  windowMs,
  max,
  keyFn = getClientIp,
  message = 'Слишком много запросов. Повторите позже.',
  skip = null,
  logLabel = 'RATE_LIMIT',
}) {
  return (req, res, next) => {
    if (typeof skip === 'function' && skip(req)) {
      return next()
    }

    const key = String(keyFn(req) || 'unknown')
    const result = consumeRateLimit(store, key, { windowMs, max })

    res.setHeader('X-RateLimit-Limit', String(max))
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)))

    if (result.allowed) {
      return next()
    }

    res.setHeader('Retry-After', String(result.retryAfterSeconds))
    console.warn(`${logLabel} | key=${key} | retryAfterSeconds=${result.retryAfterSeconds}`)
    return res.status(429).json({
      error: message,
      retryAfterSeconds: result.retryAfterSeconds,
    })
  }
}

export function sendSafeApiError(req, res, error, fallbackMessage = 'Ошибка сервера') {
  const status = Number(error?.status || error?.statusCode) || 500
  const responseStatus = status >= 400 && status < 600 ? status : 500
  const message = responseStatus >= 500 ? fallbackMessage : (error?.message || fallbackMessage)
  console.error(`API_ERROR | ${req.method} ${req.originalUrl} |`, error?.stack || error?.message || error)
  return res.status(responseStatus).json({ error: message })
}
