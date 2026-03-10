import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import axios from 'axios'
import { Buffer } from 'buffer'
import { fileURLToPath } from 'url'
import { retryOperation } from './diagnostics.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'cars')

fs.mkdirSync(UPLOADS_DIR, { recursive: true })

export async function downloadImage(url, carId) {
  if (!url || !url.startsWith('http')) return null

  const hash = crypto.createHash('md5').update(url).digest('hex').substring(0, 10)
  const ext = (path.extname(url.split('?')[0]) || '.jpg').toLowerCase()
  const filename = `car_${carId}_${hash}${ext}`
  const filepath = path.join(UPLOADS_DIR, filename)

  if (fs.existsSync(filepath)) return `/uploads/cars/${filename}`

  try {
    const result = await retryOperation(async () => axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
      proxy: false,
      maxContentLength: 25 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.encar.com/',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      validateStatus: (status) => status === 200 || status === 404,
    }), {
      maxAttempts: 3,
      baseDelayMs: 800,
      factor: 2,
      classifyError: (error) => {
        const status = Number(error?.response?.status) || 0
        if (status === 404) {
          return {
            reason: 'photo_not_found',
            classification: 'problem',
            temporary: false,
            retryable: false,
            details: '404 Not Found',
            httpStatus: 404,
          }
        }

        if (status === 429 || status >= 500 || !status) {
          return {
            reason: 'photo_download_failed',
            classification: 'problem',
            temporary: true,
            retryable: true,
            details: error.message,
            httpStatus: status || null,
          }
        }

        return {
          reason: 'photo_download_failed',
          classification: 'problem',
          temporary: false,
          retryable: false,
          details: error.message,
          httpStatus: status || null,
        }
      },
    })
    const resp = result.value

    const contentType = resp.headers['content-type'] || ''
    if (!contentType.startsWith('image/')) return null

    fs.writeFileSync(filepath, Buffer.from(resp.data))
    return `/uploads/cars/${filename}`
  } catch {
    return null
  }
}

export async function downloadPhotosDetailed(photoUrls, carId, maxPhotos = 8) {
  const successes = []
  const failures = []
  const toDownload = photoUrls.slice(0, maxPhotos)

  for (const url of toDownload) {
    const localUrl = await downloadImage(url, carId)
    if (localUrl) {
      successes.push({ sourceUrl: url, localUrl })
    } else {
      failures.push({ sourceUrl: url })
    }
  }

  return {
    attempted: toDownload.length,
    saved: successes.length,
    failed: failures.length,
    urls: successes.map((item) => item.localUrl),
    failures,
  }
}

export async function downloadPhotos(photoUrls, carId, maxPhotos = 8) {
  const result = await downloadPhotosDetailed(photoUrls, carId, maxPhotos)
  return result.urls
}
