import { useEffect, useMemo, useState } from 'react'

const StarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const Stars = () => (
  <div className="review-stars">
    {[1, 2, 3, 4, 5].map((i) => <StarIcon key={i} />)}
  </div>
)

const REVIEWS = [
  {
    name: 'Азамат',
    text: 'Заказал уже вторую Sonata через Auto V Korea, с под такси. Открыл свой таксопарк. Планирую ещё заказать. Машина пришла за 19 дней в Кыргызстан, Бишкек. Спасибо! Рекомендую!',
  },
  {
    name: 'Александр',
    text: 'Уже второй автомобиль покупаем из Кореи. Качество корейских авто на высоте. Все машины пришли в целости и сохранности в Россию, Курская область. Благодарим за сервис команду AVT.',
  },
  {
    name: 'Валера',
    text: 'В этот раз пришла Kia Sportage за 17 дней, уже восьмая машина, которую заказали в Кыргызстан. Спасибо компании Auto V Trade!',
  },
  {
    name: 'Алексей',
    text: 'Заказал Hyundai Sonata через AVT Auto V Korea. Машина пришла за 23 дня в отличном состоянии. Рекомендую!',
  },
  {
    name: 'Марат',
    text: 'Уже второй автомобиль покупаю из Кореи. Качество корейских авто на высоте, а сервис AVT Auto V Korea безупречен.',
  },
  {
    name: 'Дмитрий',
    text: 'Очень доволен KIA K5. Пробег минимальный, состояние как новое. Спасибо команде за помощь!',
  },
]

export default function Reviews() {
  const [expanded, setExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(max-width: 639px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const media = window.matchMedia('(max-width: 639px)')
    const handleChange = (event) => setIsMobile(event.matches)

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange)
      return () => media.removeEventListener('change', handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])

  const visibleReviews = useMemo(
    () => (isMobile ? (expanded ? REVIEWS : REVIEWS.slice(0, 3)) : REVIEWS),
    [expanded, isMobile],
  )

  return (
    <section className="reviews-section">
      <div className="section-inner">
        <h2 className="section-title reveal">Отзывы наших клиентов</h2>
        <p className="section-subtitle reveal reveal-delay-1">
          Что говорят люди, которые уже получили свои автомобили из Кореи
        </p>

        <div className="reviews-grid">
          {visibleReviews.map(({ name, text }, i) => (
            <div className="review-card" key={`${name}-${i}`}>
              <Stars />
              <p className="review-name">{name}</p>
              <p className="review-text">"{text}"</p>
            </div>
          ))}
        </div>

        {isMobile && REVIEWS.length > 3 ? (
          <div className="reviews-actions">
            <button
              type="button"
              className="reviews-toggle"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? 'Скрыть отзывы' : 'Смотреть больше'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
