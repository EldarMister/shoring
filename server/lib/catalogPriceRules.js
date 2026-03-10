export const MIN_ALLOWED_PRICE_USD = 2000
export const MIN_ALLOWED_PRICE_KRW = 3000000

const SUSPICIOUS_NINES_PRICE_KRW_RE = /^9{4,}0{4}$/

function normalizeWholePrice(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.round(numeric)
}

export function isTooCheapCatalogPrice({ priceKrw = 0, priceUsd = 0 } = {}) {
  const krw = normalizeWholePrice(priceKrw)
  const usd = Number(priceUsd) || 0

  if (krw > 0 && krw < MIN_ALLOWED_PRICE_KRW) return true
  if (usd > 0 && usd < MIN_ALLOWED_PRICE_USD) return true
  return false
}

export function isSuspiciousNinesPrice({ priceKrw = 0 } = {}) {
  const krw = normalizeWholePrice(priceKrw)
  if (krw <= 0) return false
  return SUSPICIOUS_NINES_PRICE_KRW_RE.test(String(krw))
}

export function isBlockedCatalogPrice({ priceKrw = 0, priceUsd = 0 } = {}) {
  return (
    isTooCheapCatalogPrice({ priceKrw, priceUsd }) ||
    isSuspiciousNinesPrice({ priceKrw })
  )
}

export function getBlockedCatalogPriceReason({ priceKrw = 0, priceUsd = 0 } = {}) {
  if (isTooCheapCatalogPrice({ priceKrw, priceUsd })) {
    return `цена ниже $${MIN_ALLOWED_PRICE_USD}, похоже на аренду/месячный платеж`
  }

  if (isSuspiciousNinesPrice({ priceKrw })) {
    return 'подозрительная placeholder-цена с одними 9'
  }

  return ''
}

export function buildBlockedCatalogPriceSql(alias = 'c') {
  return `(
    (COALESCE(${alias}.price_krw, 0) > 0 AND COALESCE(${alias}.price_krw, 0) < ${MIN_ALLOWED_PRICE_KRW})
    OR (COALESCE(${alias}.price_usd, 0) > 0 AND COALESCE(${alias}.price_usd, 0) < ${MIN_ALLOWED_PRICE_USD})
    OR CAST(COALESCE(${alias}.price_krw, 0) AS text) ~ '^9{4,}0{4}$'
  )`
}
