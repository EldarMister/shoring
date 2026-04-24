import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Seo from '../components/seo/Seo.jsx'
import { buildNotFoundSeo, SITE_URL } from '../../shared/seo.js'

const POPULAR_LINKS = [
  { to: '/catalog', label: 'Каталог авто из Кореи' },
  { to: '/urgent-sale', label: 'Срочная продажа' },
  { to: '/damaged-stock', label: 'Битые авто' },
  { to: '/damaged-stock/parts', label: 'Запчасти из Кореи' },
  { to: '/delivery-price-list', label: 'Прайс доставки' },
  { to: '/contacts', label: 'Контакты' },
]

export default function NotFoundPage() {
  const location = useLocation()
  const seo = useMemo(
    () => buildNotFoundSeo({ pathname: location.pathname, origin: SITE_URL }),
    [location.pathname]
  )

  return (
    <>
      <Seo {...seo} />
      <main className="not-found-page" style={pageStyle}>
        <div style={innerStyle}>
          <div style={badgeStyle}>404</div>
          <h1 style={titleStyle}>Страница не найдена</h1>
          <p style={leadStyle}>
            Запрошенный адрес не существует или объявление больше недоступно.
            Возможно, автомобиль уже продан либо ссылка устарела.
          </p>

          <div style={ctaRowStyle}>
            <Link to="/" className="btn-primary" style={primaryBtnStyle}>
              На главную
            </Link>
            <Link to="/catalog" className="btn-car-outline" style={outlineBtnStyle}>
              Открыть каталог
            </Link>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Популярные разделы</div>
            <ul style={linkListStyle}>
              {POPULAR_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} style={listLinkStyle}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  )
}

const pageStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  padding: '48px 20px',
}

const innerStyle = {
  maxWidth: 640,
  width: '100%',
  textAlign: 'center',
  background: 'var(--surface, #fff)',
  border: '1px solid var(--border, #e5e7eb)',
  borderRadius: 24,
  padding: '48px 28px',
  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.06)',
}

const badgeStyle = {
  display: 'inline-block',
  fontSize: 64,
  fontWeight: 800,
  letterSpacing: -2,
  color: '#2563eb',
  lineHeight: 1,
  marginBottom: 12,
}

const titleStyle = {
  fontSize: 28,
  fontWeight: 700,
  margin: '0 0 12px',
  color: 'var(--text, #0f172a)',
}

const leadStyle = {
  fontSize: 16,
  lineHeight: 1.5,
  color: 'var(--text-muted, #475569)',
  margin: '0 auto 28px',
  maxWidth: 520,
}

const ctaRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  justifyContent: 'center',
  marginBottom: 32,
}

const primaryBtnStyle = {
  minWidth: 180,
}

const outlineBtnStyle = {
  minWidth: 180,
}

const sectionStyle = {
  textAlign: 'left',
  borderTop: '1px solid var(--border, #e5e7eb)',
  paddingTop: 20,
  marginTop: 8,
}

const sectionTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: 'var(--text-muted, #64748b)',
  marginBottom: 12,
}

const linkListStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 8,
  listStyle: 'none',
  padding: 0,
  margin: 0,
}

const listLinkStyle = {
  display: 'block',
  padding: '10px 12px',
  borderRadius: 12,
  background: 'var(--surface-muted, #f1f5f9)',
  color: 'var(--text, #0f172a)',
  textDecoration: 'none',
  fontWeight: 500,
  fontSize: 14,
}
