import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

const HomeIcon = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" strokeWidth={2} />
  </svg>
)

const ChevronRightIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" strokeWidth={2} strokeLinecap="round" />
  </svg>
)

const BackIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const PrevIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="15 18 9 12 15 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const NextIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="9 18 15 12 9 6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function parseYear(value) {
  const m = String(value || '').match(/\d{4}/)
  return m ? Number(m[0]) : new Date().getFullYear()
}

function inferEngineLiters(model) {
  const src = String(model || '')
  const matches = src.match(/\b(\d(?:\.\d)?)\b/g) || []
  const candidate = matches
    .map(Number)
    .find((n) => Number.isFinite(n) && n >= 0.8 && n <= 8.0)
  return candidate || 2.0
}

function detectFuel(car) {
  const explicit = String(car.fuel_type || '').toLowerCase()
  const tags = Array.isArray(car.tags) ? car.tags.join(' ').toLowerCase() : ''
  const mixed = `${explicit} ${tags}`
  if (mixed.includes('дизел')) return 'diesel'
  if (mixed.includes('электро')) return 'electric'
  if (mixed.includes('газ')) return 'lpg'
  return 'gasoline'
}

function fuelLabel(type) {
  if (type === 'diesel') return 'Дизель'
  if (type === 'electric') return 'Электро'
  if (type === 'lpg') return 'Газ'
  return 'Бензин'
}

function estimateCustomsDuty({ year, engine, fuel }) {
  const age = Math.max(0, new Date().getFullYear() - Number(year || new Date().getFullYear()))
  const liters = Math.max(0.8, Number(engine || 2))
  let usd

  if (fuel === 'electric') {
    usd = liters * 450
  } else if (age <= 3) {
    usd = liters * 850
  } else if (age <= 5) {
    usd = liters * 1150
  } else if (liters > 3) {
    usd = liters * 1500
  } else if (liters > 2) {
    usd = liters * 1300
  } else {
    usd = liters * 900
  }

  if (fuel === 'diesel') usd *= 1.12
  if (fuel === 'lpg') usd *= 0.95
  return Math.round(usd)
}

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('ru-RU')
}

function mapCar(c) {
  const priceUSD = Number(c.price_usd) || 0
  const commission = Number(c.commission ?? 200) || 200
  const delivery = Number(c.delivery ?? 1750) || 1750
  const loading = Number(c.loading) || 0
  const unloading = Number(c.unloading ?? 100) || 100
  const storage = Number(c.storage ?? 310) || 310
  const vatRefund = Number(c.vat_refund) || Math.round(priceUSD * 0.07)
  const total = Number(c.total) || Math.round(priceUSD + commission + delivery + loading + unloading + storage - vatRefund)
  const images = Array.isArray(c.images)
    ? c.images
      .map((img, idx) => {
        if (!img) return null
        if (typeof img === 'string') return { id: `img-${idx}`, url: img }
        return { id: img.id ?? `img-${idx}`, url: img.url }
      })
      .filter((img) => img?.url)
    : []
  const tags = Array.isArray(c.tags) ? c.tags : []

  return {
    id: c.id,
    name: c.name || 'Автомобиль',
    model: c.model || '',
    year: c.year || '-',
    yearNum: parseYear(c.year),
    mileage: Number(c.mileage || 0),
    bodyColor: c.body_color || '-',
    interiorColor: c.interior_color || c.body_color || '-',
    location: c.location || 'Корея',
    vin: c.vin || '-',
    tags,
    fuelType: c.fuel_type || '',
    priceKRW: Number(c.price_krw) || 0,
    priceUSD,
    commission,
    delivery,
    loading,
    unloading,
    storage,
    vatRefund,
    total,
    encarUrl: c.encar_url || '',
    canNegotiate: Boolean(c.can_negotiate),
    images,
    encarId: c.encar_id || '-',
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }
}

export default function CarDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [car, setCar] = useState(null)
  const [imgIdx, setImgIdx] = useState(0)
  const [calc, setCalc] = useState({ year: new Date().getFullYear(), engine: 2.0, fuel: 'gasoline' })

  useEffect(() => {
    let active = true

    fetch(`/api/cars/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Машина не найдена' : 'Ошибка загрузки карточки')
        return res.json()
      })
      .then((data) => {
        if (!active) return
        const mapped = mapCar(data)
        const fuel = detectFuel(data)
        setCar(mapped)
        setError('')
        setCalc({ year: mapped.yearNum, engine: inferEngineLiters(mapped.model), fuel })
      })
      .catch((e) => {
        if (!active) return
        setError(e.message || 'Ошибка загрузки карточки')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [id])

  const imageCount = car?.images?.length || 1
  const boundedIdx = Math.min(imgIdx, imageCount - 1)
  const imageSrc = car?.images?.[boundedIdx]?.url || ''

  const customsDuty = useMemo(
    () => estimateCustomsDuty(calc),
    [calc]
  )

  const customsNote = useMemo(() => {
    const age = Math.max(0, new Date().getFullYear() - Number(calc.year || new Date().getFullYear()))
    if (calc.fuel === 'electric') return 'Электромобили считаются по отдельной льготной сетке.'
    if (age > 5 && Number(calc.engine) > 2) return 'Автомобили старше 5 лет с объёмом > 2.0 обычно считают по повышенной ставке.'
    if (age <= 3) return 'Для авто до 3 лет применяется базовая ставка.'
    return 'Расчет оценочный. Точную сумму подтвердит брокер.'
  }, [calc])

  if (loading) {
    return (
      <div className="catalog-page">
        <div className="cat-layout">
          <div className="cat-loading">
            <div className="cat-loading-spinner" />
            <span>Загрузка карточки...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error || !car) {
    return (
      <div className="catalog-page">
        <div className="cat-layout">
          <div className="cat-error">
            ⚠️ {error || 'Машина не найдена'} — <Link to="/catalog">Вернуться в каталог</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="catalog-page">
      <div className="cat-breadcrumb">
        <div className="cat-breadcrumb-inner">
          <Link to="/" className="cat-bc-link">
            <HomeIcon /> Главная
          </Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <Link to="/catalog" className="cat-bc-link">Каталог</Link>
          <span className="cat-bc-sep"><ChevronRightIcon /></span>
          <span className="cat-bc-current">{car.name}</span>
        </div>
      </div>

      <div className="car-details-wrap">
        <button className="car-details-back" onClick={() => navigate(-1)}>
          <BackIcon /> Назад
        </button>

        <div className="car-details-grid">
          <section className="car-details-left">
            <div className="car-details-media-card">
              <div className="car-details-main-image-wrap">
                {imageSrc ? (
                  <img src={imageSrc} alt={car.name} className="car-details-main-image" loading="lazy" />
                ) : (
                  <div className="car-img-placeholder">Нет фото</div>
                )}

                {imageCount > 1 && (
                  <>
                    <button
                      className="car-img-btn car-img-btn-prev"
                      onClick={() => setImgIdx((i) => Math.max(0, i - 1))}
                      disabled={boundedIdx === 0}
                    >
                      <PrevIcon />
                    </button>
                    <button
                      className="car-img-btn car-img-btn-next"
                      onClick={() => setImgIdx((i) => Math.min(imageCount - 1, i + 1))}
                      disabled={boundedIdx === imageCount - 1}
                    >
                      <NextIcon />
                    </button>
                  </>
                )}
                <span className="car-img-counter">{boundedIdx + 1} / {imageCount}</span>
              </div>

              {car.images.length > 1 && (
                <div className="car-details-thumbs">
                  {car.images.map((img, i) => (
                    <button
                      key={img.id || `${img.url}-${i}`}
                      className={`car-details-thumb${i === boundedIdx ? ' car-details-thumb-active' : ''}`}
                      onClick={() => setImgIdx(i)}
                    >
                      <img src={img.url} alt={`${car.name} ${i + 1}`} loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="car-details-title-card">
              <h1 className="car-details-title">{car.name}</h1>
              <p className="car-details-sub">{car.model || '-'}</p>

              <div className="car-details-meta-grid">
                <div><span className="car-details-meta-label">Год</span><strong>{car.year || '-'}</strong></div>
                <div><span className="car-details-meta-label">Пробег</span><strong>{car.mileage.toLocaleString()} км</strong></div>
                <div><span className="car-details-meta-label">Местоположение</span><strong>{car.location || '-'}</strong></div>
                <div><span className="car-details-meta-label">VIN</span><strong>{car.vin || '-'}</strong></div>
              </div>

              <div className="car-details-actions">
                <a
                  href={`https://wa.me/996705188088?text=Хочу заказать: ${car.name} (${car.year}), VIN: ${car.vin || '-'}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-car-green"
                >
                  Заказать
                </a>
                <a href={car.encarUrl || '#'} target="_blank" rel="noreferrer" className="btn-car-outline">На Encar</a>
              </div>
            </div>
          </section>

          <aside className="car-details-right">
            <div className="car-details-card">
              <div className="car-details-price-heading">Цена</div>
              <div className="car-details-price-krw">{car.priceKRW.toLocaleString()} ₩</div>
              <div className="car-details-price-usd">${car.priceUSD.toLocaleString()}</div>
              <p className="car-details-price-note">Цена в корейских вонах (KRW) и в долларах США (USD)</p>

              <div className="car-details-breakdown">
                <div className="car-price-row"><span>Цена машины (KRW)</span><span>{car.priceKRW.toLocaleString()} ₩</span></div>
                <div className="car-price-row"><span>Финальная цена (USD)</span><span>${car.priceUSD.toLocaleString()}</span></div>
                <div className="car-price-row car-price-vat"><span>Возврат НДС</span><span>-${car.vatRefund.toLocaleString()}</span></div>
                <div className="car-price-row"><span>Комиссия компании</span><span>${car.commission.toLocaleString()}</span></div>
                <div className="car-price-row"><span>Доставка</span><span>${car.delivery.toLocaleString()}</span></div>
                <div className="car-price-row"><span>Погрузка</span><span>${car.loading.toLocaleString()}</span></div>
                <div className="car-price-row"><span>Выгрузка</span><span>${car.unloading.toLocaleString()}</span></div>
                <div className="car-price-row"><span>Стоянка</span><span>${car.storage.toLocaleString()}</span></div>
              </div>
              <div className="car-price-total"><span>Итого</span><span>${car.total.toLocaleString()}</span></div>
              {car.canNegotiate && <div className="car-details-negotiate">Возможен торг</div>}
            </div>

            <div className="car-details-card car-details-customs">
              <h3 className="car-details-card-title">Калькулятор растаможки (Кыргызстан)</h3>
              <div className="car-details-customs-grid">
                <label>
                  <span>Год выпуска</span>
                  <input
                    type="number"
                    value={calc.year}
                    onChange={(e) => setCalc((p) => ({ ...p, year: Number(e.target.value) || p.year }))}
                  />
                </label>
                <label>
                  <span>Объем двигателя (л)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={calc.engine}
                    onChange={(e) => setCalc((p) => ({ ...p, engine: Number(e.target.value) || p.engine }))}
                  />
                </label>
                <label>
                  <span>Тип топлива</span>
                  <select
                    value={calc.fuel}
                    onChange={(e) => setCalc((p) => ({ ...p, fuel: e.target.value }))}
                  >
                    <option value="gasoline">Бензин</option>
                    <option value="diesel">Дизель</option>
                    <option value="lpg">Газ</option>
                    <option value="electric">Электро</option>
                  </select>
                </label>
              </div>
              <div className="car-details-customs-result">
                <span>Пошлина по сетке (оценка)</span>
                <strong>${customsDuty.toLocaleString()}</strong>
              </div>
              <div className="car-details-customs-meta">
                <span>Год: {calc.year}</span>
                <span>Объем: {Number(calc.engine).toFixed(1)} л</span>
                <span>Топливо: {fuelLabel(calc.fuel)}</span>
              </div>
              <p className="car-details-customs-note">{customsNote}</p>
            </div>

            <div className="car-details-card">
              <h3 className="car-details-card-title">Основные характеристики</h3>
              <div className="car-details-specs-grid">
                <div><span>Топливо</span><strong>{car.fuelType || fuelLabel(calc.fuel)}</strong></div>
                <div><span>Трансмиссия</span><strong>{car.tags.find((t) => /Автомат|Механика|Робот|CVT/i.test(t)) || '-'}</strong></div>
                <div><span>Цвет кузова</span><strong>{car.bodyColor || '-'}</strong></div>
                <div><span>Цвет салона</span><strong>{car.interiorColor || '-'}</strong></div>
                <div><span>Пробег</span><strong>{car.mileage.toLocaleString()} км</strong></div>
                <div><span>Местоположение</span><strong>{car.location || '-'}</strong></div>
                <div><span>ID объявления</span><strong>{car.id}</strong></div>
                <div><span>Encar ID</span><strong>{car.encarId || '-'}</strong></div>
                <div><span>Дата добавления</span><strong>{formatDate(car.createdAt)}</strong></div>
                <div><span>Последнее изменение</span><strong>{formatDate(car.updatedAt)}</strong></div>
              </div>
            </div>
          </aside>
        </div>

        <section className="car-details-card car-details-bottom-card">
          <h3 className="car-details-card-title">Инспекция и диагностика автомобиля</h3>
          <p className="car-details-muted">
            Полный отчет доступен на Encar. Если нужен перевод и разбор отчета, менеджер подготовит его для вас.
          </p>
          <div className="car-details-actions">
            <a href={car.encarUrl || '#'} target="_blank" rel="noreferrer" className="btn-car-primary">Открыть в Encar</a>
            <a href={car.encarUrl || '#'} target="_blank" rel="noreferrer" className="btn-car-green">Скачать диагностику (PDF, RU)</a>
          </div>
        </section>

        <section className="car-details-card car-details-bottom-card">
          <h3 className="car-details-card-title">История регистрации</h3>
          <div className="car-details-history-grid">
            <div><span>Назначение</span><strong>Общий</strong></div>
            <div><span>Год</span><strong>{car.year || '-'}</strong></div>
            <div><span>Номер авто</span><strong>{car.vin && car.vin !== '-' ? car.vin : '—'}</strong></div>
            <div><span>Тип автомобиля</span><strong>Легковой</strong></div>
            <div><span>Дата добавления</span><strong>{formatDate(car.createdAt)}</strong></div>
            <div><span>Последнее изменение</span><strong>{formatDate(car.updatedAt)}</strong></div>
          </div>
        </section>
      </div>
    </div>
  )
}
