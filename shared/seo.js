export const SITE_NAME = 'AVT Auto V Korea'
export const SITE_URL = 'https://avt-autovtrade.com'
export const DEFAULT_OG_IMAGE = `${SITE_URL}/favicon.jpeg`
export const DEFAULT_THEME_COLOR = '#f5f8fc'
export const DEFAULT_TITLE = `${SITE_NAME} | Автомобили из Кореи с доставкой`
export const DEFAULT_DESCRIPTION = 'Подбор, покупка и доставка автомобилей из Кореи в Кыргызстан, Россию и другие страны. Каталог Encar, срочная продажа, битые авто, запчасти и прозрачный расчет стоимости.'

const DEFAULT_ROBOTS = 'index,follow'
const NOINDEX_ROBOTS = 'noindex,follow'

const STATIC_ROUTE_DEFINITIONS = [
  {
    path: '/damaged-stock/parts',
    kind: 'collection',
    title: 'Запчасти из Кореи | Каталог деталей | AVT Auto V Korea',
    description: 'Каталог запчастей из Кореи для битых и донорских автомобилей: кузовные детали, оптика, салон, электроника и другие комплектующие.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Битые авто', path: '/damaged-stock' },
      { name: 'Запчасти', path: '/damaged-stock/parts' },
    ],
  },
  {
    path: '/damaged-stock',
    kind: 'collection',
    title: 'Битые авто из Кореи | Каталог поврежденных автомобилей | AVT Auto V Korea',
    description: 'Каталог битых автомобилей из Кореи: фото, повреждения, технические данные, карточки лотов и подбор вариантов под восстановление или разбор.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Битые авто', path: '/damaged-stock' },
    ],
  },
  {
    path: '/urgent-sale',
    kind: 'collection',
    title: 'Срочная продажа авто из Кореи | AVT Auto V Korea',
    description: 'Срочная продажа автомобилей из Кореи с подробными карточками, комплектациями, фото, пробегом и расчетом доставки под ключ.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Срочная продажа', path: '/urgent-sale' },
    ],
  },
  {
    path: '/catalog',
    kind: 'collection',
    title: 'Каталог авто из Кореи | Encar и локальные объявления | AVT Auto V Korea',
    description: 'Каталог автомобилей из Кореи с Encar и локальными объявлениями: фото, пробег, комплектации, цены, доставка и расчет итоговой стоимости.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Каталог', path: '/catalog' },
    ],
  },
  {
    path: '/delivery-price-list',
    kind: 'service',
    title: 'Стоимость доставки авто из Кореи | Прайс по странам | AVT Auto V Korea',
    description: 'Прайс доставки автомобилей из Кореи в Кыргызстан, Казахстан, Россию, Узбекистан и другие страны. Контейнер, Ro-Ro и профили доставки.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Прайс доставки', path: '/delivery-price-list' },
    ],
  },
  {
    path: '/contacts',
    kind: 'contact',
    title: 'Контакты AVT Auto V Korea | Офис в Корее и связь',
    description: 'Контакты AVT Auto V Korea: WhatsApp, телефон, email, Instagram, YouTube, TikTok и адрес офиса в Корее для связи и консультации.',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Контакты', path: '/contacts' },
    ],
  },
  {
    path: '/admin',
    kind: 'admin',
    title: 'AVT Admin | Служебная панель',
    description: 'Служебная панель управления AVT Auto V Korea.',
    robots: 'noindex,nofollow',
    breadcrumb: [
      { name: 'Главная', path: '/' },
      { name: 'Admin', path: '/admin' },
    ],
  },
  {
    path: '/',
    kind: 'home',
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    breadcrumb: [{ name: 'Главная', path: '/' }],
  },
]

const COUNTRY_LABELS = ['Кыргызстан', 'Россия', 'Казахстан', 'Узбекистан', 'Таджикистан', 'Беларусь', 'Азербайджан', 'Украина']

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function truncateText(value, maxLength = 170) {
  const text = cleanText(value)
  if (!text || text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1).trimEnd()}…`
}

function extractYear(value) {
  const match = cleanText(value).match(/\d{4}/)
  if (!match) return null
  const year = Number.parseInt(match[0], 10)
  return Number.isFinite(year) ? year : null
}

function formatInteger(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return ''
  return Math.round(number).toLocaleString('ru-RU')
}

function ensureLeadingSlash(pathname) {
  const normalized = cleanText(pathname)
  if (!normalized) return '/'
  return normalized.startsWith('/') ? normalized : `/${normalized}`
}

export function normalizePathname(pathname) {
  const normalized = ensureLeadingSlash(pathname).replace(/\/{2,}/g, '/')
  if (normalized !== '/' && normalized.endsWith('/')) return normalized.slice(0, -1)
  return normalized
}

export function buildAbsoluteUrl(pathname, origin = SITE_URL) {
  const base = cleanText(origin) || SITE_URL
  return new URL(normalizePathname(pathname), base.endsWith('/') ? base : `${base}/`).toString()
}

export function resolveSiteOrigin(inputOrigin) {
  return cleanText(inputOrigin) || SITE_URL
}

export function isParameterizedListingPage(pathname, search = '') {
  const normalizedPath = normalizePathname(pathname)
  const hasQuery = cleanText(String(search || '').replace(/^\?/, '')) !== ''
  if (!hasQuery) return false
  return (
    normalizedPath === '/catalog' ||
    normalizedPath === '/urgent-sale' ||
    normalizedPath === '/damaged-stock' ||
    normalizedPath === '/damaged-stock/parts'
  )
}

export function matchStaticSeoRoute(pathname) {
  const normalizedPath = normalizePathname(pathname)
  return STATIC_ROUTE_DEFINITIONS.find((route) => route.path === normalizedPath) || null
}

export function buildBreadcrumbSchema(items, origin = SITE_URL) {
  if (!Array.isArray(items) || !items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: cleanText(item?.name) || `Шаг ${index + 1}`,
      item: buildAbsoluteUrl(item?.path || '/', origin),
    })),
  }
}

export function buildOrganizationSchema(origin = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoDealer',
    name: SITE_NAME,
    url: resolveSiteOrigin(origin),
    logo: `${resolveSiteOrigin(origin)}/favicon.jpeg`,
    image: `${resolveSiteOrigin(origin)}/favicon.jpeg`,
    email: 'mailto:avt.shoring@gmail.com',
    telephone: ['+82 10-5665-0943', '+82 10 6568-0943', '+996 779 574 444'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: '1550 Oryu-dong, Seo-gu',
      addressLocality: 'Incheon',
      addressCountry: 'KR',
    },
    areaServed: COUNTRY_LABELS.map((name) => ({ '@type': 'Country', name })),
    sameAs: [
      'https://www.instagram.com/avt_shoring?igsh=MXhnYTgzaGJ3aGZiNQ==',
      'https://youtube.com/@avt_korea?si=svDsGDPlZS4lQy4s',
      'https://www.tiktok.com/@avt.korea?_r=1&_t=ZS-94i804TOyQx',
    ],
  }
}

export function buildWebsiteSchema(origin = SITE_URL) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: resolvedOrigin,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${resolvedOrigin}/catalog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

export function buildWebPageSchema({ name, description, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: cleanText(name),
    description: truncateText(description),
    url: cleanText(url),
  }
}

export function buildCollectionPageSchema({ name, description, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: cleanText(name),
    description: truncateText(description),
    url: cleanText(url),
  }
}

export function buildItemListSchema({ name, url, items = [] } = {}) {
  const normalized = Array.isArray(items)
    ? items
        .map((item, index) => {
          const itemUrl = cleanText(item?.url)
          if (!itemUrl) return null
          return {
            '@type': 'ListItem',
            position: index + 1,
            url: itemUrl,
            name: cleanText(item?.name) || undefined,
          }
        })
        .filter(Boolean)
    : []

  if (!normalized.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: cleanText(name) || undefined,
    url: cleanText(url) || undefined,
    numberOfItems: normalized.length,
    itemListElement: normalized,
  }
}

export function buildFaqSchema(items = []) {
  const normalized = Array.isArray(items)
    ? items
        .map((item) => {
          const question = cleanText(item?.question)
          const answer = cleanText(item?.answer)
          if (!question || !answer) return null
          return {
            '@type': 'Question',
            name: question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: answer,
            },
          }
        })
        .filter(Boolean)
    : []

  if (!normalized.length) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: normalized,
  }
}

const HOME_FAQ_ITEMS = [
  {
    question: 'Сколько занимает доставка авто из Кореи?',
    answer: 'В среднем 25–45 дней с момента покупки на Encar до получения в стране назначения. Точный срок зависит от страны доставки, способа (контейнер или Ro-Ro) и порта выгрузки.',
  },
  {
    question: 'Как происходит оплата автомобиля из Кореи?',
    answer: 'После подбора и проверки авто на Encar вы переводите задаток, мы выкупаем машину в Корее, отправляем фото и видео. Остаток оплачивается по согласованному графику: перед отправкой либо после прибытия в ваш порт.',
  },
  {
    question: 'Можно ли заказать авто под ключ с растаможкой?',
    answer: 'Да. Мы рассчитываем итоговую стоимость под ключ с учётом пошлин, утильсбора и доставки до вашего города. Расчёт доступен сразу в карточке авто и на странице прайса доставки.',
  },
  {
    question: 'Какие гарантии и проверки предоставляются?',
    answer: 'Каждое авто проходит инспекцию Encar, предоставляем VIN, историю ДТП, отчёт о пробеге и реальные фото осмотра. При необходимости — дополнительная проверка нашим специалистом в Корее.',
  },
  {
    question: 'В какие страны осуществляется доставка?',
    answer: 'Доставляем автомобили из Кореи в Кыргызстан, Казахстан, Россию, Узбекистан, Таджикистан, Беларусь, Азербайджан и Украину. Маршрут и стоимость подбираются индивидуально.',
  },
]

export function buildHomeFaqSchema() {
  return buildFaqSchema(HOME_FAQ_ITEMS)
}

export function buildServiceSchema({ name, description, url }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cleanText(name),
    description: truncateText(description),
    url: cleanText(url),
    provider: {
      '@type': 'AutoDealer',
      name: SITE_NAME,
      url: cleanText(url),
    },
    areaServed: COUNTRY_LABELS.map((countryName) => ({ '@type': 'Country', name: countryName })),
  }
}

function buildContactSchema(origin = SITE_URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Контакты AVT Auto V Korea',
    url: `${resolveSiteOrigin(origin)}/contacts`,
    mainEntity: buildOrganizationSchema(origin),
  }
}

function buildStaticRouteSchemas(route, origin, canonical) {
  const breadcrumb = buildBreadcrumbSchema(route.breadcrumb, origin)
  const pageSchema = route.kind === 'collection'
    ? buildCollectionPageSchema({ name: route.title, description: route.description, url: canonical })
    : route.kind === 'service'
      ? buildServiceSchema({ name: route.title, description: route.description, url: canonical })
      : route.kind === 'contact'
        ? buildContactSchema(origin)
        : buildWebPageSchema({ name: route.title, description: route.description, url: canonical })

  if (route.kind === 'home') {
    return [
      buildOrganizationSchema(origin),
      buildWebsiteSchema(origin),
      buildWebPageSchema({ name: route.title, description: route.description, url: canonical }),
      buildHomeFaqSchema(),
    ].filter(Boolean)
  }

  return [pageSchema, breadcrumb].filter(Boolean)
}

export function buildStaticRouteSeo({ pathname, search = '', origin = SITE_URL } = {}) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  const route = matchStaticSeoRoute(pathname) || STATIC_ROUTE_DEFINITIONS[STATIC_ROUTE_DEFINITIONS.length - 1]
  const shouldNoindex = route.kind !== 'home' && isParameterizedListingPage(pathname, search)
  const canonicalPath = shouldNoindex ? route.path : normalizePathname(pathname)
  const canonical = buildAbsoluteUrl(canonicalPath, resolvedOrigin)

  return {
    title: route.title,
    description: route.description,
    canonical,
    robots: route.robots || (shouldNoindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS),
    image: DEFAULT_OG_IMAGE,
    type: 'website',
    schema: buildStaticRouteSchemas(route, resolvedOrigin, canonical),
  }
}

function normalizeImageList(images, origin = SITE_URL) {
  if (!Array.isArray(images)) return []
  return images
    .map((item) => {
      const raw = typeof item === 'string' ? item : item?.url
      const url = cleanText(raw)
      if (!url) return ''
      if (/^https?:\/\//i.test(url)) return url
      return buildAbsoluteUrl(url, origin)
    })
    .filter(Boolean)
}

function pickFirstValue(...values) {
  for (const value of values) {
    const normalized = cleanText(value)
    if (normalized && normalized !== '-') return normalized
  }
  return ''
}

function extractCarBrand(value) {
  const name = cleanText(value)
  if (!name) return ''
  const tokens = name.split(' ').filter(Boolean)
  if (!tokens.length) return ''
  if (tokens.length >= 2 && tokens[0] === 'Mercedes-Benz') return 'Mercedes-Benz'
  return tokens[0]
}

export function buildCarSeo({ car, pathname, origin = SITE_URL, sectionName = 'Каталог', sectionPath = '/catalog' } = {}) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  const name = pickFirstValue(car?.name, car?.model, 'Автомобиль из Кореи')
  const year = extractYear(car?.year)
  const mileage = formatInteger(car?.mileage)
  const fuelType = pickFirstValue(car?.fuelType, car?.fuel_type)
  const bodyType = pickFirstValue(car?.vehicleClass, car?.bodyType, car?.body_type)
  const driveType = pickFirstValue(car?.driveType, car?.drive_type)
  const trimLevel = pickFirstValue(car?.trimLevel, car?.trim_level)
  const transmission = pickFirstValue(car?.transmission)
  const bodyColor = pickFirstValue(car?.bodyColor, car?.body_color)
  const interiorColor = pickFirstValue(car?.interiorColor, car?.interior_color)
  const location = pickFirstValue(car?.location, car?.location_short)
  const canonical = buildAbsoluteUrl(pathname, resolvedOrigin)
  const priceUsd = Number(car?.priceUSD ?? car?.price_usd ?? 0)
  const priceTotal = Number(car?.total ?? 0)
  const images = normalizeImageList(car?.images, resolvedOrigin)
  const vin = pickFirstValue(car?.vin)
  const brandName = extractCarBrand(name)
  const model = pickFirstValue(car?.model, car?.trimLevel, car?.trim_level)

  const priceLabel = priceUsd > 0 ? `${formatInteger(priceUsd)} $` : ''
  const totalLabel = priceTotal > 0 ? `под ключ ${formatInteger(priceTotal)} $` : ''

  // Title carries the highest SEO weight — pack make/model + year + price + section
  // so searchers landing from Google see the relevant car matchup instantly.
  const titleBits = [
    name,
    year ? year : '',
    priceLabel,
  ].filter(Boolean).join(' ')
  const title = `${titleBits} — купить из Кореи | ${sectionName} | ${SITE_NAME}`

  // Description follows Google's 155-char sweet spot and adds commercial intent
  // keywords ("купить", "из Кореи", "доставка") alongside every technical fact
  // we know — so long-tail searches (brand + body type + fuel + year + location)
  // all hit the same detail page.
  const detailParts = [
    year ? `${year} год` : '',
    mileage ? `пробег ${mileage} км` : '',
    bodyType,
    fuelType,
    driveType,
    transmission,
    trimLevel ? `комплектация ${trimLevel}` : '',
    bodyColor ? `цвет ${bodyColor}` : '',
    location ? location : '',
  ].filter(Boolean)
  const priceSentence = priceLabel
    ? ` Цена ${priceLabel}${totalLabel ? `, ${totalLabel}` : ''}.`
    : ''
  const description = truncateText(
    `Купить ${name}${year ? ` ${year}` : ''} из Кореи с доставкой.${priceSentence}${detailParts.length ? ` ${detailParts.join(', ')}.` : ''} Прозрачный расчет через ${SITE_NAME} (Encar).`
  )

  const keywords = [
    name,
    brandName,
    model,
    year ? `${name} ${year}` : '',
    year ? `${brandName || ''} ${year}`.trim() : '',
    bodyType,
    fuelType,
    trimLevel,
    `${name} из Кореи`,
    `купить ${brandName || name}`,
    `${brandName || name} Encar`,
    'авто из Кореи',
    'доставка авто из Кореи',
  ].filter(Boolean).filter((item, index, arr) => arr.indexOf(item) === index).join(', ')

  const schema = {
    '@context': 'https://schema.org',
    '@type': ['Product', 'Car'],
    name,
    description,
    url: canonical,
    image: images,
    brand: brandName ? { '@type': 'Brand', name: brandName } : undefined,
    manufacturer: brandName ? { '@type': 'Organization', name: brandName } : undefined,
    model: model || undefined,
    color: bodyColor || undefined,
    vehicleInteriorColor: interiorColor || undefined,
    vehicleTransmission: transmission || undefined,
    driveWheelConfiguration: driveType || undefined,
    fuelType: fuelType || undefined,
    bodyType: bodyType || undefined,
    productionDate: year ? String(year) : undefined,
    vehicleModelDate: year ? String(year) : undefined,
    sku: pickFirstValue(car?.encarId, car?.encar_id, car?.id) || undefined,
    vehicleIdentificationNumber: vin && /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin) ? vin.toUpperCase() : undefined,
    mileageFromOdometer: Number(car?.mileage) > 0
      ? {
          '@type': 'QuantitativeValue',
          value: Math.round(Number(car.mileage)),
          unitCode: 'KMT',
        }
      : undefined,
    offers: priceUsd > 0
      ? {
          '@type': 'Offer',
          price: Math.round(priceUsd),
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/UsedCondition',
          url: canonical,
          seller: {
            '@type': 'AutoDealer',
            name: SITE_NAME,
            url: resolvedOrigin,
          },
        }
      : undefined,
  }

  return {
    title,
    description,
    keywords,
    canonical,
    robots: DEFAULT_ROBOTS,
    image: images[0] || DEFAULT_OG_IMAGE,
    type: 'product',
    productMeta: priceUsd > 0
      ? {
          price: Math.round(priceUsd),
          currency: 'USD',
          availability: 'instock',
          condition: 'used',
          brand: brandName || undefined,
          category: bodyType || 'Vehicles',
        }
      : undefined,
    schema: [
      buildBreadcrumbSchema([
        { name: 'Главная', path: '/' },
        { name: sectionName, path: sectionPath },
        { name, path: pathname },
      ], resolvedOrigin),
      schema,
    ].filter(Boolean),
  }
}

export function buildPartSeo({ part, pathname, origin = SITE_URL } = {}) {
  const resolvedOrigin = resolveSiteOrigin(origin)
  const titleBase = pickFirstValue(part?.title, 'Запчасть из Кореи')
  const canonical = buildAbsoluteUrl(pathname, resolvedOrigin)
  const price = Number(part?.price || 0)
  const images = normalizeImageList(part?.images, resolvedOrigin)
  const brand = pickFirstValue(part?.brand)
  const model = pickFirstValue(part?.model)
  const category = pickFirstValue(part?.category)
  const condition = pickFirstValue(part?.condition)
  const sideLocation = pickFirstValue(part?.side_location)
  const description = truncateText(
    `${titleBase}${brand ? `, марка ${brand}` : ''}${model ? `, модель ${model}` : ''}${category ? `, категория ${category}` : ''}${condition ? `, состояние ${condition}` : ''}${sideLocation ? `, расположение ${sideLocation}` : ''}. Запчасти из Кореи с консультацией и подбором от ${SITE_NAME}.`
  )

  return {
    title: `${titleBase} | Запчасти из Кореи | ${SITE_NAME}`,
    description,
    canonical,
    robots: DEFAULT_ROBOTS,
    image: images[0] || DEFAULT_OG_IMAGE,
    type: 'product',
    schema: [
      buildBreadcrumbSchema([
        { name: 'Главная', path: '/' },
        { name: 'Битые авто', path: '/damaged-stock' },
        { name: 'Запчасти', path: '/damaged-stock/parts' },
        { name: titleBase, path: pathname },
      ], resolvedOrigin),
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: titleBase,
        description,
        image: images,
        url: canonical,
        sku: pickFirstValue(part?.article_number, part?.id) || undefined,
        brand: brand ? { '@type': 'Brand', name: brand } : undefined,
        category: category || undefined,
        itemCondition: condition ? `https://schema.org/${condition.toLowerCase().includes('нов') ? 'NewCondition' : 'UsedCondition'}` : undefined,
        offers: price > 0
          ? {
              '@type': 'Offer',
              price: Math.round(price),
              priceCurrency: 'USD',
              availability: part?.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
              url: canonical,
            }
          : undefined,
      },
    ].filter(Boolean),
  }
}

export function buildNotFoundSeo({ pathname, origin = SITE_URL, title = 'Страница не найдена' } = {}) {
  const canonical = buildAbsoluteUrl(pathname || '/', origin)
  const description = 'Запрошенная страница не найдена или больше недоступна.'
  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    canonical,
    robots: 'noindex,nofollow',
    image: DEFAULT_OG_IMAGE,
    type: 'website',
    schema: [buildWebPageSchema({ name: title, description, url: canonical })],
  }
}
