import { SEARCH_ANCHOR_CANDIDATES, getTestDestinations } from "../data/reference";
import { RADIUS_CHOICES_KM, type Origin, type RadiusKm } from "../domain/nearby";
import { parseFilters, serializeFilters, type SearchFilters } from "../domain/search";

/** Every question gets its own screen, in this order. `place` is the second half of step 4. */
export const STEPS = ["name", "phone", "locate", "origin", "place", "radius", "count", "furnish", "budget", "type", "rooms", "amenities", "results"] as const;
export type StepId = (typeof STEPS)[number];

/** Steps that count towards "n of 12" (place shares a number with origin). */
export const PROGRESS_STEPS: readonly StepId[] = ["name", "phone", "locate", "origin", "radius", "count", "furnish", "budget", "type", "rooms", "amenities", "results"];
export const progressIndex = (s: StepId) => PROGRESS_STEPS.indexOf(s === "place" ? "origin" : s);

/**
 * How the search origin was chosen.
 *  - "here":   browser location (coordinates stay in memory, never in the URL)
 *  - "place":  chose "college or office" but has not picked a point yet
 *  - "anchor": a verified test destination (VGU)
 *  - "search" / "pin": a point the user chose (search result or map pin), rounded to 4 decimals
 */
export type OriginChoice = { kind: "here" } | { kind: "place" } | { kind: "anchor"; anchorId: string } | { kind: "search" | "pin"; lat: number; lng: number; label: string };

export interface FlowState {
  step: StepId;
  choice: OriginChoice | null;
  radius: RadiusKm | null;
  filters: SearchFilters;
}

const inIndia = (lat: number, lng: number) => lat >= 6 && lat <= 37.5 && lng >= 68 && lng <= 98;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function parseFlow(params: URLSearchParams): FlowState {
  const s = params.get("s");
  const step = (STEPS as readonly string[]).includes(s ?? "") ? (s as StepId) : "name";
  const at = params.get("at");
  let choice: OriginChoice | null = null;
  if (at === "here") choice = { kind: "here" };
  else if (at === "place") choice = { kind: "place" };
  else if (at && SEARCH_ANCHOR_CANDIDATES.some((a) => a.id === at) && getTestDestinations().some((a) => a.id === at)) choice = { kind: "anchor", anchorId: at };
  else if (at === "pin" || at === "search") {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (params.get("lat") !== null && params.get("lng") !== null && Number.isFinite(lat) && Number.isFinite(lng) && inIndia(lat, lng)) {
      choice = { kind: at, lat: r4(lat), lng: r4(lng), label: (params.get("pl") ?? "").trim().slice(0, 60) || (at === "pin" ? "your pin" : "your destination") };
    } else choice = { kind: "place" };
  }
  const km = Number(params.get("km"));
  const radius = (RADIUS_CHOICES_KM as readonly number[]).includes(km) ? (km as RadiusKm) : null;
  return { step, choice, radius, filters: parseFilters(params) };
}

export function serializeFlow(state: FlowState): URLSearchParams {
  const p = serializeFilters({ ...state.filters, q: "", locality: null });
  p.set("s", state.step);
  const c = state.choice;
  if (c) {
    if (c.kind === "here" || c.kind === "place") p.set("at", c.kind);
    else if (c.kind === "anchor") p.set("at", c.anchorId);
    else {
      p.set("at", c.kind);
      p.set("lat", String(r4(c.lat)));
      p.set("lng", String(r4(c.lng)));
      p.set("pl", c.label.slice(0, 60));
    }
  }
  if (state.radius !== null) p.set("km", String(state.radius));
  return p;
}

/** The point the search is centred on, or null when it is not (yet) known. */
export function resolveOrigin(choice: OriginChoice | null, here: { lat: number; lng: number } | null): Origin | null {
  if (!choice || choice.kind === "place") return null;
  if (choice.kind === "here") return here ? { kind: "here", lat: here.lat, lng: here.lng, label: "your location" } : null;
  if (choice.kind === "anchor") {
    const a = getTestDestinations().find((x) => x.id === choice.anchorId);
    if (!a || a.lat === null || a.lng === null) return null;
    return { kind: "anchor", lat: a.lat, lng: a.lng, label: a.id === "anchor_vgu" ? "VGU" : a.name };
  }
  return { kind: choice.kind, lat: choice.lat, lng: choice.lng, label: choice.label };
}

const AFTER_ORIGIN: readonly StepId[] = ["radius", "count", "furnish", "budget", "type", "rooms", "amenities", "results"];
const AFTER_RADIUS: readonly StepId[] = ["count", "furnish", "budget", "type", "rooms", "amenities", "results"];

/**
 * Refresh / deep-link safety: a screen is only shown when what it needs exists. Otherwise the user is
 * sent to the earliest screen that supplies it, so no step ever computes from missing data.
 */
export function guardStep(state: FlowState, here: { lat: number; lng: number } | null): StepId {
  const { step, choice, radius } = state;
  if (step === "place" && choice?.kind === "here") return "origin";
  if (AFTER_ORIGIN.includes(step) && !resolveOrigin(choice, here)) return choice && choice.kind !== "here" ? "place" : "origin";
  if (AFTER_RADIUS.includes(step) && radius === null) return "radius";
  return step;
}

export function previousStep(step: StepId, choice: OriginChoice | null): StepId {
  if (step === "radius") return choice?.kind === "here" ? "origin" : "place";
  const i = STEPS.indexOf(step);
  return STEPS[Math.max(0, i - 1)]!;
}

export function nextStep(step: StepId, choice: OriginChoice | null): StepId {
  if (step === "origin") return choice?.kind === "here" ? "radius" : "place";
  const i = STEPS.indexOf(step);
  return STEPS[Math.min(STEPS.length - 1, i + 1)]!;
}
