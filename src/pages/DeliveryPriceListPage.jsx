import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useDeliveryContext } from '../hooks/useDeliveryContext.js'
import { resolveDeliveryPriceList, resolveDeliveryTypeLabel } from '../lib/delivery'

const FLAG_CDN_BASE = 'https://flagcdn.com'
const DISPLAY_COUNTRY_CODES = ['kg', 'kz', 'ru', 'uz', 'tj', 'by', 'az', 'ua']
const FLAG_ACCENT_MAP = {
  kg: '218, 42, 48',
  by: '198, 35, 43',
  ua: '234, 179, 8',
  kz: '56, 189, 248',
  uz: '34, 197, 94',
  ru: '37, 99, 235',
  az: '34, 197, 94',
  tj: '34, 197, 94',
}

const getFlagUrl = (code, width) => `${FLAG_CDN_BASE}/w${width}/${code}.png`

function formatUsd(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0) return 'Уточняйте'
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

export default function DeliveryPriceListPage() {
  const { settings, loading, countries, countryCode, selectedCountry, setCountryCode } = useDeliveryContext()

  const priceList = useMemo(
    () => resolveDeliveryPriceList({ settings, countryCode }),
    [settings, countryCode],
  )

  const country = priceList.country || selectedCountry || null
  const title = country?.label || 'Кыргызстан'
  const shippingTypeLabel = resolveDeliveryTypeLabel(country)
  const shippingExtraPrice = countryCode === 'ru' ? '900$' : ''
  const visibleCountries = useMemo(
    () => (countries || []).filter((countryItem) => DISPLAY_COUNTRY_CODES.includes(countryItem.code)),
    [countries],
  )

  return (
    <section className="delivery-price-page">
      <div className="delivery-price-shell">
        <div className="delivery-price-hero">
          <div>
            <div className="delivery-price-kicker">PRICE LIST</div>
            <h1 className="delivery-price-title">
              <span className="delivery-price-title-prefix">Доставка в</span>
              <span className="delivery-price-title-country">
                <img
                  className="delivery-price-title-flag"
                  src={getFlagUrl(countryCode, 160)}
                  srcSet={`${getFlagUrl(countryCode, 320)} 2x`}
                  width="44"
                  height="28"
                  alt={title}
                  loading="eager"
                  decoding="async"
                />
                <span>{title}</span>
              </span>
            </h1>
          </div>
          <div className="delivery-price-meta">
            <div className="delivery-price-badge-row">
              <div className="delivery-price-badge">{shippingTypeLabel}</div>
              {shippingExtraPrice ? (
                <div className="delivery-price-badge delivery-price-badge-accent">{shippingExtraPrice}</div>
              ) : null}
            </div>
            <div className="delivery-price-actions">
              <Link to="/" className="delivery-price-link">На главную</Link>
              <Link to="/catalog" className="delivery-price-link is-primary">Каталог</Link>
            </div>
          </div>
        </div>

        <div className="delivery-price-flags" aria-label="Выбор страны для прайс-листа">
          {visibleCountries.map((countryItem) => (
            <button
              key={countryItem.code}
              type="button"
              className={`delivery-price-flag-button ${countryCode === countryItem.code ? 'is-active' : ''}`.trim()}
              onClick={() => setCountryCode(countryItem.code)}
              aria-pressed={countryCode === countryItem.code}
              style={{
                '--flag-accent-rgb': FLAG_ACCENT_MAP[countryItem.code] || '218, 42, 48',
              }}
            >
              <img
                className="delivery-price-flag"
                src={getFlagUrl(countryItem.code, 160)}
                srcSet={`${getFlagUrl(countryItem.code, 320)} 2x`}
                width="56"
                height="36"
                alt={countryItem.label}
                loading="lazy"
                decoding="async"
              />
              <span>{countryItem.label}</span>
            </button>
          ))}
        </div>

        <div className="delivery-price-board">
          <div className="delivery-price-board-head">
            <span>Профиль доставки</span>
            <span>Цена</span>
          </div>

          {priceList.items.map((item) => (
            <div key={item.code} className="delivery-price-row">
              <div className="delivery-price-row-copy">
                <div className="delivery-price-row-title">{item.label}</div>
                {item.description ? (
                  <div className="delivery-price-row-description">{item.description}</div>
                ) : null}
              </div>
              <div className={`delivery-price-row-value ${item.resolvedPrice ? '' : 'is-missing'}`.trim()}>
                {formatUsd(item.resolvedPrice)}
              </div>
            </div>
          ))}
        </div>

        {!loading && !priceList.items.length ? (
          <div className="delivery-price-empty">Пока нет настроенных тарифов для отображения.</div>
        ) : null}
      </div>
    </section>
  )
}
