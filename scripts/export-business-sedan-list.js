import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import pg from 'pg'

dotenv.config()

const { Pool } = pg
const DATABASE_URL = process.env.DATABASE_URL
const REPORT_PATH = process.env.REPORT_PATH || 'reports/business-sedan-list.csv'

if (!DATABASE_URL) {
  console.error('DATABASE_URL is missing')
  process.exit(1)
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

function csvEscape(value = '') {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, name, model, trim_level, vehicle_class, body_type
    FROM cars
    WHERE body_type = 'Бизнес-седан'
    ORDER BY id ASC
  `)

  const lines = ['id,name,model,trim_level,vehicle_class,body_type']
  for (const row of rows) {
    lines.push([
      row.id,
      csvEscape(row.name),
      csvEscape(row.model),
      csvEscape(row.trim_level),
      csvEscape(row.vehicle_class),
      csvEscape(row.body_type),
    ].join(','))
  }

  const dir = path.dirname(REPORT_PATH)
  await fs.promises.mkdir(dir, { recursive: true })
  await fs.promises.writeFile(REPORT_PATH, lines.join('\n'), 'utf8')
  console.log(`rows ${rows.length}`)
  console.log(`report ${REPORT_PATH}`)
}

main()
  .catch((error) => {
    console.error('export-business-sedan-list failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
