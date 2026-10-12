import type { LatLng } from "../domain/geo";

/**
 * SIMULATED positions for demo inventory.
 *
 * Every NIVORA listing is fictional. Their map positions are therefore synthetic too: by default a
 * listing sits at its locality centre plus a deterministic offset of at most 600 m
 * (`approximateCoordinates`). The few entries below are DESIGNATED synthetic positions, chosen so
 * the radius feature has something to demonstrate around the founder's test destination. They are
 * not real addresses, not verified, and must never be presented as real rental properties.
 */
export const DEMO_POSITION_OVERRIDES: Readonly<Record<string, LatLng>> = {
  // "Builder Floor 2 BHK, Jagatpura": placed on the Jagatpura side of NRI Road, about 1.5 km west of VGU, so the 2 km count stays the same even if the VGU pin is off by a few hundred metres.
  prop_fx_06: { lat: 26.8121, lng: 75.8748 },
};

export const DEMO_POSITION_NOTICE = "Simulated position — demo home, not a real address.";
