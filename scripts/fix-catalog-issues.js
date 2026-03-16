import pool from '../server/db.js'
import { normalizeCarTextFields } from '../server/lib/carRecordNormalization.js'
import { fetchEncarVehicleDetail } from '../server/lib/encarVehicle.js'
import { computePricing, getExchangeRateSnapshot } from '../server/lib/exchangeRate.js'
import { runCarTextBackfill } from '../server/lib/carTextBackfill.js'
import { getPricingSettings, resolveVehicleFees } from '../server/lib/pricingSettings.js'
import { hasHangul } from '../server/scraper/translator.js'
import { normalizeVin } from '../server/lib/vin.js'

const UNIQUE_VIN_INDEX_SQL = `
  CREATE UNIQUE INDEX IF NOT EXISTS idx_cars_vin_unique
    ON cars (UPPER(BTRIM(vin)))
    WHERE vin IS NOT NULL
      AND UPPER(BTRIM(vin)) ~ '^[A-HJ-NPR-Z0-9]{17}$'
`

function isBlank(value) {
  return !String(value || '').trim()
}

function buildPricingPatch(row, exchangeSnapshot, pricingSettings) {
  const fees = resolveVehicleFees(row, pricingSettings)
  const pricing = computePricing({
    priceKrw: row.price_krw,
    commission: fees.commission,
    delivery: fees.delivery,
    loading: fees.loading,
    unloading: fees.unloading,
    storage: fees.storage,
  }, exchangeSnapshot)

  return {
    commission: fees.commission,
    delivery: fees.delivery,
    delivery_profile_code: fees.delivery_profile_code || null,
    loading: fees.loading,
    unloading: fees.unloading,
    storage: fees.storage,
    price_usd: pricing.price_usd,
    vat_refund: pricing.vat_refund,
    total: pricing.total,
  }
}

async function findDuplicateVinGroups() {
  const result = await pool.query(`
    SELECT UPPER(BTRIM(vin)) AS vin, COUNT(*)::int AS count
    FROM cars
    WHERE vin IS NOT NULL
      AND UPPER(BTRIM(vin)) ~ '^[A-HJ-NPR-Z0-9]{17}$'
    GROUP BY 1
    HAVING COUNT(*) > 1
    ORDER BY 1
  `)

  return result.rows
}

async function deleteDuplicateVins() {
  const duplicateGroups = await findDuplicateVinGroups()
  let deleted = 0

  for (const group of duplicateGroups) {
    const rows = await pool.query(`
      SELECT
        c.id,
        c.encar_id,
        c.price_krw,
        c.total,
        c.body_color,
        c.trim_level,
        c.location,
        c.name,
        c.updated_at,
        c.created_at,
        COALESCE(img.image_count, 0) AS image_count,
        (
          CASE WHEN COALESCE(c.price_krw, 0) > 0 THEN 3 ELSE 0 END +
          CASE WHEN COALESCE(c.total, 0) > 0 THEN 3 ELSE 0 END +
          CASE WHEN COALESCE(BTRIM(c.body_color), '') <> '' THEN 2 ELSE 0 END +
          CASE WHEN COALESCE(BTRIM(c.trim_level), '') <> '' THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(BTRIM(c.location), '') <> '' THEN 1 ELSE 0 END +
          CASE WHEN COALESCE(BTRIM(c.name), '') <> '' THEN 1 ELSE 0 END +
          COALESCE(img.image_count, 0)
        ) AS score
      FROM cars c
      LEFT JOIN (
        SELECT car_id, COUNT(*)::int AS image_count
        FROM car_images
        GROUP BY car_id
      ) img ON img.car_id = c.id
      WHERE UPPER(BTRIM(c.vin)) = $1
      ORDER BY score DESC, c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC
    `, [group.vin])

    const [keeper, ...duplicates] = rows.rows
    if (!keeper || !duplicates.length) continue

    const duplicateIds = duplicates.map((row) => row.id)
    await pool.query('DELETE FROM cars WHERE id = ANY($1::int[])', [duplicateIds])
    deleted += duplicateIds.length

    console.log(`Removed VIN duplicates for ${group.vin}: kept #${keeper.id}, deleted ${duplicateIds.join(', ')}`)
  }

  return {
    groups: duplicateGroups.length,
    deleted,
  }
}

async function repairTechnicalRows() {
  const exchangeSnapshot = await getExchangeRateSnapshot()
  const pricingSettings = await getPricingSettings()
  const rows = await pool.query(`
    SELECT
      id,
      encar_id,
      name,
      model,
      trim_level,
      body_color,
      interior_color,
      location,
      vin,
      year,
      mileage,
      price_krw,
      price_usd,
      fuel_type,
      transmission,
      drive_type,
      body_type,
      vehicle_class,
      commission,
      delivery,
      delivery_profile_code,
      loading,
      unloading,
      storage,
      pricing_locked,
      vat_refund,
      total
    FROM cars
    ORDER BY id ASC
  `)

  const summary = {
    checked: rows.rows.length,
    updated: 0,
    deleted_invalid: 0,
    unresolved: 0,
    detail_fetched: 0,
    detail_failed: 0,
    fields: {
      name: 0,
      model: 0,
      trim_level: 0,
      body_color: 0,
      interior_color: 0,
      location: 0,
      vin: 0,
      price_krw: 0,
      price_usd: 0,
      commission: 0,
      delivery: 0,
      delivery_profile_code: 0,
      loading: 0,
      unloading: 0,
      storage: 0,
      vat_refund: 0,
      total: 0,
      fuel_type: 0,
      transmission: 0,
      drive_type: 0,
      body_type: 0,
      vehicle_class: 0,
    },
  }

  for (const row of rows.rows) {
    const needsLiveFix = (
      hasHangul(row.name) ||
      hasHangul(row.model) ||
      hasHangul(row.location) ||
      Number(row.price_krw || 0) <= 0 ||
      Number(row.total || 0) <= 0 ||
      isBlank(row.body_color)
    )

    const patch = {}
    const normalizedVin = normalizeVin(row.vin)
    if ((row.vin || '') !== normalizedVin) patch.vin = normalizedVin || null

    if (needsLiveFix && row.encar_id) {
      try {
        const detail = await fetchEncarVehicleDetail(row.encar_id)
        summary.detail_fetched += 1

        if (detail.name) patch.name = detail.name
        if (detail.model) patch.model = detail.model
        if (detail.trim_level) patch.trim_level = detail.trim_level
        if (detail.body_color) patch.body_color = detail.body_color
        if (detail.interior_color) patch.interior_color = detail.interior_color
        if (detail.location) patch.location = detail.location
        if (detail.vin) patch.vin = normalizeVin(detail.vin)
        if (Number(detail.price_krw) > 0) patch.price_krw = Number(detail.price_krw)
        if (detail.fuel_type) patch.fuel_type = detail.fuel_type
        if (detail.transmission) patch.transmission = detail.transmission
        if (detail.drive_type) patch.drive_type = detail.drive_type
        if (detail.body_type) patch.body_type = detail.body_type
        if (detail.vehicle_class) patch.vehicle_class = detail.vehicle_class
      } catch {
        summary.detail_failed += 1
      }
    }

    const currentForText = {
      name: patch.name ?? row.name,
      model: patch.model ?? row.model,
      trim_level: patch.trim_level ?? row.trim_level,
      drive_type: patch.drive_type ?? row.drive_type,
      body_type: patch.body_type ?? row.body_type,
      vehicle_class: patch.vehicle_class ?? row.vehicle_class,
      body_color: patch.body_color ?? row.body_color,
      interior_color: patch.interior_color ?? row.interior_color,
      location: patch.location ?? row.location,
    }
    const normalizedText = normalizeCarTextFields(currentForText)
    for (const field of ['name', 'model', 'trim_level', 'drive_type', 'body_type', 'vehicle_class', 'body_color', 'interior_color', 'location']) {
      if (normalizedText[field] !== undefined) {
        patch[field] = normalizedText[field]
      }
    }

    const effectiveRow = {
      ...row,
      ...patch,
      vin: patch.vin ?? row.vin,
      price_krw: Number(patch.price_krw ?? row.price_krw ?? 0),
      body_color: patch.body_color ?? row.body_color,
    }

    if (effectiveRow.price_krw <= 0 || isBlank(effectiveRow.body_color)) {
      await pool.query('DELETE FROM cars WHERE id = $1', [row.id])
      summary.deleted_invalid += 1
      continue
    }

    if (effectiveRow.price_krw > 0 && (
      Number(effectiveRow.price_usd || 0) <= 0 ||
      Number(effectiveRow.total || 0) <= 0 ||
      Number(effectiveRow.vat_refund || 0) <= 0
    )) {
      Object.assign(patch, buildPricingPatch(effectiveRow, exchangeSnapshot, pricingSettings))
    }

    const changedFields = Object.entries(patch)
      .filter(([field, value]) => {
        const before = row[field]
        const after = value === '' ? null : value
        if (before === after) return false
        if (before == null && after == null) return false
        return true
      })

    if (!changedFields.length) {
      if (needsLiveFix) summary.unresolved += 1
      continue
    }

    const setClauses = []
    const params = []
    let index = 1

    for (const [field, rawValue] of changedFields) {
      const value = rawValue === '' ? null : rawValue
      setClauses.push(`${field} = $${index++}`)
      params.push(value)
      if (summary.fields[field] !== undefined) summary.fields[field] += 1
    }

    setClauses.push(`updated_at = NOW()`)
    params.push(row.id)

    await pool.query(
      `UPDATE cars SET ${setClauses.join(', ')} WHERE id = $${index}`,
      params
    )

    summary.updated += 1
  }

  return summary
}

async function createVinUniqueIndex() {
  await pool.query(UNIQUE_VIN_INDEX_SQL)
}

async function countCatalogIssues() {
  const result = await pool.query(`
    SELECT
      SUM(CASE WHEN vin IS NOT NULL AND UPPER(BTRIM(vin)) ~ '^[A-HJ-NPR-Z0-9]{17}$' THEN 0 ELSE 0 END) AS dummy,
      SUM(CASE WHEN price_krw <= 0 THEN 1 ELSE 0 END)::int AS zero_price,
      SUM(CASE WHEN total <= 0 THEN 1 ELSE 0 END)::int AS zero_total,
      SUM(CASE WHEN COALESCE(BTRIM(body_color), '') = '' THEN 1 ELSE 0 END)::int AS empty_body_color
    FROM cars
  `)

  return result.rows[0]
}

async function main() {
  await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS vehicle_class VARCHAR(100)`)
  const beforeDuplicates = await findDuplicateVinGroups()
  console.log(`VIN duplicate groups before cleanup: ${beforeDuplicates.length}`)

  const vinCleanupBefore = await deleteDuplicateVins()
  const textSummary = await runCarTextBackfill()
  const technicalSummary = await repairTechnicalRows()
  const vinCleanupAfter = await deleteDuplicateVins()
  await createVinUniqueIndex()

  const remainingDuplicates = await findDuplicateVinGroups()
  const remainingIssues = await countCatalogIssues()

  console.log('Text normalization:')
  console.log(`  checked=${textSummary.total} updated=${textSummary.updated} skipped=${textSummary.skipped} errors=${textSummary.errors}`)
  console.log('VIN cleanup before repair:')
  console.log(`  groups=${vinCleanupBefore.groups} deleted=${vinCleanupBefore.deleted}`)
  console.log('Technical repair:')
  console.log(`  checked=${technicalSummary.checked} updated=${technicalSummary.updated} deleted_invalid=${technicalSummary.deleted_invalid} unresolved=${technicalSummary.unresolved}`)
  console.log(`  detail_fetched=${technicalSummary.detail_fetched} detail_failed=${technicalSummary.detail_failed}`)
  console.log('VIN cleanup after repair:')
  console.log(`  groups=${vinCleanupAfter.groups} deleted=${vinCleanupAfter.deleted}`)
  console.log('Remaining issues:')
  console.log(`  duplicate_vin_groups=${remainingDuplicates.length}`)
  console.log(`  zero_price=${remainingIssues.zero_price}`)
  console.log(`  zero_total=${remainingIssues.zero_total}`)
  console.log(`  empty_body_color=${remainingIssues.empty_body_color}`)
}

main()
  .catch((error) => {
    console.error('Failed to fix catalog issues:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
