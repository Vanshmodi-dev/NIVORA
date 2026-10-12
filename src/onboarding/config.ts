/** Configurable name of the guide. Change this one value to rename the character everywhere. */
export const GUIDE_NAME = "Nivi";

export const BUDGET_PRESETS: { id: string; label: string; min: number | null; max: number | null }[] = [
  { id: "any", label: "I’m flexible", min: null, max: null },
  { id: "u10", label: "Under ₹10k", min: null, max: 10000 },
  { id: "10-20", label: "₹10–20k", min: 10000, max: 20000 },
  { id: "20-40", label: "₹20–40k", min: 20000, max: 40000 },
  { id: "40p", label: "₹40k and above", min: 40000, max: null },
];

/** Region used only to bias destination search (Jaipur). Not a claim about any listing. */
export const SEARCH_VIEWBOX = { west: 75.55, north: 27.15, east: 76.05, south: 26.6 } as const;
export const MAP_DEFAULT_CENTER = { lat: 26.9124, lng: 75.7873 } as const;
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
