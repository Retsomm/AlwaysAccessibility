import { useState } from 'react'
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

export default function RoutePanel() {
  const { route, isLoadingRoute, planRoute, clearRoute } = useMapStore()
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [mode, setMode] = useState<RouteMode>('transit')
  const [showSteps, setShowSteps] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handlePlan = async () => {
    if (!origin.trim() || !destination.trim()) return
    setShowSteps(false)
    await planRoute(origin.trim(), destination.trim(), mode)
    setShowSteps(true)
  }

  const handleVoice = () => {
    if (!route) return
    const summary = `路線規劃完成。距離 ${route.distance}，預計時間 ${route.duration}。`
    const steps = route.steps.map((s, i) => `第${i + 1}步：${s.instruction}`).join('。')
    speak(summary + steps)
  }

  const handleClear = () => {
    clearRoute()
    setShowSteps(false)
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-4 right-4 bg-indigo-500 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium z-10"
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
          <div className="flex items-center justify-between text-sm">
            <div className="flex gap-3 text-gray-600">
              <span>時間：{route.duration}</span>
              <span>距離：{route.distance}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSteps((s) => !s)}
                className="text-indigo-500 text-xs hover:underline"
              >
                {showSteps ? '收起步驟' : '查看步驟'}
              </button>
              <button
                onClick={handleVoice}
                className="text-green-600 text-xs hover:underline"
                aria-label="語音朗讀路線"
              >
                🔊 語音
              </button>
              <button onClick={handleClear} className="text-gray-400 text-xs hover:text-gray-600">
                清除
              </button>
            </div>
          </div>

          {showSteps && (
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
