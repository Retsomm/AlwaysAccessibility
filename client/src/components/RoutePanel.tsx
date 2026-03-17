import { useState, useRef, useEffect } from 'react'
import { useMapStore } from '../store/mapStore'
import type { RouteMode } from '../store/mapStore'

const MODE_OPTIONS: { value: RouteMode; label: string }[] = [
  { value: 'transit', label: '大眾運輸' },
  { value: 'walking', label: '步行' },
  { value: 'wheelchair', label: '輪椅路線' },
]

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-TW'
  window.speechSynthesis.speak(utter)
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function RoutePanel() {
  const { route, isLoadingRoute, planRoute, clearRoute, setUserLocation } = useMapStore()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [mode, setMode] = useState<RouteMode>('transit')
  const [showSteps, setShowSteps] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [isNavigating, setIsNavigating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const currentStepRef = useRef(0)
  const watchIdRef = useRef<number | null>(null)
  const routeRef = useRef(route)

  useEffect(() => {
    routeRef.current = route
  }, [route])

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [])

  const handlePlan = async () => {
    if (!origin.trim() || !destination.trim()) return
    setShowSteps(false)
    stopNavigation()
    await planRoute(origin.trim(), destination.trim(), mode)
    setShowSteps(true)
  }

  const stopNavigation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsNavigating(false)
    window.speechSynthesis.cancel()
  }

  const handleStartNavigation = () => {
    const currentRoute = routeRef.current
    if (!currentRoute || !('geolocation' in navigator)) return

    setIsNavigating(true)
    currentStepRef.current = 0
    setCurrentStep(0)

    const firstStep = currentRoute.steps[0]
    speak(`開始導航。距離 ${currentRoute.distance}，預計時間 ${currentRoute.duration}。${firstStep?.instruction ?? ''}`)

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserLocation({ lat: latitude, lng: longitude })

        const steps = routeRef.current?.steps ?? []
        const idx = currentStepRef.current

        if (idx < steps.length - 1) {
          const nextStep = steps[idx + 1]
          if (nextStep.startLocation) {
            const dist = getDistance(latitude, longitude, nextStep.startLocation.lat, nextStep.startLocation.lng)
            if (dist < 30) {
              const newIdx = idx + 1
              currentStepRef.current = newIdx
              setCurrentStep(newIdx)
              if (newIdx === steps.length - 1) {
                speak(`${nextStep.instruction}。即將抵達目的地。`)
              } else {
                speak(nextStep.instruction)
              }
            }
          }
        }
      },
      () => { /* GPS 錯誤，靜默 */ },
      { enableHighAccuracy: true, maximumAge: 3000 }
    )
  }

  const handleVoice = () => {
    if (!route) return
    const summary = `路線規劃完成。距離 ${route.distance}，預計時間 ${route.duration}。`
    const steps = route.steps.map((s, i) => `第${i + 1}步：${s.instruction}`).join('。')
    speak(summary + steps)
  }

  const handleClear = () => {
    stopNavigation()
    clearRoute()
    setShowSteps(false)
    setUserLocation(null)
    setCurrentStep(0)
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-5 right-16 bg-indigo-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-10"
      >
        路線規劃
      </button>
    )
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 bg-white rounded-2xl shadow-xl z-10 overflow-hidden">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">無障礙路線規劃</span>
        <button onClick={() => setCollapsed(true)} className="text-gray-400 text-xs hover:text-gray-600">
          收起
        </button>
      </div>

      <div className="p-4 space-y-2">
        <input
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          placeholder="起點（地址或地名）"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400"
          aria-label="起點"
        />
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="終點（地址或地名）"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400"
          aria-label="終點"
          onKeyDown={(e) => e.key === 'Enter' && handlePlan()}
        />
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="交通模式">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={`flex-1 shrink-0 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                mode === opt.value
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400'
              }`}
              aria-pressed={mode === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={handlePlan}
          disabled={isLoadingRoute || !origin.trim() || !destination.trim()}
          className="w-full bg-indigo-500 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-indigo-600 transition-colors"
        >
          {isLoadingRoute ? '規劃中...' : '規劃路線'}
        </button>
      </div>

      {route && (
        <div className="px-4 pb-4 space-y-2">
          {/* 導航進行中：顯示目前步驟 */}
          {isNavigating && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-700">
                  導航中 — 第 {currentStep + 1} / {route.steps.length} 步
                </span>
                <button
                  onClick={stopNavigation}
                  className="text-xs text-red-500 font-medium hover:text-red-700"
                >
                  停止導航
                </button>
              </div>
              <p className="text-sm font-medium text-gray-800 leading-snug">
                {route.steps[currentStep]?.instruction}
              </p>
              {route.steps[currentStep + 1] && (
                <p className="text-xs text-gray-500">
                  下一步：{route.steps[currentStep + 1].instruction}
                </p>
              )}
            </div>
          )}

          {/* 路線摘要與控制 */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-3 text-gray-600">
              <span>時間：{route.duration}</span>
              <span>距離：{route.distance}</span>
            </div>
            <div className="flex gap-2">
              {!isNavigating && (
                <button
                  onClick={() => setShowSteps((s) => !s)}
                  className="text-indigo-500 text-xs hover:underline"
                >
                  {showSteps ? '收起步驟' : '查看步驟'}
                </button>
              )}
              <button
                onClick={handleVoice}
                className="text-green-600 text-xs hover:underline"
                aria-label="語音朗讀路線"
              >
                語音
              </button>
              <button onClick={handleClear} className="text-gray-400 text-xs hover:text-gray-600">
                清除
              </button>
            </div>
          </div>

          {/* 開始導航按鈕 */}
          {!isNavigating && (
            <button
              onClick={handleStartNavigation}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              開始導航
            </button>
          )}

          {/* 在 Google Maps 開啟 */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${mode === 'transit' ? 'transit' : 'walking'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
          >
            在 Google Maps 開啟導航
          </a>

          {showSteps && !isNavigating && (
            <ol className="space-y-1.5 max-h-36 overflow-y-auto border-t border-gray-100 pt-2">
              {route.steps.map((step, i) => (
                <li key={i} className="text-xs text-gray-600 flex gap-2">
                  <span className="shrink-0 w-4 text-right font-medium text-indigo-500">{i + 1}.</span>
                  <span>{step.instruction}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
