import { describe, expect, it } from "vitest";
import { buildSeed } from "../data/seed";
import type { Property } from "../domain/types";
import { STORAGE_KEY, SCHEMA_VERSION, loadState, parsePersisted, saveState, type StorageLike } from "./persistence";
import { addDays, toISODate } from "../domain/dates";
import { createAppStore, STORAGE_FAILURE_MESSAGE } from "./store";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const clock = () => NOW;

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  sets = 0;
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.sets++;
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const userProperty = (): Property => {
  const base = buildSeed(NOW).properties[0]!;
  return { ...base, id: "prop_u_001", displayCode: "NIV-DEMO-P017", title: "User listing", source: "user" };
};

describe("persistence mechanics (AC-19)", () => {
  it("writes the Known Starting State on first load", () => {
    const storage = new MemoryStorage();
    createAppStore({ storage, clock });
    const raw = storage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = parsePersisted(raw!);
    expect(typeof parsed).toBe("object");
  });

  it("round-trips: state saved by one store is restored by the next (simulated refresh)", () => {
    const storage = new MemoryStorage();
    const a = createAppStore({ storage, clock });
    a.getState().setPersona("owner");
    a.getState().setLastRoute("owner", "/owner/properties");
    a.setState((s) => ({ data: { ...s.data, properties: [...s.data.properties, userProperty()] } }));

    const b = createAppStore({ storage, clock });
    expect(b.getState().ui.persona).toBe("owner");
    expect(b.getState().ui.lastRoute.owner).toBe("/owner/properties");
    expect(b.getState().data.properties.some((p) => p.id === "prop_u_001")).toBe(true);
    expect(b.getState().data.properties).toHaveLength(17);
  });

  it("never persists the session-scoped Presenter Mode flag", () => {
    const storage = new MemoryStorage();
    const a = createAppStore({ storage, clock });
    a.setState((s) => ({ ui: { ...s.ui, presenterMode: true } }));
    const raw = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect("presenterMode" in raw.ui).toBe(false);
    expect(createAppStore({ storage, clock }).getState().ui.presenterMode).toBe(false);
  });

  it("re-seeds with a notice when the saved JSON is unreadable", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    const loaded = loadState(storage, NOW);
    expect(loaded.notice).toBe("reset_corrupt");
    expect(loaded.data.properties).toHaveLength(16);
  });

  it("re-seeds with a notice on a schema or seed version mismatch", () => {
    const storage = new MemoryStorage();
    const seedData = buildSeed(NOW);
    saveState(storage, seedData, { persona: null, lastRoute: { tenant: null, owner: null }, mapMode: "auto", ownerIntroSeen: false, wizardDraft: null, presenterMode: false, presenterNowOverride: null });
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, schemaVersion: SCHEMA_VERSION + 1 }));
    expect(loadState(storage, NOW).notice).toBe("reset_version");
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, seedVersion: 999 }));
    expect(loadState(storage, NOW).notice).toBe("reset_version");
  });

  it("treats structurally invalid saved data as corrupt", () => {
    const storage = new MemoryStorage();
    const seedData = buildSeed(NOW);
    saveState(storage, seedData, { persona: null, lastRoute: { tenant: null, owner: null }, mapMode: "auto", ownerIntroSeen: false, wizardDraft: null, presenterMode: false, presenterNowOverride: null });
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    delete saved.data.properties;
    storage.setItem(STORAGE_KEY, JSON.stringify(saved));
    expect(loadState(storage, NOW).notice).toBe("reset_corrupt");
  });

  it("falls back to memory-only, visibly, when writing fails (never silent)", () => {
    const storage = new MemoryStorage();
    const failing: StorageLike = {
      getItem: (k) => storage.getItem(k),
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
      removeItem: (k) => storage.removeItem(k),
    };
    const store = createAppStore({ storage: failing, clock });
    expect(store.getState().meta.persistence).toBe("memory-only");
    expect(store.getState().meta.persistenceError).toMatch(/quota/i);
    store.getState().setPersona("tenant");
    expect(store.getState().ui.persona).toBe("tenant"); // still works in memory
  });

  it("runs in memory-only mode when no storage is available", () => {
    const store = createAppStore({ storage: null, clock });
    expect(store.getState().meta.persistence).toBe("memory-only");
    expect(store.getState().data.properties).toHaveLength(16);
  });

  it("converges across tabs via storage events without writing back", () => {
    const storage = new MemoryStorage();
    const listeners: ((e: Event) => void)[] = [];
    const win = {
      addEventListener: (_t: string, fn: EventListenerOrEventListenerObject) => listeners.push(fn as (e: Event) => void),
      removeEventListener: () => {},
    };
    const tabA = createAppStore({ storage, clock, win });
    // Another tab writes a new state
    const other = createAppStore({ storage: new MemoryStorage(), clock });
    other.getState().setPersona("owner");
    other.setState((s) => ({ data: { ...s.data, properties: [...s.data.properties, userProperty()] } }));
    const incoming = JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      seedVersion: JSON.parse(storage.getItem(STORAGE_KEY)!).seedVersion,
      data: other.getState().data,
      ui: (({ presenterMode: _p, ...rest }) => (void _p, rest))(other.getState().ui),
    });
    const writesBefore = storage.sets;
    listeners.forEach((fn) => fn({ key: STORAGE_KEY, newValue: incoming } as unknown as StorageEvent));
    expect(tabA.getState().data.properties).toHaveLength(17);
    expect(tabA.getState().ui.persona).toBe("owner");
    expect(storage.sets).toBe(writesBefore);
    // Unrelated keys and deletions are ignored
    listeners.forEach((fn) => fn({ key: "other", newValue: "x" } as unknown as StorageEvent));
    listeners.forEach((fn) => fn({ key: STORAGE_KEY, newValue: null } as unknown as StorageEvent));
    expect(tabA.getState().data.properties).toHaveLength(17);
  });
});

describe("resetDemo (AC-20)", () => {
  it("removes user-created records and restores the seed exactly, and persists that", () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, clock });
    store.getState().setPersona("tenant");
    store.getState().setLastRoute("tenant", "/tenant/search?x=1");
    store.setState((s) => ({
      data: {
        ...s.data,
        properties: [...s.data.properties, userProperty()],
        counters: { ...s.data.counters, request: 1010 },
        savedProperties: [{ id: "sp1", tenantId: "tenant_demo", propertyId: "prop_fx_04", savedAt: NOW.toISOString() }],
      },
    }));
    expect(store.getState().data.properties).toHaveLength(17);

    store.getState().resetDemo();

    expect(store.getState().data).toEqual(buildSeed(NOW));
    expect(store.getState().ui.persona).toBeNull();
    expect(store.getState().ui.lastRoute).toEqual({ tenant: null, owner: null });
    expect(store.getState().data.properties.every((p) => p.source === "fixture")).toBe(true);
    // And the saved copy matches
    const reloaded = createAppStore({ storage, clock });
    expect(reloaded.getState().data).toEqual(buildSeed(NOW));
    expect(reloaded.getState().ui.persona).toBeNull();
  });

  it("clears Presenter log and wizard draft as part of the reset", () => {
    const store = createAppStore({ storage: new MemoryStorage(), clock });
    store.setState((s) => ({
      data: { ...s.data, presenter: { simulationLog: [{ id: "l1", target: "x", field: "status", from: "a", to: "b", at: NOW.toISOString(), snapshot: null }] } },
      ui: { ...s.ui, wizardDraft: { step: 3 } },
    }));
    store.getState().resetDemo();
    expect(store.getState().data.presenter.simulationLog).toEqual([]);
    expect(store.getState().ui.wizardDraft).toBeNull();
  });
});

describe("tenant actions in the shared store (AC-14, AC-16, AC-26)", () => {
  const tomorrow = toISODate(addDays(NOW, 1));
  const form = { propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false };

  it("a created request is in the store, persisted, and survives a simulated refresh", () => {
    const storage = new MemoryStorage();
    const a = createAppStore({ storage, clock });
    const r = a.getState().createVisitRequest(form);
    expect(r.ok).toBe(true);
    const b = createAppStore({ storage, clock });
    const mine = b.getState().data.visitRequests.filter((x) => x.tenantId === "tenant_demo");
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ displayCode: "NIV-VR-1007", status: "pending", propertyId: "prop_fx_01", ownerId: "owner_demo" });
    expect(b.getState().data.counters.request).toBe(1008);
    expect(b.getState().data.tenants.find((t) => t.id === "tenant_demo")?.name).toBe("Asha Verma");
  });

  it("saves and persists saved homes", () => {
    const storage = new MemoryStorage();
    const a = createAppStore({ storage, clock });
    expect(a.getState().toggleSaved("prop_fx_04")).toMatchObject({ ok: true, saved: true });
    expect(createAppStore({ storage, clock }).getState().data.savedProperties.map((s) => s.propertyId)).toEqual(["prop_fx_04"]);
    expect(a.getState().toggleSaved("prop_fx_04")).toMatchObject({ ok: true, saved: false });
    expect(createAppStore({ storage, clock }).getState().data.savedProperties).toEqual([]);
  });

  it("when the storage write fails, nothing changes and failure is returned — never success (AC-26)", () => {
    const storage = new MemoryStorage();
    const store = createAppStore({ storage, clock });
    const before = store.getState().data;
    storage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
    const created = store.getState().createVisitRequest(form);
    expect(created).toEqual({ ok: false, code: "storage", message: STORAGE_FAILURE_MESSAGE });
    expect(store.getState().data).toBe(before);
    expect(store.getState().toggleSaved("prop_fx_04")).toMatchObject({ ok: false, code: "storage" });
    expect(store.getState().saveTenantProfile({ name: "Asha Verma", phone: "" })).toMatchObject({ ok: false, code: "storage" });
    expect(store.getState().data).toBe(before);
    expect(store.getState().data.visitRequests.filter((r) => r.source === "user")).toEqual([]);
  });

  it("without any browser storage the actions still work in memory (banner is shown elsewhere)", () => {
    const store = createAppStore({ storage: null, clock });
    expect(store.getState().createVisitRequest(form).ok).toBe(true);
    expect(store.getState().meta.persistence).toBe("memory-only");
  });

  it("cancelling goes through the transition rules against the latest stored status", () => {
    const store = createAppStore({ storage: new MemoryStorage(), clock });
    const created = store.getState().createVisitRequest(form);
    if (!created.ok || !("request" in created)) throw new Error("create failed");
    const id = created.request.id;
    expect(store.getState().cancelVisitRequest(id, "Plans changed")).toMatchObject({ ok: true });
    expect(store.getState().data.visitRequests.find((r) => r.id === id)?.status).toBe("cancelled");
    expect(store.getState().cancelVisitRequest(id)).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("resetDemo removes created requests, saves and the profile", () => {
    const store = createAppStore({ storage: new MemoryStorage(), clock });
    store.getState().createVisitRequest(form);
    store.getState().toggleSaved("prop_fx_04");
    store.getState().resetDemo();
    expect(store.getState().data).toEqual(buildSeed(NOW));
    expect(store.getState().data.tenants.find((t) => t.id === "tenant_demo")?.name).toBeNull();
  });
});
