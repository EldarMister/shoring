import fs from 'fs'
import path from 'path'
import pg from 'pg'
import dotenv from 'dotenv'
import { BODY_TYPE_LABELS } from '../shared/vehicleTaxonomy.js'

dotenv.config()

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const APPLY = String(process.env.APPLY || '').trim() === '1'
const REPORT_PATH = String(process.env.REPORT_PATH || '').trim()

const RULE_REASONS = {
  ghost: '\u0442\u0438\u043f \u043a\u0443\u0437\u043e\u0432\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d: Ghost \u043e\u0442\u043d\u043e\u0441\u0438\u0442\u0441\u044f \u043a \u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u043c \u0441\u0435\u0434\u0430\u043d\u0430\u043c, \u0430 \u043d\u0435 \u043a \u043e\u0431\u044b\u0447\u043d\u044b\u043c \u0441\u0435\u0434\u0430\u043d\u0430\u043c',
  sf90Spider: '`Spider` \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e \u043a\u0443\u0437\u043e\u0432\u0430, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 body_type \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d \u043a\u0430\u043a \u041a\u0430\u0431\u0440\u0438\u043e\u043b\u0435\u0442',
  sf90Coupe: 'body_type \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438',
  gtc: '`GTC` \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442 \u043e\u0442\u043a\u0440\u044b\u0442\u0443\u044e \u0432\u0435\u0440\u0441\u0438\u044e \u043a\u0443\u0437\u043e\u0432\u0430, \u043f\u043e\u044d\u0442\u043e\u043c\u0443 body_type \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d \u043a\u0430\u043a \u041a\u0430\u0431\u0440\u0438\u043e\u043b\u0435\u0442',
  cullinan: '\u0442\u0438\u043f \u043a\u0443\u0437\u043e\u0432\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438 (Cullinan \u2014 \u0432\u043d\u0435\u0434\u043e\u0440\u043e\u0436\u043d\u0438\u043a)',
  spectreCoupe: '`Coupe` \u043e\u0437\u043d\u0430\u0447\u0430\u0435\u0442 \u043a\u0443\u0437\u043e\u0432 \u041a\u0443\u043f\u0435',
  lamboCoupe: '\u0442\u0438\u043f \u043a\u0443\u0437\u043e\u0432\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438 (\u0441\u043f\u043e\u0440\u0442\u043a\u0430\u0440 \u2014 \u043a\u0443\u043f\u0435)',
  x5: '\u0442\u0438\u043f \u043a\u0443\u0437\u043e\u0432\u0430 \u0443\u0442\u043e\u0447\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438 (X5 \u2014 \u043a\u0440\u043e\u0441\u0441\u043e\u0432\u0435\u0440 / \u0432\u043d\u0435\u0434\u043e\u0440\u043e\u0436\u043d\u0438\u043a)',
}

const RE_GHOST = /\bRolls-?Royce\s+Ghost(?:\s+EWB)?\b/i
const RE_CULLINAN = /\bRolls-?Royce\s+Cullinan\b/i
const RE_SPECTRE = /\bRolls-?Royce\s+Spectre\b/i
const RE_COUPe = /\bCoupe\b/i
const RE_BENTLEY_GTC = /\bBentley\s+Continental\b.*\bGTC\b/i
const RE_SF90 = /\bFerrari\s+SF90\b/i
const RE_SPIDER = /\bSpider\b/i
const RE_LAMBO_REVUELTO = /\bLamborghini\s+Revuelto\b/i
const RE_LAMBO_HURACAN_STO = /\bLamborghini\s+Huracan\b.*\bSTO\b/i
const RE_BMW_X5 = /\bBMW\s+X5\b/i

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function resolveBodyTypeUpdate(row) {
  const name = cleanText(row.name)
  const model = cleanText(row.model)
  const trim = cleanText(row.trim_level)
  const context = cleanText([name, model, trim].filter(Boolean).join(' '))
  const current = cleanText(row.body_type)

  if (!context) return null

  if (RE_GHOST.test(context) && (!current || current === BODY_TYPE_LABELS.sedan)) {
    return { value: BODY_TYPE_LABELS.executiveSedan, reason: RULE_REASONS.ghost }
  }

  if (RE_CULLINAN.test(context)) {
    return { value: BODY_TYPE_LABELS.suv, reason: RULE_REASONS.cullinan }
  }

  if (RE_SPECTRE.test(context) && RE_COUPe.test(context)) {
    return { value: BODY_TYPE_LABELS.coupe, reason: RULE_REASONS.spectreCoupe }
  }

  if (RE_BENTLEY_GTC.test(context)) {
    return { value: BODY_TYPE_LABELS.cabriolet, reason: RULE_REASONS.gtc }
  }

  if (RE_SF90.test(context)) {
    if (RE_SPIDER.test(context)) {
      return { value: BODY_TYPE_LABELS.cabriolet, reason: RULE_REASONS.sf90Spider }
    }
    if (!current) {
      return { value: BODY_TYPE_LABELS.coupe, reason: RULE_REASONS.sf90Coupe }
    }
  }

  if (RE_LAMBO_REVUELTO.test(context) || RE_LAMBO_HURACAN_STO.test(context)) {
    return { value: BODY_TYPE_LABELS.coupe, reason: RULE_REASONS.lamboCoupe }
  }

  if (RE_BMW_X5.test(context)) {
    return { value: BODY_TYPE_LABELS.suv, reason: RULE_REASONS.x5 }
  }

  return null
}

function displayBodyType(value) {
  const text = cleanText(value)
  return text || '\u043f\u0443\u0441\u0442\u043e'
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, name, model, trim_level, body_type
    FROM cars
    ORDER BY id ASC
  `)

  const changes = []

  for (const row of rows) {
    const result = resolveBodyTypeUpdate(row)
    if (!result) continue
    if (cleanText(row.body_type) === result.value) continue

    changes.push({
      id: row.id,
      name: row.name || '',
      before: displayBodyType(row.body_type),
      after: result.value,
      reason: result.reason,
    })
  }

  if (APPLY && changes.length) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const chunkSize = 200
      for (let i = 0; i < changes.length; i += chunkSize) {
        const chunk = changes.slice(i, i + chunkSize)
        const values = []
        const placeholders = chunk.map((change, index) => {
          const base = index * 2
          values.push(change.id, change.after)
          return `($${base + 1}, $${base + 2})`
        })

        await client.query(
          `UPDATE cars AS c
           SET body_type = v.body_type,
               updated_at = NOW()
           FROM (VALUES ${placeholders.join(', ')}) AS v(id, body_type)
           WHERE c.id = v.id::int`,
          values,
        )
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  if (REPORT_PATH) {
    const lines = []
    for (const change of changes) {
      lines.push(`ID ${change.id}`)
      lines.push('')
      lines.push('\u0411\u044b\u043b\u043e:')
      lines.push(`name: ${change.name}`)
      lines.push(`body_type: ${change.before}`)
      lines.push('')
      lines.push('\u0414\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c:')
      lines.push(`name: ${change.name}`)
      lines.push(`body_type: ${change.after}`)
      lines.push('')
      lines.push('\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f:')
      lines.push(`- ${change.reason}`)
      lines.push('')
    }
    const dir = path.dirname(REPORT_PATH)
    await fs.promises.mkdir(dir, { recursive: true }).catch(() => {})
    await fs.promises.writeFile(REPORT_PATH, lines.join('\n'), 'utf8')
  }

  console.log(JSON.stringify({
    applied: APPLY,
    total: rows.length,
    changed: changes.length,
    reportPath: REPORT_PATH || null,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('fix-body-type-rules failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
