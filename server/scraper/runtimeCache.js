import fs from 'fs/promises'
import path from 'path'

const CACHE_VERSION = 2
const LIST_PAGE_TTL_MS = 18 * 60 * 60 * 1000
const MAX_LIST_PAGE_ENTRIES = 240
const SKIP_DECISION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SKIP_DECISION_ENTRIES = 5000
const CACHE_FILE = path.join(process.cwd(), 'server', 'scraper', '.runtime-cache.json')

function createEmptyCache() {
  return {
    version: CACHE_VERSION,
    listPages: {},
    skipDecisions: {},
  }
}

let runtimeCache = createEmptyCache()
let cacheLoaded = false
let loadPromise = null
let persistTimer = null

function listPageKey(parseScope, offset) {
  return `${String(parseScope || 'all').trim()}:${Number(offset) || 0}`
}

function skipDecisionKey(encarId) {
  return String(encarId || '').trim()
}

function normalizeModifiedDate(value) {
  return String(value || '').trim()
}

function pruneListPages(now = Date.now()) {
  const entries = Object.entries(runtimeCache.listPages || {})
  const freshEntries = entries.filter(([, entry]) => {
    const touchedAt = Number(entry?.touchedAt) || 0
    return touchedAt > 0 && (now - touchedAt) <= LIST_PAGE_TTL_MS
  })

  if (freshEntries.length <= MAX_LIST_PAGE_ENTRIES) {
    runtimeCache.listPages = Object.fromEntries(freshEntries)
    return
  }

  const limited = freshEntries
    .sort((left, right) => (Number(right[1]?.touchedAt) || 0) - (Number(left[1]?.touchedAt) || 0))
    .slice(0, MAX_LIST_PAGE_ENTRIES)

  runtimeCache.listPages = Object.fromEntries(limited)
}

function pruneSkipDecisions(now = Date.now()) {
  const entries = Object.entries(runtimeCache.skipDecisions || {})
  const freshEntries = entries.filter(([, entry]) => {
    const touchedAt = Number(entry?.touchedAt) || 0
    return touchedAt > 0 && (now - touchedAt) <= SKIP_DECISION_TTL_MS
  })

  if (freshEntries.length <= MAX_SKIP_DECISION_ENTRIES) {
    runtimeCache.skipDecisions = Object.fromEntries(freshEntries)
    return
  }

  const limited = freshEntries
    .sort((left, right) => (Number(right[1]?.touchedAt) || 0) - (Number(left[1]?.touchedAt) || 0))
    .slice(0, MAX_SKIP_DECISION_ENTRIES)

  runtimeCache.skipDecisions = Object.fromEntries(limited)
}

function normalizeCache(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyCache()
  const normalized = {
    version: CACHE_VERSION,
    listPages: raw.listPages && typeof raw.listPages === 'object' ? raw.listPages : {},
    skipDecisions: raw.skipDecisions && typeof raw.skipDecisions === 'object' ? raw.skipDecisions : {},
  }
  runtimeCache = normalized
  pruneListPages()
  pruneSkipDecisions()
  return runtimeCache
}

function schedulePersist() {
  if (!cacheLoaded) return
  if (persistTimer) clearTimeout(persistTimer)

  persistTimer = setTimeout(async () => {
    persistTimer = null
    pruneListPages()
    pruneSkipDecisions()
    try {
      await fs.writeFile(CACHE_FILE, JSON.stringify(runtimeCache, null, 2), 'utf8')
    } catch {
      // Cache persistence is best-effort only.
    }
  }, 250)

  persistTimer.unref?.()
}

export async function loadScraperRuntimeCache() {
  if (cacheLoaded) return runtimeCache
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const raw = await fs.readFile(CACHE_FILE, 'utf8')
      normalizeCache(JSON.parse(raw))
    } catch {
      runtimeCache = createEmptyCache()
    }

    cacheLoaded = true
    return runtimeCache
  })()

  return loadPromise
}

export function getListPageSnapshot(parseScope, offset) {
  if (!cacheLoaded) return null

  pruneListPages()
  const entry = runtimeCache.listPages[listPageKey(parseScope, offset)]
  if (!entry) return null

  return { ...entry }
}

export function rememberListPageSnapshot(parseScope, offset, snapshot = {}) {
  if (!cacheLoaded) return null

  const now = Date.now()
  runtimeCache.listPages[listPageKey(parseScope, offset)] = {
    parseScope: String(parseScope || 'all').trim() || 'all',
    offset: Number(offset) || 0,
    fingerprint: String(snapshot.fingerprint || '').trim(),
    knownOnly: Boolean(snapshot.knownOnly),
    freshCount: Math.max(0, Number(snapshot.freshCount) || 0),
    scanned: Math.max(0, Number(snapshot.scanned) || 0),
    total: Math.max(0, Number(snapshot.total) || 0),
    source: String(snapshot.source || '').trim(),
    touchedAt: now,
  }

  pruneListPages(now)
  schedulePersist()
  return getListPageSnapshot(parseScope, offset)
}

export function getSkipDecisionSnapshot(encarId, modifiedDate) {
  if (!cacheLoaded) return null

  const key = skipDecisionKey(encarId)
  const normalizedModifiedDate = normalizeModifiedDate(modifiedDate)
  if (!key || !normalizedModifiedDate) return null

  pruneSkipDecisions()
  const entry = runtimeCache.skipDecisions[key]
  if (!entry) return null
  if (normalizeModifiedDate(entry.modifiedDate) !== normalizedModifiedDate) return null

  return { ...entry }
}

export function rememberSkipDecision(encarId, modifiedDate, decision = {}) {
  if (!cacheLoaded) return null

  const key = skipDecisionKey(encarId)
  const normalizedModifiedDate = normalizeModifiedDate(modifiedDate)
  const reason = String(decision.reason || '').trim()
  if (!key || !normalizedModifiedDate || !reason) return null

  const now = Date.now()
  runtimeCache.skipDecisions[key] = {
    encarId: key,
    modifiedDate: normalizedModifiedDate,
    reason,
    details: String(decision.details || '').trim(),
    duplicateId: Number.isFinite(Number(decision.duplicateId)) ? Number(decision.duplicateId) : null,
    touchedAt: now,
  }

  pruneSkipDecisions(now)
  schedulePersist()
  return getSkipDecisionSnapshot(key, normalizedModifiedDate)
}

export function clearSkipDecision(encarId) {
  if (!cacheLoaded) return

  const key = skipDecisionKey(encarId)
  if (!key || !runtimeCache.skipDecisions[key]) return

  delete runtimeCache.skipDecisions[key]
  schedulePersist()
}
