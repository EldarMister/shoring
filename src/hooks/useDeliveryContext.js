import { useContext } from 'react'
import { DeliveryContext } from '../context/delivery-context.js'

export function useDeliveryContext() {
  const context = useContext(DeliveryContext)

  if (!context) {
    throw new Error('useDeliveryContext must be used within DeliveryProvider')
  }

  return context
}
