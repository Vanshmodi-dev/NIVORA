import { SEED_VERSION, buildInitialUi, buildSeed } from "../data/seed";
import type { DataState, UiState } from "../domain/types";

/**
 * Local persistence (blueprint §9.3, §9.5, §16.3). This is a demo convenience, NOT a backend:
 * no authentication, no security, no multi-device or multi-user sync.
 */
export const STORAGE_KEY = "nivora.state.v1";
export const SCHEMA_VERSION = 1;

/** Minimal storage surface (satisfied by `Storage`), so tests can inject fakes. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Persisted `ui` omits `presenterMode`: Presenter Mode is session-scoped (§9.6 PM-4). */
export type PersistedUi = Omit<UiState, "presenterMode" | "presenterNowOverride">;

export interface PersistedState {
  schemaVersion: number;
  seedVersion: number;
  data: DataState;
  ui: PersistedUi;
}

export type LoadNotice = "reset_version" | "reset_corrupt" | null;

export interface LoadResult {
  data: DataState;
  ui: UiState;
  notice: LoadNotice;
}

const DATA_ARRAYS = [
  "owners",
  "tenants",
  "properties",
  "verificationItems",
  "visitRequests",
  "savedProperties",
  "tenancies",
  "rentRecords",
  "maintenanceRequests",
] as const;

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Structural check only (not deep validation). Anything that fails is re-seeded. */
export function isValidShape(x: unknown): x is PersistedState {
  if (!isObject(x) || !isObject(x.data) || !isObject(x.ui)) return false;
  const data = x.data;
  if (!DATA_ARRAYS.every((k) => Array.isArray(data[k]))) return false;
  if (!isObject(data.counters)) return false;
  const c = data.counters;
  if (typeof c.request !== "number" || typeof c.property !== "number" || typeof c.maintenance !== "number") {
    return false;
  }
  if (!isObject(data.presenter) || !Array.isArray(data.presenter.simulationLog)) return false;
  const ui = x.ui;
  if (!isObject(ui.lastRoute) || typeof ui.ownerIntroSeen !== "boolean") return false;
  if (ui.persona !== null && ui.persona !== "tenant" && ui.persona !== "owner") return false;
  return true;
}

export function freshState(now: Date): { data: DataState; ui: UiState } {
  return { data: buildSeed(now), ui: buildInitialUi() };
}

export function parsePersisted(raw: string): PersistedState | "version" | "corrupt" {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "corrupt";
  }
  if (!isObject(parsed)) return "corrupt";
  if (parsed.schemaVersion !== SCHEMA_VERSION || parsed.seedVersion !== SEED_VERSION) return "version";
  return isValidShape(parsed) ? parsed : "corrupt";
}

/**
 * Loads saved state, or seeds a Known Starting State when nothing valid is saved.
 * A version mismatch or unreadable payload re-seeds and reports a notice (no migrations).
 */
export function loadState(storage: StorageLike | null, now: Date): LoadResult {
  const seeded = (notice: LoadNotice): LoadResult => ({ ...freshState(now), notice });
  if (!storage) return seeded(null);
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return seeded(null);
  }
  if (raw === null) return seeded(null);
  const parsed = parsePersisted(raw);
  if (parsed === "version") return seeded("reset_version");
  if (parsed === "corrupt") return seeded("reset_corrupt");
  return { data: parsed.data, ui: { ...parsed.ui, presenterMode: false, presenterNowOverride: null }, notice: null };
}

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Writes synchronously. Failures are returned, never swallowed. */
export function saveState(storage: StorageLike | null, data: DataState, ui: UiState): SaveResult {
  if (!storage) return { ok: false, error: "Browser storage is unavailable." };
  // Session-scoped fields are never written to persistent storage.
  const { presenterMode: _a, presenterNowOverride: _b, ...persistedUi } = ui;
  void _a;
  void _b;
  const payload: PersistedState = {
    schemaVersion: SCHEMA_VERSION,
    seedVersion: SEED_VERSION,
    data,
    ui: persistedUi,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    const message = typeof e === "object" && e !== null && "message" in e ? String((e as { message: unknown }).message) : "";
    return { ok: false, error: message || "Could not write to browser storage." };
  }
}

export function clearSaved(storage: StorageLike | null): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear if storage is inaccessible */
  }
}

/** Accessing `window.localStorage` can throw (blocked site data, private modes). */
export function getBrowserStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    const s = window.localStorage;
    const probe = "__nivora_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
