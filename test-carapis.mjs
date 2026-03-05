import { CarapisClient, CarapisClientError } from 'encar'

const API_KEY = process.env.CARAPIS_API_KEY || ''

console.log('=== ТЕСТ CARAPIS ENCAR API ===\n')
console.log(`Режим: ${API_KEY ? 'С API ключом' : 'Free tier (без ключа)'}`)

const client = new CarapisClient(API_KEY || undefined)
console.log(`Base URL: ${client.baseUrl}`)
console.log(`Методы: ${Object.getOwnPropertyNames(client).filter(k => typeof client[k] === 'function').join(', ')}`)
console.log(`Endpoints: ${Object.keys(client._endpoints || {}).join(', ')}`)

// 1. Список машин
console.log('\n1. Получаю список машин (limit=5)...')
try {
  const vehicles = await client.listVehicles({ limit: 5 })
  console.log(`✅ Всего в базе: ${vehicles.count}`)
  console.log(`✅ Получено: ${vehicles.results?.length}`)
  console.log(`✅ Страниц: ${vehicles.pages}`)
  console.log('\nПример первой машины:')
  const car = vehicles.results?.[0]
  console.log(JSON.stringify(car, null, 2))

  // 2. Детали машины
  if (car?.id) {
    console.log(`\n2. Детали машины ID=${car.id}...`)
    try {
      const details = await client.getVehicles({ vehicle_id: car.id })
      console.log(`✅ Поля: ${Object.keys(details).join(', ')}`)
      console.log(JSON.stringify(details, null, 2))
    } catch (e) {
      console.log(`❌ Детали: ${e.message}`)
    }
  }

  // 3. Пагинация
  console.log('\n3. Пагинация (page=2, limit=3)...')
  try {
    const page2 = await client.listVehicles({ limit: 3, page: 2 })
    console.log(`✅ Страница 2: ${page2.results?.length} машин`)
    console.log(`   IDs: ${page2.results?.map(v => v.id).join(', ')}`)
  } catch (e) {
    console.log(`❌ Пагинация: ${e.message}`)
  }

} catch (e) {
  console.log(`❌ Ошибка: ${e.message}`)
  if (e instanceof CarapisClientError) {
    console.log(`   Status: ${e.status}`)
    console.log(`   Details: ${JSON.stringify(e.details)}`)
  }
}

console.log('\n=== ТЕСТ ЗАВЕРШЁН ===')
