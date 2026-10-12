import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { clearClockOverride, systemClock, type Clock } from "../domain/clock";
import {
  cancelVisitRequest,
  clearTenantProfile,
  markRequestSeen,
  createVisitRequest,
  saveTenantProfile,
  toggleSavedProperty,
  type CancelResult,
  type CreateVisitResult,
  type ProfileResult,
  type ToggleSavedResult,
  type VisitInput,
} from "../domain/mutations";
import {
  attachSampleDocument,
  ownerTransitionRequest,
  publishProperty,
  reconfirmAvailability,
  saveOwnerProfile,
  setListingStatus,
  updateProperty,
  type OwnerProfileResult,
  type OwnerRequestResult,
  type PropertyResult,
  type PublishResult,
  type UpdateResult,
} from "../domain/ownerMutations";
import type { ListingForm } from "../domain/listing";
import {
  createMaintenanceRequest,
  recordRentPaid,
  updateMaintenanceStatus,
  type CreateMaintenanceResult,
  type MaintenanceInput,
  type RentResult,
  type UpdateMaintenanceResult,
} from "../domain/lifecycle";
import type { MaintenanceStatus } from "../domain/types";
import type { RequestStatus } from "../domain/types";
import type { TransitionPayload } from "../domain/requests";
import { DEMO_OWNER_ID, DEMO_TENANT_ID, type DataState, type MapMode, type Persona, type UiState } from "../domain/types";
import {
  STORAGE_KEY,
  freshState,
  getBrowserStorage,
  loadState,
  parsePersisted,
  saveState,
  type LoadNotice,
  type StorageLike,
} from "./persistence";

/**
 * The single shared store (blueprint §9.1). Tenant and Owner screens are views over this one
 * state — there are no per-role copies. All writes go through the actions below.
 */
export interface AppState {
  data: DataState;
  ui: UiState;
  meta: {
    /** "memory-only" means a storage write failed; changes won't survive a refresh. */
    persistence: "ok" | "memory-only";
    persistenceError: string | null;
    notice: LoadNotice;
  };
  setPersona: (persona: Persona | null) => void;
  setLastRoute: (role: Persona, route: string) => void;
  setMapMode: (mode: MapMode) => void;
  clearNotice: () => void;
  /** Replaces everything with the Known Starting State (§9.4, §18.1). */
  resetDemo: () => void;

  /* Tenant write paths (Phase 3). Each returns a typed result; success means the record is in
     the store AND, when browser storage exists, was actually written (AC-26). */
  toggleSaved: (propertyId: string) => ToggleSavedResult | StorageFailure;
  createVisitRequest: (input: Omit<VisitInput, "tenantId">) => CreateVisitResult | StorageFailure;
  cancelVisitRequest: (requestId: string, reason?: string) => CancelResult | StorageFailure;
  saveTenantProfile: (values: { name: string; phone: string }) => ProfileResult | StorageFailure;
  clearTenantProfile: () => { ok: true } | StorageFailure;
  /** In-app "Updated" indicator bookkeeping; a failed write is harmless and silent. */
  markRequestSeen: (requestId: string) => void;

  /* Owner write paths (Phase 4/5) — same atomic, storage-first contract. */
  publishProperty: (form: ListingForm) => PublishResult | StorageFailure;
  updateProperty: (propertyId: string, form: ListingForm) => UpdateResult | StorageFailure;
  setListingStatus: (propertyId: string, to: "published" | "unavailable") => PropertyResult | StorageFailure;
  reconfirmAvailability: (propertyId: string) => PropertyResult | StorageFailure;
  attachSampleDocument: (propertyId: string, category: "identity" | "authority") => PropertyResult | StorageFailure;
  saveOwnerProfile: (values: { name: string; phone: string }) => OwnerProfileResult | StorageFailure;
  ownerTransitionRequest: (requestId: string, to: RequestStatus, payload?: TransitionPayload) => OwnerRequestResult | StorageFailure;
  recordRentPaid: (rentId: string) => RentResult | StorageFailure;
  createMaintenanceRequest: (input: Omit<MaintenanceInput, "tenantId">) => CreateMaintenanceResult | StorageFailure;
  updateMaintenanceStatus: (requestId: string, to: MaintenanceStatus, note?: string) => UpdateMaintenanceResult | StorageFailure;
  /** Working copy of the Add Property wizard (persisted so a refresh does not lose it). */
  setWizardDraft: (draft: { step: number; form: ListingForm } | null) => void;
  setOwnerIntroSeen: () => void;
}

export type StorageFailure = { ok: false; code: "storage"; message: string };
export const STORAGE_FAILURE_MESSAGE = "Couldn't save your change. Browser storage is full or blocked, so nothing was changed.";

export interface StoreOptions {
  storage: StorageLike | null;
  clock?: Clock;
  /** Listens for cross-tab `storage` events when provided (best effort, last write wins). */
  win?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
}

export type AppStore = StoreApi<AppState>;

export function createAppStore({ storage, clock = systemClock, win = null }: StoreOptions): AppStore {
  const loaded = loadState(storage, clock());
  let suppressSave = false;

  const store = createStore<AppState>()((set, get) => ({
    data: loaded.data,
    ui: loaded.ui,
    meta: { persistence: storage ? "ok" : "memory-only", persistenceError: storage ? null : "Browser storage is unavailable.", notice: loaded.notice },
    setPersona: (persona) => set((s) => ({ ui: { ...s.ui, persona } })),
    setLastRoute: (role, route) =>
      set((s) =>
        s.ui.lastRoute[role] === route ? s : { ui: { ...s.ui, lastRoute: { ...s.ui.lastRoute, [role]: route } } },
      ),
    setMapMode: (mapMode) => set((s) => ({ ui: { ...s.ui, mapMode } })),
    clearNotice: () => set((s) => ({ meta: { ...s.meta, notice: null } })),
    resetDemo: () => {
      // A reset always returns to real time and a real-time seed (founder D6).
      clearClockOverride();
      const fresh = freshState(clock());
      set((s) => ({ data: fresh.data, ui: fresh.ui, meta: { ...s.meta, notice: null } }));
    },

    toggleSaved: (propertyId) => {
      const r = toggleSavedProperty(get().data, DEMO_TENANT_ID, propertyId, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    createVisitRequest: (input) => {
      const r = createVisitRequest(get().data, { ...input, tenantId: DEMO_TENANT_ID }, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    cancelVisitRequest: (requestId, reason = "") => {
      const r = cancelVisitRequest(get().data, DEMO_TENANT_ID, requestId, reason, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    saveTenantProfile: (values) => {
      const r = saveTenantProfile(get().data, DEMO_TENANT_ID, values);
      return r.ok ? commit(r.data, r) : r;
    },
    clearTenantProfile: () => commit(clearTenantProfile(get().data, DEMO_TENANT_ID), { ok: true as const }),
    markRequestSeen: (requestId) => {
      const next = markRequestSeen(get().data, DEMO_TENANT_ID, requestId);
      if (next !== get().data) commit(next, { ok: true as const });
    },

    publishProperty: (form) => {
      const r = publishProperty(get().data, DEMO_OWNER_ID, form, clock());
      if (!r.ok) return r;
      const done = commit(r.data, r);
      if (done.ok) set((s) => ({ ui: { ...s.ui, wizardDraft: null } }));
      return done;
    },
    updateProperty: (id, form) => {
      const r = updateProperty(get().data, DEMO_OWNER_ID, id, form, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    setListingStatus: (id, to) => {
      const r = setListingStatus(get().data, DEMO_OWNER_ID, id, to, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    reconfirmAvailability: (id) => {
      const r = reconfirmAvailability(get().data, DEMO_OWNER_ID, id, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    attachSampleDocument: (id, category) => {
      const r = attachSampleDocument(get().data, DEMO_OWNER_ID, id, category, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    saveOwnerProfile: (values) => {
      const r = saveOwnerProfile(get().data, DEMO_OWNER_ID, values);
      return r.ok ? commit(r.data, r) : r;
    },
    ownerTransitionRequest: (requestId, to, payload = {}) => {
      const r = ownerTransitionRequest(get().data, DEMO_OWNER_ID, requestId, to, payload, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    recordRentPaid: (rentId) => {
      const r = recordRentPaid(get().data, DEMO_OWNER_ID, rentId, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    createMaintenanceRequest: (input) => {
      const r = createMaintenanceRequest(get().data, { ...input, tenantId: DEMO_TENANT_ID }, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    updateMaintenanceStatus: (requestId, to, note = "") => {
      const r = updateMaintenanceStatus(get().data, DEMO_OWNER_ID, requestId, to, note, clock());
      return r.ok ? commit(r.data, r) : r;
    },
    setWizardDraft: (draft) => set((s) => ({ ui: { ...s.ui, wizardDraft: draft } })),
    setOwnerIntroSeen: () => set((s) => (s.ui.ownerIntroSeen ? s : { ui: { ...s.ui, ownerIntroSeen: true } })),
  }));

  /**
   * Writes a new data state. When browser storage exists the write is attempted FIRST: if it
   * fails, nothing changes and a failure is returned, so no caller can show a success message for
   * a change that did not stick (AC-26). Without any storage the app runs in memory (banner shown).
   */
  function commit<R extends { ok: true }>(next: DataState, result: R): R | StorageFailure {
    if (storage) {
      const saved = saveState(storage, next, store.getState().ui);
      if (!saved.ok) return { ok: false, code: "storage", message: STORAGE_FAILURE_MESSAGE };
    }
    suppressSave = true;
    try {
      store.setState((s) => ({ data: next, meta: storage ? { ...s.meta, persistence: "ok", persistenceError: null } : s.meta }));
    } finally {
      suppressSave = false;
    }
    return result;
  }

  // Persist after every mutation of data/ui (synchronous; failures surface in `meta`).
  // Write the initial state too, so a first visit is immediately persisted.
  const persist = (state: AppState) => {
    const result = saveState(storage, state.data, state.ui);
    if (!result.ok) {
      if (state.meta.persistence !== "memory-only" || state.meta.persistenceError !== result.error) {
        store.setState((s) => ({ meta: { ...s.meta, persistence: "memory-only", persistenceError: result.error } }));
      }
    } else if (state.meta.persistence !== "ok") {
      store.setState((s) => ({ meta: { ...s.meta, persistence: "ok", persistenceError: null } }));
    }
  };

  store.subscribe((state, prev) => {
    if (suppressSave) return;
    if (state.data !== prev.data || state.ui !== prev.ui) persist(state);
  });
  if (storage) persist(store.getState());

  if (win && storage) {
    win.addEventListener("storage", (event: Event) => {
      const e = event as StorageEvent;
      if (e.key !== STORAGE_KEY || e.newValue === null) return;
      const parsed = parsePersisted(e.newValue);
      if (typeof parsed === "string") return;
      suppressSave = true;
      try {
        store.setState((s) => ({ data: parsed.data, ui: { ...parsed.ui, presenterMode: s.ui.presenterMode, presenterNowOverride: s.ui.presenterNowOverride } }));
      } finally {
        suppressSave = false;
      }
    });
  }

  return store;
}

/** Application singleton, bound to the browser's localStorage when available. */
export const appStore: AppStore = createAppStore({
  storage: getBrowserStorage(),
  win: typeof window !== "undefined" ? window : null,
});

export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useStore(appStore, selector);
}
