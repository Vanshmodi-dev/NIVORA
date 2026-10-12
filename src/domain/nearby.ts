import { DEMO_POSITION_OVERRIDES } from "../data/demoPositions";
import { LOCALITIES } from "../data/reference";
import { approximateCoordinates, haversineKm, type LatLng } from "./geo";
import type { Property } from "./types";

/**
 * Radius matching over demo inventory. Positions are SIMULATED (see data/demoPositions.ts), so the
 * result is accurate for the demo dataset only. Distances are straight-line, never travel time.
 */
export type OriginKind = "anchor" | "search" | "pin" | "here";

export interface Origin extends LatLng {
  kind: OriginKind;
  label: string;
}

export const RADIUS_CHOICES_KM = [2, 3, 5, 7, 10] as const;
export type RadiusKm = (typeof RADIUS_CHOICES_KM)[number];

export function demoPosition(p: Pick<Property, "id" | "locality">): LatLng {
  const override = DEMO_POSITION_OVERRIDES[p.id];
  if (override) return override;
  const loc = LOCALITIES.find((l) => l.id === p.locality);
  if (!loc) throw new Error(`Unknown locality ${p.locality}`);
  return approximateCoordinates({ lat: loc.lat, lng: loc.lng }, p.id);
}

export interface NearbyResult<T> {
  property: T;
  km: number;
}

/** Properties whose simulated position lies within `radiusKm` of the origin, nearest first. */
export function withinRadius<T extends Pick<Property, "id" | "locality">>(properties: readonly T[], origin: LatLng, radiusKm: number): NearbyResult<T>[] {
  return properties
    .map((property) => ({ property, km: haversineKm(origin, demoPosition(property)) }))
    .filter((r) => r.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}
