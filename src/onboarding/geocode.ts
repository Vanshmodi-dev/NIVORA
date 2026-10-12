import { SEARCH_VIEWBOX } from "./config";

export interface Place {
  label: string;
  lat: number;
  lng: number;
}

export type FetchLike = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const MIN_INTERVAL_MS = 1100;
let lastCall = 0;

/**
 * Destination search through OpenStreetMap's Nominatim. Called only when the user presses Search
 * (never as-you-type), at most one request per ~1.1 s, as the Nominatim usage policy requires.
 * The query text is sent to nominatim.openstreetmap.org; nothing else is.
 * Coordinates are rounded to 4 decimals and are approximate.
 */
export async function searchPlaces(query: string, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) throw new Error("Type at least 3 characters to search.");
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const v = SEARCH_VIEWBOX;
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in" +
    `&viewbox=${v.west},${v.north},${v.east},${v.south}&bounded=0&q=${encodeURIComponent(q)}`;
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  } catch {
    throw new Error("The place search isn’t available right now (are you offline?).");
  }
  if (!res.ok) throw new Error("The place search isn’t available right now.");
  const rows = (await res.json()) as { lat?: string; lon?: string; display_name?: string; name?: string }[];
  const out: Place[] = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const label = (r.name || r.display_name || "").split(",").slice(0, 2).join(",").trim().slice(0, 60);
    out.push({ label: label || q.slice(0, 60), lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4 });
  }
  return out;
}

export const __resetGeocodeThrottleForTests = () => {
  lastCall = 0;
};
