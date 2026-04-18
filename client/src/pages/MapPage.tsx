import { useEffect, useRef, useState, useCallback } from 'react'
import { APIProvider, Map, useMap, useMapsLibrary, MapControl, ControlPosition } from '@vis.gl/react-google-maps'
import { useGoogleLogin } from '@react-oauth/google'
import FilterBar from '../components/FilterBar'
import MapMarkers from '../components/MapMarkers'
import PlaceSidebar from '../components/PlaceSidebar'
import { useMapStore } from '../store/mapStore'
import { useAuthStore } from '../store/authStore'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

const MapCameraController = () => {
  const map = useMap()
  const focusLocation = useMapStore((s) => s.focusLocation)
  const setFocusLocation = useMapStore((s) => s.setFocusLocation)

  useEffect(() => {
    if (!map || !focusLocation) return
    map.panTo({ lat: focusLocation.lat, lng: focusLocation.lng })
    map.setZoom(focusLocation.zoom ?? 16)
    setFocusLocation(null)
  }, [map, focusLocation, setFocusLocation])

  return null
}

interface PlaceSuggestion {
  mainText: string
  secondaryText: string
  fullText: string
}

interface GoogleMapsTextValue {
  toString(): string
}

interface GoogleMapsPlacePrediction {
  mainText?: GoogleMapsTextValue
  secondaryText?: GoogleMapsTextValue
  text?: GoogleMapsTextValue
}

interface GoogleMapsAutocompleteSuggestion {
  placePrediction?: GoogleMapsPlacePrediction
}

interface GoogleMapsPlacesLibrary {
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (params: {
      input: string
      language: string
      region: string
      locationBias?: google.maps.Circle
    }) => Promise<{ suggestions: GoogleMapsAutocompleteSuggestion[] }>
  }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

interface SearchHistoryItem {
  id: string
  keyword: string
  searchedAt: string
}

const SearchBar = () => {
  const { searchByKeyword, isLoadingPlaces } = useMapStore()
  const user = useAuthStore((s) => s.user)
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useMapsLibrary('places')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
        setShowRecent(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchRecentSearches = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch(`${API_BASE}/api/search-history?userId=${encodeURIComponent(user.id)}`)
      const data = (await res.json()) as { histories?: SearchHistoryItem[] }
      setRecentSearches(data.histories ?? [])
    } catch {
      setRecentSearches([])
    }
  }, [user])

  const saveSearchHistory = useCallback(async (kw: string) => {
    if (!user) return
    try {
      await fetch(`${API_BASE}/api/search-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, keyword: kw }),
      })
    } catch {
      // 靜默失敗
    }
  }, [user])

  const { userLocation } = useMapStore()

  const fetchSuggestions = useCallback(async (value: string) => {
    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    try {
      const lib = await google.maps.importLibrary('places') as GoogleMapsPlacesLibrary
      const locationBias = userLocation
        ? new google.maps.Circle({ center: userLocation, radius: 5000 })
        : undefined
      const { suggestions: raw } = await lib.AutocompleteSuggestion
        .fetchAutocompleteSuggestions({ input: value, language: 'zh-TW', region: 'tw', ...(locationBias ? { locationBias } : {}) })

      const mapped: PlaceSuggestion[] = raw
        .filter((s) => s.placePrediction)
        .slice(0, 5)
        .map((s) => ({
          mainText: s.placePrediction?.mainText?.toString() ?? '',
          secondaryText: s.placePrediction?.secondaryText?.toString() ?? '',
          fullText: s.placePrediction?.text?.toString() ?? s.placePrediction?.mainText?.toString() ?? '',
        }))

      setSuggestions(mapped)
      setShowSuggestions(mapped.length > 0)
    } catch {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }, [userLocation])

  const handleInputChange = (value: string) => {
    setKeyword(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setShowRecent(false)
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300)
  }

  const handleSelectSuggestion = (s: PlaceSuggestion) => {
    setKeyword(s.mainText)
    setSuggestions([])
    setShowSuggestions(false)
    setShowRecent(false)
    saveSearchHistory(s.mainText)
    searchByKeyword(s.mainText)
  }

  const handleSearch = () => {
    if (!keyword.trim()) return
    setSuggestions([])
    setShowSuggestions(false)
    setShowRecent(false)
    saveSearchHistory(keyword.trim())
    searchByKeyword(keyword.trim())
  }

  const handleSelectRecent = (kw: string) => {
    setKeyword(kw)
    setShowRecent(false)
    searchByKeyword(kw)
  }

  const handleClearHistory = async () => {
    if (!user) return
    try {
      await fetch(`${API_BASE}/api/search-history?userId=${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      setRecentSearches([])
      setShowRecent(false)
    } catch {
      // 靜默失敗
    }
  }

  return (
    <div ref={containerRef} style={{ flex: 1, maxWidth: 640, position: 'relative' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'var(--bg-sunk)',
        border: '1px solid var(--hairline)',
        borderRadius: 14,
        padding: '9px 14px',
        transition: 'background 0.15s',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <input
          value={keyword}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          onFocus={() => {
            if (suggestions.length > 0) setShowSuggestions(true)
          }}
          placeholder="搜尋地點，例如：麥當勞、台北車站…"
          autoComplete="off"
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: 'transparent',
            fontSize: 14,
            color: 'var(--ink)',
          }}
        />
        <span className="hidden sm:inline-flex" style={{
          fontFamily: 'monospace',
          fontSize: 11,
          color: 'var(--ink-3)',
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 4,
          padding: '2px 6px',
          flexShrink: 0,
        }}>⌘K</span>
        <button
          onClick={handleSearch}
          disabled={isLoadingPlaces || !keyword.trim()}
          style={{
            background: 'var(--ink)',
            color: 'var(--bg)',
            borderRadius: 10,
            padding: '7px 12px',
            fontWeight: 500,
            fontSize: 13,
            border: 0,
            flexShrink: 0,
            opacity: (isLoadingPlaces || !keyword.trim()) ? 0.4 : 1,
            cursor: (isLoadingPlaces || !keyword.trim()) ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoadingPlaces ? '…' : '搜尋'}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          zIndex: 50,
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--hairline)' : undefined,
                cursor: 'pointer',
                display: 'block',
              }}
              className="hover:bg-[var(--bg-sunk)] transition-colors"
            >
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.mainText}</p>
              {s.secondaryText && (
                <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.secondaryText}</p>
              )}
            </button>
          ))}
        </div>
      )}

      {showRecent && !showSuggestions && recentSearches.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 8px', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>最近搜尋</span>
            <button
              onMouseDown={(e) => { e.preventDefault(); handleClearHistory() }}
              style={{ fontSize: 12, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer' }}
            >清除</button>
          </div>
          {recentSearches.map((h) => (
            <button
              key={h.id}
              onMouseDown={(e) => { e.preventDefault(); handleSelectRecent(h.keyword) }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: '1px solid var(--hairline)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              className="hover:bg-[var(--bg-sunk)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
              </svg>
              <span style={{ fontSize: 13, color: 'var(--ink-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.keyword}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const UserButton = () => {
  const { user, setUser, logout } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      const info = await res.json() as { sub: string; name: string; email: string; picture: string }
      setUser({ id: info.sub, name: info.name, email: info.email, avatar: info.picture })
    },
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!user) {
    return (
      <button
        onClick={() => login()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 14px',
          borderRadius: 999,
          border: '1px solid var(--hairline)',
          background: 'var(--panel)',
          fontSize: 13,
          color: 'var(--ink-2)',
          fontWeight: 500,
          flexShrink: 0,
          transition: 'all 0.12s',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        登入
      </button>
    )
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setShowMenu((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px',
          borderRadius: 999,
          border: '1px solid var(--hairline)',
          background: 'var(--panel)',
          cursor: 'pointer',
          transition: 'all 0.12s',
        }}
      >
        <img src={user.avatar} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
        <span className="hidden sm:inline" style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, paddingRight: 8 }}>{user.name}</span>
      </button>
      {showMenu && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 'calc(100% + 6px)',
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          minWidth: 160,
          zIndex: 50,
        }}>
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--hairline)' }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{user.email}</span>
          </div>
          <button
            onMouseDown={(e) => { e.preventDefault(); logout(); setShowMenu(false) }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 14px',
              fontSize: 13,
              color: 'var(--ink-2)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            className="hover:bg-[var(--bg-sunk)] transition-colors"
          >
            登出
          </button>
        </div>
      )}
    </div>
  )
}

const LocateButton = () => {
  const { setUserLocation, setFocusLocation } = useMapStore()
  const [locating, setLocating] = useState(false)

  const handleLocate = () => {
    if (!('geolocation' in navigator)) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude })
        setFocusLocation({ lat: latitude, lng: longitude, zoom: 16 })
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <MapControl position={ControlPosition.RIGHT_TOP}>
      <button
        onClick={handleLocate}
        disabled={locating}
        title="定位到目前位置"
        style={{
          margin: 10,
          width: 40,
          height: 40,
          background: 'var(--panel)',
          border: '1px solid var(--hairline)',
          borderRadius: 10,
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-2)',
          cursor: locating ? 'not-allowed' : 'pointer',
          opacity: locating ? 0.6 : 1,
          transition: 'all 0.1s',
        }}
      >
        {locating ? (
          <svg className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round"/>
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>
          </svg>
        )}
      </button>
    </MapControl>
  )
}

const MapPage = () => {
  const setOpenMarkerId = useMapStore((s) => s.setOpenMarkerId)

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <main style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}>
        {/* Header */}
        <header style={{
          flexShrink: 0,
          background: 'var(--panel-warm)',
          borderBottom: '1px solid var(--hairline)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          zIndex: 40,
          position: 'relative',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: 'var(--ink)',
              color: 'var(--bg)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="2"/><path d="M9 9v4h4l3 5M9 13l-3 6"/>
              </svg>
            </div>
            <div className="hidden sm:block">
              <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontWeight: 500, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
                無障礙地圖
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: -2 }}>
                Always Accessible
              </div>
            </div>
          </div>

          <SearchBar />
          <UserButton />
        </header>

        {/* Filter bar */}
        <FilterBar />

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Map
            defaultCenter={{ lat: 25.0478, lng: 121.5319 }}
            defaultZoom={14}
            gestureHandling="greedy"
            cameraControl
            cameraControlOptions={{ position: ControlPosition.RIGHT_TOP }}
            fullscreenControlOptions={{ position: ControlPosition.RIGHT_TOP }}
            streetViewControlOptions={{ position: ControlPosition.RIGHT_TOP }}
            style={{ width: '100%', height: '100%' }}
            mapId="accessibility-map"
            onClick={() => setOpenMarkerId(null)}
          >
            <MapCameraController />
            <MapMarkers />
            <LocateButton />
          </Map>

          <PlaceSidebar />
        </div>
      </main>
    </APIProvider>
  )
}

export default MapPage
