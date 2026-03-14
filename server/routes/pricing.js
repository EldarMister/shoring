import { Router } from 'express'
import { getPricingSettings } from '../lib/pricingSettings.js'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const pricingSettings = await getPricingSettings()
    return res.json(pricingSettings)
  } catch (error) {
    console.error('PRICING_SETTINGS_PUBLIC_ERROR |', error?.message || error)
    return res.status(500).json({ error: 'Ошибка загрузки настроек' })
  }
})

export default router
