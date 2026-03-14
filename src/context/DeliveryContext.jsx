import { useContext, useEffect, useMemo, useState } from 'react'
import { DeliveryContext } from './delivery-context.js'
import { normalizeDeliverySettings, resolveDefaultCountryCode } from '../lib/delivery.js'

export function DeliveryProvider({ children }) {
  const [settings, setSettings] = useState(() => normalizeDeliverySettings({}))
  const [loading, setLoading] = useState(true)
  const [countryCode, setCountryCode] = useState('kg')

  useEffect(() => {
    let active = true

    const run = async () => {
      try {
        const res = await fetch('/api/pricing-settings')
        if (!res.ok) throw new Error('Failed to load delivery settings')
        const payload = await res.json()
        if (!active) return
        const normalized = normalizeDeliverySettings(payload)
        setSettings(normalized)
        setCountryCode((prev) => {
          const exists = normalized.delivery_countries.some((country) => country.code === prev)
          return exists ? prev : normalized.default_country_code
        })
      } catch {
        if (!active) return
        setSettings(normalizeDeliverySettings({}))
      } finally {
        if (active) setLoading(false)
      }
    }

    run()
    return () => {
      active = false
    }
  }, [])

  const value = useMemo(() => {
    const countries = settings.delivery_countries || []
    const defaultCountryCode = settings.default_country_code || resolveDefaultCountryCode(countries)
    const selectedCountry = countries.find((country) => country.code === countryCode) || countries[0] || null

    return {
      settings,
      loading,
      countries,
      countryCode,
      defaultCountryCode,
      selectedCountry,
      setCountryCode,
    }
  }, [settings, loading, countryCode])

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  )
}

export function useDeliveryContext() {
  return useContext(DeliveryContext)
}
