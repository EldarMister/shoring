import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PARTS_SECTION_CONFIG } from '../lib/catalogSections.js'

const HomeIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9M5 10v10h14V10" />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
  </svg>
)

const BackIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 18-6-6 6-6" />
  </svg>
)

function mapPart(part) {
  return {
    ...part,
    title: String(part.title || '').trim(),
    brand: String(part.brand || '').trim(),
    model: String(part.model || '').trim(),
    generation_body: String(part.generation_body || '').trim(),
    year_range: String(part.year_range || '').trim(),
    side_location: String(part.side_location || '').trim(),
    category: String(part.category || '').trim(),
    condition: String(part.condition || '').trim(),
    description: String(part.description || '').trim(),
    article_number: String(part.article_number || '').trim(),
    availability_text: String(part.availability_text || '').trim(),
    donor_vehicle: String(part.donor_vehicle || '').trim(),
    in_stock: Boolean(part.in_stock),
    price: Number(part.price || 0),
    images: Array.isArray(part.images) ? part.images : [],
  }
}

export default function PartDetailsPage({ introContent = null }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [part, setPart] = useState(null)
  const [activeImage, setActiveImage] = useState(0)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetch(`/api/parts/${id}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 404 ? 'Запчасть не найдена' : 'Ошибка загрузки карточки')
        const data = await response.json()
        if (!active) return
        setPart(mapPart(data))
        setActiveImage(0)
      } catch (requestError) {
        if (!active || requestError?.name === 'AbortError') return
        setError(requestError.message || 'Ошибка загрузки карточки')
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
      controller.abort()
    }
  }, [id])

  const activeImageUrl = useMemo(() => part?.images?.[activeImage]?.url || '', [part?.images, activeImage])

  if (loading) {
    return (
      <div className="catalog-page catalog-page-damaged">
        <div className="cat-layout">
          <div className="cat-loading">
            <div className="cat-loading-spinner" />
            <span>Загрузка карточки запчасти...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !part) {
    return (
      <div className="catalog-page catalog-page-damaged">
        <div className="cat-layout">
          <div className="cat-error">
            ⚠️ {error || 'Запчасть не найдена'} — <Link to={PARTS_SECTION_CONFIG.path}>Вернуться в каталог</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="catalog-page catalog-page-damaged">
      <div className="cat-breadcrumb">
        <div className="cat-breadcrumb-inner">
          <Link to="/" className="cat-bc-link"><HomeIcon /> Главная</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <Link to="/damaged-stock" className="cat-bc-link">Битые авто</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <Link to={PARTS_SECTION_CONFIG.path} className="cat-bc-link">{PARTS_SECTION_CONFIG.breadcrumbLabel}</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <span className="cat-bc-current">{part.title}</span>
        </div>
      </div>

      <div className="parts-page-shell">
        {introContent}

        <div className="part-details-wrap">
          <button className="car-details-back" onClick={() => navigate(PARTS_SECTION_CONFIG.path)}><BackIcon /> Назад</button>

          <div className="part-details-grid">
            <section className="part-details-gallery">
              <div className="part-details-main-image">
                {activeImageUrl ? (
                  <img src={activeImageUrl} alt={part.title} loading="lazy" />
                ) : (
                  <div className="part-card-placeholder">Нет фото</div>
                )}
              </div>
              {part.images.length > 1 ? (
                <div className="part-details-thumbs">
                  {part.images.map((image, index) => (
                    <button
                      key={image.id || `${image.url}-${index}`}
                      className={`part-details-thumb${index === activeImage ? ' is-active' : ''}`}
                      onClick={() => setActiveImage(index)}
                    >
                      <img src={image.url} alt={`${part.title} ${index + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="part-details-info">
              <div className="car-details-title-card">
                <div className={`car-details-section-badge${part.in_stock ? '' : ' is-muted'}`}>
                  {part.availability_text || (part.in_stock ? 'В наличии' : 'Нет в наличии')}
                </div>
                <h1 className="car-details-title">{part.title}</h1>
                <p className="car-details-sub">
                  {[part.brand, part.model, part.generation_body, part.year_range].filter(Boolean).join(' • ') || 'Совместимость не указана'}
                </p>

                <div className="part-details-price-row">
                  <div className="car-details-price-usd">${part.price.toLocaleString()}</div>
                  {part.article_number ? <span className="part-card-article">Артикул: {part.article_number}</span> : null}
                </div>

                <div className="part-details-spec-grid">
                  <div><span>Категория</span><strong>{part.category || '-'}</strong></div>
                  <div><span>Состояние</span><strong>{part.condition || '-'}</strong></div>
                  <div><span>Расположение</span><strong>{part.side_location || '-'}</strong></div>
                  <div><span>Донор</span><strong>{part.donor_vehicle || '-'}</strong></div>
                </div>

                {part.description ? <p className="part-details-description">{part.description}</p> : null}

                <div className="car-details-actions">
                  <a
                    href={`https://wa.me/821056650943?text=${encodeURIComponent(`Интересует запчасть: ${part.title}, артикул: ${part.article_number || '-'}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-car-green"
                  >
                    Связаться в WhatsApp
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
