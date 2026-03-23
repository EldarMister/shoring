import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import PartCard from '../components/catalog/PartCard.jsx'
import Seo from '../components/seo/Seo.jsx'
import { PARTS_SECTION_CONFIG, buildPartDetailsPath } from '../lib/catalogSections.js'
import useRecoverableErrorRetry from '../lib/useRecoverableErrorRetry.js'
import { buildStaticRouteSeo, SITE_URL } from '../../shared/seo.js'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'price_asc', label: 'Цена: дешевле' },
  { value: 'price_desc', label: 'Цена: дороже' },
]

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

const ChevronDownIcon = () => (
  <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="4 12 9 17 20 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function buildInitialFilters(searchParams) {
  return {
    q: searchParams.get('q') || '',
    brand: searchParams.get('brand') || '',
    model: searchParams.get('model') || '',
    category: searchParams.get('category') || '',
    availability: searchParams.get('availability') || 'all',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
  }
}

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

export default function PartsCatalogPage({ introContent = null }) {
  const location = useLocation()
  const navigate = useNavigate()
  const seo = useMemo(
    () => buildStaticRouteSeo({ pathname: location.pathname, search: location.search, origin: SITE_URL }),
    [location.pathname, location.search]
  )
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const [filters, setFilters] = useState(() => buildInitialFilters(searchParams))
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'newest')
  const [page, setPage] = useState(() => Math.max(Number(searchParams.get('page')) || 1, 1))
  const [parts, setParts] = useState([])
  const [meta, setMeta] = useState({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryNonce, setRetryNonce] = useState(0)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)
  const activeSortOption = SORT_OPTIONS.find((option) => option.value === sort) || SORT_OPTIONS[0]

  useEffect(() => {
    const nextParams = new URLSearchParams(location.search)
    setFilters(buildInitialFilters(nextParams))
    setSort(nextParams.get('sort') || 'newest')
    setPage(Math.max(Number(nextParams.get('page')) || 1, 1))
    setSortOpen(false)
  }, [location.search])

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!sortRef.current?.contains(event.target)) {
        setSortOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSortOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const retryLoad = useCallback(() => {
    setRetryNonce((value) => value + 1)
  }, [])
  useRecoverableErrorRetry(error, retryLoad)

  useEffect(() => {
    let active = true
    const controller = new AbortController()

    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams({ page: String(page), limit: '24', sort })
        for (const [key, value] of Object.entries(filters)) {
          const normalized = String(value || '').trim()
          if (!normalized || normalized === 'all') continue
          params.set(key, normalized)
        }

        const response = await fetch(`/api/parts?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Ошибка загрузки запчастей')
        const data = await response.json()
        if (!active) return

        setParts(Array.isArray(data.parts) ? data.parts.map(mapPart) : [])
        setMeta({
          total: Number(data.total || 0),
          page: Number(data.page || 1),
          pages: Math.max(Number(data.pages || 1), 1),
        })
      } catch (requestError) {
        if (!active || requestError?.name === 'AbortError') return
        setError(requestError.message || 'Ошибка загрузки запчастей')
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
      controller.abort()
    }
  }, [filters, sort, page, retryNonce])

  const applyFilters = (event) => {
    event.preventDefault()
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(filters)) {
      const normalized = String(value || '').trim()
      if (!normalized || normalized === 'all') continue
      params.set(key, normalized)
    }
    if (sort !== 'newest') params.set('sort', sort)
    navigate(`${PARTS_SECTION_CONFIG.path}${params.toString() ? `?${params}` : ''}`, { replace: true })
  }

  const resetFilters = () => {
    setFilters({
      q: '',
      brand: '',
      model: '',
      category: '',
      availability: 'all',
      minPrice: '',
      maxPrice: '',
    })
    setSort('newest')
    setPage(1)
    navigate(PARTS_SECTION_CONFIG.path, { replace: true })
  }

  const goToPage = (nextPage) => {
    const params = new URLSearchParams(location.search)
    if (nextPage > 1) params.set('page', String(nextPage))
    else params.delete('page')
    navigate(`${PARTS_SECTION_CONFIG.path}${params.toString() ? `?${params}` : ''}`, { replace: true })
  }

  return (
    <div className="catalog-page catalog-page-damaged">
      <Seo {...seo} />
      <div className="cat-breadcrumb">
        <div className="cat-breadcrumb-inner">
          <Link to="/" className="cat-bc-link"><HomeIcon /> Главная</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <Link to="/damaged-stock" className="cat-bc-link">Битые авто</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <span className="cat-bc-current">{PARTS_SECTION_CONFIG.breadcrumbLabel}</span>
        </div>
      </div>

      <div className="parts-page-shell">
        {introContent}
        <div className="parts-page-head">
          <h1 className="cat-title">{PARTS_SECTION_CONFIG.title}</h1>
          <p className="cat-subtitle">{PARTS_SECTION_CONFIG.subtitle}</p>
        </div>

        <form className="parts-filter-bar" onSubmit={applyFilters}>
          <input
            className="adm-input"
            value={filters.q}
            onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            placeholder="Поиск по названию, артикулу, модели"
          />
          <input
            className="adm-input"
            value={filters.brand}
            onChange={(event) => setFilters((prev) => ({ ...prev, brand: event.target.value }))}
            placeholder="Марка"
          />
          <input
            className="adm-input"
            value={filters.model}
            onChange={(event) => setFilters((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="Модель"
          />
          <input
            className="adm-input"
            value={filters.category}
            onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
            placeholder="Категория"
          />
          <select
            className="adm-select"
            value={filters.availability}
            onChange={(event) => setFilters((prev) => ({ ...prev, availability: event.target.value }))}
          >
            <option value="all">Любое наличие</option>
            <option value="in_stock">Только в наличии</option>
            <option value="out_of_stock">Нет в наличии</option>
          </select>
          <input
            className="adm-input"
            type="number"
            min="0"
            value={filters.minPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, minPrice: event.target.value }))}
            placeholder="Цена от"
          />
          <input
            className="adm-input"
            type="number"
            min="0"
            value={filters.maxPrice}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))}
            placeholder="Цена до"
          />
          <div className={`cat-sort-wrap${sortOpen ? ' is-open' : ''}`} ref={sortRef}>
            <button
              type="button"
              className="cat-sort-trigger"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
              onClick={() => setSortOpen((open) => !open)}
            >
              <span className="cat-sort-trigger-label">{activeSortOption.label}</span>
              <span className="cat-sort-trigger-icon" aria-hidden="true"><ChevronDownIcon /></span>
            </button>
            {sortOpen && (
              <div className="cat-sort-menu" role="listbox" aria-label="Сортировка запчастей">
                {SORT_OPTIONS.map((option) => {
                  const isActive = option.value === sort
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={`cat-sort-option${isActive ? ' is-active' : ''}`}
                      onClick={() => {
                        setSort(option.value)
                        setSortOpen(false)
                      }}
                    >
                      <span className="cat-sort-option-check" aria-hidden="true">
                        {isActive ? <CheckIcon /> : null}
                      </span>
                      <span className="cat-sort-option-label">{option.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <button type="submit" className="adm-btn adm-btn-primary">Применить</button>
          <button type="button" className="adm-btn adm-btn-cancel" onClick={resetFilters}>Сбросить</button>
        </form>

        <div className="cat-results-bar">
          <div>
            <div className="cat-results-heading">Запчасти</div>
            <div className="cat-results-count">
              {loading ? 'Загрузка...' : `Найдено: ${meta.total.toLocaleString()} • Стр. ${meta.page} из ${meta.pages}`}
            </div>
          </div>
        </div>

        {error ? <div className="cat-error">⚠️ {error}</div> : null}

        {loading ? (
          <div className="cat-loading">
            <div className="cat-loading-spinner" />
            <span>Загрузка запчастей...</span>
          </div>
        ) : parts.length ? (
          <div className="parts-list">
            {parts.map((part) => (
              <PartCard key={part.id} part={part} detailsHref={buildPartDetailsPath(part.id)} />
            ))}
          </div>
        ) : (
          <div className="cat-empty">Запчасти не найдены. Измените фильтры.</div>
        )}

        {meta.pages > 1 ? (
          <div className="cat-pagination">
            <button className="cat-page-btn" disabled={meta.page <= 1} onClick={() => goToPage(meta.page - 1)}>← Назад</button>
            <span className="cat-page-info">Стр. {meta.page} / {meta.pages}</span>
            <button className="cat-page-btn" disabled={meta.page >= meta.pages} onClick={() => goToPage(meta.page + 1)}>Вперёд →</button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
