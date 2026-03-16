import { Router, Request, Response } from 'express'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const { origin, destination, mode = 'transit' } = req.query

  if (!origin || !destination) {
    res.status(400).json({ error: 'origin 與 destination 為必填' })
    return
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Google API 金鑰未設定' })
    return
  }

  try {
    // wheelchair 模式：使用大眾運輸並避開室內（減少階梯）
    const resolvedMode = mode === 'wheelchair' ? 'transit' : (mode as string)

    const params = new URLSearchParams({
      origin: origin as string,
      destination: destination as string,
      mode: resolvedMode,
      key: apiKey,
      language: 'zh-TW',
      region: 'TW',
    })

    if (resolvedMode === 'transit') {
      params.set('transit_mode', 'bus|rail')
    }
    if (mode === 'wheelchair') {
      params.set('avoid', 'indoor')
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = (await response.json()) as {
      status: string
      error_message?: string
      routes?: any[]
    }

    if (data.status !== 'OK') {
      res.status(400).json({ error: data.status, message: data.error_message })
      return
    }

    const route = data.routes![0]
    const leg = route.legs[0]

    res.json({
      polyline: route.overview_polyline.points,
      duration: leg.duration.text,
      distance: leg.distance.text,
      steps: leg.steps.map((step: any) => ({
        instruction: (step.html_instructions as string).replace(/<[^>]*>/g, ''),
        distance: step.distance.text,
        duration: step.duration.text,
        mode: step.travel_mode,
      })),
    })
  } catch {
    res.status(500).json({ error: '無法取得路線資料' })
  }
})

export default router
