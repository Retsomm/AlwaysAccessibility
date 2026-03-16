import { useEffect, useState } from 'react'
import { APIProvider, Map, useMap, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useGoogleLogin } from '@react-oauth/google'
import FilterBar from '../components/FilterBar'
import MapMarkers from '../components/MapMarkers'
import RoutePanel from '../components/RoutePanel'
import PlaceSidebar from '../components/PlaceSidebar'
import { useMapStore } from '../store/mapStore'
import { useAuthStore } from '../store/authStore'

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

// 使用 geometry library 解碼 polyline 並在地圖上繪製路線
function RoutePolyline() {
  const map = useMap()
  const geometry = useMapsLibrary('geometry')
  const route = useMapStore((s) => s.route)

  useEffect(() => {
    if (!map || !geometry || !route?.polyline) return

    const path = geometry.encoding.decodePath(route.polyline)
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: '#6366f1',
      strokeWeight: 5,
      strokeOpacity: 0.8,
    })
    polyline.setMap(map)

    return () => polyline.setMap(null)
  }, [map, geometry, route])

  return null
}

function SearchBar() {
  const { searchByKeyword, isLoadingPlaces } = useMapStore()
  const [keyword, setKeyword] = useState('')

  const handleSearch = () => {
    if (!keyword.trim()) return
    searchByKeyword(keyword.trim())
  }

  return (
    <div className="flex gap-2 flex-1">
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        placeholder="搜尋地點（如：麥當勞、台北車站）"
        className="flex-1 bg-white/20 placeholder-white/70 text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:bg-white/30 min-w-0"
        aria-label="關鍵字搜尋"
      />
      <button
        onClick={handleSearch}
        disabled={isLoadingPlaces || !keyword.trim()}
        className="bg-white text-indigo-600 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 shrink-0"
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
        className="shrink-0 bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
      >
        登入
      </button>
    )
  }

  return (
    <div className="relative shrink-0">
      <button onClick={() => setShowMenu((v) => !v)} className="flex items-center gap-1.5">
        <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full border-2 border-white/60" />
      </button>
      {showMenu && (
        <div className="absolute right-0 top-9 bg-white rounded-xl shadow-lg py-1 min-w-35 z-20">
          <p className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-100">{user.name}</p>
          <button
            onClick={() => { logout(); setShowMenu(false) }}
            className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-gray-50"
          >
            登出
          </button>
        </div>
      )}
    </div>
  )
}

export default function MapPage() {
  const setOpenMarkerId = useMapStore((s) => s.setOpenMarkerId)

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <main className="flex flex-col h-full">
        <header className="text-white px-4 py-3 flex items-center gap-3 shrink-0" style={{ background: 'linear-gradient(to right, #8b5cf6, #4f46e5)' }}>
          <h1 className="text-lg font-semibold shrink-0">無障礙地圖</h1>
          <SearchBar />
          <UserButton />
        </header>

        <div className="flex-1 relative">
          {/* 過濾器列（地圖上方浮層） */}
          <div className="absolute top-2 left-0 right-0 z-10">
            <FilterBar />
          </div>

          <Map
            defaultCenter={{ lat: 25.0478, lng: 121.5319 }}
            defaultZoom={14}
            gestureHandling="greedy"
            style={{ width: '100%', height: '100%' }}
            mapId="accessibility-map"
            onClick={() => setOpenMarkerId(null)}
          >
            <MapMarkers />
            <RoutePolyline />
          </Map>

          {/* 路線規劃面板（地圖下方浮層） */}
          <RoutePanel />

          {/* 地點詳情側邊欄 */}
          <PlaceSidebar />
        </div>
      </main>
    </APIProvider>
  )
}
