import axios from 'axios'
import iconv from 'iconv-lite'
import { load } from 'cheerio'

const COMMON_HEADERS = Object.freeze({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
})

const historyHtmlClient = axios.create({
  baseURL: 'https://www.encar.com',
  timeout: 10000,
  responseType: 'arraybuffer',
  headers: {
    ...COMMON_HEADERS,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: 'https://www.encar.com/',
  },
})

const femDetailClient = axios.create({
  baseURL: 'https://fem.encar.com',
  timeout: 20000,
  headers: {
    ...COMMON_HEADERS,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    Referer: 'https://www.encar.com/',
  },
})

const historyApiClient = axios.create({
  baseURL: 'https://api.encar.com',
  timeout: 20000,
  headers: {
    ...COMMON_HEADERS,
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.encar.com',
    Referer: 'https://fem.encar.com/',
  },
})

const HISTORY_SECTION_ALIASES = Object.freeze({
  statistics: [
    '\uD1B5\uACC4',
    'statistics',
    '\u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430',
  ],
  uninsuredPeriods: [
    '\uBB34\uBCF4\uD5D8',
    '\uBB34\uBCF4\uD5D8 \uAE30\uAC04',
    'uninsured period',
    'period without insurance',
    '\u043F\u0435\u0440\u0438\u043E\u0434\u044B \u0431\u0435\u0437 \u0441\u0442\u0440\u0430\u0445\u043E\u0432\u043A\u0438',
  ],
  ownerChanges: [
    '\uBA85\uC758\uBCC0\uACBD',
    'owner change',
    '\u0441\u043C\u0435\u043D\u0430 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430',
    '\u0441\u043C\u0435\u043D\u044B \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u0432',
  ],
})

const HISTORY_STAT_FIELDS = Object.freeze([
  { key: 'accidents', aliases: ['\uC0AC\uACE0', 'accidents', '\u0430\u0432\u0430\u0440\u0438\u0438'], type: 'number' },
  { key: 'totalLoss', aliases: ['\uC804\uC190', 'total loss', '\u0442\u043E\u0442\u0430\u043B\u044C\u043D\u0430\u044F \u043F\u043E\u0442\u0435\u0440\u044F'], type: 'number' },
  { key: 'ownerChanges', aliases: ['\uBA85\uC758\uBCC0\uACBD', 'owner changes', '\u0441\u043C\u0435\u043D\u044B \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0435\u0432'], type: 'number' },
  { key: 'numberChanges', aliases: ['\uCC28\uB7C9\uBC88\uD638 \uBCC0\uACBD', '\uBC88\uD638\uBCC0\uACBD', 'number changes', '\u0441\u043C\u0435\u043D\u044B \u043D\u043E\u043C\u0435\u0440\u043E\u0432'], type: 'number' },
  { key: 'atFaultCount', aliases: ['\uB0B4\uCC28\uD53C\uD574', 'my fault', '\u043F\u043E \u043C\u043E\u0435\u0439 \u0432\u0438\u043D\u0435'], type: 'number' },
  { key: 'atFaultDamage', aliases: ['\uB0B4\uCC28\uD53C\uD574\uAE08\uC561', '\uD53C\uD574 \uAE08\uC561', 'my fault damage', '\u0443\u0449\u0435\u0440\u0431 (\u043C\u043E\u044F \u0432\u0438\u043D\u0430)'], type: 'money' },
  { key: 'notAtFaultCount', aliases: ['\uD0C0\uCC28\uAC00\uD574', 'not at fault', '\u043D\u0435 \u043F\u043E \u043C\u043E\u0435\u0439 \u0432\u0438\u043D\u0435'], type: 'number' },
  { key: 'notAtFaultDamage', aliases: ['\uD0C0\uCC28\uAC00\uD574 \uD53C\uD574\uAE08\uC561', 'other fault damage', '\u0443\u0449\u0435\u0440\u0431 (\u0447\u0443\u0436\u0430\u044F \u0432\u0438\u043D\u0430)'], type: 'money' },
  { key: 'thefts', aliases: ['\uB3C4\uB09C', 'thefts', '\u043A\u0440\u0430\u0436\u0438'], type: 'number' },
])

const HISTORY_OVERVIEW_FIELDS = Object.freeze([
  { key: 'loans', aliases: ['\uC555\uB958', '\uC800\uB2F9', 'loan', '\u0437\u0430\u043B\u043E\u0433'], type: 'number' },
  { key: 'registrationDate', aliases: ['\uB4F1\uB85D\uC77C', 'registration date', '\u0434\u0430\u0442\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438'], type: 'date' },
  { key: 'businessUse', aliases: ['\uC601\uC5C5\uC6A9', 'business', '\u0431\u0438\u0437\u043D\u0435\u0441'], type: 'number' },
  { key: 'openData', aliases: ['\uC5F4\uB78C \uAC00\uB2A5', 'open data', '\u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435'], type: 'text' },
  { key: 'governmentUse', aliases: ['\uAD00\uC6A9', 'government', '\u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439'], type: 'number' },
  { key: 'engineDisplacement', aliases: ['\uBC30\uAE30\uB7C9', 'engine displacement', '\u043E\u0431\u044A\u0435\u043C \u0434\u0432\u0438\u0433\u0430\u0442\u0435\u043B\u044F'], type: 'number' },
  { key: 'firstRegistration', aliases: ['\uCD5C\uCD08\uB4F1\uB85D\uC77C', 'first registration', '\u043F\u0435\u0440\u0432\u0430\u044F \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F'], type: 'date' },
])

const HISTORY_URLS = Object.freeze([
  ({ carId }) => `/dc/dc_cardetailview.do?pageid=dc_carcompensated_l01&listAdvType=compensate&carid=${encodeURIComponent(carId)}`,
  ({ carId }) => `/dc/dc_cardetailview.do?pageid=fc_carcompensated_l01&listAdvType=compensate&carid=${encodeURIComponent(carId)}`,
  ({ carId }) => `/dc/dc_cardetailview.do?pageid=dc_carchecked_l01&listAdvType=chk_list&carid=${encodeURIComponent(carId)}`,
  ({ carId }) => `/dc/dc_cardetailview.do?pageid=fc_carchecked_l01&listAdvType=chk_list&carid=${encodeURIComponent(carId)}`,
])

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function compactMatchText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[~\-\u2013\u2014]/g, '')
    .replace(/[()[\]{}:;,./\\|_]+/g, ' ')
    .replace(/\s+/g, '')
}

function matchesAlias(value, aliases = []) {
  const haystack = compactMatchText(value)
  if (!haystack) return false
  return aliases.some((alias) => haystack.includes(compactMatchText(alias)))
}

function parseIntegerValue(value) {
  const digits = String(value || '').replace(/[^\d-]+/g, '')
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? parsed : null
}

function parseMoneyValue(value) {
  return parseIntegerValue(value)
}

function normalizeDateValue(value) {
  const text = cleanText(value)
  if (!text) return ''

  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10)

  let match = text.match(/^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`

  match = text.match(/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/)
  if (match) return `${match[3]}-${match[2]}-${match[1]}`

  match = text.match(/^(\d{4})(\d{2})(\d{2})$/)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`

  match = text.match(/^(\d{4})[.\-/](\d{2})$/)
  if (match) return `${match[1]}-${match[2]}`

  match = text.match(/^(\d{4})(\d{2})$/)
  if (match) return `${match[1]}-${match[2]}`

  return text
}

function normalizePeriodToken(value) {
  const text = cleanText(value)
  if (!text) return ''

  let match = text.match(/^(\d{4})(\d{2})$/)
  if (match) return `${match[1]}-${match[2]}`

  match = text.match(/^(\d{4})[.\-/](\d{2})$/)
  if (match) return `${match[1]}-${match[2]}`

  return normalizeDateValue(text)
}

function createHistorySkeleton() {
  return {
    available: false,
    pageType: 'unknown',
    sourceUrl: '',
    overview: {},
    statistics: Object.fromEntries(HISTORY_STAT_FIELDS.map((field) => [field.key, null])),
    uninsuredPeriods: [],
    ownerChanges: [],
    accidentDetails: [],
    numberChangeHistory: [],
    parserDiagnostics: [],
  }
}

function pushDiagnostic(target, field, found, strategy, extra = {}) {
  target.push({
    field,
    found: Boolean(found),
    strategy,
    ...extra,
  })
}

function detectPageType($, html) {
  const bodyClass = cleanText($('body').attr('class'))
  if (/\bindex\b/i.test(bodyClass)) return 'index_shell'

  if (html.includes('__PRELOADED_STATE__')) return 'detail_shell'

  const text = cleanText($.root().text() || html)
  if (
    matchesAlias(text, HISTORY_SECTION_ALIASES.statistics)
    || matchesAlias(text, HISTORY_SECTION_ALIASES.uninsuredPeriods)
    || matchesAlias(text, HISTORY_SECTION_ALIASES.ownerChanges)
  ) {
    return 'history_detail'
  }

  return 'unknown'
}

function findSectionContainers($, aliases) {
  const roots = []
  const seen = new Set()

  $('h1,h2,h3,h4,h5,h6,strong,th,dt,p,div,span,li').each((_, element) => {
    const label = cleanText($(element).text())
    if (!label || label.length > 80 || !matchesAlias(label, aliases)) return

    const container = $(element).closest('section, article, table, dl, ul, ol, div')
    if (!container.length) return

    const text = cleanText(container.text())
    if (!text || text.length < label.length + 2) return

    const node = container.get(0)
    if (!node || seen.has(node)) return
    seen.add(node)
    roots.push(container)
  })

  return roots
}

function collectPairsFromScope($scope, $) {
  const pairs = []
  const seen = new Set()

  const pushPair = (label, value, source) => {
    const cleanLabel = cleanText(label)
    const cleanValue = cleanText(value)
    if (!cleanLabel || !cleanValue) return
    const key = `${cleanLabel}|||${cleanValue}`
    if (seen.has(key)) return
    seen.add(key)
    pairs.push({ label: cleanLabel, value: cleanValue, source })
  }

  $scope.find('tr').each((_, row) => {
    const cells = $(row).children('th,td').toArray()
    if (cells.length < 2) return
    const label = $(cells[0]).text()
    const value = cells.slice(1).map((cell) => $(cell).text()).join(' ')
    pushPair(label, value, 'table-row')
  })

  $scope.find('dt').each((_, dt) => {
    const $dt = $(dt)
    const $dd = $dt.next('dd')
    if (!$dd.length) return
    pushPair($dt.text(), $dd.text(), 'definition-list')
  })

  $scope.find('li,div').each((_, node) => {
    const $node = $(node)
    const children = $node.children().toArray().filter((child) => cleanText($(child).text()))
    if (children.length < 2 || children.length > 4) return

    const label = cleanText($(children[0]).text())
    const value = cleanText(children.slice(1).map((child) => $(child).text()).join(' '))
    if (!label || !value) return
    if (label.length > 60 || value.length > 120) return
    pushPair(label, value, 'child-block')
  })

  return pairs
}

function extractFieldFromPairs(pairs, fieldDef) {
  const pair = pairs.find((item) => matchesAlias(item.label, fieldDef.aliases))
  if (!pair) return null

  if (fieldDef.type === 'date') {
    return { value: normalizeDateValue(pair.value), strategy: pair.source, rawLabel: pair.label, rawValue: pair.value }
  }
  if (fieldDef.type === 'money') {
    return { value: parseMoneyValue(pair.value), strategy: pair.source, rawLabel: pair.label, rawValue: pair.value }
  }
  if (fieldDef.type === 'number') {
    return { value: parseIntegerValue(pair.value), strategy: pair.source, rawLabel: pair.label, rawValue: pair.value }
  }

  return { value: cleanText(pair.value), strategy: pair.source, rawLabel: pair.label, rawValue: pair.value }
}

function extractFieldFromText(text, fieldDef) {
  const aliases = fieldDef.aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const regex = fieldDef.type === 'date'
    ? new RegExp(`(?:${aliases})\\s*[:\\uFF1A-]?\\s*(\\d{2}[.\\-/]\\d{2}[.\\-/]\\d{4}|\\d{4}[.\\-/]\\d{2}[.\\-/]\\d{2}|\\d{8}|\\d{6})`, 'i')
    : fieldDef.type === 'number' || fieldDef.type === 'money'
      ? new RegExp(`(?:${aliases})\\s*[:\\uFF1A-]?\\s*([+-]?\\d[\\d\\s,]*(?:\\s*(?:\\u20A9|\\uC6D0|W))?)`, 'i')
      : new RegExp(`(?:${aliases})\\s*[:\\uFF1A-]?\\s*([^\\n\\r]{1,40})`, 'i')
  const match = cleanText(text).match(regex)
  if (!match) return null

  const rawValue = cleanText(match[1])
  if (!rawValue) return null

  if (fieldDef.type === 'date') {
    return { value: normalizeDateValue(rawValue), strategy: 'section-regex', rawValue }
  }
  if (fieldDef.type === 'money') {
    return { value: parseMoneyValue(rawValue), strategy: 'section-regex', rawValue }
  }
  if (fieldDef.type === 'number') {
    return { value: parseIntegerValue(rawValue), strategy: 'section-regex', rawValue }
  }

  return { value: rawValue, strategy: 'section-regex', rawValue }
}

function parseStatisticsSection($, diagnostics) {
  const result = Object.fromEntries(HISTORY_STAT_FIELDS.map((field) => [field.key, null]))
  const sections = findSectionContainers($, HISTORY_SECTION_ALIASES.statistics)
  const sectionText = cleanText(sections.map(($section) => $section.text()).join(' ') || $.root().text())
  const pairs = sections.flatMap(($section) => collectPairsFromScope($section, $))

  for (const field of HISTORY_STAT_FIELDS) {
    const exact = extractFieldFromPairs(pairs, field)
    if (exact && exact.value !== null && exact.value !== '') {
      result[field.key] = exact.value
      pushDiagnostic(diagnostics, `vehicleHistory.statistics.${field.key}`, true, exact.strategy, {
        rawLabel: exact.rawLabel,
        rawValue: exact.rawValue,
      })
      continue
    }

    const fallback = extractFieldFromText(sectionText, field)
    if (fallback && fallback.value !== null && fallback.value !== '') {
      result[field.key] = fallback.value
      pushDiagnostic(diagnostics, `vehicleHistory.statistics.${field.key}`, true, fallback.strategy, {
        rawValue: fallback.rawValue,
      })
      continue
    }

    if (!sections.length) {
      pushDiagnostic(diagnostics, `vehicleHistory.statistics.${field.key}`, false, 'section-detect', { reason: 'section_not_found' })
      continue
    }

    pushDiagnostic(diagnostics, `vehicleHistory.statistics.${field.key}`, false, 'section-regex', { reason: 'value_not_found' })
  }

  return result
}

function parseOverviewSection($, diagnostics) {
  const pairs = collectPairsFromScope($.root(), $)
  const overview = {}

  for (const field of HISTORY_OVERVIEW_FIELDS) {
    const exact = extractFieldFromPairs(pairs, field)
    if (!exact || exact.value === null || exact.value === '') {
      pushDiagnostic(diagnostics, `vehicleHistory.overview.${field.key}`, false, 'global-pairs', { reason: 'value_not_found' })
      continue
    }

    overview[field.key] = exact.value
    pushDiagnostic(diagnostics, `vehicleHistory.overview.${field.key}`, true, exact.strategy, {
      rawLabel: exact.rawLabel,
      rawValue: exact.rawValue,
    })
  }

  return overview
}

function parseUninsuredPeriodsSection($, diagnostics) {
  const sections = findSectionContainers($, HISTORY_SECTION_ALIASES.uninsuredPeriods)
  const text = cleanText(sections.map(($section) => $section.text()).join(' ') || $.root().text())
  const periods = []
  const seen = new Set()
  const regex = /(?:\uAE30\uAC04|period|\u043F\u0435\u0440\u0438\u043E\u0434)(?:\s*\d+)?\s*[:#-]?\s*(\d{4}[.-]?\d{2}|\d{6})\s*(?:~|-|to)\s*(\d{4}[.-]?\d{2}|\d{6})/gi

  let match
  while ((match = regex.exec(text))) {
    const start = normalizePeriodToken(match[1])
    const end = normalizePeriodToken(match[2])
    const key = `${start}~${end}`
    if (!start || !end || seen.has(key)) continue
    seen.add(key)
    periods.push({
      index: periods.length + 1,
      raw: `${match[1]}~${match[2]}`,
      start,
      end,
    })
  }

  if (!periods.length) {
    const compactRegex = /(\d{6})\s*(?:~|-)\s*(\d{6})/g
    while ((match = compactRegex.exec(text))) {
      const start = normalizePeriodToken(match[1])
      const end = normalizePeriodToken(match[2])
      const key = `${start}~${end}`
      if (!start || !end || seen.has(key)) continue
      seen.add(key)
      periods.push({
        index: periods.length + 1,
        raw: `${match[1]}~${match[2]}`,
        start,
        end,
      })
    }
  }

  pushDiagnostic(
    diagnostics,
    'vehicleHistory.uninsuredPeriods',
    periods.length > 0,
    periods.length > 0 ? 'section-regex' : 'document-regex',
    periods.length > 0
      ? { count: periods.length }
      : { reason: sections.length ? 'value_not_found' : 'section_not_found_fallback_failed' },
  )

  return periods
}

function parseOwnerChangesSection($, diagnostics) {
  const sections = findSectionContainers($, HISTORY_SECTION_ALIASES.ownerChanges)
  const pairs = sections.flatMap(($section) => collectPairsFromScope($section, $))
  const text = cleanText(sections.map(($section) => $section.text()).join(' ') || $.root().text())
  const changes = []
  const seen = new Set()

  for (const pair of pairs) {
    if (!matchesAlias(pair.label, HISTORY_SECTION_ALIASES.ownerChanges)) continue
    const normalizedDate = normalizeDateValue(pair.value)
    if (!normalizedDate) continue
    const indexMatch = pair.label.match(/(\d+)/)
    const index = indexMatch ? Number(indexMatch[1]) : changes.length + 1
    const key = `${index}|${normalizedDate}`
    if (seen.has(key)) continue
    seen.add(key)
    changes.push({ index, date: normalizedDate, rawDate: pair.value })
  }

  if (!changes.length) {
    const regex = /(?:\uBA85\uC758\uBCC0\uACBD|owner\s*change|\u0441\u043C\u0435\u043D\u0430 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0430)\s*(\d+)?\s*[:#-]?\s*(\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}[.\-/]\d{2}[.\-/]\d{2})/gi
    let match
    while ((match = regex.exec(text))) {
      const index = match[1] ? Number(match[1]) : changes.length + 1
      const normalizedDate = normalizeDateValue(match[2])
      const key = `${index}|${normalizedDate}`
      if (!normalizedDate || seen.has(key)) continue
      seen.add(key)
      changes.push({ index, date: normalizedDate, rawDate: match[2] })
    }
  }

  changes.sort((a, b) => a.index - b.index || a.date.localeCompare(b.date))
  pushDiagnostic(
    diagnostics,
    'vehicleHistory.ownerChanges',
    changes.length > 0,
    changes.length > 0 ? 'mixed-fallback' : 'document-regex',
    changes.length > 0
      ? { count: changes.length }
      : { reason: sections.length ? 'value_not_found' : 'section_not_found_fallback_failed' },
  )

  return changes
}

function parsePreloadedState(html) {
  const marker = '__PRELOADED_STATE__ = '
  const start = html.indexOf(marker)
  if (start < 0) return null
  const end = html.indexOf('</script>', start)
  if (end < 0) return null

  const raw = html
    .slice(start + marker.length, end)
    .trim()
    .replace(/;\s*$/, '')

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function resolveVehicleNoFromState(state) {
  return cleanText(
    state?.cars?.base?.vehicleNo
      || state?.carInfo?.car?.vehicleNo
      || state?.cars?.base?.manage?.vehicleNo
      || '',
  )
}

function resolveVehicleIdFromState(state, fallbackId = '') {
  const candidates = [
    state?.cars?.base?.vehicleId,
    state?.carInfo?.car?.vehicleId,
    state?.carInfo?.car?.id,
    state?.saleCar?.car?.vehicleId,
    state?.saleCar?.car?.id,
    state?.cars?.detailServerDriven?.result?.vehicleId,
    state?.cars?.detailServerDriven?.result?.id,
    state?.cars?.detailServerDriven?.serverDrivenVehicleId,
  ]

  for (const candidate of candidates) {
    const normalized = cleanText(candidate)
    if (normalized) return normalized
  }

  return cleanText(fallbackId)
}

async function fetchFemDetailState(carId) {
  const url = `/cars/detail/${encodeURIComponent(carId)}`
  const response = await femDetailClient.get(url)
  const html = String(response.data || '')
  return {
    html,
    state: parsePreloadedState(html),
    sourceUrl: `https://fem.encar.com${url}`,
  }
}

function buildHistoryFromRecord(record, { carId, vehicleNo, sourceUrl }) {
  const result = createHistorySkeleton()
  result.available = true
  result.pageType = 'record_api'
  result.sourceUrl = sourceUrl

  const totalLossCount = [record?.totalLossCnt, record?.floodTotalLossCnt]
    .map((value) => parseIntegerValue(value))
    .filter((value) => value !== null)
  const totalLossValue = totalLossCount.length ? totalLossCount.reduce((sum, value) => sum + value, 0) : null

  const statistics = {
    accidents: parseIntegerValue(record?.accidentCnt) ?? ((parseIntegerValue(record?.myAccidentCnt) || 0) + (parseIntegerValue(record?.otherAccidentCnt) || 0)),
    totalLoss: totalLossValue,
    ownerChanges: parseIntegerValue(record?.ownerChangeCnt),
    numberChanges: parseIntegerValue(record?.carNoChangeCnt),
    atFaultCount: parseIntegerValue(record?.myAccidentCnt),
    atFaultDamage: parseMoneyValue(record?.myAccidentCost),
    notAtFaultCount: parseIntegerValue(record?.otherAccidentCnt),
    notAtFaultDamage: parseMoneyValue(record?.otherAccidentCost),
    thefts: parseIntegerValue(record?.robberCnt),
  }

  const overview = {
    loans: parseIntegerValue(record?.loan),
    registrationDate: normalizeDateValue(record?.regDate),
    businessUse: parseIntegerValue(record?.business),
    openData: typeof record?.openData === 'boolean' ? (record.openData ? 'Да' : 'Нет') : cleanText(record?.openData),
    governmentUse: parseIntegerValue(record?.government),
    engineDisplacement: parseIntegerValue(record?.displacement),
    firstRegistration: normalizeDateValue(record?.firstDate),
    vehicleNo: cleanText(record?.carNo || vehicleNo),
    year: cleanText(record?.year),
    manufacturer: cleanText(record?.maker),
    fuel: cleanText(record?.fuel),
  }

  result.statistics = statistics
  result.overview = Object.fromEntries(
    Object.entries(overview).filter(([, value]) => value !== null && value !== undefined && value !== ''),
  )

  for (const field of HISTORY_STAT_FIELDS) {
    const value = statistics[field.key]
    pushDiagnostic(
      result.parserDiagnostics,
      `vehicleHistory.statistics.${field.key}`,
      value !== null && value !== undefined,
      'record-api',
      value !== null && value !== undefined ? { value } : { reason: 'field_not_present' },
    )
  }

  for (const field of HISTORY_OVERVIEW_FIELDS) {
    const value = result.overview[field.key]
    pushDiagnostic(
      result.parserDiagnostics,
      `vehicleHistory.overview.${field.key}`,
      value !== null && value !== undefined && value !== '',
      'record-api',
      value !== null && value !== undefined && value !== '' ? { value } : { reason: 'field_not_present' },
    )
  }

  result.uninsuredPeriods = [record?.notJoinDate1, record?.notJoinDate2, record?.notJoinDate3, record?.notJoinDate4, record?.notJoinDate5]
    .map((raw, index) => ({ raw: cleanText(raw), index: index + 1 }))
    .filter((item) => item.raw)
    .map((item) => {
      const [startRaw = '', endRaw = ''] = item.raw.split('~')
      return {
        index: item.index,
        raw: item.raw,
        start: normalizePeriodToken(startRaw),
        end: normalizePeriodToken(endRaw),
      }
    })
    .filter((item) => item.start && item.end)

  pushDiagnostic(
    result.parserDiagnostics,
    'vehicleHistory.uninsuredPeriods',
    result.uninsuredPeriods.length > 0,
    'record-api',
    result.uninsuredPeriods.length > 0 ? { count: result.uninsuredPeriods.length } : { reason: 'field_not_present' },
  )

  result.ownerChanges = Array.isArray(record?.ownerChanges)
    ? record.ownerChanges
      .map((rawDate, index) => ({
        index: index + 1,
        date: normalizeDateValue(rawDate),
        rawDate: cleanText(rawDate),
      }))
      .filter((item) => item.date)
    : []

  pushDiagnostic(
    result.parserDiagnostics,
    'vehicleHistory.ownerChanges',
    result.ownerChanges.length > 0,
    'record-api',
    result.ownerChanges.length > 0 ? { count: result.ownerChanges.length } : { reason: 'field_not_present' },
  )

  result.accidentDetails = Array.isArray(record?.accidents)
    ? record.accidents.map((item, index) => ({
      index: index + 1,
      typeCode: cleanText(item?.type),
      date: normalizeDateValue(item?.date),
      insuranceBenefit: parseMoneyValue(item?.insuranceBenefit),
      partCost: parseMoneyValue(item?.partCost),
      laborCost: parseMoneyValue(item?.laborCost),
      paintingCost: parseMoneyValue(item?.paintingCost),
    }))
    : []

  result.numberChangeHistory = Array.isArray(record?.carInfoChanges)
    ? record.carInfoChanges.map((item, index) => ({
      index: index + 1,
      date: normalizeDateValue(item?.date),
      carNo: cleanText(item?.carNo),
    }))
    : []

  pushDiagnostic(
    result.parserDiagnostics,
    'vehicleHistory.accidentDetails',
    result.accidentDetails.length > 0,
    'record-api',
    result.accidentDetails.length > 0 ? { count: result.accidentDetails.length } : { reason: 'field_not_present' },
  )

  pushDiagnostic(
    result.parserDiagnostics,
    'vehicleHistory.numberChangeHistory',
    result.numberChangeHistory.length > 0,
    'record-api',
    result.numberChangeHistory.length > 0 ? { count: result.numberChangeHistory.length } : { reason: 'field_not_present' },
  )

  pushDiagnostic(
    result.parserDiagnostics,
    'vehicleHistory.meta',
    true,
    'record-api',
    {
      carId: cleanText(carId),
      vehicleNo: overview.vehicleNo || '',
      openData: result.overview.openData || '',
    },
  )

  result.available = Boolean(
    Object.keys(result.overview).length
      || Object.values(result.statistics).some((value) => value !== null && value !== undefined)
      || result.uninsuredPeriods.length
      || result.ownerChanges.length
      || result.accidentDetails.length
      || result.numberChangeHistory.length
  )

  return result
}

export function parseEncarHistoryRecord(record, meta = {}) {
  return buildHistoryFromRecord(record, meta)
}

export function parseEncarHistoryHtml(html, { sourceUrl = '' } = {}) {
  const result = createHistorySkeleton()
  result.sourceUrl = sourceUrl

  const $ = load(html)
  result.pageType = detectPageType($, html)
  if (result.pageType === 'index_shell') {
    result.parserDiagnostics.push({
      field: 'vehicleHistory',
      found: false,
      strategy: 'page-detect',
      reason: 'redirected_to_index_shell',
    })
    return result
  }

  if (result.pageType === 'detail_shell') {
    result.parserDiagnostics.push({
      field: 'vehicleHistory',
      found: false,
      strategy: 'page-detect',
      reason: 'detail_shell_requires_record_api',
    })
    return result
  }

  result.overview = parseOverviewSection($, result.parserDiagnostics)
  result.statistics = parseStatisticsSection($, result.parserDiagnostics)
  result.uninsuredPeriods = parseUninsuredPeriodsSection($, result.parserDiagnostics)
  result.ownerChanges = parseOwnerChangesSection($, result.parserDiagnostics)
  result.available = Boolean(
    Object.values(result.overview).some((value) => value !== null && value !== '')
    || Object.values(result.statistics).some((value) => value !== null && value !== '')
    || result.uninsuredPeriods.length
    || result.ownerChanges.length
  )

  return result
}

async function fetchHistoryHtmlFallback(carId) {
  let lastParsed = createHistorySkeleton()

  for (const buildUrl of HISTORY_URLS) {
    const url = buildUrl({ carId })
    const response = await historyHtmlClient.get(url)
    const html = iconv.decode(Buffer.from(response.data), 'euc-kr')
    const parsed = parseEncarHistoryHtml(html, { sourceUrl: `https://www.encar.com${url}` })

    lastParsed = parsed
    if (parsed.available || parsed.pageType !== 'index_shell') {
      return parsed
    }
  }

  return lastParsed
}

export async function fetchEncarHistory(carId, { vehicleNo = '' } = {}) {
  let resolvedVehicleNo = cleanText(vehicleNo)
  let resolvedCarId = cleanText(carId)
  let detailSourceUrl = ''
  let detailState = null

  if (!resolvedVehicleNo) {
    try {
      const femDetail = await fetchFemDetailState(carId)
      detailState = femDetail.state
      detailSourceUrl = femDetail.sourceUrl
      resolvedVehicleNo = resolveVehicleNoFromState(femDetail.state)
      resolvedCarId = resolveVehicleIdFromState(femDetail.state, carId)
      if (!resolvedVehicleNo) {
        const rawMatch = femDetail.html.match(/"vehicleNo":"([^"]+)"/)
        resolvedVehicleNo = cleanText(rawMatch?.[1] || '')
      }
    } catch (detailError) {
      const fallback = await fetchHistoryHtmlFallback(carId)
      fallback.parserDiagnostics.push({
        field: 'vehicleHistory.vehicleNo',
        found: false,
        strategy: 'detail-shell',
        reason: detailError.message,
      })
      return fallback
    }
  }

  if (!resolvedVehicleNo) {
    const fallback = await fetchHistoryHtmlFallback(carId)
    fallback.parserDiagnostics.push({
      field: 'vehicleHistory.vehicleNo',
      found: false,
      strategy: 'detail-shell',
      reason: 'vehicle_no_not_found',
      sourceUrl: detailSourceUrl,
    })
    return fallback
  }

  async function fetchRecord(targetCarId) {
    const recordUrl = `/v1/readside/record/vehicle/${encodeURIComponent(targetCarId)}/open`
    const response = await historyApiClient.get(recordUrl, {
      params: { vehicleNo: resolvedVehicleNo },
    })

    return buildHistoryFromRecord(response.data, {
      carId: targetCarId,
      vehicleNo: resolvedVehicleNo,
      sourceUrl: `https://api.encar.com${recordUrl}?vehicleNo=${encodeURIComponent(resolvedVehicleNo)}`,
    })
  }

  try {
    return await fetchRecord(resolvedCarId)
  } catch (error) {
    const shouldResolveAlias = (!detailState || resolveVehicleIdFromState(detailState, carId) === cleanText(carId)) && error.response?.status === 404

    if (shouldResolveAlias) {
      try {
        const femDetail = await fetchFemDetailState(carId)
        detailState = femDetail.state
        detailSourceUrl = femDetail.sourceUrl
        resolvedCarId = resolveVehicleIdFromState(femDetail.state, carId)
        resolvedVehicleNo = resolvedVehicleNo || resolveVehicleNoFromState(femDetail.state)
        if (resolvedCarId && resolvedCarId !== cleanText(carId) && resolvedVehicleNo) {
          const aliased = await fetchRecord(resolvedCarId)
          aliased.parserDiagnostics.push({
            field: 'vehicleHistory.aliasVehicleId',
            found: true,
            strategy: 'detail-shell',
            sourceUrl: detailSourceUrl,
            requestedCarId: cleanText(carId),
            resolvedCarId,
          })
          return aliased
        }
      } catch {
        // Fall back to HTML parser below.
      }
    }

    const fallback = await fetchHistoryHtmlFallback(carId)
    fallback.parserDiagnostics.push({
      field: 'vehicleHistory.recordApi',
      found: false,
      strategy: 'record-api',
      reason: error.response?.status ? `http_${error.response.status}` : error.message,
      vehicleNo: resolvedVehicleNo,
      sourceUrl: `https://api.encar.com/v1/readside/record/vehicle/${encodeURIComponent(resolvedCarId)}/open?vehicleNo=${encodeURIComponent(resolvedVehicleNo)}`,
    })
    if (detailSourceUrl && resolvedCarId !== cleanText(carId)) {
      fallback.parserDiagnostics.push({
        field: 'vehicleHistory.aliasVehicleId',
        found: true,
        strategy: 'detail-shell',
        sourceUrl: detailSourceUrl,
        requestedCarId: cleanText(carId),
        resolvedCarId,
      })
    }
    return fallback
  }
}
