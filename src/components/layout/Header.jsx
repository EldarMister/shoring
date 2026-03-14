import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth.js'
import AuthModal from '../auth/AuthModal.jsx'
import logoImg from '../../assets/logo.png'
import { getSearchTargetPath } from '../../lib/catalogSections.js'

const SearchIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const UserIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
)

const MenuIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
)

const CloseIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const SunIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="5" strokeWidth={2} />
    <path
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
    />
  </svg>
)

const MoonIcon = () => (
  <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
    />
  </svg>
)

const AVTLogo = () => (
  <Link to="/" className="header-logo">
    <img src={logoImg} alt="AVT Auto V Korea" className="header-logo-img" />
  </Link>
)

const navLinks = [
  { label: 'Главная', to: '/' },
  { label: 'Каталог', to: '/catalog' },
  { label: 'Срочная продажа', to: '/urgent-sale' },
  { label: 'Битые авто', to: '/damaged-stock' },
  { label: 'Запчасти', to: '/damaged-stock/parts' },
  { label: 'Контакты', to: '/contacts' },
]

const isNavLinkActive = (to, pathname) => {
  if (to === '/') return pathname === '/'
  if (to === '/damaged-stock') {
    if (pathname.startsWith('/damaged-stock/parts')) return false
    return pathname === '/damaged-stock' || pathname.startsWith('/damaged-stock/')
  }
  return pathname === to || pathname.startsWith(`${to}/`)
}

function AuthButtonContent({ label }) {
  return (
    <>
      <UserIcon />
      {label}
    </>
  )
}

function LocalAuthControl({ mobile = false, onAction, onOpenAuth }) {
  const { isLoading, logout, user } = useAuth()
  const buttonClassName = mobile ? 'mobile-login-btn' : 'header-login'

  if (isLoading) {
    return (
      <button className={buttonClassName} disabled type="button">
        <AuthButtonContent label="..." />
      </button>
    )
  }

  if (!user) {
    return (
      <button
        className={buttonClassName}
        onClick={() => {
          onAction?.()
          onOpenAuth?.()
        }}
        title="Войти"
        type="button"
      >
        <AuthButtonContent label="Войти" />
      </button>
    )
  }

  const label = user.login || 'Аккаунт'
  const authenticatedClassName = `${buttonClassName} ${mobile ? 'mobile-login-btn-authenticated' : 'header-login-authenticated'}`
  const rowClassName = mobile ? 'mobile-auth-row' : 'header-auth-row'
  const logoutClassName = mobile ? 'mobile-auth-logout' : 'header-auth-logout'

  return (
    <div className={rowClassName}>
      <button className={authenticatedClassName} title={label} type="button">
        <AuthButtonContent label={label} />
      </button>
      <button
        className={logoutClassName}
        onClick={() => {
          onAction?.()
          logout()
        }}
        type="button"
      >
        Выйти
      </button>
    </div>
  )
}

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchDirty, setSearchDirty] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const locationQuery = new URLSearchParams(location.search).get('q') || ''
  const effectiveSearchTerm = searchDirty ? searchTerm : locationQuery
  const searchTargetPath = getSearchTargetPath(location.pathname)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!searchDirty) return

    const currentQuery = locationQuery
    const nextQuery = searchTerm.trim()
    const hasPendingWhitespace = searchTerm !== nextQuery

    if (!hasPendingWhitespace && currentQuery === nextQuery && location.pathname === searchTargetPath) {
      const timer = setTimeout(() => {
        setSearchDirty(false)
      }, 0)
      return () => clearTimeout(timer)
    }

    const timer = setTimeout(() => {
      if (!nextQuery && location.pathname !== searchTargetPath && !currentQuery) {
        setSearchDirty(false)
        return
      }

      const params = new URLSearchParams(location.search)
      if (nextQuery) params.set('q', nextQuery)
      else params.delete('q')
      params.delete('page')

      navigate(`${searchTargetPath}${params.toString() ? `?${params}` : ''}`, { replace: true })
      if (!hasPendingWhitespace) {
        setSearchDirty(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [location.pathname, location.search, locationQuery, navigate, searchDirty, searchTargetPath, searchTerm])

  const submitSearch = (event) => {
    event.preventDefault()
    const query = effectiveSearchTerm.trim()
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    navigate(`${searchTargetPath}${params.toString() ? `?${params}` : ''}`, { replace: true })
    setMobileOpen(false)
    setSearchDirty(false)
  }

  const handleSearchChange = (value) => {
    setSearchTerm(value)
    setSearchDirty(true)
  }

  return (
    <>
      <header className={`site-header${scrolled ? ' site-header-scrolled' : ''}`}>
        <div className="header-row">
          <AVTLogo />

          <form className="header-search-mobile" onSubmit={submitSearch}>
            <span className="header-search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Марка / модель / VIN"
              className="search-input"
              value={effectiveSearchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </form>

          <nav className="header-nav">
            {navLinks.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className={isNavLinkActive(to, location.pathname) ? 'active' : ''}
              >
                {label}
              </Link>
            ))}
          </nav>

          <form className="header-search" onSubmit={submitSearch}>
            <span className="header-search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Марка / модель / VIN / артикул"
              className="search-input"
              value={effectiveSearchTerm}
              onChange={(event) => handleSearchChange(event.target.value)}
            />
          </form>

          <button
            className="theme-toggle"
            onClick={(event) => toggle(event)}
            title={theme === 'light' ? 'Темная тема' : 'Светлая тема'}
            type="button"
          >
            {theme === 'light' ? <MoonIcon /> : <SunIcon />}
          </button>

          <LocalAuthControl onOpenAuth={() => setAuthModalOpen(true)} />

          <div className="header-mobile-controls">
            <button
              className="theme-toggle"
              onClick={(event) => toggle(event)}
              title="Сменить тему"
              style={{ width: 32, height: 32 }}
              type="button"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              className="header-icon-btn"
              onClick={() => setMobileOpen((value) => (value === 'menu' ? false : 'menu'))}
              type="button"
            >
              {mobileOpen === 'menu' ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>

        {mobileOpen === 'menu' && (
          <div className="header-mobile-menu">
            {navLinks.map(({ label, to }) => (
              <Link
                key={to}
                to={to}
                className={`mobile-nav-link${isNavLinkActive(to, location.pathname) ? ' active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <LocalAuthControl
              mobile
              onAction={() => setMobileOpen(false)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          </div>
        )}
      </header>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={() => setMobileOpen(false)}
      />
    </>
  )
}
