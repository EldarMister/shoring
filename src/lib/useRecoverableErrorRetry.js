import { useEffect } from 'react'

function normalizeErrorText(error) {
  return String(error || '').trim().toLowerCase()
}

export function isRecoverableError(error) {
  const text = normalizeErrorText(error)
  if (!text) return false
  return !text.includes('не найден') && !text.includes('не найдена') && !text.includes('not found')
}

export default function useRecoverableErrorRetry(error, retry, { delayMs = 4000 } = {}) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
    if (typeof retry !== 'function' || !isRecoverableError(error)) return undefined

    let stopped = false
    const safeRetry = () => {
      if (stopped) return
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      retry()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      safeRetry()
    }

    const timer = window.setTimeout(safeRetry, Math.max(1000, Number(delayMs) || 4000))
    window.addEventListener('online', safeRetry)
    window.addEventListener('focus', safeRetry)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopped = true
      window.clearTimeout(timer)
      window.removeEventListener('online', safeRetry)
      window.removeEventListener('focus', safeRetry)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [delayMs, error, retry])
}
