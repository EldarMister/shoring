import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import pg from 'pg'
import { normalizeBodyTypeLabel, BODY_TYPE_LABELS } from '../shared/vehicleTaxonomy.js'

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

const NAME_REPLACEMENTS = [
  [/\bKeompaetisyeon\b/gi, 'Competition'],
  [/\bKabonpaekiji\b/gi, 'Carbon Package'],
  [/\bIndibijueol\b/gi, 'Individual'],
  [/\biPeopomeonseu\b/gi, 'iPerformance'],
  [/\bPeurogeuresibeu\b/gi, 'Progressive'],
  [/\bMaenyupaekcheo\b/gi, 'MANUFAKTUR'],
  [/\bOnrain\b/gi, 'Online'],
  [/\b4Mosyeon\b/gi, '4Motion'],
  [/\bAlrwireu\b/gi, 'Allure'],
  [/\bSeomit\b/gi, 'Summit'],
  [/\bSeupideu\b/gi, 'Speed'],
  [/\bTeuropeo\b/gi, 'Trofeo'],
  [/\be-?Sipeuteo\b/gi, 'e-Shift'],
  [/\bIntenseu\b/gi, 'Intense'],
  [/\bPeuraim\b/gi, 'Prime'],
  [/\bMaseuteojeu\b/gi, 'Masters'],
  [/\bSeuteisyeon\s+Wagon\b/gi, 'Station Wagon'],
]

const MANUAL_REVIEW_RULES = [
  { pattern: /\bEorinibohocha\b/i, label: 'Eorinibohocha' },
  { pattern: /\bPeibeodeu\b/i, label: 'Peibeodeu' },
  { pattern: /\bRedeo\b/i, label: 'Redeo' },
  { pattern: /\bRedeupit\b/i, label: 'Redeupit' },
  { pattern: /\bPeulreokseu\b/i, label: 'Peulreokseu' },
  { pattern: /\bIkseuteurim(?:-X)?\b/i, label: 'Ikseuteurim' },
]

const EXPLICIT_AWD_RE = /\b(?:xDrive|quattro|AWD|4MATIC|ALL4)\b/i
const EXPLICIT_4WD_RE = /\b4WD\b/i

const BUSINESS_SEDAN_MODEL_RE = [
  /\bAudi\s+A6\b/i,
  /\bMercedes[-\s]?Benz\s+E-Class\b/i,
  /\bBMW\s+5\s*Series\b/i,
  /\bHyundai\s+Grandeur\b/i,
  /\bGenesis\s+G80\b/i,
  /\bKia\s+K7\b/i,
  /\bKia\s+K8\b/i,
  /\bVolvo\s+S90\b/i,
  /\bLexus\s+ES\b/i,
]

const EXECUTIVE_SEDAN_MODEL_RE = [
  /\bBMW\s+7\s*Series\b/i,
  /\bMercedes[-\s]?Benz\s+S-Class\b/i,
  /\bAudi\s+A8\b/i,
  /\bGenesis\s+G90\b/i,
  /\bLexus\s+LS\b/i,
]

const BODY_TYPE_MODEL_OVERRIDES = [
  { pattern: /\bKia\s+RAY\b/i, body: BODY_TYPE_LABELS.minivan },
  { pattern: /\bPorsche\s+Taycan\b/i, body: BODY_TYPE_LABELS.liftback },
  { pattern: /\bAudi\s+e-?tron\s+GT\b/i, body: BODY_TYPE_LABELS.liftback },
  { pattern: /\bAudi\s+RS7\b/i, body: BODY_TYPE_LABELS.liftback },
  { pattern: /\bAudi\s+S7\b/i, body: BODY_TYPE_LABELS.liftback },
  { pattern: /\bPorsche\s+718\b/i, body: BODY_TYPE_LABELS.coupe },
  { pattern: /\bJaguar\s+F-?TYPE\b/i, body: BODY_TYPE_LABELS.coupe },
  { pattern: /\bMaserati\s+MC20\b/i, body: BODY_TYPE_LABELS.coupe },
  { pattern: /\bRolls-?Royce\s+Wraith\b/i, body: BODY_TYPE_LABELS.coupe },
  { pattern: /\bHyundai\s+Solati\b/i, body: BODY_TYPE_LABELS.minivan },
  { pattern: /\bMercedes[-\s]?Benz\s+V-Class\b/i, body: BODY_TYPE_LABELS.minivan },
  { pattern: /\bDodge\s+Ram\s+Pick\s+Up\b/i, body: BODY_TYPE_LABELS.pickup },
  { pattern: /\bGMC\s+Sierra\b/i, body: BODY_TYPE_LABELS.pickup },
  { pattern: /\bChevrolet\s+Colorado\b/i, body: BODY_TYPE_LABELS.pickup },
  { pattern: /\bSsangYong\s+Musso\b/i, body: BODY_TYPE_LABELS.pickup },
  { pattern: /\bSsangYong\s+Rexton\b/i, body: BODY_TYPE_LABELS.suv },
  { pattern: /\bSuzuki\s+Jimny\b/i, body: BODY_TYPE_LABELS.suv },
  { pattern: /\bIneos\s+Grenadier\b.*\bStation\s+Wagon\b/i, body: BODY_TYPE_LABELS.suv },
]


function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function applyReplacements(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const original = String(value)
  let text = original
  let changed = false
  for (const [pattern, replacement] of NAME_REPLACEMENTS) {
    const next = text.replace(pattern, replacement)
    if (next !== text) changed = true
    text = next
  }
  return changed ? cleanText(text) : value
}

function getManualReviewMatches(text) {
  const value = String(text || '')
  return MANUAL_REVIEW_RULES.filter((rule) => rule.pattern.test(value)).map((rule) => rule.label)
}

function resolveDriveUpdate(row) {
  const current = cleanText(row.drive_type)
  const combined = cleanText([row.name, row.model, row.trim_level].filter(Boolean).join(' '))

  if (EXPLICIT_4WD_RE.test(combined)) {
    return current === '\u041f\u043e\u043b\u043d\u044b\u0439 (4WD)' ? current : '\u041f\u043e\u043b\u043d\u044b\u0439 (4WD)'
  }
  if (EXPLICIT_AWD_RE.test(combined)) {
    return current === '\u041f\u043e\u043b\u043d\u044b\u0439 (AWD)' ? current : '\u041f\u043e\u043b\u043d\u044b\u0439 (AWD)'
  }

  return current
}

function resolveBodyTypeUpdate(row, nextName, nextModel, nextTrim) {
  const rawBody = cleanText(row.body_type)
  const normalizedBody = normalizeBodyTypeLabel(rawBody)
  const context = cleanText([nextName || row.name || '', nextModel || row.model || '', nextTrim || row.trim_level || ''].join(' '))
  const isExecutive = EXECUTIVE_SEDAN_MODEL_RE.some((pattern) => pattern.test(context))
  const isBusiness = BUSINESS_SEDAN_MODEL_RE.some((pattern) => pattern.test(context))

  for (const rule of BODY_TYPE_MODEL_OVERRIDES) {
    if (rule.pattern.test(context)) {
      return { value: rule.body, reason: 'model-override' }
    }
  }

  if (normalizedBody === BODY_TYPE_LABELS.executiveSedan) {
    if (isExecutive) return { value: BODY_TYPE_LABELS.executiveSedan, reason: null }
    if (isBusiness) return { value: BODY_TYPE_LABELS.businessSedan, reason: 'business-sedan' }
    return { value: BODY_TYPE_LABELS.sedan, reason: 'model-override' }
  }

  if (normalizedBody === BODY_TYPE_LABELS.businessSedan) {
    if (isBusiness) return { value: BODY_TYPE_LABELS.businessSedan, reason: null }
    if (isExecutive) return { value: BODY_TYPE_LABELS.executiveSedan, reason: 'executive-sedan' }
    return { value: BODY_TYPE_LABELS.sedan, reason: 'model-override' }
  }

  if (normalizedBody === BODY_TYPE_LABELS.sedan) {
    if (isExecutive) {
      return { value: BODY_TYPE_LABELS.executiveSedan, reason: 'executive-sedan' }
    }
    if (isBusiness) {
      return { value: BODY_TYPE_LABELS.businessSedan, reason: 'business-sedan' }
    }
  }

  return { value: row.body_type, reason: null }
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, name, model, trim_level, drive_type, body_type, vehicle_class
    FROM cars
    ORDER BY id ASC
  `)

  const changes = []
  const manualReviews = []

  for (const row of rows) {
    const reviewMatches = getManualReviewMatches([row.name, row.model, row.trim_level].filter(Boolean).join(' '))
    const nextName = reviewMatches.length ? row.name : applyReplacements(row.name)
    const nextModel = reviewMatches.length ? row.model : applyReplacements(row.model)
    const nextTrim = reviewMatches.length ? row.trim_level : applyReplacements(row.trim_level)

    const nextDrive = resolveDriveUpdate(row)
    const bodyUpdate = resolveBodyTypeUpdate(row, nextName, nextModel, nextTrim)
    const nextBody = bodyUpdate.value

    const patch = {}
    if (nextName !== row.name) patch.name = nextName
    if (nextModel !== row.model) patch.model = nextModel
    if (nextTrim !== row.trim_level) patch.trim_level = nextTrim
    if (nextDrive !== row.drive_type) patch.drive_type = nextDrive
    if (nextBody !== row.body_type) patch.body_type = nextBody

    if (Object.keys(patch).length) {
      changes.push({
        id: row.id,
        before: {
          name: row.name,
          model: row.model,
          trim_level: row.trim_level,
          drive_type: row.drive_type,
          body_type: row.body_type,
          vehicle_class: row.vehicle_class,
        },
        after: {
          name: patch.name ?? row.name,
          model: patch.model ?? row.model,
          trim_level: patch.trim_level ?? row.trim_level,
          drive_type: patch.drive_type ?? row.drive_type,
          body_type: patch.body_type ?? row.body_type,
        },
        patch,
        bodyTypeReason: bodyUpdate.reason,
      })
    }

    if (reviewMatches.length) {
      manualReviews.push({
        id: row.id,
        name: row.name,
        matches: reviewMatches,
      })
    }
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
          const base = index * 6
          values.push(
            change.id,
            change.after.name ?? null,
            change.after.model ?? null,
            change.after.trim_level ?? null,
            change.after.drive_type ?? null,
            change.after.body_type ?? null,
          )
          return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`
        })

        await client.query(
          `UPDATE cars AS c
           SET name = v.name,
               model = v.model,
               trim_level = v.trim_level,
               drive_type = v.drive_type,
               body_type = v.body_type,
               updated_at = NOW()
           FROM (VALUES ${placeholders.join(', ')}) AS v(id, name, model, trim_level, drive_type, body_type)
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
      const before = change.before
      const after = change.after
      const changedFields = Object.keys(change.patch)

      lines.push(`ID ${change.id}`)
      lines.push('')
      lines.push('\u0411\u044b\u043b\u043e:')
      for (const field of changedFields) {
        lines.push(`${field}: ${before[field] ?? ''}`)
      }
      lines.push('')
      lines.push('\u0414\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c:')
      for (const field of changedFields) {
        lines.push(`${field}: ${after[field] ?? ''}`)
      }
      lines.push('')
      lines.push('\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f:')
      for (const field of changedFields) {
        if (field === 'body_type') {
          if (change.bodyTypeReason === 'business-sedan') {
            lines.push('- body_type \u0443\u0442\u043e\u0447\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438 (\u0431\u0438\u0437\u043d\u0435\u0441-\u0441\u0435\u0434\u0430\u043d)')
          } else if (change.bodyTypeReason === 'executive-sedan') {
            lines.push('- body_type \u0443\u0442\u043e\u0447\u043d\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438 (\u043f\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043b\u044c\u0441\u043a\u0438\u0439 \u0441\u0435\u0434\u0430\u043d)')
          } else {
            lines.push('- body_type \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043f\u043e \u043c\u043e\u0434\u0435\u043b\u0438')
          }
        } else if (field === 'drive_type') {
          lines.push('- drive_type \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d \u043f\u043e \u044f\u0432\u043d\u043e\u043c\u0443 \u043c\u0430\u0440\u043a\u0435\u0440\u0443 \u0432 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0438 / \u043c\u043e\u0434\u0435\u043b\u0438')
        } else if (field === 'name' || field === 'model' || field === 'trim_level') {
          lines.push('- \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0430 \u043a\u043e\u0440\u044f\u0432\u0430\u044f \u0442\u0440\u0430\u043d\u0441\u043b\u0438\u0442\u0435\u0440\u0430\u0446\u0438\u044f / \u043e\u043f\u0435\u0447\u0430\u0442\u043a\u0430')
        } else {
          lines.push(`- ${field} \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u0435\u043d`)
        }
      }
      lines.push('')
    }

    for (const review of manualReviews) {
      lines.push(`ID ${review.id}`)
      lines.push('')
      lines.push('\u0411\u044b\u043b\u043e:')
      lines.push(`name: ${review.name ?? ''}`)
      lines.push('')
      lines.push('\u0421\u0442\u0430\u0442\u0443\u0441:')
      lines.push('manual review')
      lines.push('')
      lines.push('\u041f\u0440\u0438\u0447\u0438\u043d\u0430:')
      lines.push('- \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u043e\u0445\u043e\u0436\u0435 \u043d\u0430 \u043a\u043e\u0440\u0435\u0439\u0441\u043a\u0443\u044e \u0440\u043e\u043c\u0430\u043d\u0438\u0437\u0430\u0446\u0438\u044e, \u043d\u043e \u0431\u0435\u0437 \u0432\u044b\u0441\u043e\u043a\u043e\u0439 \u0443\u0432\u0435\u0440\u0435\u043d\u043d\u043e\u0441\u0442\u0438 \u043d\u0435\u043b\u044c\u0437\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u0438\u0441\u043f\u0440\u0430\u0432\u043b\u044f\u0442\u044c')
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
    console.error('fix-car-fields failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
