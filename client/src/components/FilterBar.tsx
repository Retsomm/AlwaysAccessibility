import { useMapStore } from '../store/mapStore'
import type { FilterType } from '../store/mapStore'

const FILTERS: { type: FilterType; label: string }[] = [
  { type: 'restaurant', label: '無障礙餐廳' },
  { type: 'attraction', label: '無障礙景點' },
  { type: 'parking', label: '無障礙停車' },
  { type: 'toilet', label: '無障礙廁所' },
  { type: 'ramp', label: '無障礙坡道' },
]

export default function FilterBar() {
  const { activeFilters, toggleFilter, isLoadingPlaces } = useMapStore()

  return (
    <div className="flex gap-2 overflow-x-auto sm:pl-48 pl-1 sm:py-1 py-3 pointer-events-auto">
      {FILTERS.map(({ type, label }) => {
          const isActive = activeFilters.includes(type)
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              disabled={isLoadingPlaces}
              className={`flex shrink-0 px-3 py-1.5 text-md font-medium shadow transition-colors cursor-pointer ${
                isActive
                  ? 'bg-sky-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-sky-400'
              } disabled:opacity-60`}
              aria-pressed={isActive}
            >
              {label}
            </button>
          )
        })}
        <button
          onClick={() => {
            toggleFilter('toilet')
            toggleFilter('ramp')
          }}
          className="flex shrink-0 px-3 py-1.5 text-md font-medium shadow transition-colors bg-white text-gray-700 border border-gray-200 hover:border-sky-400 cursor-pointer"
          aria-label="顯示台北身障資源圖層"
        >
          身障資源圖層
        </button>
    </div>
  )
}
