import { create } from 'zustand'

export type FilterType = 'restaurant' | 'attraction' | 'parking' | 'toilet' | 'ramp'

export interface Place {
  id: string
  name: string
  location: { lat: number; lng: number }
  address: string
  rating?: number
  accessibility: {
    wheelchair_entrance?: boolean
    wheelchair_parking?: boolean
    wheelchair_restroom?: boolean
    wheelchair_seating?: boolean
  }
  types: string[]
  filterType: FilterType
  photoName?: string | null
}

export interface DisabilityPoint {
  id: string
  name: string
  lat: number
  lng: number
  category: string
  address: string
}

type PlaceApiItem = Omit<Place, 'filterType'>

interface PlacesApiResponse {
  places?: PlaceApiItem[]
}

interface MapState {
  center: { lat: number; lng: number }
  userLocation: { lat: number; lng: number } | null
  focusLocation: { lat: number; lng: number; zoom?: number } | null
  activeFilters: FilterType[]
  places: Place[]
  disabilityPoints: DisabilityPoint[]
  isLoadingPlaces: boolean
  openMarkerId: string | null
  leftPanelOpen: boolean
  leftPanelTab: 'results' | 'bookmarks' | 'history'
  setOpenMarkerId: (id: string | null) => void
  setUserLocation: (loc: { lat: number; lng: number } | null) => void
  setFocusLocation: (loc: { lat: number; lng: number; zoom?: number } | null) => void
  setLeftPanelOpen: (open: boolean) => void
  setLeftPanelTab: (tab: 'results' | 'bookmarks' | 'history') => void
  addPlace: (place: Place) => void
  toggleFilter: (filter: FilterType) => void
  setCenter: (center: { lat: number; lng: number }) => void
  fetchDisabilityMap: () => Promise<void>
  searchByKeyword: (keyword: string) => Promise<void>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// 判斷 places type 對應的 FilterType
const FILTER_TYPES: Record<FilterType, string[]> = {
  restaurant: ['restaurant', 'food', 'cafe', 'bakery', 'bar'],
  attraction: ['tourist_attraction', 'museum', 'park', 'amusement_park', 'zoo', 'aquarium'],
  parking: ['parking'],
  toilet: [],
  ramp: [],
}

export const useMapStore = create<MapState>((set, get) => ({
  center: { lat: 25.0478, lng: 121.5319 },
  userLocation: null,
  focusLocation: null,
  activeFilters: [],
  places: [],
  disabilityPoints: [],
  isLoadingPlaces: false,
  openMarkerId: null,
  leftPanelOpen: false,
  leftPanelTab: 'results',
  setOpenMarkerId: (id) => set({ openMarkerId: id }),
  setUserLocation: (loc) => set({ userLocation: loc }),
  setFocusLocation: (loc) => set({ focusLocation: loc }),
  setLeftPanelOpen: (open) => set({ leftPanelOpen: open }),
  setLeftPanelTab: (tab) => set({ leftPanelTab: tab }),
  addPlace: (place) => {
    const { places } = get()
    if (!places.find((p) => p.id === place.id)) {
      set({ places: [...places, place] })
    }
  },

  toggleFilter: async (filter) => {
    const { activeFilters, center } = get()
    const isActive = activeFilters.includes(filter)

    if (isActive) {
      set({
        activeFilters: activeFilters.filter((f) => f !== filter),
        places: get().places.filter((p) => p.filterType !== filter),
      })
      return
    }

    set({ activeFilters: [...activeFilters, filter] })

    if (filter === 'toilet' || filter === 'ramp') {
      await get().fetchDisabilityMap()
      return
    }

    set({ isLoadingPlaces: true })
    try {
      const params = new URLSearchParams({
        lat: center.lat.toString(),
        lng: center.lng.toString(),
        type: filter,
        radius: '1500',
      })
      const res = await fetch(`${API_BASE}/api/places?${params}`)
      const data = (await res.json()) as PlacesApiResponse

      const newPlaces: Place[] = (data.places ?? []).map((p) => ({
        ...p,
        filterType: filter,
      }))

      // 去除重複 id
      const existingIds = new Set(get().places.map((p) => p.id))
      set({ places: [...get().places, ...newPlaces.filter((p) => !existingIds.has(p.id))] })
    } catch {
      // 不影響 UI
    } finally {
      set({ isLoadingPlaces: false })
    }
  },

  setCenter: (center) => set({ center }),

  fetchDisabilityMap: async () => {
    if (get().disabilityPoints.length > 0) return
    try {
      const res = await fetch(`${API_BASE}/api/disability-map`)
      const data = (await res.json()) as { points?: DisabilityPoint[] }
      set({ disabilityPoints: data.points ?? [] })
    } catch {
      // 不影響 UI
    }
  },

  searchByKeyword: async (keyword) => {
    const { center, userLocation } = get()
    const searchCenter = userLocation ?? center
    set({ isLoadingPlaces: true })
    try {
      const params = new URLSearchParams({
        lat: searchCenter.lat.toString(),
        lng: searchCenter.lng.toString(),
        keyword,
        radius: '1500',
      })
      const res = await fetch(`${API_BASE}/api/places?${params}`)
      const data = (await res.json()) as PlacesApiResponse
      const newPlaces: Place[] = (data.places ?? []).map((p) => ({
        ...p,
        filterType: 'restaurant' as FilterType,
      }))
      set({ places: newPlaces, activeFilters: [], leftPanelOpen: true, leftPanelTab: 'results' })
      if (newPlaces.length > 0) {
        set({ focusLocation: { ...newPlaces[0].location, zoom: 16 } })
      }
    } catch {
      // 不影響 UI
    } finally {
      set({ isLoadingPlaces: false })
    }
  },

}))

export { FILTER_TYPES }
