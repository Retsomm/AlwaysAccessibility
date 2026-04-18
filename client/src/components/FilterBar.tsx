import { useMapStore } from '../store/mapStore'
import type { FilterType } from '../store/mapStore'

const FoodIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11h18l-2 9H5l-2-9ZM7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)
const AttractionIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 2.5 6.5L21 10l-5 4.5L17.5 21 12 17l-5.5 4L8 14.5 3 10l6.5-1.5L12 2Z"/>
  </svg>
)
const ParkingIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 17V8h3.5a3 3 0 0 1 0 6H9"/>
  </svg>
)
const ToiletIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="5" r="2"/><path d="M9 9v5h5l3 5M9 14l-4 6"/>
  </svg>
)
const RampIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16M4 20V10l8-6 8 6"/>
  </svg>
)
const LayersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>
  </svg>
)

const FILTERS: { type: FilterType; label: string; Icon: React.FC }[] = [
  { type: 'restaurant', label: '餐廳', Icon: FoodIcon },
  { type: 'attraction', label: '景點', Icon: AttractionIcon },
  { type: 'parking',    label: '停車', Icon: ParkingIcon },
  { type: 'toilet',     label: '無障礙廁所', Icon: ToiletIcon },
  { type: 'ramp',       label: '無障礙坡道', Icon: RampIcon },
]

const FilterBar = () => {
  const { activeFilters, toggleFilter, isLoadingPlaces } = useMapStore()

  const chipBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 12px',
    borderRadius: 999,
    border: '1px solid var(--hairline)',
    background: 'var(--panel)',
    fontSize: 13,
    color: 'var(--ink-2)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'all 0.12s',
    cursor: 'pointer',
  }
  const chipActive: React.CSSProperties = {
    ...chipBase,
    background: 'var(--ink)',
    color: 'var(--bg)',
    borderColor: 'var(--ink)',
  }
  const chipGhost: React.CSSProperties = {
    ...chipBase,
    background: 'transparent',
    border: '1px dashed var(--hairline-2)',
    color: 'var(--ink-3)',
  }

  return (
    <div style={{
      flexShrink: 0,
      background: 'var(--bg)',
      borderBottom: '1px solid var(--hairline)',
      padding: '8px 12px',
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      alignItems: 'center',
      scrollbarWidth: 'none',
    }}>
      {FILTERS.map(({ type, label, Icon }) => {
        const isActive = activeFilters.includes(type)
        return (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            disabled={isLoadingPlaces}
            style={isActive ? chipActive : chipBase}
            aria-pressed={isActive}
          >
            <Icon />
            {label}
          </button>
        )
      })}
      <div style={{ width: 1, height: 18, background: 'var(--hairline)', margin: '0 4px', flexShrink: 0 }} />
      <button
        style={chipGhost}
        onClick={() => { toggleFilter('toilet'); toggleFilter('ramp') }}
      >
        <LayersIcon /> 身障資源圖層
      </button>
    </div>
  )
}

export default FilterBar
