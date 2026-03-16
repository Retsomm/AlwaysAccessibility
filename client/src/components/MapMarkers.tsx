import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { useMapStore } from '../store/mapStore'
import type { DisabilityPoint, Place } from '../store/mapStore'

function PlaceMarker({ place }: { place: Place }) {
  const { openMarkerId, setOpenMarkerId } = useMapStore()

  return (
    <AdvancedMarker position={place.location} onClick={() => setOpenMarkerId(place.id)} title={place.name}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white ${
          openMarkerId === place.id ? 'bg-indigo-700 scale-110' : place.accessibility.wheelchair_entrance !== false ? 'bg-indigo-500' : 'bg-gray-400'
        } transition-transform`}
      >
        ♿
      </div>
    </AdvancedMarker>
  )
}

function DisabilityPointMarker({ point }: { point: DisabilityPoint }) {
  const { openMarkerId, setOpenMarkerId } = useMapStore()
  const open = openMarkerId === point.id
  const position = { lat: point.lat, lng: point.lng }

  return (
    <>
      <AdvancedMarker position={position} onClick={() => setOpenMarkerId(point.id)} title={point.name}>
        <div className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white">
          資
        </div>
      </AdvancedMarker>

      {open && (
        <InfoWindow position={position} onCloseClick={() => setOpenMarkerId(null)}>
          <div className="max-w-50 space-y-1">
            <p className="font-semibold text-sm leading-tight">{point.name}</p>
            {point.category && point.category !== 'general' && (
              <p className="text-xs text-gray-500">{point.category}</p>
            )}
            {point.address && (
              <p className="text-xs text-gray-500">{point.address}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  )
}

export default function MapMarkers() {
  const places = useMapStore((s) => s.places)
  const disabilityPoints = useMapStore((s) => s.disabilityPoints)
  const activeFilters = useMapStore((s) => s.activeFilters)

  const showDisabilityLayer =
    activeFilters.includes('toilet') || activeFilters.includes('ramp')

  return (
    <>
      {places.map((place) => (
        <PlaceMarker key={place.id} place={place} />
      ))}
      {showDisabilityLayer &&
        disabilityPoints.map((point) => (
          <DisabilityPointMarker key={point.id} point={point} />
        ))}
    </>
  )
}
