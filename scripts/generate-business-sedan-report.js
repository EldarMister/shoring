import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing')
  process.exit(1)
}

const REPORT_PATH = String(process.env.REPORT_PATH || '').trim()
if (!REPORT_PATH) {
  console.error('REPORT_PATH is required')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

async function main() {
  const { rows } = await pool.query(`
    SELECT id
    FROM cars
    WHERE body_type = 'Бизнес-седан'
      AND vehicle_class = 'Бизнес-класс'
    ORDER BY id ASC
  `)

  const lines = []
  for (const row of rows) {
    lines.push(`ID ${row.id}`)
    lines.push('')
    lines.push('Было:')
    lines.push('body_type: Седан')
    lines.push('')
    lines.push('Должно быть:')
    lines.push('body_type: Бизнес-седан')
    lines.push('')
    lines.push('Изменения:')
    lines.push('- body_type уточнен по `vehicle_class = Бизнес-класс`')
    lines.push('')
  }

  const dir = path.dirname(REPORT_PATH)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(REPORT_PATH, lines.join('\n'), 'utf8')

  console.log(JSON.stringify({ reportPath: REPORT_PATH, rows: rows.length }, null, 2))
}

main()
  .catch((error) => {
    console.error('generate-business-sedan-report failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
