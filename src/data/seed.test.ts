import { describe, expect, it } from "vitest";
import { addDays, toISODate } from "../domain/dates";
import { haversineKm } from "../domain/geo";
import { deriveRentStatus } from "../domain/rent";
import { DEMO_OWNER_ID, DEMO_TENANT_ID } from "../domain/types";
import { getEffectiveVerification, verificationSummary } from "../domain/verification";
import { LOCALITIES, SEARCH_ANCHOR_CANDIDATES, evaluateMapGate, getLocality, getTestDestinations, getUsableAnchors, isLocationDataVerified } from "./reference";
import { buildInitialUi, buildSeed } from "./seed";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const seed = buildSeed(NOW);
const prop = (n: number) => {
  const p = seed.properties.find((x) => x.id === `prop_fx_${String(n).padStart(2, "0")}`);
  if (!p) throw new Error(`missing fixture ${n}`);
  return p;
};
const summaryOf = (n: number, now = NOW) => {
  const p = prop(n);
  return verificationSummary(getEffectiveVerification(p, seed.verificationItems, now));
};

describe("buildSeed — Known Starting State (blueprint §13.7, §18.1)", () => {
  it("creates 16 fixture properties, 6 visit requests and 64 verification items", () => {
    expect(seed.properties).toHaveLength(16);
    expect(seed.visitRequests).toHaveLength(6);
    expect(seed.verificationItems).toHaveLength(64);
    expect(new Set(seed.properties.map((p) => p.id)).size).toBe(16);
    expect(new Set(seed.visitRequests.map((r) => r.id)).size).toBe(6);
  });

  it("marks everything as fixture/demo and starts with no saved homes and an empty tenant profile", () => {
    expect(seed.properties.every((p) => p.source === "fixture")).toBe(true);
    expect(seed.visitRequests.every((r) => r.source === "fixture")).toBe(true);
    expect([...seed.owners, ...seed.tenants].every((x) => x.isDemo)).toBe(true);
    expect(seed.savedProperties).toEqual([]);
    const tenant = seed.tenants.find((t) => t.id === DEMO_TENANT_ID);
    expect(tenant).toMatchObject({ name: null, phone: null });
    expect(seed.owners.find((o) => o.id === DEMO_OWNER_ID)).toMatchObject({ displayName: null, phone: null });
  });

  it("starts counters at 1007 for requests (fixtures use 1001–1006) and user properties at 1", () => {
    expect(seed.counters).toEqual({ request: 1007, property: 1, maintenance: 1004 });
    expect(seed.visitRequests.map((r) => r.displayCode)).toEqual([
      "NIV-VR-1001",
      "NIV-VR-1002",
      "NIV-VR-1003",
      "NIV-VR-1004",
      "NIV-VR-1005",
      "NIV-VR-1006",
    ]);
  });

  it("gives the demo owner 7 properties of which 3 are published (Active listings = 3)", () => {
    const mine = seed.properties.filter((p) => p.ownerId === DEMO_OWNER_ID);
    expect(mine.map((p) => p.id.slice(-2)).sort()).toEqual(["01", "02", "05", "11", "12", "15", "16"]);
    expect(mine.filter((p) => p.listingStatus === "published")).toHaveLength(3);
  });

  it("assigns the listed statuses to the special fixtures", () => {
    expect(prop(10).listingStatus).toBe("unavailable");
    expect(prop(11).listingStatus).toBe("pending_review");
    expect(prop(12).listingStatus).toBe("draft");
    expect(prop(15).listingStatus).toBe("unavailable");
    expect(prop(16).listingStatus).toBe("unavailable");
  });

  it("yields 11 searchable 'Available now' homes at the starting state (AC-05 basis)", () => {
    const today = toISODate(NOW);
    const available = seed.properties.filter((p) => p.listingStatus === "published" && p.availableFrom <= today);
    expect(available).toHaveLength(11);
  });

  it("covers the planned range of prices, types and furnishing", () => {
    const rents = seed.properties.map((p) => p.rent);
    expect(Math.min(...rents)).toBe(6500);
    expect(Math.max(...rents)).toBe(75000);
    expect(new Set(seed.properties.map((p) => p.type)).size).toBe(5);
    expect(new Set(seed.properties.map((p) => p.furnishing)).size).toBe(3);
  });

  it("derives the owner dashboard starting figures: New Requests = 1, Scheduled visits = 1", () => {
    const mineIds = new Set(seed.properties.filter((p) => p.ownerId === DEMO_OWNER_ID).map((p) => p.id));
    const mineReqs = seed.visitRequests.filter((r) => mineIds.has(r.propertyId));
    expect(mineReqs.filter((r) => r.status === "pending")).toHaveLength(1);
    const today = toISODate(NOW);
    expect(mineReqs.filter((r) => r.status === "scheduled" && (r.scheduledFor?.date ?? "") >= today)).toHaveLength(1);
    // Request 1006 belongs to another owner and must stay out of the demo owner's scope.
    expect(seed.visitRequests.find((r) => r.displayCode === "NIV-VR-1006")?.ownerId).toBe("owner_fx_b");
  });

  it("builds the six fixture requests in the specified states with consistent history", () => {
    const byCode = Object.fromEntries(seed.visitRequests.map((r) => [r.displayCode, r]));
    expect(byCode["NIV-VR-1001"]?.status).toBe("pending");
    expect(byCode["NIV-VR-1002"]?.status).toBe("contacted");
    expect(byCode["NIV-VR-1003"]?.status).toBe("scheduled");
    expect(byCode["NIV-VR-1003"]?.scheduledFor).toEqual({ date: toISODate(addDays(NOW, 3)), slot: "afternoon" });
    expect(byCode["NIV-VR-1004"]?.status).toBe("completed");
    expect(byCode["NIV-VR-1005"]?.status).toBe("cancelled");
    expect(byCode["NIV-VR-1005"]?.propertyId).toBe("prop_fx_10"); // history kept on an unavailable listing
    for (const r of seed.visitRequests) {
      expect(r.statusHistory[0]?.status).toBe("pending");
      expect(r.statusHistory[r.statusHistory.length - 1]?.status).toBe(r.status);
    }
  });

  it("assigns the planned verification profiles (effective statuses, freshness-aware)", () => {
    expect(summaryOf(1)).toBe("4 of 4 checks verified (demo)");
    expect(summaryOf(4)).toBe("1 of 4 checks verified (demo)"); // only availability confirmed
    expect(summaryOf(8)).toBe("1 of 4 checks verified (demo)");
    expect(summaryOf(12)).toBe("0 of 4 checks verified (demo)");
  });

  it("makes exactly FX-05's availability stale, so it needs re-verification", () => {
    for (const p of seed.properties) {
      const av = getEffectiveVerification(p, seed.verificationItems, NOW).find((e) => e.category === "availability");
      expect(av?.stale ?? false).toBe(p.id === "prop_fx_05");
    }
    const fx5 = getEffectiveVerification(prop(5), seed.verificationItems, NOW);
    expect(fx5.map((e) => e.status)).toEqual(["verified_demo", "not_checked", "pending_review", "needs_reverification"]);
  });

  it("stores seedStatus equal to status and labels all fixture verification as demo-sourced", () => {
    for (const v of seed.verificationItems) {
      expect(v.seedStatus).toBe(v.status);
      expect(v.source).toBe("demo_fixture");
      expect(v.simulatedAt).toBeNull();
    }
    expect(seed.presenter.simulationLog).toEqual([]);
  });

  it("resolves dates against 'now': shifting now shifts the data but keeps relative states", () => {
    const later = addDays(NOW, 90);
    const seedLater = buildSeed(later);
    expect(toISODate(addDays(new Date(`${prop(1).availableFrom}T12:00:00`), 90))).toBe(
      seedLater.properties.find((p) => p.id === "prop_fx_01")?.availableFrom,
    );
    const av = (s: typeof seed, now: Date) =>
      s.properties
        .map((p) => getEffectiveVerification(p, s.verificationItems, now).find((e) => e.category === "availability")?.status)
        .join(",");
    expect(av(seedLater, later)).toBe(av(seed, NOW));
  });

  it("is deterministic for the same 'now'", () => {
    expect(buildSeed(NOW)).toEqual(buildSeed(NOW));
  });

  it("keeps coordinates approximate: within 600 m of the locality centroid, never identical", () => {
    const seen = new Set<string>();
    for (const p of seed.properties) {
      const c = getLocality(p.locality);
      expect(haversineKm(c, p) * 1000).toBeLessThanOrEqual(605);
      expect(p.locationPrecision).toBe("locality_approximate");
      seen.add(`${p.lat},${p.lng}`);
    }
    expect(seen.size).toBe(16);
  });

  it("never names a real institution or landmark in fixture text (D-26)", () => {
    const forbidden = /MNIT|Malaviya National|University|College|Institute|World Trade|JECC|Manipal|Mahindra|IIS\b|Medical|Technology|Rajasthan/i;
    for (const p of seed.properties) {
      for (const text of [p.title, p.description, p.addressArea, p.landmark ?? ""]) {
        expect(text, `${p.id}: ${text}`).not.toMatch(forbidden);
      }
    }
  });

  it("gives each fixture its own image ids (no sharing between listings) and no assets exist yet", () => {
    const all = seed.properties.flatMap((p) => p.photoIds);
    expect(new Set(all).size).toBe(all.length);
    for (const p of seed.properties) expect(p.photoIds.length).toBeGreaterThanOrEqual(1);
    expect(prop(12).photoIds.length).toBeLessThanOrEqual(1); // incomplete draft
  });

  it("seeds the rent preview with one overdue month, one due month and the rest paid", () => {
    const demo = seed.rentRecords.filter((r) => r.tenancyId === "tn_demo");
    const statuses = demo.map((r) => deriveRentStatus(r, NOW));
    expect(statuses.filter((s) => s === "overdue")).toHaveLength(1);
    expect(statuses.filter((s) => s === "due")).toHaveLength(1);
    expect(statuses.filter((s) => s === "paid")).toHaveLength(demo.length - 2);
    const other = seed.rentRecords.filter((r) => r.tenancyId === "tn_fx_2").map((r) => deriveRentStatus(r, NOW));
    expect(other.filter((s) => s === "due")).toHaveLength(1);
    expect(other.filter((s) => s === "overdue")).toHaveLength(0);
  });

  it("seeds three maintenance requests in open / in-progress / resolved states", () => {
    expect(seed.maintenanceRequests.map((m) => m.status)).toEqual(["open", "in_progress", "resolved"]);
  });

  it("starts with Presenter Mode off and no persona", () => {
    expect(buildInitialUi()).toMatchObject({ persona: null, presenterMode: false, mapMode: "auto", ownerIntroSeen: false });
  });
});

describe("location reference data and the verification gate (D-28, founder D2)", () => {
  it("has 11 localities and the candidate anchors, all approximate; only the founder-designated VGU test destination is verified, and the full gate stays unsatisfied", () => {
    expect(LOCALITIES).toHaveLength(11);
    expect(SEARCH_ANCHOR_CANDIDATES.length).toBeGreaterThanOrEqual(7);
    for (const x of [...LOCALITIES, ...SEARCH_ANCHOR_CANDIDATES]) {
      expect(x.precision).toBe("approximate");
      if (x.verification.status === "verified") expect((x as { id: string }).id).toBe("anchor_vgu");
    }
    expect(SEARCH_ANCHOR_CANDIDATES.filter((a) => a.verification.status === "verified")).toHaveLength(1);
    expect(isLocationDataVerified()).toBe(false);
    expect(getUsableAnchors()).toEqual([]);
    expect(getTestDestinations().map((a) => a.id)).toEqual(["anchor_vgu"]);
  });

  it("keeps every checked entry recorded with source, date and notes, and unchecked ones empty", () => {
    const checkedItems = [...LOCALITIES, ...SEARCH_ANCHOR_CANDIDATES].filter((x) => x.verification.status === "unverified");
    expect(checkedItems.length).toBeGreaterThan(0);
    for (const x of checkedItems) {
      expect(x.verification.sources.length).toBeGreaterThan(0);
      expect(x.verification.checkedOn).toBe("2026-10-10");
      expect(x.verification.notes).toBeTruthy();
    }
  });

  it("excludes Manipal University Jaipur and Mahindra World City from the initial anchor set (D2)", () => {
    for (const id of ["anchor_manipal", "anchor_mwc"]) {
      const a = SEARCH_ANCHOR_CANDIDATES.find((x) => x.id === id);
      expect(a?.verification.status).toBe("rejected");
      expect(a?.lat).toBeNull();
    }
  });

  it("does not invent coordinates for anchors that have no source", () => {
    const none = SEARCH_ANCHOR_CANDIDATES.filter((a) => a.coordinateBasis === "none");
    expect(none.length).toBeGreaterThan(0);
    for (const a of none) {
      expect(a.lat).toBeNull();
      expect(a.lng).toBeNull();
    }
  });

  it("reports the gate as not satisfied, with reasons, and offers no usable anchors", () => {
    const gate = evaluateMapGate();
    expect(gate.satisfied).toBe(false);
    expect(gate.reasons.length).toBeGreaterThan(0);
    expect(getUsableAnchors()).toEqual([]);
  });

  it("evaluateMapGate passes only with all localities and enough verified colleges and office areas", () => {
    const ok = { status: "verified" as const, sources: ["s"], checkedOn: "2026-01-01", checkedBy: "x", notes: null };
    const locs = LOCALITIES.map((l) => ({ ...l, verification: ok }));
    const mk = (id: string, category: "college" | "office_area") => ({ id, name: id, officialName: id, category, localityContext: "", lat: 26.9, lng: 75.8, precision: "approximate" as const, coordinateBasis: "osm_feature" as const, verification: ok });
    const good = [mk("a", "college"), mk("b", "college"), mk("c", "college"), mk("d", "office_area"), mk("e", "office_area")];
    expect(evaluateMapGate(locs, good).satisfied).toBe(true);
    expect(evaluateMapGate(locs, good.slice(0, 3)).satisfied).toBe(false);
    expect(evaluateMapGate(locs, [...good.slice(0, 3), mk("d", "college"), mk("e", "college")]).satisfied).toBe(false);
    expect(evaluateMapGate(LOCALITIES, good).satisfied).toBe(false);
  });
});
