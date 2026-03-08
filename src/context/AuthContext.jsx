import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { signOut } from 'firebase/auth'
import AuthModal from '../components/auth/AuthModal'
import { formatPhoneForDisplay } from '../lib/authClient'
import { firebaseAuth } from '../lib/firebase'

const AUTH_TOKEN_KEY = 'tlv-user-jwt'
const AuthContext = createContext(null)

function readStoredToken() {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

function storeToken(token) {
  try {
    if (token) window.localStorage.setItem(AUTH_TOKEN_KEY, token)
    else window.localStorage.removeItem(AUTH_TOKEN_KEY)
  } catch {
    // Ignore storage failures in private mode.
  }
}

async function apiFetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    const error = new Error(payload?.error || 'Ошибка запроса')
    error.status = response.status
    error.details = payload || {}
    throw error
  }

  return payload
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readStoredToken())
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()))
  const [authModalOpen, setAuthModalOpen] = useState(false)

  useEffect(() => {
    if (!token) {
      setUser(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    apiFetchJson('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((payload) => {
        if (!cancelled) {
          setUser(payload.user || null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          storeToken('')
          setToken('')
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const openAuthModal = () => setAuthModalOpen(true)
  const closeAuthModal = () => setAuthModalOpen(false)

  const authenticateWithFirebase = async ({ idToken, phone = '' }) => {
    const payload = await apiFetchJson('/api/auth/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, phone }),
    })

    storeToken(payload.token || '')
    setToken(payload.token || '')
    setUser(payload.user || null)
    setAuthModalOpen(false)
    return payload
  }

  const logout = () => {
    if (firebaseAuth) {
      signOut(firebaseAuth).catch(() => {})
    }
    storeToken('')
    setToken('')
    setUser(null)
    setAuthModalOpen(false)
  }

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    openAuthModal,
    closeAuthModal,
    authenticateWithFirebase,
    logout,
  }), [loading, token, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={authModalOpen}
        onClose={closeAuthModal}
        user={user}
        loading={loading}
        authenticateWithFirebase={authenticateWithFirebase}
        logout={logout}
      />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return value
}

export { formatPhoneForDisplay }
