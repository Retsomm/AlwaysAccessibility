import 'dotenv/config'
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const router = Router()
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// GET /api/bookmarks?userId=xxx
router.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: '缺少 userId' })
    return
  }
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: userId as string },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ bookmarks })
  } catch {
    res.status(500).json({ error: '無法取得收藏清單' })
  }
})

// POST /api/bookmarks
router.post('/', async (req, res) => {
  const { userId, googlePlaceId, name, address, lat, lng } = req.body
  if (!userId || !googlePlaceId || !name) {
    res.status(400).json({ error: '缺少必要欄位' })
    return
  }
  try {
    const bookmark = await prisma.bookmark.upsert({
      where: { userId_googlePlaceId: { userId, googlePlaceId } },
      create: { userId, googlePlaceId, name, address: address ?? null, lat: lat ?? 0, lng: lng ?? 0 },
      update: {},
    })
    res.json({ bookmark })
  } catch {
    res.status(500).json({ error: '無法新增收藏' })
  }
})

// DELETE /api/bookmarks/:googlePlaceId?userId=xxx
router.delete('/:googlePlaceId', async (req, res) => {
  const { googlePlaceId } = req.params
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: '缺少 userId' })
    return
  }
  try {
    await prisma.bookmark.deleteMany({
      where: { userId: userId as string, googlePlaceId },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '無法刪除收藏' })
  }
})

export default router
