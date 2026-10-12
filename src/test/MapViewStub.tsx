import type { MapViewProps } from "../onboarding/MapView";

/** jsdom cannot run Leaflet. This stand-in exposes what the real map would be given. */
export default function MapViewStub({ origin, radiusKm, homes = [], onPick }: MapViewProps) {
  return (
    <div data-testid="map" data-origin={origin ? `${origin.lat},${origin.lng}` : ""} data-origin-label={origin?.label ?? ""} data-radius={radiusKm ?? ""} data-homes={homes.length}>
      {onPick && (
        <button type="button" onClick={() => onPick(26.9, 75.8)}>
          Drop test pin
        </button>
      )}
    </div>
  );
}
