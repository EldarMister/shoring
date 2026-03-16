import { useEffect, useMemo, useRef, useState } from 'react'
import { useDeliveryContext } from '../../hooks/useDeliveryContext.js'

const ChevronDownIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="6 9 12 15 18 9" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function DeliveryCountrySelect({ label = 'Страна доставки', ariaLabel = 'Страна доставки', compact = false }) {
  const { countries = [], countryCode, setCountryCode } = useDeliveryContext() || {}
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const options = useMemo(
    () => countries.map((country) => ({
      value: country.code,
      label: country.label,
      flag: country.flag,
    })),
    [countries],
  )

  const activeOption = useMemo(
    () => options.find((option) => option.value === countryCode) || options[0] || null,
    [options, countryCode],
  )

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  if (!options.length) return null

  return (
    <div className={`delivery-country-select${compact ? ' is-compact' : ''}`}>
      {label ? <span className="delivery-country-label">{label}</span> : null}
      <div className={`delivery-country-dropdown${open ? ' is-open' : ''}`} ref={rootRef}>
        <button
          type="button"
          className="delivery-country-trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="delivery-country-trigger-content">
            {activeOption?.flag ? (
              <span className="delivery-country-flag" aria-hidden="true">{activeOption.flag}</span>
            ) : null}
            <span className="delivery-country-trigger-label">{activeOption?.label || ''}</span>
          </span>
          <span className="delivery-country-trigger-icon" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>
        {open && (
          <div className="delivery-country-menu" role="listbox" aria-label={ariaLabel}>
            {options.map((option) => {
              const isActive = option.value === countryCode
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`delivery-country-option${isActive ? ' is-active' : ''}`}
                  onClick={() => {
                    setCountryCode?.(option.value)
                    setOpen(false)
                  }}
                >
                  <span className="delivery-country-option-check" aria-hidden="true">
                    {isActive ? <CheckIcon /> : null}
                  </span>
                  {option.flag ? (
                    <span className="delivery-country-flag" aria-hidden="true">{option.flag}</span>
                  ) : null}
                  <span className="delivery-country-option-label">{option.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
