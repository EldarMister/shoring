const BRAND_ALIAS_GROUPS = [
  {
    canonical: 'Kia',
    matchers: [/\bkia\b/i, /\bgia\b/i, /\uAE30\uC544/u],
    sqlTerms: ['kia', 'gia', '\uAE30\uC544'],
  },
  {
    canonical: 'Hyundai',
    matchers: [/\bhyundai\b/i, /\bhyeondae\b/i, /\uD604\uB300/u],
    sqlTerms: ['hyundai', 'hyeondae', '\uD604\uB300'],
  },
  {
    canonical: 'Genesis',
    matchers: [/\bgenesis\b/i, /\bjenesiseu\b/i, /\uC81C\uB124\uC2DC\uC2A4/u],
    sqlTerms: ['genesis', 'jenesiseu', '\uC81C\uB124\uC2DC\uC2A4'],
  },
]

function findBrandAliasGroup(value) {
  const text = String(value || '').trim()
  if (!text || text === '-') return null
  return BRAND_ALIAS_GROUPS.find(({ matchers }) => matchers.some((matcher) => matcher.test(text))) || null
}

export function normalizeKnownBrandAlias(value) {
  return findBrandAliasGroup(value)?.canonical || ''
}

export function getKnownBrandSqlPatterns(value) {
  const group = findBrandAliasGroup(value)
  return group ? group.sqlTerms.map((term) => `%${term}%`) : []
}
