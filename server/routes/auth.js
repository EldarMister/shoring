import express from 'express'
import pool from '../db.js'
import { getFirebaseAdminAuth } from '../lib/firebaseAdmin.js'
import requireUserAuth from '../middleware/requireUserAuth.js'
import { createUserToken, normalizePhone, serializeUser } from '../lib/userAuth.js'

const router = express.Router()

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
      `INSERT INTO users (phone)
       VALUES ($1)
       ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
       RETURNING id, phone, created_at`,
      [phone],
    )

    const user = serializeUser(userResult.rows[0])
    const token = createUserToken(user)
    return res.json({ ok: true, token, user })
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
