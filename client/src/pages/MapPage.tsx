import { useEffect, useRef, useState, useCallback } from 'react'
import { APIProvider, Map, useMap, useMapsLibrary, MapControl, ControlPosition } from '@vis.gl/react-google-maps'
import { useGoogleLogin } from '@react-oauth/google'
import FilterBar from '../components/FilterBar'
import MapMarkers from '../components/MapMarkers'
import PlaceSidebar from '../components/PlaceSidebar'
import { useMapStore } from '../store/mapStore'
import { useAuthStore } from '../store/authStore'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

// 監聽 focusLocation 並移動地圖鏡頭
function MapCameraController() {
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

function SearchBar() {
  const { searchByKeyword, isLoadingPlaces } = useMapStore()
  const user = useAuthStore((s) => s.user)
  const [keyword, setKeyword] = useState('')
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([])
  const [showRecent, setShowRecent] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 預先載入 places library（讓 importLibrary 後續呼叫立即回傳）
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
    <div ref={containerRef} className="flex gap-2 flex-1 min-w-60 md:min-w-0 relative">
      <div className="flex-1 relative min-w-0">
        <input
          value={keyword}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          onFocus={() => {
            if (suggestions.length > 0) { setShowSuggestions(true); return }
            if (!keyword.trim() && user) { fetchRecentSearches().then(() => setShowRecent(true)) }
          }}
          placeholder="搜尋地點（如：麥當勞、台北車站）"
          className="w-full bg-white/20 placeholder-white/70 text-white text-md rounded-lg px-3 py-1.5 outline-none focus:bg-white/30"
          aria-label="關鍵字搜尋"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl overflow-hidden z-50">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s) }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors cursor-pointer"
              >
                <p className="text-md font-medium text-gray-800 truncate">{s.mainText}</p>
                {s.secondaryText && (
                  <p className="text-md text-gray-400 truncate mt-0.5">{s.secondaryText}</p>
                )}
              </button>
            ))}
          </div>
        )}
        {showRecent && !showSuggestions && recentSearches.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-md text-gray-400 font-medium">最近搜尋</span>
              <button
                onMouseDown={(e) => { e.preventDefault(); handleClearHistory() }}
                className="text-md text-gray-400 hover:text-gray-600"
              >
                清除
              </button>
            </div>
            {recentSearches.map((h) => (
              <button
                key={h.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelectRecent(h.keyword) }}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span className="text-gray-400 text-md">🕐</span>
                <span className="text-md text-gray-700 truncate">{h.keyword}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={handleSearch}
        disabled={isLoadingPlaces || !keyword.trim()}
        className="bg-white text-sky-600 px-3 py-1.5 rounded-lg text-md font-medium disabled:opacity-50 shrink-0 cursor-pointer"
      >
        {isLoadingPlaces ? '搜尋中' : '搜尋'}
      </button>
    </div>
  )
}

function UserButton() {
  const { user, setUser, logout } = useAuthStore()
  const [showMenu, setShowMenu] = useState(false)

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      })
      const info = await res.json() as { sub: string; name: string; email: string; picture: string }
      setUser({ id: info.sub, name: info.name, email: info.email, avatar: info.picture })
    },
  })

  if (!user) {
    return (
      <button
        onClick={() => login()}
        className="absolute bottom-0 right-2 bg-sky-600 text-white px-4 py-2 w-16 shadow-lg text-md font-medium z-10 cursor-pointer"
      >
  登入
      </button>
    )
  }

  return (
    <div className="relative shrink-0">
      <button onClick={() => setShowMenu((v) => !v)} className="flex items-center gap-1.5 cursor-pointer">
        <img src={user.avatar} alt={user.name} className="w-10 h-10 border-2 border-white/60" />
      </button>
      {showMenu && (
        <div className="absolute right-0 bottom-9 bg-white rounded-xl shadow-lg py-1 min-w-35 z-20">
          <p className="px-3 py-1.5 text-md text-gray-500 border-b border-gray-100">{user.name}</p>
          <button
            onClick={() => { logout(); setShowMenu(false) }}
            className="w-full text-left px-3 py-2 text-md text-red-500 hover:bg-gray-50 cursor-pointer"
          >
            登出
          </button>
        </div>
      )}
    </div>
  )
}

function LocateButton() {
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
        className="m-2.5 w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors cursor-pointer"
        style={{ border: '1px solid rgba(0,0,0,0.12)' }}
      >
        {locating ? (
          <svg className="w-5 h-5 animate-spin text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" />
          </svg>
        )}
      </button>
    </MapControl>
  )
}

export default function MapPage() {
  const setOpenMarkerId = useMapStore((s) => s.setOpenMarkerId)
  const leftPanelOpen = useMapStore((s) => s.leftPanelOpen)

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <main className="flex flex-col h-full">
        <header className="text-white px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: 'linear-gradient(to right, #38bdf8, #0284c7)' }}>
          <h1 className="text-lg font-semibold shrink-0 sm:flex hidden">無障礙地圖</h1>
          <SearchBar />
        </header>

        {/* 手機版篩選列（header 下方靜態列） */}
        <div className="md:hidden shrink-0 bg-gray-50 border-b border-gray-200">
          <FilterBar />
        </div>

        <div className="flex-1 relative">
          {/* 桌機版過濾器列（地圖上方浮層） */}
          <div className={`hidden md:block absolute top-2 right-0 z-10 pointer-events-none transition-all duration-200 w-fit ${leftPanelOpen ? 'left-80' : 'left-10'}`}>
            <FilterBar />
          </div>

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

          {/* 登入按鈕 */}
          <div className="absolute bottom-5 right-2 z-10">
            <UserButton />
          </div>

          {/* 地點詳情側邊欄 */}
          <PlaceSidebar />
        </div>
      </main>
    </APIProvider>
  )
}
