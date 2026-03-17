import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import placesRouter from './routes/places'
import disabilityMapRouter from './routes/disabilityMap'
import directionsRouter from './routes/directions'
import ratingsRouter from './routes/ratings'
import bookmarksRouter from './routes/bookmarks'
import searchHistoryRouter from './routes/searchHistory'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/places', placesRouter)
app.use('/api/disability-map', disabilityMapRouter)
app.use('/api/directions', directionsRouter)
app.use('/api/ratings', ratingsRouter)
app.use('/api/bookmarks', bookmarksRouter)
app.use('/api/search-history', searchHistoryRouter)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
