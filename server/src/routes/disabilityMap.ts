import { Router, Request, Response } from 'express'

const router = Router()

// 快取 1 小時
let cache: { data: { points: DisabilityPoint[] }; timestamp: number } | null = null
const CACHE_TTL = 60 * 60 * 1000

// data.taipei 台北市無障礙相關資料集
const DATASET_IDS = [
  'f8a625d2-6529-4c6a-8852-0122d8bb740e',
  'baf32b58-b194-448d-96a0-ba04013d164f',
]

interface DisabilityPoint {
  id: string
  name: string
  lat: number
  lng: number
  category: string
  address: string
}

function extractCoord(record: Record<string, string>, keys: string[]): number {
  for (const k of keys) {
    const v = parseFloat(record[k] ?? '')
    if (!isNaN(v)) return v
  }
  return NaN
}

router.get('/', async (_req: Request, res: Response) => {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    res.json(cache.data)
    return
  }

  const points: DisabilityPoint[] = []

  for (const datasetId of DATASET_IDS) {
    try {
      const url = `https://data.taipei/api/v1/dataset/${datasetId}?scope=resourceAquire&limit=1000&offset=0`
      const response = await fetch(url, {
        headers: { 'User-Agent': 'AlwaysAccessibility/1.0' },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) continue

      const data = (await response.json()) as { result?: { results?: any[]; records?: any[] } }
      const records: Record<string, string>[] = data?.result?.results ?? data?.result?.records ?? []

      records.forEach((record, index) => {
        const lat = extractCoord(record, ['lat', 'Lat', 'latitude', '緯度', 'Y', 'y'])
        const lng = extractCoord(record, ['lng', 'Lng', 'lon', 'longitude', '經度', 'X', 'x'])

        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          points.push({
            id: `${datasetId}-${index}`,
            name:
              record['name'] ??
              record['Name'] ??
              record['名稱'] ??
              record['facility_name'] ??
              record['機構名稱'] ??
              '無障礙設施',
            lat,
            lng,
            category:
              record['category'] ??
              record['type'] ??
              record['類別'] ??
              record['服務類別'] ??
              'general',
            address:
              record['address'] ??
              record['Address'] ??
              record['地址'] ??
              record['機構地址'] ??
              '',
          })
        }
      })
    } catch {
      // 單一資料集失敗不影響其他資料集
      continue
    }
  }

  const result = { points }
  cache = { data: result, timestamp: Date.now() }
  res.json(result)
})

export default router
