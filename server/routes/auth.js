import express from 'express'
import pool from '../db.js'
import { getFirebaseAdminAuth } from '../lib/firebaseAdmin.js'
import {
  consumeRateLimit,
  createRateLimitStore,
  getClientIp,
  getRateLimitSnapshot,
} from '../lib/requestSecurity.js'
import requireUserAuth from '../middleware/requireUserAuth.js'
import { createUserToken, normalizePhone, serializeUser } from '../lib/userAuth.js'

const router = express.Router()
const SMS_SEND_LIMIT_MAX = 5
const SMS_SEND_LIMIT_WINDOW_MS = 15 * 60 * 1000
const smsSendPhoneRateStore = createRateLimitStore('sms-send-phone')
const smsSendIpRateStore = createRateLimitStore('sms-send-ip')

function mapFirebaseAuthError(error) {
  switch (error?.code) {
    case 'auth/argument-error':
    case 'auth/invalid-id-token':
      return { status: 400, message: 'Некорректный Firebase ID token' }
    case 'auth/id-token-expired':
      return { status: 401, message: 'Firebase-сессия истекла. Войдите снова' }
    case 'auth/user-disabled':
      return { status: 403, message: 'Аккаунт Firebase отключен' }
    default:
      return { status: 500, message: 'Не удалось проверить Firebase ID token' }
  }
}

function getAuthConfigStatus() {
  const checks = {
    jwtSecret: Boolean(String(globalThis.process?.env?.JWT_SECRET || '').trim()),
    firebaseProjectId: Boolean(String(globalThis.process?.env?.FIREBASE_PROJECT_ID || '').trim()),
    firebaseClientEmail: Boolean(String(globalThis.process?.env?.FIREBASE_CLIENT_EMAIL || '').trim()),
    firebasePrivateKey: Boolean(String(globalThis.process?.env?.FIREBASE_PRIVATE_KEY || '').trim()),
  }

  const missing = Object.entries(checks)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  return {
    ready: missing.length === 0,
    checks,
    missing,
  }
}

router.get('/status', (_req, res) => {
  return res.json(getAuthConfigStatus())
})

router.post('/sms/request', (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) {
    return res.status(400).json({ error: 'Введите корректный номер телефона' })
  }

  const ip = getClientIp(req)
  const phoneKey = `phone:${phone}`
  const ipKey = `ip:${ip}`
  const phoneSnapshot = getRateLimitSnapshot(smsSendPhoneRateStore, phoneKey, {
    windowMs: SMS_SEND_LIMIT_WINDOW_MS,
    max: SMS_SEND_LIMIT_MAX,
  })
  const ipSnapshot = getRateLimitSnapshot(smsSendIpRateStore, ipKey, {
    windowMs: SMS_SEND_LIMIT_WINDOW_MS,
    max: SMS_SEND_LIMIT_MAX,
  })
  const blockedSnapshot = [phoneSnapshot, ipSnapshot].find((snapshot) => !snapshot.allowed)

  if (blockedSnapshot) {
    const retryAfterSeconds = blockedSnapshot.retryAfterSeconds
    console.warn(`SMS_SEND_LIMIT_BLOCKED | ip=${ip} | phone=${phone} | retryAfterSeconds=${retryAfterSeconds}`)
    return res.status(429).json({
      error: 'Слишком много запросов SMS-кода. Повторите позже.',
      retryAfterSeconds,
    })
  }

  const phoneState = consumeRateLimit(smsSendPhoneRateStore, phoneKey, {
    windowMs: SMS_SEND_LIMIT_WINDOW_MS,
    max: SMS_SEND_LIMIT_MAX,
  })
  const ipState = consumeRateLimit(smsSendIpRateStore, ipKey, {
    windowMs: SMS_SEND_LIMIT_WINDOW_MS,
    max: SMS_SEND_LIMIT_MAX,
  })

  return res.json({
    ok: true,
    remaining: Math.min(phoneState.remaining, ipState.remaining),
    windowSeconds: Math.ceil(SMS_SEND_LIMIT_WINDOW_MS / 1000),
  })
})

router.post('/firebase', async (req, res) => {
  const idToken = String(req.body?.idToken || '').trim()
  if (!idToken) {
    return res.status(400).json({ error: 'Передайте Firebase ID token' })
  }

  try {
    const decodedToken = await getFirebaseAdminAuth().verifyIdToken(idToken)

    if (
      decodedToken.firebase?.sign_in_provider
      && decodedToken.firebase.sign_in_provider !== 'phone'
    ) {
      return res.status(400).json({ error: 'Поддерживается только вход по номеру телефона' })
    }

    const phone = normalizePhone(decodedToken.phone_number || req.body?.phone)
    if (!phone) {
      return res.status(400).json({ error: 'В токене Firebase отсутствует номер телефона' })
    }

    const userResult = await pool.query(
      `WITH inserted AS (
         INSERT INTO users (phone, updated_at, last_login_at)
         VALUES ($1, NOW(), NOW())
         ON CONFLICT (phone) DO NOTHING
         RETURNING id, phone, created_at, updated_at, last_login_at, TRUE AS is_new_user
       ),
       updated AS (
         UPDATE users
         SET updated_at = NOW(),
             last_login_at = NOW()
         WHERE phone = $1
           AND NOT EXISTS (SELECT 1 FROM inserted)
         RETURNING id, phone, created_at, updated_at, last_login_at, FALSE AS is_new_user
       )
       SELECT * FROM inserted
       UNION ALL
       SELECT * FROM updated
       LIMIT 1`,
      [phone],
    )

    if (!userResult.rows.length) {
      return res.status(500).json({ error: 'Не удалось создать или обновить пользователя' })
    }

    const row = userResult.rows[0]
    const user = serializeUser(row)
    const token = createUserToken(user)
    return res.json({ ok: true, token, user, isNewUser: Boolean(row.is_new_user) })
  } catch (error) {
    const mappedError = mapFirebaseAuthError(error)
    if (mappedError.status >= 500) {
      console.error('Firebase auth failed:', error.message)
    }
    return res.status(mappedError.status).json({ error: mappedError.message })
  }
})

router.get('/me', requireUserAuth, async (req, res) => {
  return res.json({ user: req.user })
})

export default router
