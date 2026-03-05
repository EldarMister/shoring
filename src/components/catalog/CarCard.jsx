import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

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

const PinIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <circle cx="12" cy="11" r="3" strokeWidth={2} />
  </svg>
)

const WhatsAppIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const NewTabIcon = () => (
  <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
)

const TAG_STYLES = [
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#dbeafe', color: '#1d4ed8' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#d1fae5', color: '#065f46' },
]

export default function CarCard({ car }) {
  const [imgIdx, setImgIdx] = useState(0)
  const [imgFailed, setImgFailed] = useState(false)

  const images = useMemo(() => (Array.isArray(car.images) ? car.images : []), [car.images])
  const imageCount = images.length || 1
  const boundedIdx = Math.min(imgIdx, imageCount - 1)
  const imageSrc = images[boundedIdx]?.url || ''
  const hasImage = Boolean(imageSrc) && !imgFailed

  const prev = () => setImgIdx((i) => Math.max(0, i - 1))
  const next = () => setImgIdx((i) => Math.min(imageCount - 1, i + 1))
  const onImgError = () => setImgFailed(true)

  return (
    <div className="car-card">
      <div className="car-card-top">
        <div className="car-img-wrap">
          {hasImage ? (
            <img
              src={imageSrc}
              alt={car.name}
              className="car-img"
              loading="lazy"
              onError={onImgError}
            />
          ) : (
            <div className="car-img-placeholder">
              <svg width="56" height="56" fill="none" stroke="#cbd5e1" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M19 17H5a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2z"
                />
                <circle cx="12" cy="12" r="2.5" strokeWidth={1} />
              </svg>
            </div>
          )}

          {imageCount > 1 && (
            <>
              <button className="car-img-btn car-img-btn-prev" onClick={prev} disabled={boundedIdx === 0}>
                <PrevIcon />
              </button>
              <button
                className="car-img-btn car-img-btn-next"
                onClick={next}
                disabled={boundedIdx === imageCount - 1}
              >
                <NextIcon />
              </button>
            </>
          )}

          <span className="car-img-counter">{boundedIdx + 1}/{imageCount}</span>
          {car.encarUrl && <span className="car-img-encar-badge">encar</span>}
        </div>

        <div className="car-info">
          <h3 className="car-name">{car.name}</h3>
          <span className="car-model">{car.model}</span>
          <div className="car-meta">
            <span>{car.year}</span>
            <span className="car-meta-sep">•</span>
            <span>{Number(car.mileage || 0).toLocaleString()} км</span>
          </div>

          <div className="car-tags">
            {(car.tags || []).map((tag, i) => (
              <span
                key={`${tag}-${i}`}
                className="car-tag"
                style={{
                  backgroundColor: TAG_STYLES[i % TAG_STYLES.length].bg,
                  color: TAG_STYLES[i % TAG_STYLES.length].color,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="car-detail">
            <span className="car-detail-label">Кузов:</span>
            <span className="car-detail-value">{car.bodyColor || '-'}</span>
          </div>
          <div className="car-detail">
            <span className="car-detail-label">Салон:</span>
            <span className="car-detail-value">{car.interiorColor || '-'}</span>
          </div>
          <div className="car-location">
            <PinIcon />
            <span>{car.location || '-'}</span>
          </div>
          <div className="car-vin">VIN: <span>{car.vin || '-'}</span></div>
        </div>

        <div className="car-price-col">
          <div className="car-price-krw">{Number(car.priceKRW || 0).toLocaleString()} ₩</div>
          <div className="car-price-usd">${Number(car.priceUSD || 0).toLocaleString()}</div>
          <div className="car-price-breakdown">
            <div className="car-price-row">
              <span>Комиссия:</span><span>${Number(car.commission || 0).toLocaleString()}</span>
            </div>
            <div className="car-price-row">
              <span>Доставка:</span><span>${Number(car.delivery || 0).toLocaleString()}</span>
            </div>
            <div className="car-price-row">
              <span>Погрузка:</span><span>${Number(car.loading || 0).toLocaleString()}</span>
            </div>
            <div className="car-price-row">
              <span>Выгрузка:</span><span>${Number(car.unloading || 0).toLocaleString()}</span>
            </div>
            <div className="car-price-row">
              <span>Стоянка:</span><span>${Number(car.storage || 0).toLocaleString()}</span>
            </div>
            <div className="car-price-row car-price-vat">
              <span>Возврат НДС (7%):</span><span>-${Number(car.vatRefund || 0).toLocaleString()}</span>
            </div>
          </div>
          <div className="car-price-total">
            <span>До Бишкека:</span>
            <span>${Number(car.total || 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="car-card-actions">
        <Link to={`/catalog/${car.id}`} className="btn-car-primary">Открыть</Link>
        <a href={car.encarUrl || '#'} target="_blank" rel="noreferrer" className="btn-car-outline">
          <NewTabIcon /> В новой вкладке
        </a>
        <a href={car.encarUrl || '#'} target="_blank" rel="noreferrer" className="btn-car-outline">
          Encar →
        </a>
        <a
          href={`https://wa.me/996705188088?text=Хочу заказать: ${car.name} (${car.year}), VIN: ${car.vin || '-'}`}
          target="_blank"
          rel="noreferrer"
          className="btn-car-green"
        >
          <WhatsAppIcon /> Заказать
        </a>
        {car.canNegotiate && <button className="btn-car-negotiate">Возможен торг</button>}
      </div>
    </div>
  )
}
