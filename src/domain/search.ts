import { AMENITY_IDS, LOCALITIES } from "../data/reference";
import { addDays, parseISODate, startOfDay, toISODate } from "./dates";
import { formatDate, formatRupees } from "./format";
import { AMENITY_LABEL, FURNISHING_LABEL, LOCALITY_LABEL, PROPERTY_TYPE_LABEL } from "./labels";
import type {
  AmenityId,
  DataState,
  Furnishing,
  LocalityId,
  Property,
  PropertyType,
} from "./types";
import { getEffectiveVerification, verifiedCount } from "./verification";

/**
 * Tenant search (blueprint §6.2, §6.4). Pure functions over the shared `DataState`: the list on
 * the results page, the featured homes and the suggestions all come from the same selector, so
 * they can never disagree.
 *
 * NOT implemented (blocked by the §13.6.2 location-verification gate, founder decision D2):
 * "near a college or office" search, radius, distance and Nearest sorting.
 */

export type RoomsFilter = "any" | "1" | "2" | "3+";
export type AvailabilityFilter = "now" | "within_30" | "any";
export type VerificationFilter = "any" | "identity" | "all4";
export type SortKey = "newest" | "rent_asc" | "rent_desc";

export const MAX_RENT = 300_000;
export const KEYWORD_MAX = 60;

export interface SearchFilters {
  q: string;
  locality: LocalityId | null;
  min: number | null;
  max: number | null;
  types: PropertyType[];
  rooms: RoomsFilter;
  furnishing: Furnishing[];
  amenities: AmenityId[];
  avail: AvailabilityFilter;
  verif: VerificationFilter;
  sort: SortKey;
}

export const DEFAULT_FILTERS: SearchFilters = {
  q: "",
  locality: null,
  min: null,
  max: null,
  types: [],
  rooms: "any",
  furnishing: [],
  amenities: [],
  avail: "now",
  verif: "any",
  sort: "newest",
};

export const PROPERTY_TYPES: readonly PropertyType[] = ["apartment", "independent_house", "builder_floor", "studio", "single_room"];
export const FURNISHINGS: readonly Furnishing[] = ["unfurnished", "semi_furnished", "fully_furnished"];
const ROOMS: readonly RoomsFilter[] = ["any", "1", "2", "3+"];
const AVAILS: readonly AvailabilityFilter[] = ["now", "within_30", "any"];
const VERIFS: readonly VerificationFilter[] = ["any", "identity", "all4"];
const SORTS: readonly SortKey[] = ["newest", "rent_asc", "rent_desc"];

export const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest listed",
  rent_asc: "Rent: low to high",
  rent_desc: "Rent: high to low",
};
export const ROOMS_LABEL: Record<RoomsFilter, string> = { any: "Any", "1": "1", "2": "2", "3+": "3+" };
export const AVAIL_LABEL: Record<AvailabilityFilter, string> = {
  now: "Available now",
  within_30: "Within 30 days",
  any: "Include unavailable",
};
export const VERIF_LABEL: Record<VerificationFilter, string> = {
  any: "Any",
  identity: "Owner identity verified (demo)",
  all4: "All 4 checks verified (demo)",
};

/* ---------------------------------------------------------------- rent validation */

export const RENT_ORDER_ERROR = "Maximum rent must be at least the minimum.";

/** Digits-only rent input → integer clamped to ₹0–₹3,00,000, or null when empty. */
export function parseRentInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  return Math.min(MAX_RENT, parseInt(digits, 10));
}

export function validateRent(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null && min > max) return RENT_ORDER_ERROR;
  return null;
}

/* ---------------------------------------------------------------- URL state codec */

const pick = <T extends string>(allowed: readonly T[], value: string | null): T | null =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;

const pickMany = <T extends string>(allowed: readonly T[], value: string | null): T[] => {
  if (!value) return [];
  const wanted = new Set(value.split(","));
  return allowed.filter((a) => wanted.has(a));
};

const intParam = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Math.min(MAX_RENT, parseInt(value, 10));
};

/**
 * Parses filters from the URL. Invalid or unknown values are silently ignored and fall back to
 * defaults (§6.3.6). Parameters for the blocked anchor mode (`mode`, `anchor`, `radius`) are
 * ignored. A contradictory rent range (min > max) is dropped entirely.
 */
export function parseFilters(params: URLSearchParams): SearchFilters {
  const localityIds = LOCALITIES.map((l) => l.id);
  let min = intParam(params.get("min"));
  let max = intParam(params.get("max"));
  if (validateRent(min, max)) {
    min = null;
    max = null;
  }
  return {
    q: (params.get("q") ?? "").trim().slice(0, KEYWORD_MAX),
    locality: pick(localityIds, params.get("locality")),
    min,
    max,
    types: pickMany(PROPERTY_TYPES, params.get("type")),
    rooms: pick(ROOMS, params.get("beds")) ?? DEFAULT_FILTERS.rooms,
    furnishing: pickMany(FURNISHINGS, params.get("furn")),
    amenities: pickMany(AMENITY_IDS, params.get("amen")),
    avail: pick(AVAILS, params.get("avail")) ?? DEFAULT_FILTERS.avail,
    verif: pick(VERIFS, params.get("verif")) ?? DEFAULT_FILTERS.verif,
    sort: pick(SORTS, params.get("sort")) ?? DEFAULT_FILTERS.sort,
  };
}

/** Serialises filters, omitting defaults so URLs stay short and stable. */
export function serializeFilters(f: SearchFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.locality) p.set("locality", f.locality);
  if (f.min !== null) p.set("min", String(f.min));
  if (f.max !== null) p.set("max", String(f.max));
  if (f.types.length) p.set("type", f.types.join(","));
  if (f.rooms !== DEFAULT_FILTERS.rooms) p.set("beds", f.rooms);
  if (f.furnishing.length) p.set("furn", f.furnishing.join(","));
  if (f.amenities.length) p.set("amen", f.amenities.join(","));
  if (f.avail !== DEFAULT_FILTERS.avail) p.set("avail", f.avail);
  if (f.verif !== DEFAULT_FILTERS.verif) p.set("verif", f.verif);
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  return p;
}

/** True when every filter equals its default (sort excluded — it is not a filter). */
export function isDefaultFilters(f: SearchFilters): boolean {
  return countActiveFilters(f) === 0;
}

/** Number of active (non-default) filters; sort does not count. */
export function countActiveFilters(f: SearchFilters): number {
  return (
    (f.q ? 1 : 0) +
    (f.locality ? 1 : 0) +
    (f.min !== null ? 1 : 0) +
    (f.max !== null ? 1 : 0) +
    (f.types.length ? 1 : 0) +
    (f.rooms !== "any" ? 1 : 0) +
    (f.furnishing.length ? 1 : 0) +
    (f.amenities.length ? 1 : 0) +
    (f.avail !== "now" ? 1 : 0) +
    (f.verif !== "any" ? 1 : 0)
  );
}

/* ---------------------------------------------------------------- availability */

export type ListingAvailability =
  | { kind: "available_now"; label: "Available now"; tone: "positive" }
  | { kind: "available_from"; label: string; tone: "warning" }
  | { kind: "unavailable"; label: "No longer available"; tone: "error" };

/** Tenant-facing availability for a published or unavailable listing. */
export function getAvailability(p: Pick<Property, "listingStatus" | "availableFrom">, now: Date): ListingAvailability {
  if (p.listingStatus === "unavailable") return { kind: "unavailable", label: "No longer available", tone: "error" };
  const today = toISODate(startOfDay(now));
  if (p.availableFrom > today) {
    const d = parseISODate(p.availableFrom);
    const short = formatDate(toISODate(d)).split(" ").slice(0, 2).join(" ");
    return { kind: "available_from", label: `Available from ${short}`, tone: "warning" };
  }
  return { kind: "available_now", label: "Available now", tone: "positive" };
}

/** Tenants can only ever see published or unavailable listings (§6.5.2); never draft/pending. */
export function isTenantVisible(p: Pick<Property, "listingStatus">): boolean {
  return p.listingStatus === "published" || p.listingStatus === "unavailable";
}

export function getTenantProperty(data: Pick<DataState, "properties">, id: string): Property | null {
  const p = data.properties.find((x) => x.id === id);
  return p && isTenantVisible(p) ? p : null;
}

/* ---------------------------------------------------------------- selector */

const matchesRooms = (p: Property, rooms: RoomsFilter): boolean => {
  if (rooms === "any") return true;
  if (rooms === "3+") return p.bedrooms >= 3;
  return p.bedrooms === Number(rooms);
};

/**
 * Single source for results, counts, featured homes and suggestions. AND across categories;
 * OR within property type and within furnishing; amenities must ALL be present.
 */
export function selectSearchResults(
  data: Pick<DataState, "properties" | "verificationItems">,
  filters: SearchFilters,
  now: Date,
): Property[] {
  const today = toISODate(startOfDay(now));
  const horizon = toISODate(addDays(startOfDay(now), 30));
  const q = filters.q.trim().toLowerCase();

  const results = data.properties.filter((p) => {
    if (!isTenantVisible(p)) return false;
    if (filters.avail === "now" && !(p.listingStatus === "published" && p.availableFrom <= today)) return false;
    if (filters.avail === "within_30" && !(p.listingStatus === "published" && p.availableFrom <= horizon)) return false;

    if (q) {
      const hay = [p.title, LOCALITY_LABEL[p.locality], p.landmark ?? "", p.addressArea].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.locality && p.locality !== filters.locality) return false;
    if (filters.min !== null && p.rent < filters.min) return false;
    if (filters.max !== null && p.rent > filters.max) return false;
    if (filters.types.length && !filters.types.includes(p.type)) return false;
    if (!matchesRooms(p, filters.rooms)) return false;
    if (filters.furnishing.length && !filters.furnishing.includes(p.furnishing)) return false;
    if (filters.amenities.length && !filters.amenities.every((a) => p.amenities.includes(a))) return false;

    if (filters.verif !== "any") {
      const eff = getEffectiveVerification(p, data.verificationItems, now);
      if (filters.verif === "identity" && eff.find((e) => e.category === "identity")?.status !== "verified_demo") return false;
      if (filters.verif === "all4" && verifiedCount(eff) !== 4) return false;
    }
    return true;
  });

  const byNewest = (a: Property, b: Property) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt) || a.id.localeCompare(b.id);
  const sorters: Record<SortKey, (a: Property, b: Property) => number> = {
    newest: byNewest,
    rent_asc: (a, b) => a.rent - b.rent || byNewest(a, b),
    rent_desc: (a, b) => b.rent - a.rent || byNewest(a, b),
  };
  return [...results].sort(sorters[filters.sort]);
}

/**
 * Featured demo homes: deterministic, spread across the trust range (not ranked by
 * verification — the selection is a spread, not a recommendation). §6.1.
 */
export function selectFeatured(
  data: Pick<DataState, "properties" | "verificationItems">,
  now: Date,
  count = 4,
): Property[] {
  const available = selectSearchResults(data, DEFAULT_FILTERS, now);
  const scored = available
    .map((p) => ({ p, v: verifiedCount(getEffectiveVerification(p, data.verificationItems, now)) }))
    .sort((a, b) => b.v - a.v || a.p.id.localeCompare(b.p.id));
  if (scored.length <= count) return scored.map((s) => s.p);
  const picks = new Set<number>();
  for (let i = 0; i < count; i++) picks.add(Math.round((i * (scored.length - 1)) / (count - 1)));
  return [...picks].map((i) => scored[i]!.p);
}

/* ---------------------------------------------------------------- chips and suggestions */

export type FilterKey =
  | "q"
  | "locality"
  | "min"
  | "max"
  | "types"
  | "rooms"
  | "furnishing"
  | "amenities"
  | "avail"
  | "verif";

export interface ActiveFilterChip {
  key: FilterKey;
  label: string;
}

export function activeFilterChips(f: SearchFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (f.q) chips.push({ key: "q", label: `“${f.q}”` });
  if (f.locality) chips.push({ key: "locality", label: LOCALITY_LABEL[f.locality] });
  if (f.min !== null) chips.push({ key: "min", label: `Min ${formatRupees(f.min)}` });
  if (f.max !== null) chips.push({ key: "max", label: `Max ${formatRupees(f.max)}` });
  if (f.types.length) chips.push({ key: "types", label: f.types.map((t) => PROPERTY_TYPE_LABEL[t]).join(" / ") });
  if (f.rooms !== "any") chips.push({ key: "rooms", label: `${ROOMS_LABEL[f.rooms]} room${f.rooms === "1" ? "" : "s"}` });
  if (f.furnishing.length) chips.push({ key: "furnishing", label: f.furnishing.map((x) => FURNISHING_LABEL[x]).join(" / ") });
  if (f.amenities.length) chips.push({ key: "amenities", label: f.amenities.map((a) => AMENITY_LABEL[a]).join(", ") });
  if (f.avail !== "now") chips.push({ key: "avail", label: AVAIL_LABEL[f.avail] });
  if (f.verif !== "any") chips.push({ key: "verif", label: VERIF_LABEL[f.verif] });
  return chips;
}

/** Returns the filters with one filter group reset to its default. */
export function removeFilter(f: SearchFilters, key: FilterKey): SearchFilters {
  switch (key) {
    case "q": return { ...f, q: "" };
    case "locality": return { ...f, locality: null };
    case "min": return { ...f, min: null };
    case "max": return { ...f, max: null };
    case "types": return { ...f, types: [] };
    case "rooms": return { ...f, rooms: "any" };
    case "furnishing": return { ...f, furnishing: [] };
    case "amenities": return { ...f, amenities: [] };
    case "avail": return { ...f, avail: "now" };
    case "verif": return { ...f, verif: "any" };
  }
}

export interface FilterSuggestion {
  key: FilterKey;
  label: string;
  filters: SearchFilters;
  count: number;
}

const SUGGESTION_LABEL: Record<FilterKey, (f: SearchFilters) => string> = {
  q: (f) => `Remove the search “${f.q}”`,
  locality: (f) => `Search all of Jaipur instead of ${f.locality ? LOCALITY_LABEL[f.locality] : "this locality"}`,
  min: () => "Remove the minimum rent",
  max: () => "Remove the maximum rent",
  types: (f) => `Remove the ${f.types.map((t) => PROPERTY_TYPE_LABEL[t]).join(" / ")} filter`,
  rooms: () => "Remove the rooms filter",
  furnishing: (f) => `Remove “${f.furnishing.map((x) => FURNISHING_LABEL[x]).join(" / ")}”`,
  amenities: () => "Remove the amenity filters",
  avail: () => "Remove the availability filter",
  verif: () => "Remove the verification filter",
};

/**
 * Up to three one-click relaxations, each of which would yield at least one home (§6.3.6).
 * Derived by re-running the same selector with one filter group removed.
 */
export function suggestRelaxations(
  data: Pick<DataState, "properties" | "verificationItems">,
  filters: SearchFilters,
  now: Date,
  max = 3,
): FilterSuggestion[] {
  const out: FilterSuggestion[] = [];
  for (const chip of activeFilterChips(filters)) {
    const relaxed = removeFilter(filters, chip.key);
    const count = selectSearchResults(data, relaxed, now).length;
    if (count > 0) out.push({ key: chip.key, label: `${SUGGESTION_LABEL[chip.key](filters)} (${count} ${count === 1 ? "home" : "homes"})`, filters: relaxed, count });
  }
  return out.sort((a, b) => b.count - a.count).slice(0, max);
}

/** `2 BHK · 2 bath · Semi-furnished`; Studio / Single Room read `Studio · 1 bath · …`. */
export function specsLine(p: Pick<Property, "type" | "bedrooms" | "bathrooms" | "furnishing">): string {
  const rooms =
    p.type === "studio" ? "Studio" : p.type === "single_room" ? "Single room" : `${p.bedrooms} BHK`;
  return `${rooms} · ${p.bathrooms} bath · ${FURNISHING_LABEL[p.furnishing]}`;
}
