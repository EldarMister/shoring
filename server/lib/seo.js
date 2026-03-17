import pool from '../db.js'
import { buildBlockedCatalogPriceSql, getBlockedCatalogPriceReason } from './catalogPriceRules.js'
import { buildBlockedGenericVehicleSql, getBlockedGenericVehicleReason } from './catalogVehicleRules.js'
import {
  buildAbsoluteUrl,
  buildCarSeo,
  buildNotFoundSeo,
  buildPartSeo,
  buildStaticRouteSeo,
  matchStaticSeoRoute,
  normalizePathname,
  resolveSiteOrigin,
  SITE_URL,
} from '../../shared/seo.js'

const SITEMAP_CACHE_TTL_MS = 15 * 60 * 1000

let sitemapCache = {
  origin: '',
  xml: '',
  expiresAt: 0,
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeXml(value) {
  return escapeHtml(value)
}

function replaceTag(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement)
  }
  return html.replace('</head>', `${replacement}\n  </head>`)
}

function replaceTitle(html, title) {
  return replaceTag(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
}

function replaceMetaTag(html, attrName, attrValue, content) {
  const replacement = `<meta ${attrName}="${attrValue}" content="${escapeHtml(content)}" />`
  const pattern = new RegExp(`<meta\\b(?=[^>]*\\b${attrName}=["']${attrValue}["'])[^>]*>`, 'i')
  return replaceTag(html, pattern, replacement)
}

function replaceLinkTag(html, rel, href) {
  const replacement = `<link rel="${rel}" href="${escapeHtml(href)}" />`
  const pattern = new RegExp(`<link\\b(?=[^>]*\\brel=["']${rel}["'])[^>]*>`, 'i')
  return replaceTag(html, pattern, replacement)
}

function replaceJsonLd(html, schema) {
  const serialized = Array.isArray(schema) ? schema.filter(Boolean) : [schema].filter(Boolean)
  const json = serialized.length
    ? JSON.stringify(serialized).replace(/</g, '\\u003c')
    : ''
  const script = serialized.length
    ? `<script id="app-seo-jsonld" type="application/ld+json">${json}</script>`
    : ''
  const marker = '<!--SEO_JSON_LD-->'

  if (html.includes(marker)) {
    return html.replace(marker, script)
  }

  const pattern = /<script\b[^>]*id=["']app-seo-jsonld["'][^>]*>[\s\S]*?<\/script>/i
  if (script) {
    return replaceTag(html, pattern, script)
  }
  return html.replace(pattern, '')
}

function toSearchString(req) {
  const index = String(req.originalUrl || '').indexOf('?')
  return index >= 0 ? String(req.originalUrl || '').slice(index) : ''
}

function getPrimaryOrigin() {
  return resolveSiteOrigin(
    globalThis.process?.env?.PUBLIC_SITE_URL
    || globalThis.process?.env?.SITE_URL
    || globalThis.process?.env?.BASE_URL
    || SITE_URL
  )
}

function buildCarRouteMeta(pathname) {
  const normalizedPath = normalizePathname(pathname)
  const matchedCatalog = normalizedPath.match(/^\/catalog\/(\d+)$/)
  if (matchedCatalog) {
    return { id: matchedCatalog[1], listingType: 'main', sectionName: 'Каталог', sectionPath: '/catalog' }
  }

  const matchedUrgent = normalizedPath.match(/^\/urgent-sale\/(\d+)$/)
  if (matchedUrgent) {
    return { id: matchedUrgent[1], listingType: 'urgent', sectionName: 'Срочная продажа', sectionPath: '/urgent-sale' }
  }

  const matchedDamaged = normalizedPath.match(/^\/damaged-stock\/(\d+)$/)
  if (matchedDamaged) {
    return { id: matchedDamaged[1], listingType: 'damaged', sectionName: 'Битые авто', sectionPath: '/damaged-stock' }
  }

  return null
}

function buildPartRouteMeta(pathname) {
  const normalizedPath = normalizePathname(pathname)
  const matched = normalizedPath.match(/^\/damaged-stock\/parts\/(\d+)$/)
  if (!matched) return null
  return { id: matched[1], sectionPath: '/damaged-stock/parts' }
}

async function fetchSeoCar(id, listingType) {
  const result = await pool.query(
    `SELECT c.id,
            c.name,
            c.model,
            c.year,
            c.mileage,
            c.fuel_type,
            c.drive_type,
            c.body_type,
            c.vehicle_class,
            c.trim_level,
            c.body_color,
            c.location,
            c.price_usd,
            c.price_krw,
            c.encar_id,
            c.created_at,
            c.updated_at,
            COALESCE(
              json_agg(json_build_object('url', ci.url) ORDER BY ci.position ASC)
              FILTER (WHERE ci.id IS NOT NULL),
              '[]'
            ) AS images
       FROM cars c
       LEFT JOIN car_images ci ON ci.car_id = c.id
      WHERE c.id = $1
        AND c.listing_type = $2
        AND NOT ${buildBlockedCatalogPriceSql('c')}
        AND NOT ${buildBlockedGenericVehicleSql('c')}
      GROUP BY c.id
      LIMIT 1`,
    [id, listingType]
  )

  if (!result.rows.length) return null
  const row = result.rows[0]

  const priceBlockReason = getBlockedCatalogPriceReason({
    priceKrw: row.price_krw,
    priceUsd: row.price_usd,
  })
  const vehicleBlockReason = getBlockedGenericVehicleReason({
    name: row.name,
    model: row.model,
  })

  if (priceBlockReason || vehicleBlockReason) return null
  return row
}

async function fetchSeoPart(id) {
  const result = await pool.query(
    `SELECT p.id,
            p.title,
            p.brand,
            p.model,
            p.category,
            p.condition,
            p.side_location,
            p.article_number,
            p.price,
            p.in_stock,
            p.created_at,
            p.updated_at,
            COALESCE(
              json_agg(json_build_object('url', pi.url) ORDER BY pi.position ASC)
              FILTER (WHERE pi.id IS NOT NULL),
              '[]'
            ) AS images
       FROM parts p
       LEFT JOIN part_images pi ON pi.part_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
      LIMIT 1`,
    [id]
  )

  return result.rows[0] || null
}

function toIsoDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function buildUrlEntry(loc, lastmod = '', priority = '') {
  return [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : '',
    priority ? `    <priority>${escapeXml(priority)}</priority>` : '',
    '  </url>',
  ].filter(Boolean).join('\n')
}

export function injectSeoIntoHtml(template, seo) {
  let html = String(template || '')
  const resolvedSeo = seo || buildStaticRouteSeo({ pathname: '/', origin: SITE_URL })

  html = replaceTitle(html, resolvedSeo.title)
  html = replaceMetaTag(html, 'name', 'description', resolvedSeo.description)
  html = replaceMetaTag(html, 'name', 'robots', resolvedSeo.robots)
  html = replaceMetaTag(html, 'name', 'theme-color', '#f5f8fc')
  html = replaceLinkTag(html, 'canonical', resolvedSeo.canonical)

  html = replaceMetaTag(html, 'property', 'og:type', resolvedSeo.type || 'website')
  html = replaceMetaTag(html, 'property', 'og:site_name', 'AVT Auto V Korea')
  html = replaceMetaTag(html, 'property', 'og:locale', 'ru_RU')
  html = replaceMetaTag(html, 'property', 'og:title', resolvedSeo.title)
  html = replaceMetaTag(html, 'property', 'og:description', resolvedSeo.description)
  html = replaceMetaTag(html, 'property', 'og:url', resolvedSeo.canonical)
  html = replaceMetaTag(html, 'property', 'og:image', resolvedSeo.image)

  html = replaceMetaTag(html, 'name', 'twitter:card', 'summary_large_image')
  html = replaceMetaTag(html, 'name', 'twitter:title', resolvedSeo.title)
  html = replaceMetaTag(html, 'name', 'twitter:description', resolvedSeo.description)
  html = replaceMetaTag(html, 'name', 'twitter:image', resolvedSeo.image)
  html = replaceMetaTag(html, 'name', 'twitter:site', '@avt_shoring')

  html = replaceJsonLd(html, resolvedSeo.schema)
  return html
}

export async function resolveRequestSeo(req) {
  const origin = getPrimaryOrigin()
  const pathname = normalizePathname(req.path || '/')
  const search = toSearchString(req)

  const partRoute = buildPartRouteMeta(pathname)
  if (partRoute) {
    const part = await fetchSeoPart(partRoute.id)
    if (!part) {
      return {
        seo: buildNotFoundSeo({ pathname, origin, title: 'Запчасть не найдена' }),
        statusCode: 404,
      }
    }

    return {
      seo: buildPartSeo({ part, pathname, origin }),
      statusCode: 200,
    }
  }

  const carRoute = buildCarRouteMeta(pathname)
  if (carRoute) {
    const car = await fetchSeoCar(carRoute.id, carRoute.listingType)
    if (!car) {
      return {
        seo: buildNotFoundSeo({ pathname, origin, title: 'Автомобиль не найден' }),
        statusCode: 404,
      }
    }

    return {
      seo: buildCarSeo({
        car,
        pathname,
        origin,
        sectionName: carRoute.sectionName,
        sectionPath: carRoute.sectionPath,
      }),
      statusCode: 200,
    }
  }

  if (matchStaticSeoRoute(pathname)) {
    return {
      seo: buildStaticRouteSeo({ pathname, search, origin }),
      statusCode: 200,
    }
  }

  return {
    seo: buildNotFoundSeo({ pathname, origin, title: 'Страница не найдена' }),
    statusCode: 404,
  }
}

export function buildRobotsTxt(origin = SITE_URL) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  return [
    'User-agent: *',
    'Allow: /',
    '',
    `Host: ${new URL(resolvedOrigin).host}`,
    `Sitemap: ${resolvedOrigin}/sitemap.xml`,
    '',
  ].join('\n')
}

async function generateSitemapXml(origin = SITE_URL) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  const staticEntries = [
    { path: '/', priority: '1.0' },
    { path: '/catalog', priority: '0.9' },
    { path: '/urgent-sale', priority: '0.8' },
    { path: '/damaged-stock', priority: '0.8' },
    { path: '/damaged-stock/parts', priority: '0.7' },
    { path: '/delivery-price-list', priority: '0.7' },
    { path: '/contacts', priority: '0.6' },
  ]

  const [carsResult, partsResult] = await Promise.all([
    pool.query(
      `SELECT id, listing_type, GREATEST(COALESCE(updated_at, created_at), created_at) AS lastmod
         FROM cars c
        WHERE NOT ${buildBlockedCatalogPriceSql('c')}
          AND NOT ${buildBlockedGenericVehicleSql('c')}`
    ),
    pool.query(
      `SELECT id, GREATEST(COALESCE(updated_at, created_at), created_at) AS lastmod
         FROM parts`
    ),
  ])

  const urls = [
    ...staticEntries.map((entry) => buildUrlEntry(buildAbsoluteUrl(entry.path, resolvedOrigin), '', entry.priority)),
    ...carsResult.rows.map((row) => {
      const path = row.listing_type === 'urgent'
        ? `/urgent-sale/${row.id}`
        : row.listing_type === 'damaged'
          ? `/damaged-stock/${row.id}`
          : `/catalog/${row.id}`
      return buildUrlEntry(buildAbsoluteUrl(path, resolvedOrigin), toIsoDate(row.lastmod), '0.6')
    }),
    ...partsResult.rows.map((row) => (
      buildUrlEntry(buildAbsoluteUrl(`/damaged-stock/parts/${row.id}`, resolvedOrigin), toIsoDate(row.lastmod), '0.5')
    )),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
  ].join('\n')
}

export async function getSitemapXml(origin = SITE_URL) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  const now = Date.now()

  if (
    sitemapCache.xml &&
    sitemapCache.origin === resolvedOrigin &&
    sitemapCache.expiresAt > now
  ) {
    return sitemapCache.xml
  }

  const xml = await generateSitemapXml(resolvedOrigin)
  sitemapCache = {
    origin: resolvedOrigin,
    xml,
    expiresAt: now + SITEMAP_CACHE_TTL_MS,
  }
  return xml
}
