import axios from 'axios'
import { isBlockedCatalogPrice } from '../lib/catalogPriceRules.js'
import { classifyVehicleOrigin, VEHICLE_ORIGIN_LABELS } from '../lib/vehicleData.js'
import {
  buildEncarSourceDiagnostic,
  decorateEncarSourceError,
  fetchViaEncarProxy,
  getPreferredEncarSource,
  hasEncarProxy,
  isEncarProxySuppressed,
  rememberHealthyEncarSource,
  shouldRetryViaAlternateEncarSource,
  suppressEncarProxy,
} from '../lib/encarSource.js'

export function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

export function jitter(min = 1500, max = 3500) {
  return sleep(min + Math.random() * (max - min))
}

function toAbsoluteEncarPhotoUrl(url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/')) return `https://ci.encar.com${url}`
  return `https://ci.encar.com/${url}`
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
]

let uaIdx = 0
function nextUA() { return USER_AGENTS[uaIdx++ % USER_AGENTS.length] }

const ENCAR_DEFAULT_SORT = 'ModifiedDate'
const MIN_LIST_YEAR = 2019
const MAX_LIST_TOP_UP_PAGES = 6
const PAGE_FETCH_SIZE = 20
const PARSE_SCOPE_ALL = 'all'
const PARSE_SCOPE_DOMESTIC = 'domestic'
const PARSE_SCOPE_IMPORTED = 'imported'
const PARSE_SCOPE_JAPANESE = 'japanese'
const PARSE_SCOPE_GERMAN = 'german'
const SUPPORTED_PARSE_SCOPES = new Set([
  PARSE_SCOPE_ALL,
  PARSE_SCOPE_DOMESTIC,
  PARSE_SCOPE_IMPORTED,
  PARSE_SCOPE_JAPANESE,
  PARSE_SCOPE_GERMAN,
])
const IMPORT_ONLY_SCOPES = new Set([
  PARSE_SCOPE_IMPORTED,
  PARSE_SCOPE_JAPANESE,
  PARSE_SCOPE_GERMAN,
])
const ENCAR_SCOPE_MANUFACTURERS = {
  [PARSE_SCOPE_JAPANESE]: [
    '도요타',
    '렉서스',
    '혼다',
    '닛산',
    '인피니티',
    '마쯔다',
    '스바루',
    '미쯔비시',
    '스즈키',
    '이스즈',
    '다이하쯔',
    '어큐라',
  ],
  [PARSE_SCOPE_GERMAN]: [
    'BMW',
    '벤츠',
    '아우디',
    '폭스바겐',
    '포르쉐',
    '미니',
    '스마트',
    '마이바흐',
    '오펠',
  ],
}

function normalizeParseScope(parseScope = PARSE_SCOPE_ALL) {
  return SUPPORTED_PARSE_SCOPES.has(parseScope) ? parseScope : PARSE_SCOPE_ALL
}

function buildScopedManufacturerOrQuery(parseScope) {
  const manufacturers = ENCAR_SCOPE_MANUFACTURERS[parseScope]
  if (!Array.isArray(manufacturers) || manufacturers.length === 0) return ''

  const nodes = manufacturers
    .map((value) => String(value || '').replace(/\./g, '').trim())
    .filter(Boolean)
    .map((value) => `Manufacturer.${value}.`)

  if (nodes.length === 0) return ''
  if (nodes.length === 1) return nodes[0]

  return `(Or.${nodes.join('_.')})`
}

function buildEncarListQuery(parseScope = PARSE_SCOPE_ALL) {
  const normalizedScope = normalizeParseScope(parseScope)

  if (normalizedScope === PARSE_SCOPE_DOMESTIC) {
    return '(And.Hidden.N._.CarType.Y._.Year.range(201900..).)'
  }

  const scopedManufacturerOr = buildScopedManufacturerOrQuery(normalizedScope)
  if (scopedManufacturerOr) {
    return `(And.Hidden.N._.CarType.N._.Year.range(201900..)._.${scopedManufacturerOr})`
  }

  if (IMPORT_ONLY_SCOPES.has(normalizedScope)) {
    return '(And.Hidden.N._.CarType.N._.Year.range(201900..).)'
  }

  return '(And.Hidden.N._.Year.range(201900..).)'
}

const apiClient = axios.create({
  baseURL: 'https://api.encar.com',
  timeout: 25000,
  proxy: false,
  headers: {
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    Origin: 'https://www.encar.com',
    Referer: 'https://www.encar.com/',
  },
})

function asListResult(data) {
  return {
    total: Number(data?.Count) || 0,
    cars: Array.isArray(data?.SearchResults) ? data.SearchResults : [],
  }
}

function parseListYear(rawYear) {
  const match = String(rawYear || '').match(/\d{4}/)
  return match ? Number.parseInt(match[0], 10) : 0
}

function parseListPriceKrw(rawPrice) {
  const numeric = Number(rawPrice) || 0
  return numeric > 0 ? numeric * 10000 : 0
}

function isUsableListCar(raw) {
  const year = parseListYear(raw?.Year)
  if (!Number.isFinite(year) || year < MIN_LIST_YEAR) return false

  const priceKrw = parseListPriceKrw(raw?.Price)
  if (isBlockedCatalogPrice({ priceKrw })) return false

  return true
}

function buildOriginSignal(raw) {
  return [
    raw?.Manufacturer,
    raw?.Model,
    raw?.Badge,
    raw?.Name,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
}

function getImportedOriginRatio(cars = []) {
  const sample = cars
    .map((raw) => buildOriginSignal(raw))
    .filter(Boolean)
    .slice(0, 10)

  if (!sample.length) return 1

  const importedCount = sample.filter((value) => classifyVehicleOrigin(value) === VEHICLE_ORIGIN_LABELS.imported).length
  return importedCount / sample.length
}

function createListScopeMismatchError(parseScope, source, cars = []) {
  const ratio = getImportedOriginRatio(cars)
  const sample = cars.slice(0, 3).map((raw) => `${raw?.Manufacturer || '-'} ${raw?.Model || ''}`.trim()).join(' | ')
  const error = new Error(`List source mismatch for scope=${parseScope} via ${source}; importedRatio=${ratio.toFixed(2)}; sample=${sample}`)
  error.code = 'LIST_SCOPE_MISMATCH'
  error.parseScope = parseScope
  error.source = source
  error.importedRatio = ratio
  return error
}

function isListScopeMismatch(parseScope, cars = []) {
  if (!IMPORT_ONLY_SCOPES.has(parseScope)) return false
  if (!Array.isArray(cars) || cars.length < 5) return false
  return getImportedOriginRatio(cars) < 0.6
}

async function fetchListViaProxy(offset, pageLimit, parseScope = PARSE_SCOPE_ALL) {
  const data = await fetchViaEncarProxy(
    {
      endpoint: 'list',
      offset,
      limit: pageLimit,
      count: true,
      q: buildEncarListQuery(parseScope),
      sr: `|${ENCAR_DEFAULT_SORT}|${offset}|${pageLimit}`,
      sort: ENCAR_DEFAULT_SORT,
    },
    {
      timeout: 25000,
      headers: {
        'User-Agent': nextUA(),
      },
    },
  )

  return asListResult(data)
}

async function fetchListDirect(offset, pageLimit, parseScope = PARSE_SCOPE_ALL) {
  const resp = await apiClient.get('/search/car/list/premium', {
    params: {
      count: true,
      q: buildEncarListQuery(parseScope),
      sr: `|${ENCAR_DEFAULT_SORT}|${offset}|${pageLimit}`,
    },
    headers: { 'User-Agent': nextUA() },
  })
  return asListResult(resp.data)
}

function getListFetchers({ allowSuppressedProxyProbe = false } = {}) {
  const fetchers = []
  if (hasEncarProxy() && (!isEncarProxySuppressed() || allowSuppressedProxyProbe)) {
    fetchers.push({
      name: 'proxy',
      run: (offset, pageLimit, parseScope) => fetchListViaProxy(offset, pageLimit, parseScope),
    })
  }
  fetchers.push({
    name: 'direct',
    run: (offset, pageLimit, parseScope) => fetchListDirect(offset, pageLimit, parseScope),
  })
  return fetchers
}

async function fetchBatchWithFallback(offset, pageLimit, parseScope, preferredSource) {
  const fetchers = getListFetchers()
  const preferred = preferredSource || getPreferredEncarSource('list')
  const orderedFetchers = [
    ...fetchers.filter((fetcher) => fetcher.name === preferred),
    ...fetchers.filter((fetcher) => fetcher.name !== preferred),
  ]

  let lastError = null
  const sourceDiagnostics = []

  for (const fetcher of orderedFetchers) {
    try {
      const batch = await fetcher.run(offset, pageLimit, parseScope)
      if (isListScopeMismatch(parseScope, batch.cars)) {
        if (fetcher.name === 'proxy') suppressEncarProxy()
        lastError = createListScopeMismatchError(parseScope, fetcher.name, batch.cars)
        sourceDiagnostics.push(buildEncarSourceDiagnostic(fetcher.name, lastError, 'scope_mismatch'))
        continue
      }

      rememberHealthyEncarSource('list', fetcher.name)
      return {
        batch,
        source: fetcher.name,
        sourceDiagnostics,
        fallbackUsed: sourceDiagnostics.length > 0,
      }
    } catch (error) {
      if (fetcher.name === 'proxy') {
        suppressEncarProxy(Number(error?.response?.status) || 0)
      }
      sourceDiagnostics.push(buildEncarSourceDiagnostic(fetcher.name, error))
      lastError = error
    }
  }

  if (
    hasEncarProxy()
    && isEncarProxySuppressed()
    && !sourceDiagnostics.some((item) => item?.source === 'proxy')
    && shouldRetryViaAlternateEncarSource(lastError)
  ) {
    try {
      const batch = await fetchListViaProxy(offset, pageLimit, parseScope)
      if (isListScopeMismatch(parseScope, batch.cars)) {
        suppressEncarProxy()
        lastError = createListScopeMismatchError(parseScope, 'proxy', batch.cars)
        sourceDiagnostics.push(buildEncarSourceDiagnostic('proxy', lastError, 'scope_mismatch'))
      } else {
        rememberHealthyEncarSource('list', 'proxy')
        return {
          batch,
          source: 'proxy',
          sourceDiagnostics,
          fallbackUsed: true,
        }
      }
    } catch (error) {
      suppressEncarProxy(Number(error?.response?.status) || 0)
      sourceDiagnostics.push(buildEncarSourceDiagnostic('proxy', error, 'suppressed_probe'))
      lastError = error
    }
  }

  if (lastError) lastError.fetchSourceDiagnostics = sourceDiagnostics
  throw lastError || new Error(`Failed to fetch Encar list for scope=${parseScope}`)
}

/**
 * Fetch paginated car list from Encar API (via Vercel proxy if ENCAR_PROXY_URL is set)
 * @param {number} offset
 * @param {number} limit max 20 per page
 * @param {number} retries
 * @param {{ parseScope?: 'all' | 'domestic' | 'imported' | 'japanese' | 'german' }} options
 * @returns {{ total: number, cars: object[] }}
 */
export async function fetchCarList(offset = 0, limit = 20, retries = 3, options = {}) {
  const pageLimit = Math.min(limit, 20)
  const parseScope = normalizeParseScope(options?.parseScope)

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      let activeSource = hasEncarProxy() && !isEncarProxySuppressed()
        ? getPreferredEncarSource('list')
        : 'direct'
      let total = 0
      let scanned = 0
      let nextOffset = offset
      let pagesFetched = 0
      const collected = []
      const sourceDiagnostics = []

      while (collected.length < pageLimit && pagesFetched < MAX_LIST_TOP_UP_PAGES) {
        const result = await fetchBatchWithFallback(nextOffset, PAGE_FETCH_SIZE, parseScope, activeSource)
        const { batch, source } = result
        activeSource = source
        if (Array.isArray(result.sourceDiagnostics) && result.sourceDiagnostics.length) {
          sourceDiagnostics.push(...result.sourceDiagnostics)
        }

        if (!total) total = batch.total
        const batchCars = Array.isArray(batch.cars) ? batch.cars : []
        if (!batchCars.length) break

        pagesFetched += 1
        nextOffset += batchCars.length
        scanned += batchCars.length

        for (const raw of batchCars) {
          if (!isUsableListCar(raw)) continue
          collected.push(raw)
          if (collected.length >= pageLimit) break
        }

        if (batchCars.length < PAGE_FETCH_SIZE) break
      }

      return {
        total,
        cars: collected.slice(0, pageLimit),
        scanned,
        listSource: activeSource,
        sourceDiagnostics,
        fallbackUsed: sourceDiagnostics.length > 0,
      }
    } catch (err) {
      decorateEncarSourceError(err, 'list')
      if (attempt === retries) throw err
      await sleep(3000 * attempt)
    }
  }
}

/**
 * Extract photo URLs directly from Encar list payload.
 * Prefers explicit Photos[] locations, then falls back to Photo prefix pattern.
 */
export function extractPhotoUrls(raw, maxPhotos = 8) {
  const urls = []

  if (Array.isArray(raw?.Photos)) {
    const sorted = [...raw.Photos].sort((a, b) => (a?.ordering || 0) - (b?.ordering || 0))
    for (const p of sorted) {
      const abs = toAbsoluteEncarPhotoUrl(p?.location)
      if (abs && !urls.includes(abs)) urls.push(abs)
      if (urls.length >= maxPhotos) return urls
    }
    if (urls.length > 0) return urls
  }

  if (typeof raw?.Photo === 'string' && raw.Photo) {
    const prefix = toAbsoluteEncarPhotoUrl(raw.Photo)
    if (prefix) {
      for (let i = 1; i <= maxPhotos; i++) {
        const num = String(i).padStart(3, '0')
        const candidate = `${prefix}${num}.jpg`
        if (!urls.includes(candidate)) urls.push(candidate)
      }
    }
  }

  return urls.slice(0, maxPhotos)
}

/**
 * Build photo URLs by Encar's CDN pattern:
 * https://ci.encar.com/carpicture{id[0:2]}/{id[2:5]}/{id}{num:03d}.jpg
 */
export function buildPhotoUrls(carId, maxPhotos = 12) {
  const id = String(carId)
  if (id.length < 6) return []

  const prefix = id.substring(0, 2)
  const mid = id.substring(2, 5)
  const urls = []

  for (let i = 1; i <= maxPhotos; i++) {
    const num = String(i).padStart(3, '0')
    urls.push(`https://ci.encar.com/carpicture${prefix}/${mid}/${id}${num}.jpg`)
  }
  return urls
}

/**
 * Probe which photo URLs actually exist (HEAD request)
 * Returns only valid ones (up to maxPhotos)
 */
export async function probePhotoUrls(carId, maxPhotos = 8) {
  const urls = buildPhotoUrls(carId, maxPhotos + 4)
  const valid = []

  for (const url of urls) {
    if (valid.length >= maxPhotos) break
    try {
      const resp = await axios.head(url, {
        timeout: 6000,
        proxy: false,
        headers: {
          'User-Agent': nextUA(),
          Referer: 'https://www.encar.com/',
        },
        validateStatus: (status) => status < 500,
      })
      if (resp.status === 200) {
        valid.push(url)
      } else if (valid.length > 0) {
        // Stop probing after first miss once at least one real image was found.
        break
      }
    } catch {
      if (valid.length > 0) break
    }
    await sleep(300)
  }

  return valid
}
