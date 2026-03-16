import 'dotenv/config'
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const router = Router()
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

router.get('/:googlePlaceId', async (req, res) => {
  try {
    const { googlePlaceId } = req.params
    const place = await prisma.place.findUnique({ where: { googlePlaceId } })
    if (!place) {
      res.json({ ratings: [] })
      return
    }
    const ratings = await prisma.rating.findMany({
      where: { placeId: place.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json({ ratings })
  } catch {
    res.status(500).json({ error: '無法取得評分資料' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { googlePlaceId, name, lat, lng, ramp, toilet, parking, entrance, note, submittedBy, submitterGoogleId, submitterAvatarUrl } = req.body
    if (!googlePlaceId || !name) {
      res.status(400).json({ error: '缺少必要欄位' })
      return
    }

    const place = await prisma.place.upsert({
      where: { googlePlaceId },
      create: {
        googlePlaceId,
        name,
        lat: typeof lat === 'number' ? lat : 0,
        lng: typeof lng === 'number' ? lng : 0,
      },
      update: {},
    })

    const rating = await prisma.rating.create({
      data: {
        placeId: place.id,
        ramp: ramp ?? 'UNKNOWN',
        toilet: toilet ?? 'UNKNOWN',
        parking: parking ?? 'UNKNOWN',
        entrance: entrance ?? 'UNKNOWN',
        note: note || null,
        submittedBy: submittedBy || null,
        submitterGoogleId: submitterGoogleId || null,
        submitterAvatarUrl: submitterAvatarUrl || null,
      },
    })

    res.json({ rating })
  } catch {
    res.status(500).json({ error: '無法儲存評分' })
  }
})

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { ramp, toilet, parking, entrance, note, submitterGoogleId } = req.body

    const existing = await prisma.rating.findUnique({ where: { id } })
    if (!existing) {
      res.status(404).json({ error: '找不到評分' })
      return
    }
    if (!submitterGoogleId || existing.submitterGoogleId !== submitterGoogleId) {
      res.status(403).json({ error: '無權限修改' })
      return
    }

    const rating = await prisma.rating.update({
      where: { id },
      data: {
        ramp: ramp ?? existing.ramp,
        toilet: toilet ?? existing.toilet,
        parking: parking ?? existing.parking,
        entrance: entrance ?? existing.entrance,
        note: note !== undefined ? (note || null) : existing.note,
      },
    })

    res.json({ rating })
  } catch {
    res.status(500).json({ error: '無法更新評分' })
  }
})

export default router
