import { AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps'
import { useMapStore } from '../store/mapStore'
import type { DisabilityPoint, Place } from '../store/mapStore'

const UserLocationMarker = () => {
  const userLocation = useMapStore((s) => s.userLocation)
  if (!userLocation) return null
  return (
    <AdvancedMarker position={userLocation} title="您的目前位置">
      <div className="relative w-5 h-5 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-60" />
        <div className="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-md" />
      </div>
    </AdvancedMarker>
  )
}

const PlaceMarker = ({ place }: { place: Place }) => {
  const { openMarkerId, setOpenMarkerId } = useMapStore()

  return (
    <AdvancedMarker position={place.location} onClick={() => setOpenMarkerId(place.id)} title={place.name}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-md font-bold shadow-md border-2 border-white ${
          openMarkerId === place.id ? 'bg-sky-600 scale-110' : place.accessibility.wheelchair_entrance !== false ? 'bg-sky-600' : 'bg-gray-400'
        } transition-transform`}
      >
        ♿
      </div>
    </AdvancedMarker>
  )
}

const DisabilityPointMarker = ({ point }: { point: DisabilityPoint }) => {
  const { openMarkerId, setOpenMarkerId } = useMapStore()
  const open = openMarkerId === point.id
  const position = { lat: point.lat, lng: point.lng }

  return (
    <>
      <AdvancedMarker position={position} onClick={() => setOpenMarkerId(point.id)} title={point.name}>
        <div className="w-6 h-6 rounded-full bg-sky-500 flex items-center justify-center text-white text-md font-bold shadow-md border-2 border-white">
        
        </div>
      </AdvancedMarker>

      {open && (
        <InfoWindow position={position} onCloseClick={() => setOpenMarkerId(null)}>
          <div className="max-w-50 space-y-1">
            <p className="font-semibold text-md leading-tight">{point.name}</p>
            {point.category && point.category !== 'general' && (
              <p className="text-md text-gray-500">{point.category}</p>
            )}
            {point.address && (
              <p className="text-md text-gray-500">{point.address}</p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  )
}

const MapMarkers = () => {
  const places = useMapStore((s) => s.places)
  const disabilityPoints = useMapStore((s) => s.disabilityPoints)
  const activeFilters = useMapStore((s) => s.activeFilters)

  const showDisabilityLayer =
    activeFilters.includes('toilet') || activeFilters.includes('ramp')

  return (
    <>
      <UserLocationMarker />
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

export default MapMarkers
