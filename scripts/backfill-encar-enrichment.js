import pool from '../server/db.js'
import { fetchEncarVehicleEnrichment } from '../server/lib/encarVehicle.js'
import { normalizeInteriorColorName } from '../server/lib/vehicleData.js'

const DEFAULT_CONCURRENCY = (() => {
  const raw = Number.parseInt(process.env.BACKFILL_ENRICH_CONCURRENCY || '2', 10)
  if (!Number.isFinite(raw)) return 2
  return Math.min(Math.max(raw, 1), 4)
})()

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeOptionFeatures(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((item) => cleanText(item)).filter(Boolean))].slice(0, 12)
}

function hasOptionFeatures(value) {
  return normalizeOptionFeatures(value).length > 0
}

async function ensureSchema() {
  await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS option_features TEXT[] DEFAULT '{}'`)
}

async function fetchCandidates() {
  const result = await pool.query(`
    SELECT id, encar_id, name, body_color, interior_color, option_features
    FROM cars
    WHERE encar_id IS NOT NULL
      AND encar_id != ''
      AND (
        COALESCE(BTRIM(interior_color), '') = ''
        OR COALESCE(array_length(option_features, 1), 0) = 0
      )
    ORDER BY updated_at ASC NULLS FIRST, id ASC
  `)

  return result.rows
}

async function updateCar(id, patch) {
  const fields = Object.entries(patch).filter(([, value]) => value !== undefined)
  if (!fields.length) return false

  const updates = []
  const params = []
  let index = 1

  for (const [field, value] of fields) {
    updates.push(`${field} = $${index++}`)
    params.push(value)
  }

  updates.push('updated_at = NOW()')
  params.push(id)

  await pool.query(`UPDATE cars SET ${updates.join(', ')} WHERE id = $${index}`, params)
  return true
}

async function main() {
  await ensureSchema()

  const candidates = await fetchCandidates()
  const stats = {
    checked: candidates.length,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    interior_filled: 0,
    option_features_filled: 0,
  }

  console.log(`Backfill candidates: ${stats.checked}`)
  if (!candidates.length) {
    await pool.end()
    return
  }

  let nextIndex = 0

  async function worker() {
    while (true) {
      const currentIndex = nextIndex++
      if (currentIndex >= candidates.length) return

      const row = candidates[currentIndex]

      try {
        const detail = await fetchEncarVehicleEnrichment(row.encar_id)
        const patch = {}
        const nextInterior = cleanText(detail.interior_color)
        const currentInterior = cleanText(row.interior_color)
        const normalizedCurrentInterior = normalizeInteriorColorName(currentInterior, row.body_color || '')

        if (!normalizedCurrentInterior && nextInterior) {
          patch.interior_color = nextInterior
          stats.interior_filled += 1
        }

        if (!hasOptionFeatures(row.option_features)) {
          const nextFeatures = normalizeOptionFeatures(detail.option_features)
          if (nextFeatures.length) {
            patch.option_features = nextFeatures
            stats.option_features_filled += 1
          }
        }

        if (await updateCar(row.id, patch)) {
          stats.updated += 1
        } else {
          stats.skipped += 1
        }
      } catch (error) {
        stats.errors += 1
        console.error(`Backfill error for ID ${row.id} / Encar ${row.encar_id}: ${error.message}`)
      } finally {
        stats.processed += 1
        if (stats.processed % 25 === 0 || stats.processed === stats.checked) {
          console.log(`Progress: ${stats.processed}/${stats.checked} | updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}`)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(DEFAULT_CONCURRENCY, candidates.length) }, () => worker()))

  const result = await pool.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE COALESCE(BTRIM(interior_color), '') <> '')::int AS with_interior_color,
      COUNT(*) FILTER (WHERE COALESCE(array_length(option_features, 1), 0) > 0)::int AS with_option_features
    FROM cars
  `)

  console.log('Backfill summary:', JSON.stringify(stats, null, 2))
  console.log('Catalog coverage:', JSON.stringify(result.rows[0], null, 2))

  await pool.end()
}

main().catch(async (error) => {
  console.error(error)
  try {
    await pool.end()
  } catch {
    // ignore close errors
  }
  process.exit(1)
})
