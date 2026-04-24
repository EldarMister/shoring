// Re-runs the production normalizer against every existing car row so that
// (a) Korean romanizations added to shared/vehicleTextFixes.js propagate to the
// legacy data, and (b) empty vehicle_class rows get the body-type fallback.
//
// DRY RUN by default. Set APPLY=1 to write changes.
//
//   DATABASE_URL=... APPLY=1 node scripts/backfill-vehicle-text-and-class.js
import dotenv from 'dotenv'
import pg from 'pg'
import { applyVehicleTitleFixes, applyTrimFixes } from '../shared/vehicleTextFixes.js'
import { resolveVehicleClassLabel } from '../shared/vehicleTaxonomy.js'

dotenv.config()

const { Pool } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing')
  process.exit(1)
}

const APPLY = String(process.env.APPLY || '').trim() === '1'
const LIMIT = Number(process.env.LIMIT || 0)

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function pickChange(before, after) {
  const b = cleanText(before)
  const a = cleanText(after)
  if (!a) return null
  if (a === b) return null
  return a
}

async function main() {
  console.log(`[backfill] APPLY=${APPLY}${LIMIT ? ` LIMIT=${LIMIT}` : ''}`)
  const { rows } = await pool.query(
    `SELECT id, name, model, trim_level, drive_type, body_type, vehicle_class
       FROM cars
       ${LIMIT > 0 ? `ORDER BY id ASC LIMIT ${LIMIT}` : 'ORDER BY id ASC'}`
  )

  const updates = []
  const stats = { name: 0, model: 0, trim_level: 0, vehicle_class: 0 }

  for (const row of rows) {
    const nextName = pickChange(row.name, applyVehicleTitleFixes(row.name))
    const nextModel = pickChange(row.model, applyVehicleTitleFixes(row.model))
    const nextTrim = pickChange(row.trim_level, applyTrimFixes(row.trim_level))

    const effectiveName = nextName ?? row.name
    const effectiveModel = nextModel ?? row.model
    const effectiveTrim = nextTrim ?? row.trim_level
    const resolvedClass = resolveVehicleClassLabel(
      row.vehicle_class || '',
      row.body_type || '',
      effectiveName || '',
      effectiveModel || '',
      effectiveTrim || '',
    )
    const currentClass = cleanText(row.vehicle_class)
    const nextClass = resolvedClass && resolvedClass !== currentClass ? resolvedClass : null

    const patch = {}
    if (nextName) { patch.name = nextName; stats.name++ }
    if (nextModel) { patch.model = nextModel; stats.model++ }
    if (nextTrim) { patch.trim_level = nextTrim; stats.trim_level++ }
    if (nextClass) { patch.vehicle_class = nextClass; stats.vehicle_class++ }

    if (Object.keys(patch).length) {
      updates.push({ id: row.id, patch, before: row })
    }
  }

  console.log(`[backfill] scanned=${rows.length} with_changes=${updates.length}`)
  console.log(`[backfill] field changes: ${JSON.stringify(stats)}`)

  // Show a few examples so operators can sanity-check before applying
  for (const u of updates.slice(0, 10)) {
    console.log('\n---\nID', u.id)
    for (const key of Object.keys(u.patch)) {
      console.log(`  ${key}:`)
      console.log(`    before: ${u.before[key] ?? ''}`)
      console.log(`    after : ${u.patch[key]}`)
    }
  }

  if (!APPLY) {
    console.log('\n[backfill] Dry run — set APPLY=1 to write changes.')
    return
  }

  console.log('\n[backfill] Applying updates...')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const chunkSize = 200
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize)
      const values = []
      const placeholders = chunk.map((u, index) => {
        const base = index * 5
        values.push(
          u.id,
          u.patch.name ?? u.before.name ?? null,
          u.patch.model ?? u.before.model ?? null,
          u.patch.trim_level ?? u.before.trim_level ?? null,
          u.patch.vehicle_class ?? u.before.vehicle_class ?? null,
        )
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
      })
      await client.query(
        `UPDATE cars AS c
           SET name = v.name,
               model = v.model,
               trim_level = v.trim_level,
               vehicle_class = v.vehicle_class,
               updated_at = NOW()
          FROM (VALUES ${placeholders.join(', ')})
               AS v(id, name, model, trim_level, vehicle_class)
          WHERE c.id = v.id::int`,
        values,
      )
      process.stdout.write(`\r[backfill] applied ${Math.min(i + chunkSize, updates.length)}/${updates.length}`)
    }
    await client.query('COMMIT')
    console.log('\n[backfill] done.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

main()
  .catch((error) => {
    console.error('backfill failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
