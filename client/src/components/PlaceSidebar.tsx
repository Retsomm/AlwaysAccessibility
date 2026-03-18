import { useState, useEffect, useCallback } from 'react'
import { useMapStore } from '../store/mapStore'
import { useAuthStore } from '../store/authStore'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

type AccessibilityLevel = 'YES' | 'LIMITED' | 'NO' | 'UNKNOWN'

interface RatingItem {
  id: string
  ramp: AccessibilityLevel
  toilet: AccessibilityLevel
  parking: AccessibilityLevel
  entrance: AccessibilityLevel
  note: string | null
  submittedBy: string | null
  submitterGoogleId: string | null
  submitterAvatarUrl: string | null
  createdAt: string
}

interface ReviewForm {
  entrance: AccessibilityLevel
  toilet: AccessibilityLevel
  parking: AccessibilityLevel
  ramp: AccessibilityLevel
  note: string
}

interface BookmarkItem {
  id: string
  googlePlaceId: string
  name: string
  address?: string | null
  lat: number
  lng: number
  createdAt: string
}

const EMPTY_FORM: ReviewForm = { entrance: 'UNKNOWN', toilet: 'UNKNOWN', parking: 'UNKNOWN', ramp: 'UNKNOWN', note: '' }

const LEVEL_OPTIONS: { value: AccessibilityLevel; label: string; active: string }[] = [
  { value: 'YES', label: '有', active: 'bg-green-100 text-green-700 border-green-400 font-semibold' },
  { value: 'LIMITED', label: '部分', active: 'bg-yellow-100 text-yellow-700 border-yellow-400 font-semibold' },
  { value: 'NO', label: '無', active: 'bg-red-100 text-red-600 border-red-400 font-semibold' },
  { value: 'UNKNOWN', label: '未知', active: 'bg-gray-100 text-gray-500 border-gray-400 font-semibold' },
]

const FIELDS: { key: keyof Omit<ReviewForm, 'note'>; label: string; short: string; icon: string }[] = [
  { key: 'entrance', label: '無障礙入口', short: '入口', icon: '🚪' },
  { key: 'toilet', label: '無障礙廁所', short: '廁所', icon: '🚻' },
  { key: 'parking', label: '無障礙停車', short: '停車', icon: '🅿️' },
  { key: 'ramp', label: '無障礙坡道', short: '坡道', icon: '♿' },
]

const LEVEL_DISPLAY: Record<AccessibilityLevel, { icon: string; color: string; label: string }> = {
  YES: { icon: '✓', color: 'text-green-600', label: '有' },
  LIMITED: { icon: '△', color: 'text-yellow-600', label: '部分' },
  NO: { icon: '✕', color: 'text-red-500', label: '無' },
  UNKNOWN: { icon: '?', color: 'text-gray-400', label: '未知' },
}

function formatDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return '剛才'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-TW')
}

function BookmarkIcon({ filled, className = 'w-5 h-5' }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function FieldSelector({
  field,
  value,
  onChange,
}: {
  field: (typeof FIELDS)[number]
  value: AccessibilityLevel
  onChange: (v: AccessibilityLevel) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-md text-gray-600 font-medium">
        {field.icon} {field.label}
      </p>
      <div className="flex gap-1">
        {LEVEL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-md py-1 rounded border transition-colors cursor-pointer ${
              value === opt.value ? opt.active : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-500'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RatingCard({
  rating,
  currentGoogleId,
  onEdit,
}: {
  rating: RatingItem
  currentGoogleId?: string
  onEdit: (r: RatingItem) => void
}) {
  const isOwner = !!currentGoogleId && rating.submitterGoogleId === currentGoogleId
  const displayName = rating.submittedBy ?? '匿名'
  const initial = displayName.slice(0, 1).toUpperCase()

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 mb-2">
        {rating.submitterAvatarUrl ? (
          <img
            src={rating.submitterAvatarUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full shrink-0 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-md font-bold shrink-0">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-md font-medium text-gray-800 truncate">{displayName}</span>
            {isOwner && (
              <button
                onClick={() => onEdit(rating)}
                className="shrink-0 text-md text-sky-500 hover:text-sky-700 font-medium cursor-pointer"
              >
                編輯
              </button>
            )}
          </div>
          <span className="text-md text-gray-400">{formatDate(rating.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-1">
        {FIELDS.map((f) => {
          const lvl = rating[f.key as keyof RatingItem] as AccessibilityLevel
          const { icon, color } = LEVEL_DISPLAY[lvl]
          return (
            <div key={f.key} className="text-center">
              <div className={`text-md font-bold ${color}`}>{icon}</div>
              <div className="text-md text-gray-500 mt-0.5">{f.short}</div>
            </div>
          )
        })}
      </div>

      {rating.note && (
        <p className="text-md text-gray-600 mt-1.5 leading-relaxed italic">「{rating.note}」</p>
      )}
    </div>
  )
}

function ReviewFormSection({
  form,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  title,
}: {
  form: ReviewForm
  onChange: (f: ReviewForm) => void
  onSubmit: () => void
  onCancel: () => void
  isSubmitting: boolean
  title: string
}) {
  return (
    <div className="space-y-3">
      <p className="text-md font-semibold text-gray-700">{title}</p>
      {FIELDS.map((f) => (
        <FieldSelector
          key={f.key}
          field={f}
          value={form[f.key]}
          onChange={(v) => onChange({ ...form, [f.key]: v })}
        />
      ))}
      <textarea
        value={form.note}
        onChange={(e) => onChange({ ...form, note: e.target.value })}
        placeholder="補充說明（選填）"
        rows={2}
        className="w-full text-md border border-gray-200 rounded px-2 py-1.5 text-gray-800 outline-none resize-none focus:border-sky-300"
      />
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-md py-2 rounded font-medium disabled:opacity-50 transition-colors cursor-pointer"
        >
          {isSubmitting ? '儲存中...' : '儲存'}
        </button>
        <button
          onClick={onCancel}
          className="text-md text-gray-400 hover:text-gray-600 px-3 cursor-pointer"
        >
          取消
        </button>
      </div>
    </div>
  )
}

export default function PlaceSidebar() {
  const {
    openMarkerId, setOpenMarkerId, places, setFocusLocation,
    leftPanelOpen, leftPanelTab, setLeftPanelOpen, setLeftPanelTab, addPlace, searchByKeyword,
  } = useMapStore()
  const user = useAuthStore((s) => s.user)

  const place = places.find((p) => p.id === openMarkerId) ?? null

  // Detail view state
  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [loadingRatings, setLoadingRatings] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRating, setEditingRating] = useState<RatingItem | null>(null)
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Bookmark state for current place
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false)

  // Bookmarks list state
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [loadingBookmarks, setLoadingBookmarks] = useState(false)

  // Search history state
  const [searchHistory, setSearchHistory] = useState<{ id: string; keyword: string }[]>([])

  const fetchSearchHistory = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${API_BASE}/api/search-history?userId=${encodeURIComponent(user.id)}`)
      const data = (await res.json()) as { histories?: { id: string; keyword: string }[] }
      setSearchHistory(data.histories ?? [])
    } catch {
      setSearchHistory([])
    }
  }, [user])

  useEffect(() => {
    if ((leftPanelTab === 'results' || leftPanelTab === 'history') && leftPanelOpen && user) {
      fetchSearchHistory()
    }
  }, [leftPanelTab, leftPanelOpen, user, fetchSearchHistory])

  // Auto-open panel when marker is clicked
  useEffect(() => {
    if (openMarkerId) setLeftPanelOpen(true)
  }, [openMarkerId, setLeftPanelOpen])

  const fetchRatings = useCallback(async (googlePlaceId: string) => {
    setLoadingRatings(true)
    try {
      const res = await fetch(`${API_BASE}/api/ratings/${encodeURIComponent(googlePlaceId)}`)
      const data = (await res.json()) as { ratings: RatingItem[] }
      setRatings(data.ratings ?? [])
    } catch {
      setRatings([])
    } finally {
      setLoadingRatings(false)
    }
  }, [])

  useEffect(() => {
    if (!place) {
      setRatings([])
      setShowAddForm(false)
      setEditingRating(null)
      setForm(EMPTY_FORM)
      return
    }
    fetchRatings(place.id)
  }, [place, fetchRatings])

  // Check bookmark status for current place
  useEffect(() => {
    if (!place || !user) { setIsBookmarked(false); return }
    fetch(`${API_BASE}/api/bookmarks?userId=${encodeURIComponent(user.id)}`)
      .then((r) => r.json())
      .then((data: { bookmarks?: { googlePlaceId: string }[] }) => {
        setIsBookmarked((data.bookmarks ?? []).some((b) => b.googlePlaceId === place.id))
      })
      .catch(() => setIsBookmarked(false))
  }, [place, user])

  const fetchBookmarks = useCallback(async () => {
    if (!user) return
    setLoadingBookmarks(true)
    try {
      const res = await fetch(`${API_BASE}/api/bookmarks?userId=${encodeURIComponent(user.id)}`)
      const data = (await res.json()) as { bookmarks?: BookmarkItem[] }
      setBookmarks(data.bookmarks ?? [])
    } catch {
      setBookmarks([])
    } finally {
      setLoadingBookmarks(false)
    }
  }, [user])

  useEffect(() => {
    if (leftPanelTab === 'bookmarks' && user) fetchBookmarks()
  }, [leftPanelTab, user, fetchBookmarks])

  const toggleBookmark = async () => {
    if (!place || !user || isTogglingBookmark) return
    setIsTogglingBookmark(true)
    try {
      if (isBookmarked) {
        await fetch(
          `${API_BASE}/api/bookmarks/${encodeURIComponent(place.id)}?userId=${encodeURIComponent(user.id)}`,
          { method: 'DELETE' }
        )
        setIsBookmarked(false)
        setBookmarks((prev) => prev.filter((b) => b.googlePlaceId !== place.id))
      } else {
        await fetch(`${API_BASE}/api/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            googlePlaceId: place.id,
            name: place.name,
            address: place.address,
            lat: place.location.lat,
            lng: place.location.lng,
          }),
        })
        setIsBookmarked(true)
      }
    } catch {
      // 靜默失敗
    } finally {
      setIsTogglingBookmark(false)
    }
  }

  const handleAdd = async () => {
    if (!place) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googlePlaceId: place.id,
          name: place.name,
          lat: place.location.lat,
          lng: place.location.lng,
          ...form,
          note: form.note || undefined,
          submittedBy: user?.name,
          submitterGoogleId: user?.id,
          submitterAvatarUrl: user?.avatar,
        }),
      })
      const data = (await res.json()) as { rating?: RatingItem }
      if (data.rating) setRatings((prev) => [data.rating!, ...prev])
      setShowAddForm(false)
      setForm(EMPTY_FORM)
    } catch {
      // 靜默失敗
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditSave = async () => {
    if (!editingRating) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/ratings/${editingRating.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          note: form.note || undefined,
          submitterGoogleId: user?.id,
        }),
      })
      const data = (await res.json()) as { rating?: RatingItem }
      if (data.rating) {
        setRatings((prev) => prev.map((r) => (r.id === editingRating.id ? data.rating! : r)))
      }
      setEditingRating(null)
      setForm(EMPTY_FORM)
    } catch {
      // 靜默失敗
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleStartEdit = (rating: RatingItem) => {
    setEditingRating(rating)
    setForm({
      entrance: rating.entrance,
      toilet: rating.toilet,
      parking: rating.parking,
      ramp: rating.ramp,
      note: rating.note ?? '',
    })
    setShowAddForm(false)
  }

  const handleClose = () => {
    setLeftPanelOpen(false)
    setOpenMarkerId(null)
  }

  if (!leftPanelOpen) {
    return (
      <button
        onClick={() => setLeftPanelOpen(true)}
        aria-label="開啟側邊欄"
        className="absolute left-0 top-1/2 -translate-y-1/2 bg-white shadow-lg rounded-r-xl z-10 flex flex-col items-center justify-center gap-1.5 px-2 py-4 text-gray-500 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18" />
        </svg>
        <span className="text-md font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>地點資訊</span>
      </button>
    )
  }

  const accessibilityBadges = place
    ? [
        place.accessibility.wheelchair_entrance && '無障礙入口',
        place.accessibility.wheelchair_parking && '無障礙停車',
        place.accessibility.wheelchair_restroom && '無障礙廁所',
        place.accessibility.wheelchair_seating && '無障礙座位',
      ].filter(Boolean) as string[]
    : []

  return (
    <div className="absolute left-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-10 flex flex-col">
      {/* Tab 列 */}
      <div className="shrink-0 border-b border-gray-100 px-4 pt-3 flex items-center justify-between">
        <div className="flex gap-4">
          <button
            onClick={() => { setLeftPanelTab('results'); setOpenMarkerId(null) }}
            className={`text-md font-medium pb-2.5 border-b-2 transition-colors cursor-pointer ${
              leftPanelTab === 'results'
                ? 'border-sky-500 text-sky-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            搜尋結果
          </button>
          {user && (
            <>
              <button
                onClick={() => { setLeftPanelTab('history'); setOpenMarkerId(null) }}
                className={`text-md font-medium pb-2.5 border-b-2 transition-colors cursor-pointer ${
                  leftPanelTab === 'history'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                搜尋紀錄
              </button>
              <button
                onClick={() => { setLeftPanelTab('bookmarks'); setOpenMarkerId(null) }}
                className={`text-md font-medium pb-2.5 border-b-2 transition-colors flex items-center gap-1 cursor-pointer ${
                  leftPanelTab === 'bookmarks'
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <BookmarkIcon filled={leftPanelTab === 'bookmarks'} className="w-3.5 h-3.5" />
                收藏
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 text-xl leading-none mb-2 cursor-pointer"
          aria-label="關閉面板"
        >
          ×
        </button>
      </div>

      {/* 主要內容 */}
      {place && openMarkerId ? (
        /* 地點詳情 */
        <div className="flex flex-col flex-1 overflow-hidden">
          <button
            onClick={() => setOpenMarkerId(null)}
            className="shrink-0 flex items-center gap-1 px-4 py-2 text-md text-sky-500 hover:text-sky-700 border-b border-gray-100 cursor-pointer"
          >
            ← 返回列表
          </button>

          <div className="flex-1 overflow-y-auto">
            {place.photoName && (
              <img
                src={`${API_BASE}/api/places/photo?name=${encodeURIComponent(place.photoName)}`}
                alt={place.name}
                className="w-full h-36 object-cover"
              />
            )}

            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-900 leading-tight">{place.name}</h2>
                {user && (
                  <button
                    onClick={toggleBookmark}
                    disabled={isTogglingBookmark}
                    aria-label={isBookmarked ? '取消收藏' : '加入收藏'}
                    className={`shrink-0 p-1 rounded transition-colors disabled:opacity-40 cursor-pointer ${
                      isBookmarked ? 'text-sky-500' : 'text-gray-300 hover:text-sky-400'
                    }`}
                  >
                    <BookmarkIcon filled={isBookmarked} />
                  </button>
                )}
              </div>
              {place.rating != null && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-amber-500 text-md">{'★'.repeat(Math.round(place.rating))}</span>
                  <span className="text-gray-300 text-md">{'★'.repeat(5 - Math.round(place.rating))}</span>
                  <span className="text-md text-gray-500 ml-0.5">{place.rating}</span>
                </div>
              )}
              {place.address && <p className="text-md text-gray-500 mt-0.5">{place.address}</p>}
              {accessibilityBadges.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {accessibilityBadges.map((badge) => (
                    <span
                      key={badge}
                      className="text-md bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}&travelmode=walking`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-md font-medium text-sky-600 hover:text-sky-800 underline"
              >
                在 Google Maps 開啟導航
              </a>
            </div>

            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <h3 className="text-md font-semibold text-gray-800">社群無障礙資訊</h3>
              {!loadingRatings && (
                <span className="text-md text-gray-400">{ratings.length} 筆</span>
              )}
            </div>

            {loadingRatings ? (
              <p className="px-4 py-4 text-md text-gray-400">載入中...</p>
            ) : ratings.length === 0 ? (
              <p className="px-4 py-3 text-md text-gray-400">尚無無障礙資訊，歡迎新增！</p>
            ) : (
              <div className="px-4">
                {ratings.map((r) =>
                  editingRating?.id === r.id ? (
                    <div key={r.id} className="py-3 border-b border-gray-100">
                      <ReviewFormSection
                        form={form}
                        onChange={setForm}
                        onSubmit={handleEditSave}
                        onCancel={() => { setEditingRating(null); setForm(EMPTY_FORM) }}
                        isSubmitting={isSubmitting}
                        title="編輯無障礙資訊"
                      />
                    </div>
                  ) : (
                    <RatingCard
                      key={r.id}
                      rating={r}
                      currentGoogleId={user?.id}
                      onEdit={handleStartEdit}
                    />
                  )
                )}
              </div>
            )}
          </div>

          {user && (
            <div className="shrink-0 border-t border-gray-100 px-4 py-3">
              {showAddForm ? (
                <ReviewFormSection
                  form={form}
                  onChange={setForm}
                  onSubmit={handleAdd}
                  onCancel={() => { setShowAddForm(false); setForm(EMPTY_FORM) }}
                  isSubmitting={isSubmitting}
                  title="新增無障礙資訊"
                />
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full text-md text-sky-600 hover:text-sky-800 font-medium py-1 text-center cursor-pointer"
                >
                  + 新增無障礙資訊
                </button>
              )}
            </div>
          )}
        </div>
      ) : leftPanelTab === 'results' ? (
        /* 搜尋結果列表 */
        <div className="flex-1 overflow-y-auto">
          {places.length === 0 ? (
            <div>
              {user && searchHistory.length > 0 ? (
                <>
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-md font-medium text-gray-400">最近搜尋</p>
                  </div>
                  {searchHistory.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => searchByKeyword(h.keyword)}
                      className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                      </svg>
                      <span className="text-md text-gray-700 truncate">{h.keyword}</span>
                    </button>
                  ))}
                </>
              ) : (
                <div className="px-4 py-12 text-center">
                  <p className="text-md text-gray-400">請在上方搜尋地點</p>
                </div>
              )}
            </div>
          ) : (
            places.map((p) => (
              <button
                key={p.id}
                onClick={() => setOpenMarkerId(p.id)}
                className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-md font-medium text-gray-800 truncate">{p.name}</p>
                    {p.address && <p className="text-md text-gray-500 truncate mt-0.5">{p.address}</p>}
                    {p.rating != null && (
                      <span className="text-md text-amber-500">{'★'.repeat(Math.round(p.rating))} {p.rating}</span>
                    )}
                  </div>
                  {p.accessibility.wheelchair_entrance !== false && (
                    <span className="shrink-0 text-md bg-sky-50 text-sky-500 border border-sky-100 px-1.5 py-0.5 rounded mt-0.5">♿</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      ) : leftPanelTab === 'history' ? (
        /* 搜尋紀錄列表 */
        <div className="flex-1 overflow-y-auto">
          {searchHistory.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <p className="text-md text-gray-400">尚無搜尋紀錄</p>
            </div>
          ) : (
            searchHistory.map((h) => (
              <button
                key={h.id}
                onClick={() => {
                  setLeftPanelTab('results')
                  searchByKeyword(h.keyword)
                }}
                className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors flex items-center gap-3 cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <span className="text-md text-gray-700 truncate">{h.keyword}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        /* 收藏列表 */
        <div className="flex-1 overflow-y-auto">
          {loadingBookmarks ? (
            <p className="px-4 py-8 text-md text-gray-400 text-center">載入中...</p>
          ) : bookmarks.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <BookmarkIcon filled={false} className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-md text-gray-400">尚無收藏地點</p>
              <p className="text-md text-gray-300 mt-1">點擊地標後按收藏按鈕加入</p>
            </div>
          ) : (
            bookmarks.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  addPlace({
                    id: b.googlePlaceId,
                    name: b.name,
                    location: { lat: b.lat, lng: b.lng },
                    address: b.address ?? '',
                    accessibility: {},
                    types: [],
                    filterType: 'restaurant',
                    photoName: null,
                  })
                  setOpenMarkerId(b.googlePlaceId)
                  setFocusLocation({ lat: b.lat, lng: b.lng, zoom: 16 })
                }}
                className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-md font-medium text-gray-800 truncate">{b.name}</p>
                    {b.address && <p className="text-md text-gray-500 truncate mt-0.5">{b.address}</p>}
                  </div>
                  <BookmarkIcon filled className="shrink-0 w-4 h-4 text-sky-400 mt-0.5" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
