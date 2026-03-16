import { Router, Request, Response } from 'express'

const router = Router()

const PLACE_TYPE_MAP: Record<string, string[]> = {
  restaurant: ['restaurant'],
  attraction: ['tourist_attraction', 'museum', 'park', 'amusement_park'],
  parking: ['parking'],
}

const FIELD_MASK =
  'places.id,places.displayName,places.location,places.accessibilityOptions,places.formattedAddress,places.types,places.rating,places.photos'

function mapPlace(p: any): object {
  return {
    id: p.id,
    name: p.displayName?.text ?? '',
    location: {
      lat: p.location?.latitude,
      lng: p.location?.longitude,
    },
    address: p.formattedAddress ?? '',
    rating: p.rating,
    accessibility: {
      wheelchair_entrance: p.accessibilityOptions?.wheelchairAccessibleEntrance,
      wheelchair_parking: p.accessibilityOptions?.wheelchairAccessibleParking,
      wheelchair_restroom: p.accessibilityOptions?.wheelchairAccessibleRestroom,
      wheelchair_seating: p.accessibilityOptions?.wheelchairAccessibleSeating,
    },
    types: p.types ?? [],
    photoName: p.photos?.[0]?.name ?? null,
  }
}

// 照片代理：避免在前端暴露 API Key
router.get('/photo', (req: Request, res: Response) => {
  const { name } = req.query
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!name || !apiKey) {
    res.status(400).send('Bad request')
    return
  }
  res.redirect(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=400&skipHttpRedirect=false&key=${apiKey}`
  )
})

router.get('/', async (req: Request, res: Response) => {
  const { lat, lng, type = 'restaurant', radius = '1500', keyword } = req.query

  if (!lat || !lng) {
    res.status(400).json({ error: 'lat 與 lng 為必填' })
    return
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Google API 金鑰未設定' })
    return
  }

  try {
    let data: { places?: any[] }

    if (keyword) {
      // 關鍵字搜尋：使用 searchText API
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: keyword as string,
          locationBias: {
            circle: {
              center: {
                latitude: parseFloat(lat as string),
                longitude: parseFloat(lng as string),
              },
              radius: parseFloat(radius as string),
            },
          },
          maxResultCount: 20,
        }),
      })
      data = (await response.json()) as { places?: any[] }
    } else {
      // 類型過濾：使用 searchNearby API
      const includedTypes = PLACE_TYPE_MAP[type as string] ?? PLACE_TYPE_MAP.restaurant
      const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          includedTypes,
          locationRestriction: {
            circle: {
              center: {
                latitude: parseFloat(lat as string),
                longitude: parseFloat(lng as string),
              },
              radius: parseFloat(radius as string),
            },
          },
          maxResultCount: 20,
        }),
      })
      data = (await response.json()) as { places?: any[] }
    }

    res.json({ places: (data.places ?? []).map(mapPlace) })
  } catch {
    res.status(500).json({ error: '無法取得地點資料' })
  }
})

export default router
