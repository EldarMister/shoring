import pool from '../db.js'
import { resolveBodyType } from './vehicleData.js'

const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000

export const DEFAULT_DELIVERY_PROFILES = [
  {
    code: 'suv_big',
    label: 'SUV BIG',
    description: 'Highlander, Carnival',
    price: 1800,
    sort_order: 10,
  },
  {
    code: 'suv_middle',
    label: 'SUV MIDDLE',
    description: 'Santafe, Sorento',
    price: 1700,
    sort_order: 20,
  },
  {
    code: 'suv_small',
    label: 'SUV SMALL',
    description: 'Tivoli, Seltos',
    price: 1600,
    sort_order: 30,
  },
  {
    code: 'sedan_osh',
    label: 'SEDAN OSH',
    description: '',
    price: 1500,
    sort_order: 40,
  },
  {
    code: 'sedan_bishkek',
    label: 'SEDAN BISHKEK',
    description: '',
    price: 1450,
    sort_order: 50,
  },
  {
    code: 'sedan_lux',
    label: 'SEDAN LUX',
    description: '',
    price: 1600,
    sort_order: 60,
  },
  {
    code: 'half_container',
    label: 'HALF CONTAINER',
    description: '',
    price: 3000,
    sort_order: 70,
  },
  {
    code: 'mini_car',
    label: 'MINI CAR',
    description: 'Morning, Spark',
    price: 1000,
    sort_order: 80,
  },
]

export const DEFAULT_PRICING_SETTINGS = {
  commission: 200,
  loading: 0,
  unloading: 100,
  storage: 310,
  default_delivery: 1450,
  whatsapp_number: '821056650943',
  delivery_profiles: DEFAULT_DELIVERY_PROFILES,
}

const PREMIUM_SEDAN_HINT_RE = /\b(k8|k9|g80|g90|eq900|grandeur|genesis|s-class|e-class|7\s*series|5\s*series|a6|a7|a8|es300h|es350|ls500|k7)\b/i
const BIG_SUV_HINT_RE = /\b(highlander|carnival|staria|starex|palisade|telluride|mohave|mohabi|traverse|tahoe|escalade|rexton\s*w|santa\s*cruz)\b/i
const SMALL_SUV_HINT_RE = /\b(tivoli|seltos|kona|niro|venue|stonic|trax|trailblazer|encore|xm3|korando\s?c)\b/i
const MIDDLE_SUV_HINT_RE = /\b(santa\s*fe|santafe|sorento|sportage|tucson|qm6|torres|korando|captiva|equinox|rav4|cr-v|x-trail|rogue)\b/i
const CAR_LIKE_BODY_TYPES = new Set(['\u0421\u0435\u0434\u0430\u043d', '\u0421\u0435\u0434\u0430\u043d \u043c\u0430\u043b\u043e\u0433\u043e \u043a\u043b\u0430\u0441\u0441\u0430', '\u0421\u0435\u0434\u0430\u043d \u043a\u043e\u043c\u043f\u0430\u043a\u0442-\u043a\u043b\u0430\u0441\u0441\u0430', '\u0421\u0435\u0434\u0430\u043d \u0441\u0440\u0435\u0434\u043d\u0435\u0433\u043e \u043a\u043b\u0430\u0441\u0441\u0430', '\u0421\u0435\u0434\u0430\u043d \u0431\u0438\u0437\u043d\u0435\u0441-\u043a\u043b\u0430\u0441\u0441\u0430', '\u0425\u044d\u0442\u0447\u0431\u0435\u043a', '\u0423\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b', '\u041a\u0443\u043f\u0435', '\u041a\u0430\u0431\u0440\u0438\u043e\u043b\u0435\u0442'])
const HEAVY_BODY_TYPES = new Set(['Пикап', 'Грузовой / пикап', 'Минивэн'])

let cachedSettings = null
let cacheExpiresAt = 0
let pendingSettingsPromise = null

function toNumber(value, fallback) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function toText(value, fallback = '') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function slugifyCode(value, index = 0) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return text || `profile_${index + 1}`
}

function normalizeProfile(profile, index = 0) {
  const fallback = DEFAULT_DELIVERY_PROFILES[index] || DEFAULT_DELIVERY_PROFILES[0]

  return {
    code: slugifyCode(profile?.code || profile?.label || fallback.code, index),
    label: toText(profile?.label, fallback.label),
    description: toText(profile?.description, fallback.description),
    price: toNumber(profile?.price, fallback.price),
    sort_order: toNumber(profile?.sort_order, (index + 1) * 10),
  }
}

function normalizeProfiles(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_DELIVERY_PROFILES
  const uniqueCodes = new Set()

  return source
    .map((profile, index) => normalizeProfile(profile, index))
    .filter((profile) => {
      if (!profile.code || uniqueCodes.has(profile.code)) return false
      uniqueCodes.add(profile.code)
      return true
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
}

function normalizeSettings(payload = {}) {
  return {
    commission: toNumber(payload.commission, DEFAULT_PRICING_SETTINGS.commission),
    loading: toNumber(payload.loading, DEFAULT_PRICING_SETTINGS.loading),
    unloading: toNumber(payload.unloading, DEFAULT_PRICING_SETTINGS.unloading),
    storage: toNumber(payload.storage, DEFAULT_PRICING_SETTINGS.storage),
    default_delivery: toNumber(payload.default_delivery, DEFAULT_PRICING_SETTINGS.default_delivery),
    whatsapp_number: toText(payload.whatsapp_number, DEFAULT_PRICING_SETTINGS.whatsapp_number),
    delivery_profiles: normalizeProfiles(payload.delivery_profiles),
  }
}

function findProfile(settings, code) {
  const profileCode = toText(code)
  if (!profileCode) return null
  return settings.delivery_profiles.find((profile) => profile.code === profileCode) || null
}

function buildVehicleSearchText(vehicle = {}) {
  return [
    vehicle.name,
    vehicle.model,
    vehicle.trim_level,
    vehicle.body_type,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
}

export function inferDeliveryProfileCode(vehicle = {}, settings = DEFAULT_PRICING_SETTINGS) {
  const explicitCode = toText(vehicle.delivery_profile_code)
  if (explicitCode && findProfile(settings, explicitCode)) {
    return explicitCode
  }

  const bodyType = resolveBodyType(
    vehicle.body_type,
    vehicle.name,
    vehicle.model,
    vehicle.trim_level,
  )
  const haystack = buildVehicleSearchText({ ...vehicle, body_type: bodyType }).toLowerCase()

  if (bodyType === 'Мини') return findProfile(settings, 'mini_car') ? 'mini_car' : ''
  if (HEAVY_BODY_TYPES.has(bodyType)) return findProfile(settings, 'suv_big') ? 'suv_big' : ''

  if (bodyType === 'Кроссовер / внедорожник') {
    if (BIG_SUV_HINT_RE.test(haystack) && findProfile(settings, 'suv_big')) return 'suv_big'
    if (SMALL_SUV_HINT_RE.test(haystack) && findProfile(settings, 'suv_small')) return 'suv_small'
    if (MIDDLE_SUV_HINT_RE.test(haystack) && findProfile(settings, 'suv_middle')) return 'suv_middle'
    if (findProfile(settings, 'suv_middle')) return 'suv_middle'
  }

  if (CAR_LIKE_BODY_TYPES.has(bodyType)) {
    if (PREMIUM_SEDAN_HINT_RE.test(haystack) && findProfile(settings, 'sedan_lux')) return 'sedan_lux'
    if (findProfile(settings, 'sedan_bishkek')) return 'sedan_bishkek'
  }

  return ''
}

export function resolveVehicleFees(vehicle = {}, settings = DEFAULT_PRICING_SETTINGS) {
  const profileCode = inferDeliveryProfileCode(vehicle, settings)
  const profile = findProfile(settings, profileCode)
  const pricingLocked = Boolean(vehicle.pricing_locked)
  const resolvedDelivery = profile?.price ?? settings.default_delivery

  return {
    pricing_locked: pricingLocked,
    delivery_profile_code: profile?.code || profileCode || '',
    delivery_profile_label: profile?.label || '',
    delivery_profile_description: profile?.description || '',
    commission: pricingLocked ? toNumber(vehicle.commission, settings.commission) : settings.commission,
    delivery: pricingLocked ? toNumber(vehicle.delivery, resolvedDelivery) : resolvedDelivery,
    loading: pricingLocked ? toNumber(vehicle.loading, settings.loading) : settings.loading,
    unloading: pricingLocked ? toNumber(vehicle.unloading, settings.unloading) : settings.unloading,
    storage: pricingLocked ? toNumber(vehicle.storage, settings.storage) : settings.storage,
  }
}

export async function getPricingSettings({ force = false } = {}) {
  const now = Date.now()

  if (!force && cachedSettings && cacheExpiresAt > now) {
    return cachedSettings
  }

  if (pendingSettingsPromise) return pendingSettingsPromise

  pendingSettingsPromise = (async () => {
    try {
      const result = await pool.query('SELECT * FROM pricing_settings WHERE id = 1')
      const normalized = normalizeSettings(result.rows[0] || DEFAULT_PRICING_SETTINGS)
      cachedSettings = normalized
      cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS
      return normalized
    } catch (error) {
      const fallback = normalizeSettings(DEFAULT_PRICING_SETTINGS)
      cachedSettings = fallback
      cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS
      return fallback
    } finally {
      pendingSettingsPromise = null
    }
  })()

  return pendingSettingsPromise
}

export async function savePricingSettings(payload = {}) {
  const normalized = normalizeSettings(payload)

  await pool.query(
    `INSERT INTO pricing_settings
      (id, commission, loading, unloading, storage, default_delivery, whatsapp_number, delivery_profiles, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
     ON CONFLICT (id) DO UPDATE
     SET commission = EXCLUDED.commission,
         loading = EXCLUDED.loading,
         unloading = EXCLUDED.unloading,
         storage = EXCLUDED.storage,
         default_delivery = EXCLUDED.default_delivery,
         whatsapp_number = EXCLUDED.whatsapp_number,
         delivery_profiles = EXCLUDED.delivery_profiles,
         updated_at = NOW()`,
    [
      normalized.commission,
      normalized.loading,
      normalized.unloading,
      normalized.storage,
      normalized.default_delivery,
      normalized.whatsapp_number,
      JSON.stringify(normalized.delivery_profiles),
    ]
  )

  cachedSettings = normalized
  cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS
  return normalized
}
