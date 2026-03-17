import { useEffect } from 'react'
import { DEFAULT_OG_IMAGE, DEFAULT_THEME_COLOR, SITE_NAME } from '../../../shared/seo.js'

const JSON_LD_SCRIPT_ID = 'app-seo-jsonld'

function ensureHeadElement(tagName, selector, attributes = {}) {
  const head = document.head || document.getElementsByTagName('head')[0]
  let element = head.querySelector(selector)

  if (!element) {
    element = document.createElement(tagName)
    head.appendChild(element)
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      element.setAttribute(key, value)
    }
  })

  return element
}

function setMeta(selector, attributes) {
  const element = ensureHeadElement('meta', selector, attributes)
  if (attributes.content !== undefined) {
    element.setAttribute('content', attributes.content)
  }
}

function setLink(selector, attributes) {
  ensureHeadElement('link', selector, attributes)
}

function normalizeSchema(schema) {
  if (!schema) return []
  return Array.isArray(schema) ? schema.filter(Boolean) : [schema].filter(Boolean)
}

export default function Seo({
  title,
  description,
  canonical,
  robots = 'index,follow',
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  schema = [],
  themeColor = DEFAULT_THEME_COLOR,
}) {
  useEffect(() => {
    const resolvedTitle = title || SITE_NAME
    const resolvedDescription = description || ''
    const resolvedCanonical = canonical || window.location.href
    const normalizedSchema = normalizeSchema(schema)

    document.title = resolvedTitle
    document.documentElement.lang = 'ru'

    setMeta('meta[name="description"]', { name: 'description', content: resolvedDescription })
    setMeta('meta[name="robots"]', { name: 'robots', content: robots })
    setMeta('meta[name="theme-color"]', { name: 'theme-color', content: themeColor })

    setLink('link[rel="canonical"]', { rel: 'canonical', href: resolvedCanonical })

    setMeta('meta[property="og:type"]', { property: 'og:type', content: type })
    setMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
    setMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' })
    setMeta('meta[property="og:title"]', { property: 'og:title', content: resolvedTitle })
    setMeta('meta[property="og:description"]', { property: 'og:description', content: resolvedDescription })
    setMeta('meta[property="og:url"]', { property: 'og:url', content: resolvedCanonical })
    setMeta('meta[property="og:image"]', { property: 'og:image', content: image || DEFAULT_OG_IMAGE })

    setMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
    setMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: resolvedTitle })
    setMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: resolvedDescription })
    setMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image || DEFAULT_OG_IMAGE })
    setMeta('meta[name="twitter:site"]', { name: 'twitter:site', content: '@avt_shoring' })

    const head = document.head || document.getElementsByTagName('head')[0]
    let script = document.getElementById(JSON_LD_SCRIPT_ID)

    if (!normalizedSchema.length) {
      if (script) script.remove()
      return undefined
    }

    if (!script) {
      script = document.createElement('script')
      script.id = JSON_LD_SCRIPT_ID
      script.type = 'application/ld+json'
      head.appendChild(script)
    }

    script.textContent = JSON.stringify(normalizedSchema, null, 2)

    return undefined
  }, [canonical, description, image, robots, schema, themeColor, title, type])

  return null
}
