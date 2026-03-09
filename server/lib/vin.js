const STANDARD_VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/

export function normalizeVin(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
}

export function isStandardVin(value) {
  return STANDARD_VIN_RE.test(normalizeVin(value))
}
