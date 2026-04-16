import pool from '../db.js'

let ensureCarListingMetadataColumnsPromise = null

export async function ensureCarListingMetadataColumns() {
  if (!ensureCarListingMetadataColumnsPromise) {
    ensureCarListingMetadataColumnsPromise = (async () => {
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS detail_flags JSONB NOT NULL DEFAULT '{}'::jsonb`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS inspection_formats TEXT[] NOT NULL DEFAULT '{}'::text[]`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS encar_view_count INTEGER DEFAULT 0`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS encar_subscribe_count INTEGER DEFAULT 0`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS encar_first_advertised_at TIMESTAMPTZ`)
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cars_encar_first_advertised ON cars(encar_first_advertised_at DESC NULLS LAST, encar_view_count ASC, encar_subscribe_count ASC)`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS price_krw_previous BIGINT DEFAULT NULL`)
      await pool.query(`ALTER TABLE cars ADD COLUMN IF NOT EXISTS price_changed_at TIMESTAMPTZ DEFAULT NULL`)
    })().catch((error) => {
      ensureCarListingMetadataColumnsPromise = null
      throw error
    })
  }

  return ensureCarListingMetadataColumnsPromise
}

export function normalizeDetailFlags(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function buildStoredDetailFlags(value) {
  return {
    ...normalizeDetailFlags(value),
    metaReady: true,
  }
}

export function normalizeInspectionFormats(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || '').trim()).filter(Boolean)
    : []
}
