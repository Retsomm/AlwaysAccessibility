import 'dotenv/config'
import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const router = Router()
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
})

// GET /api/search-history?userId=xxx
router.get('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: '缺少 userId' })
    return
  }
  try {
    const histories = await prisma.searchHistory.findMany({
      where: { userId: userId as string },
      orderBy: { searchedAt: 'desc' },
      take: 10,
      distinct: ['keyword'],
    })
    res.json({ histories })
  } catch {
    res.status(500).json({ error: '無法取得搜尋紀錄' })
  }
})

// POST /api/search-history
router.post('/', async (req, res) => {
  const { userId, keyword } = req.body
  if (!userId || !keyword) {
    res.status(400).json({ error: '缺少必要欄位' })
    return
  }
  try {
    const history = await prisma.searchHistory.create({
      data: { userId, keyword: keyword.trim() },
    })
    res.json({ history })
  } catch {
    res.status(500).json({ error: '無法儲存搜尋紀錄' })
  }
})

// DELETE /api/search-history?userId=xxx（清除全部）
router.delete('/', async (req, res) => {
  const { userId } = req.query
  if (!userId) {
    res.status(400).json({ error: '缺少 userId' })
    return
  }
  try {
    await prisma.searchHistory.deleteMany({
      where: { userId: userId as string },
    })
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '無法清除搜尋紀錄' })
  }
})

export default router
