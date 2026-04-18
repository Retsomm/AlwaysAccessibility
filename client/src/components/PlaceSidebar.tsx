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

const LEVEL_MAP: Record<AccessibilityLevel, { label: string; tone: string; dot: string }> = {
  YES:     { label: '有',   tone: 'yes',     dot: '✓' },
  LIMITED: { label: '部分', tone: 'limited', dot: '△' },
  NO:      { label: '無',   tone: 'no',      dot: '✕' },
  UNKNOWN: { label: '未知', tone: 'unknown', dot: '?' },
}

const LEVEL_OPTIONS: AccessibilityLevel[] = ['YES', 'LIMITED', 'NO', 'UNKNOWN']

const FIELDS: { key: keyof Omit<ReviewForm, 'note'>; label: string; short: string }[] = [
  { key: 'entrance', label: '無障礙入口', short: '入口' },
  { key: 'toilet',   label: '無障礙廁所', short: '廁所' },
  { key: 'parking',  label: '無障礙停車', short: '停車' },
  { key: 'ramp',     label: '無障礙坡道', short: '坡道' },
]

// SVG icons
const DoorIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3h12v18H6z"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
  </svg>
)
const ToiletIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="5" r="2"/><path d="M9 9v5h5l3 5M9 14l-4 6"/>
  </svg>
)
const ParkingIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V8h3.5a3 3 0 0 1 0 6H9"/>
  </svg>
)
const RampIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="5" r="2"/><path d="M9 9v5h5l3 5M9 14l-4 6"/>
  </svg>
)
const BookmarkSvg = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
)
const ArrowLeftIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7"/>
  </svg>
)
const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)
const NavIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 11 18-8-8 18-2-8-8-2Z"/>
  </svg>
)
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14"/>
  </svg>
)
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  </svg>
)
const SidebarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>
  </svg>
)

const FIELD_ICONS: Record<string, React.FC> = {
  entrance: DoorIcon,
  toilet: ToiletIcon,
  parking: ParkingIcon,
  ramp: RampIcon,
}

const formatDate = (iso: string) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return '剛才'
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`
  return new Date(iso).toLocaleDateString('zh-TW')
}

const computeConsensus = (ratings: RatingItem[], field: 'entrance' | 'toilet' | 'parking' | 'ramp'): AccessibilityLevel => {
  if (ratings.length === 0) return 'UNKNOWN'
  const counts: Record<AccessibilityLevel, number> = { YES: 0, LIMITED: 0, NO: 0, UNKNOWN: 0 }
  ratings.forEach((r) => { counts[r[field]]++ })
  return (Object.entries(counts) as [AccessibilityLevel, number][]).sort((a, b) => b[1] - a[1])[0][0]
}

// Styles
const cellToneStyle = (tone: string): React.CSSProperties => {
  if (tone === 'yes') return { background: 'var(--yes-wash)', color: 'var(--yes)' }
  if (tone === 'limited') return { background: 'var(--limited-wash)', color: 'var(--limited)' }
  if (tone === 'no') return { background: 'var(--no-wash)', color: 'var(--no)' }
  return { background: 'var(--bg-sunk)', color: 'var(--ink-3)' }
}

const reviewChipStyle = (): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 8px 3px 6px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
  border: '1px solid var(--hairline)',
  background: 'var(--panel)',
})

const segBtnActiveStyle = (tone: string): React.CSSProperties => {
  if (tone === 'yes') return { background: 'var(--yes)', color: 'white' }
  if (tone === 'limited') return { background: 'var(--limited)', color: 'white' }
  if (tone === 'no') return { background: 'var(--no)', color: 'white' }
  return { background: 'var(--ink-4)', color: 'white' }
}

// FieldSelector component
const FieldSelector = ({
  fieldKey,
  label,
  value,
  onChange,
}: {
  fieldKey: string
  label: string
  value: AccessibilityLevel
  onChange: (v: AccessibilityLevel) => void
}) => {
  const FieldIcon = FIELD_ICONS[fieldKey] ?? DoorIcon
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 6 }}>
        <FieldIcon />{label}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, background: 'var(--bg-sunk)', padding: 3, borderRadius: 10 }}>
        {LEVEL_OPTIONS.map((v) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                padding: '6px 4px',
                borderRadius: 7,
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                transition: 'all 0.1s',
                cursor: 'pointer',
                ...(active ? segBtnActiveStyle(LEVEL_MAP[v].tone) : { background: 'transparent', color: 'var(--ink-3)' }),
              }}
            >
              {LEVEL_MAP[v].label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// A11y summary grid
const A11ySummary = ({ ratings }: { ratings: RatingItem[] }) => {
  const fields: { key: 'entrance' | 'toilet' | 'parking' | 'ramp'; label: string; Icon: React.FC }[] = [
    { key: 'entrance', label: '入口',   Icon: DoorIcon },
    { key: 'toilet',   label: '廁所',   Icon: ToiletIcon },
    { key: 'parking',  label: '停車',   Icon: ParkingIcon },
    { key: 'ramp',     label: '坡道',   Icon: RampIcon },
  ]
  const consensus = fields.map((f) => ({ ...f, level: computeConsensus(ratings, f.key) }))
  const yesCount = consensus.filter((c) => c.level === 'YES').length

  return (
    <div style={{ margin: '16px 20px 0', border: '1px solid var(--hairline)', borderRadius: 14, padding: '14px 16px', background: 'var(--panel-warm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, fontFamily: 'var(--serif)' }}>
          <span style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{yesCount}</span>
          <span style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>/ 4 友善</span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Accessibility</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {consensus.map((c) => {
          const toneStyle = cellToneStyle(LEVEL_MAP[c.level].tone)
          return (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--panel)', border: '1px solid var(--hairline)', borderRadius: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', flexShrink: 0, ...toneStyle }}>
                <c.Icon />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{LEVEL_MAP[c.level].label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Rating card
const RatingCard = ({
  rating,
  currentGoogleId,
  onEdit,
}: {
  rating: RatingItem
  currentGoogleId?: string
  onEdit: (r: RatingItem) => void
}) => {
  const isOwner = !!currentGoogleId && rating.submitterGoogleId === currentGoogleId
  const displayName = rating.submittedBy ?? '匿名'
  const initial = displayName.slice(0, 1).toUpperCase()

  return (
    <div style={{ padding: '14px 0', borderTop: '1px solid var(--hairline)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {rating.submitterAvatarUrl ? (
          <img
            src={rating.submitterAvatarUrl}
            alt={displayName}
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-wash)', color: 'var(--accent-2)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
            {initial}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{displayName}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 8 }}>{formatDate(rating.createdAt)}</span>
          </span>
          {isOwner && (
            <button onClick={() => onEdit(rating)} style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              編輯
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 42, marginBottom: 6 }}>
        {FIELDS.map((f) => {
          const lvl = rating[f.key as keyof RatingItem] as AccessibilityLevel
          const info = LEVEL_MAP[lvl]
          const toneStyle = cellToneStyle(info.tone)
          return (
            <span key={f.key} style={reviewChipStyle()}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 9, fontWeight: 700, color: 'white', ...{ background: toneStyle.color } }}>
                {info.dot}
              </span>
              <span style={{ color: 'var(--ink-2)' }}>{f.short}</span>
            </span>
          )
        })}
      </div>

      {rating.note && (
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, paddingLeft: 42, marginTop: 2 }}>
          「{rating.note}」
        </p>
      )}
    </div>
  )
}

// Review form section
const ReviewFormSection = ({
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
}) => (
  <div>
    <div style={{ fontFamily: 'var(--serif)', fontSize: 14, fontWeight: 500, marginBottom: 14, color: 'var(--ink)' }}>{title}</div>
    {FIELDS.map((f) => (
      <FieldSelector
        key={f.key}
        fieldKey={f.key}
        label={f.label}
        value={form[f.key]}
        onChange={(v) => onChange({ ...form, [f.key]: v })}
      />
    ))}
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 6 }}>補充說明（選填）</div>
      <textarea
        value={form.note}
        onChange={(e) => onChange({ ...form, note: e.target.value })}
        placeholder="例：門口平坦、無障礙廁所需向店員索取鑰匙…"
        rows={3}
        style={{
          width: '100%',
          padding: 10,
          border: '1px solid var(--hairline)',
          borderRadius: 10,
          background: 'var(--panel)',
          fontSize: 13,
          resize: 'none',
          outline: 0,
          fontFamily: 'inherit',
          color: 'var(--ink)',
        }}
      />
    </div>
    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
      <button
        onClick={onSubmit}
        disabled={isSubmitting}
        style={{
          flex: 1,
          background: 'var(--accent)',
          color: 'white',
          border: 'none',
          borderRadius: 10,
          padding: '9px 14px',
          fontSize: 13,
          fontWeight: 500,
          opacity: isSubmitting ? 0.5 : 1,
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          transition: 'all 0.12s',
        }}
      >
        {isSubmitting ? '儲存中…' : '提交評分'}
      </button>
      <button
        onClick={onCancel}
        style={{ fontSize: 13, color: 'var(--ink-3)', background: 'none', border: 'none', padding: '9px 14px', cursor: 'pointer' }}
      >
        取消
      </button>
    </div>
  </div>
)

const PlaceSidebar = () => {
  const {
    openMarkerId, setOpenMarkerId, places, setFocusLocation,
    leftPanelOpen, leftPanelTab, setLeftPanelOpen, setLeftPanelTab, addPlace, searchByKeyword,
  } = useMapStore()
  const user = useAuthStore((s) => s.user)

  const place = places.find((p) => p.id === openMarkerId) ?? null

  const [ratings, setRatings] = useState<RatingItem[]>([])
  const [loadingRatings, setLoadingRatings] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRating, setEditingRating] = useState<RatingItem | null>(null)
  const [form, setForm] = useState<ReviewForm>(EMPTY_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [isBookmarked, setIsBookmarked] = useState(false)
  const [isTogglingBookmark, setIsTogglingBookmark] = useState(false)

  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([])
  const [loadingBookmarks, setLoadingBookmarks] = useState(false)

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

  // Closed state — vertical tab handle
  if (!leftPanelOpen) {
    return (
      <button
        onClick={() => setLeftPanelOpen(true)}
        aria-label="開啟地點清單"
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderLeft: 0,
          borderRadius: '0 10px 10px 0',
          padding: '14px 8px',
          writingMode: 'vertical-rl',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--ink-2)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
          transition: 'color 0.1s',
        }}
      >
        <SidebarIcon />
        地點資訊
      </button>
    )
  }

  return (
    <div className="sidebar-panel">
      {/* Tab bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        padding: '14px 20px 0',
        gap: 24,
        borderBottom: '1px solid var(--hairline)',
        background: 'var(--panel)',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <button
            onClick={() => { setLeftPanelTab('results'); setOpenMarkerId(null) }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingBottom: 12,
              fontSize: 13,
              color: leftPanelTab === 'results' ? 'var(--ink)' : 'var(--ink-3)',
              fontWeight: 500,
              background: 'none',
              border: 'none',
              borderBottom: leftPanelTab === 'results' ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'color 0.1s',
            }}
          >
            搜尋結果
            <span style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 999,
              background: leftPanelTab === 'results' ? 'var(--accent-wash)' : 'var(--bg-sunk)',
              color: leftPanelTab === 'results' ? 'var(--accent-2)' : 'var(--ink-3)',
              fontWeight: 600,
            }}>{places.length}</span>
          </button>
          {user && (
            <>
              <button
                onClick={() => { setLeftPanelTab('history'); setOpenMarkerId(null) }}
                style={{
                  paddingBottom: 12,
                  fontSize: 13,
                  color: leftPanelTab === 'history' ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  borderBottom: leftPanelTab === 'history' ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'color 0.1s',
                }}
              >
                搜尋紀錄
              </button>
              <button
                onClick={() => { setLeftPanelTab('bookmarks'); setOpenMarkerId(null) }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingBottom: 12,
                  fontSize: 13,
                  color: leftPanelTab === 'bookmarks' ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: 500,
                  background: 'none',
                  border: 'none',
                  borderBottom: leftPanelTab === 'bookmarks' ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'color 0.1s',
                }}
              >
                <BookmarkSvg filled={leftPanelTab === 'bookmarks'} />
                收藏
                <span style={{
                  fontSize: 10,
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: leftPanelTab === 'bookmarks' ? 'var(--accent-wash)' : 'var(--bg-sunk)',
                  color: leftPanelTab === 'bookmarks' ? 'var(--accent-2)' : 'var(--ink-3)',
                  fontWeight: 600,
                }}>{bookmarks.length}</span>
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleClose}
          aria-label="關閉面板"
          style={{
            width: 28, height: 28,
            borderRadius: 8,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-3)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 12,
            flexShrink: 0,
            transition: 'all 0.1s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Main content */}
      {place && openMarkerId ? (
        /* Detail view */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <button
            onClick={() => setOpenMarkerId(null)}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 20px',
              fontSize: 12,
              color: 'var(--ink-3)',
              fontWeight: 500,
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--hairline)',
              cursor: 'pointer',
              transition: 'color 0.1s',
            }}
          >
            <ArrowLeftIcon /> 返回列表
          </button>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Hero */}
            {place.photoName ? (
              <img
                src={`${API_BASE}/api/places/photo?name=${encodeURIComponent(place.photoName)}`}
                alt={place.name}
                style={{ width: '100%', height: 160, objectFit: 'cover' }}
              />
            ) : (
              <div style={{ height: 160, background: 'linear-gradient(135deg, #c9b99a 0%, #a08d6c 100%)', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.6)' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {place.name.slice(0, 1)} · 地點照片
                </span>
              </div>
            )}

            {/* Head */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, lineHeight: 1.2, letterSpacing: '-0.01em', color: 'var(--ink)', margin: 0 }}>
                  {place.name}
                </h2>
                {user && (
                  <button
                    onClick={toggleBookmark}
                    disabled={isTogglingBookmark}
                    aria-label={isBookmarked ? '取消收藏' : '加入收藏'}
                    style={{
                      flexShrink: 0,
                      padding: 8,
                      borderRadius: 10,
                      border: '1px solid var(--hairline)',
                      color: isBookmarked ? 'var(--accent)' : 'var(--ink-3)',
                      background: isBookmarked ? 'var(--accent-wash)' : 'transparent',
                      opacity: isTogglingBookmark ? 0.4 : 1,
                      cursor: isTogglingBookmark ? 'not-allowed' : 'pointer',
                      transition: 'all 0.12s',
                    }}
                  >
                    <BookmarkSvg filled={isBookmarked} />
                  </button>
                )}
              </div>

              {place.rating != null && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <span style={{ color: 'var(--accent)', letterSpacing: -1 }}>{'★'.repeat(Math.round(place.rating))}</span>
                  <span style={{ color: 'var(--hairline-2)' }}>{'★'.repeat(5 - Math.round(place.rating))}</span>
                  <span style={{ fontWeight: 600, color: 'var(--ink)', marginLeft: 2, fontSize: 13 }}>{place.rating}</span>
                </div>
              )}

              {place.address && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 8, fontSize: 13, color: 'var(--ink-2)' }}>
                  <span style={{ color: 'var(--ink-3)', marginTop: 2, flexShrink: 0 }}><PinIcon /></span>
                  {place.address}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.location.lat},${place.location.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    background: 'var(--ink)',
                    color: 'var(--bg)',
                    fontSize: 13,
                    fontWeight: 500,
                    textDecoration: 'none',
                    transition: 'all 0.12s',
                  }}
                >
                  <NavIcon /> 導航
                </a>
              </div>
            </div>

            {/* A11y summary */}
            {loadingRatings ? (
              <div style={{ padding: '16px 20px 0' }}>
                <div style={{ margin: '0', border: '1px solid var(--hairline)', borderRadius: 14, padding: '14px 16px', background: 'var(--panel-warm)' }}>
                  <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>載入中…</p>
                </div>
              </div>
            ) : (
              <A11ySummary ratings={ratings} />
            )}

            {/* Reviews */}
            <div style={{ padding: '18px 20px 8px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.01em' }}>社群無障礙評論</span>
                {!loadingRatings && (
                  <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{ratings.length} 則</span>
                )}
              </div>

              {!loadingRatings && ratings.length === 0 && (
                <div style={{ padding: '16px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>尚無社群資訊</p>
                  <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>成為第一位分享無障礙體驗的人</p>
                </div>
              )}

              {ratings.map((r) =>
                editingRating?.id === r.id ? (
                  <div key={r.id} style={{ padding: '14px 0', borderTop: '1px solid var(--hairline)' }}>
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
                  <RatingCard key={r.id} rating={r} currentGoogleId={user?.id} onEdit={handleStartEdit} />
                )
              )}
            </div>
          </div>

          {/* Add rating form */}
          {user && (
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--hairline)', background: 'var(--panel-warm)', padding: '16px 20px' }}>
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
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '1px dashed var(--hairline-2)',
                    color: 'var(--ink-2)',
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'var(--panel)',
                    cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                >
                  <PlusIcon /> 新增無障礙資訊
                </button>
              )}
            </div>
          )}
        </div>
      ) : leftPanelTab === 'results' ? (
        /* Search results */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {places.length === 0 ? (
            user && searchHistory.length > 0 ? (
              <>
                <div style={{ padding: '10px 20px 6px', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>最近搜尋</div>
                {searchHistory.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => searchByKeyword(h.keyword)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '11px 20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid var(--hairline)',
                      cursor: 'pointer',
                      fontSize: 13,
                      color: 'var(--ink-2)',
                      transition: 'background 0.1s',
                    }}
                  >
                    <ClockIcon />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.keyword}</span>
                  </button>
                ))}
              </>
            ) : (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-4)', margin: '0 auto 12px' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
                  </svg>
                </div>
                <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>尚無搜尋結果</p>
                <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>請在上方搜尋地點</p>
              </div>
            )
          ) : (
            places.map((p) => {
              const badges = [
                p.accessibility.wheelchair_entrance && '輪椅可進',
                p.accessibility.wheelchair_restroom && '無障礙廁所',
                p.accessibility.wheelchair_parking && '無障礙停車',
              ].filter(Boolean) as string[]
              return (
                <button
                  key={p.id}
                  onClick={() => setOpenMarkerId(p.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 20px',
                    background: openMarkerId === p.id ? 'var(--accent-wash)' : 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--hairline)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                >
                  {openMarkerId === p.id && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--accent)', borderRadius: '0 2px 2px 0' }} />
                  )}
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--bg-sunk)', flexShrink: 0, display: 'grid', placeItems: 'center', color: 'var(--ink-3)', border: '1px solid var(--hairline)', overflow: 'hidden' }}>
                    {p.photoName ? (
                      <img src={`${API_BASE}/api/places/photo?name=${encodeURIComponent(p.photoName)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{p.name}</p>
                    {p.address && (
                      <p style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{p.address}</p>
                    )}
                    {p.rating != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 12, color: 'var(--ink-3)' }}>
                        <span style={{ color: 'var(--accent)' }}>★</span>
                        <span>{p.rating}</span>
                      </div>
                    )}
                    {badges.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                        {badges.map((badge) => (
                          <span key={badge} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--yes-wash)', color: 'var(--yes)', fontWeight: 500 }}>
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>
      ) : leftPanelTab === 'history' ? (
        /* Search history */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searchHistory.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-4)', margin: '0 auto 12px' }}>
                <ClockIcon />
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>尚無搜尋紀錄</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 20px 6px', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>最近搜尋</span>
              </div>
              {searchHistory.map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setLeftPanelTab('results'); searchByKeyword(h.keyword) }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '11px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--hairline)',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--ink-2)',
                    transition: 'background 0.1s',
                  }}
                >
                  <ClockIcon />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.keyword}</span>
                </button>
              ))}
            </>
          )}
        </div>
      ) : (
        /* Bookmarks */
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingBookmarks ? (
            <p style={{ padding: '32px 20px', fontSize: 12, color: 'var(--ink-3)', textAlign: 'center' }}>載入中…</p>
          ) : bookmarks.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-sunk)', display: 'grid', placeItems: 'center', color: 'var(--ink-4)', margin: '0 auto 12px' }}>
                <BookmarkSvg filled={false} />
              </div>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>尚無收藏地點</p>
              <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>點地標再按書籤圖示即可加入收藏</p>
            </div>
          ) : (
            <>
              <div style={{ padding: '10px 20px 6px', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
                已收藏 · {bookmarks.length} 個地點
              </div>
              {bookmarks.map((b) => (
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
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '14px 20px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--hairline)',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{b.name}</p>
                    {b.address && (
                      <p style={{ fontSize: 12, color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{b.address}</p>
                    )}
                  </div>
                  <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }}>
                    <BookmarkSvg filled />
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PlaceSidebar
