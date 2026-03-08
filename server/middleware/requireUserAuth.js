import pool from '../db.js'
import { extractBearerToken, serializeUser, verifyUserToken } from '../lib/userAuth.js'

export async function requireUserAuth(req, res, next) {
  const token = extractBearerToken(req.get('authorization'))
  if (!token) {
    return res.status(401).json({ error: 'Не авторизован' })
  }

  try {
    const payload = verifyUserToken(token)
    const userResult = await pool.query(
      'SELECT id, phone, created_at FROM users WHERE id = $1 AND phone = $2 LIMIT 1',
      [payload.id, payload.phone],
    )

    if (!userResult.rows.length) {
      return res.status(401).json({ error: 'Пользователь не найден' })
    }

    req.user = serializeUser(userResult.rows[0])
    return next()
  } catch {
    return res.status(401).json({ error: 'Сессия недействительна' })
  }
}

export default requireUserAuth
