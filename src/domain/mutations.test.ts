import { describe, expect, it } from "vitest";
import { buildSeed } from "../data/seed";
import { addDays, toISODate } from "./dates";
import {
  cancelVisitRequest,
  clearTenantProfile,
  createVisitRequest,
  filterRequests,
  findOpenRequest,
  getOwnerVisiblePhone,
  saveTenantProfile,
  selectSavedProperties,
  selectTenantRequests,
  selectUpcomingVisits,
  toggleSavedProperty,
  type VisitInput,
} from "./mutations";
import { transitionRequest } from "./requests";
import { DEMO_TENANT_ID, type DataState } from "./types";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const seed = (): DataState => buildSeed(NOW);
const tomorrow = toISODate(addDays(NOW, 1));

const input = (over: Partial<VisitInput> = {}): VisitInput => ({
  tenantId: DEMO_TENANT_ID,
  propertyId: "prop_fx_01",
  name: "Asha Verma",
  phone: "+91 98765 43210",
  date: tomorrow,
  slot: "afternoon",
  message: "Is parking included?",
  sharePhoneWithOwner: false,
  ...over,
});

function mustCreate(data: DataState, over: Partial<VisitInput> = {}) {
  const r = createVisitRequest(data, input(over), NOW);
  if (!r.ok) throw new Error(`expected success, got ${r.code}: ${r.message}`);
  return r;
}

describe("createVisitRequest (AC-14, AC-25)", () => {
  it("creates a Pending request with a unique NIV-VR id, snapshot, history and owner scoping", () => {
    const before = seed();
    const r = mustCreate(before);
    const q = r.request;
    expect(q.displayCode).toBe("NIV-VR-1007");
    expect(q.id).toBe("req_u_1007");
    expect(q.status).toBe("pending");
    expect(q.source).toBe("user");
    expect(q.tenantId).toBe(DEMO_TENANT_ID);
    expect(q.propertyId).toBe("prop_fx_01");
    expect(q.ownerId).toBe("owner_demo"); // so the Owner's request list will include it
    expect(q.tenantNameEntered).toBe("Asha Verma");
    expect(q.tenantPhoneEntered).toBe("9876543210"); // normalised to 10 digits
    expect(q.preferredDate).toBe(tomorrow);
    expect(q.preferredSlot).toBe("afternoon");
    expect(q.message).toBe("Is parking included?");
    expect(q.scheduledFor).toBeNull();
    expect(q.statusHistory).toEqual([{ status: "pending", at: NOW.toISOString(), by: "tenant" }]);
    expect(q.propertySnapshot).toMatchObject({ title: "Sunlit 2 BHK, Malviya Nagar", locality: "malviya_nagar", rent: 22000 });
    expect(r.data.visitRequests).toHaveLength(7);
    expect(r.data.visitRequests[0]).toBe(q);
    expect(r.data.counters.request).toBe(1008);
    expect(before.visitRequests).toHaveLength(6); // input state is not mutated
  });

  it("numbers requests sequentially and keeps ids unique", () => {
    const first = mustCreate(seed());
    const second = mustCreate(first.data, { propertyId: "prop_fx_02" });
    expect(second.request.displayCode).toBe("NIV-VR-1008");
    expect(new Set(second.data.visitRequests.map((x) => x.id)).size).toBe(8);
  });

  it("stores the phone-sharing consent as given and defaults it to false (founder D7)", () => {
    expect(mustCreate(seed()).request.sharePhoneWithOwner).toBe(false);
    expect(mustCreate(seed(), { sharePhoneWithOwner: true }).request.sharePhoneWithOwner).toBe(true);
  });

  it("remembers the name and phone on the tenant profile for prefilling", () => {
    const profile = mustCreate(seed()).data.tenants.find((t) => t.id === DEMO_TENANT_ID);
    expect(profile).toMatchObject({ name: "Asha Verma", phone: "9876543210" });
  });

  it("trims an empty message to null", () => {
    expect(mustCreate(seed(), { message: "   " }).request.message).toBeNull();
  });

  it("rejects invalid fields with the exact copy, per field, and creates nothing", () => {
    const data = seed();
    const r = createVisitRequest(data, input({ name: "", phone: "", date: "", slot: "", message: "x".repeat(301) }), NOW);
    expect(r.ok).toBe(false);
    if (!r.ok && r.code === "invalid") {
      expect(r.errors).toEqual({
        name: "Enter your full name (2–60 letters).",
        phone: "Enter a valid 10-digit Indian mobile number.",
        date: "Choose a date within the next 30 days.",
        slot: "Choose a time slot.",
        message: "Message is too long (max 300).",
      });
    } else throw new Error("expected invalid");
    expect(data.visitRequests).toHaveLength(6);
  });

  it.each([
    ["1234567890", false],
    ["98765", false],
    ["+91 98765 43210", true],
    ["9876543210", true],
  ])("phone %s valid=%s", (phone, valid) => {
    expect(createVisitRequest(seed(), input({ phone }), NOW).ok).toBe(valid);
  });

  it("rejects past dates and dates beyond 30 days", () => {
    expect(createVisitRequest(seed(), input({ date: toISODate(addDays(NOW, -1)) }), NOW).ok).toBe(false);
    expect(createVisitRequest(seed(), input({ date: toISODate(addDays(NOW, 31)) }), NOW).ok).toBe(false);
    expect(createVisitRequest(seed(), input({ date: toISODate(NOW) }), NOW).ok).toBe(true);
  });

  it("refuses an unavailable home (re-read at submit time) and creates no record", () => {
    const data = seed();
    const r = createVisitRequest(data, input({ propertyId: "prop_fx_10" }), NOW);
    expect(r).toMatchObject({ ok: false, code: "not_available", message: "This home is no longer available, so a visit can't be requested." });
    // and a home that becomes unavailable between opening the form and submitting
    const flipped: DataState = { ...data, properties: data.properties.map((p) => (p.id === "prop_fx_01" ? { ...p, listingStatus: "unavailable" as const } : p)) };
    expect(createVisitRequest(flipped, input(), NOW)).toMatchObject({ ok: false, code: "not_available" });
    expect(flipped.visitRequests).toHaveLength(6);
  });

  it("treats draft, pending-review and unknown homes as not found", () => {
    for (const id of ["prop_fx_11", "prop_fx_12", "nope"]) {
      expect(createVisitRequest(seed(), input({ propertyId: id }), NOW)).toMatchObject({ ok: false, code: "not_found" });
    }
  });

  it("refuses a second open request for the same home and points to the existing one", () => {
    const first = mustCreate(seed());
    const second = createVisitRequest(first.data, input(), NOW);
    expect(second.ok).toBe(false);
    if (!second.ok && second.code === "duplicate") {
      expect(second.message).toBe("You already have an open request (NIV-VR-1007) for this home.");
      expect(second.existing.id).toBe(first.request.id);
    } else throw new Error("expected duplicate");
    expect(first.data.visitRequests).toHaveLength(7);
    expect(findOpenRequest(first.data, DEMO_TENANT_ID, "prop_fx_01")?.id).toBe(first.request.id);
  });

  it("allows a new request once the earlier one is closed", () => {
    const first = mustCreate(seed());
    const cancelled = cancelVisitRequest(first.data, DEMO_TENANT_ID, first.request.id, "", NOW);
    if (!cancelled.ok) throw new Error("cancel failed");
    expect(findOpenRequest(cancelled.data, DEMO_TENANT_ID, "prop_fx_01")).toBeNull();
    expect(createVisitRequest(cancelled.data, input(), NOW).ok).toBe(true);
  });

  it("other tenants' open requests do not block this tenant", () => {
    // fixture request 1001 is Pending on prop_fx_01 from a different (fictional) tenant
    expect(createVisitRequest(seed(), input(), NOW).ok).toBe(true);
  });
});

describe("phone privacy (founder D7)", () => {
  it("owner screens get a phone number only with explicit consent", () => {
    const no = mustCreate(seed(), { sharePhoneWithOwner: false }).request;
    const yes = mustCreate(seed(), { sharePhoneWithOwner: true }).request;
    expect(getOwnerVisiblePhone(no)).toBeNull();
    expect(getOwnerVisiblePhone(yes)).toBe("9876543210");
  });

  it("fixture data contains no phone numbers at all and no consent", () => {
    const data = seed();
    for (const r of data.visitRequests) {
      expect(r.tenantPhoneEntered).toBeNull();
      expect(r.sharePhoneWithOwner).toBe(false);
      expect(getOwnerVisiblePhone(r)).toBeNull();
    }
    for (const t of data.tenants) expect(t.phone).toBeNull();
    for (const o of data.owners) expect(o.phone).toBeNull();
  });
});

describe("cancelVisitRequest (AC-23, tenant side)", () => {
  it("cancels an open request: status, who, reason and history; input untouched", () => {
    const created = mustCreate(seed());
    const later = new Date(NOW.getTime() + 60_000);
    const r = cancelVisitRequest(created.data, DEMO_TENANT_ID, created.request.id, "Plans changed", later);
    if (!r.ok) throw new Error("expected ok");
    expect(r.request).toMatchObject({ status: "cancelled", cancelledBy: "tenant", cancelReason: "Plans changed", updatedAt: later.toISOString() });
    expect(r.request.statusHistory.map((h) => h.status)).toEqual(["pending", "cancelled"]);
    expect(created.request.status).toBe("pending");
  });

  it("a second cancel is refused with the 'already' message and writes nothing", () => {
    const created = mustCreate(seed());
    const once = cancelVisitRequest(created.data, DEMO_TENANT_ID, created.request.id, "", NOW);
    if (!once.ok) throw new Error("expected ok");
    const twice = cancelVisitRequest(once.data, DEMO_TENANT_ID, created.request.id, "", NOW);
    expect(twice).toMatchObject({ ok: false, code: "invalid_transition", message: "This request is already Cancelled. The list has been refreshed." });
  });

  it("uses the latest stored status: a request the owner has completed can no longer be cancelled", () => {
    const created = mustCreate(seed());
    const scheduled = transitionRequest(created.request, "scheduled", "owner", NOW, { scheduledFor: { date: tomorrow, slot: "morning" } });
    if (!scheduled.ok) throw new Error("schedule failed");
    const completed = transitionRequest(scheduled.request, "completed", "owner", NOW);
    if (!completed.ok) throw new Error("complete failed");
    const data: DataState = { ...created.data, visitRequests: created.data.visitRequests.map((x) => (x.id === completed.request.id ? completed.request : x)) };
    expect(cancelVisitRequest(data, DEMO_TENANT_ID, created.request.id, "", NOW)).toMatchObject({ ok: false, code: "invalid_transition", message: "This request is already Visit Completed. The list has been refreshed." });
  });

  it("cannot cancel another tenant's request or an unknown one", () => {
    expect(cancelVisitRequest(seed(), DEMO_TENANT_ID, "req_fx_1001", "", NOW)).toMatchObject({ ok: false, code: "not_found" });
    expect(cancelVisitRequest(seed(), DEMO_TENANT_ID, "nope", "", NOW)).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("toggleSavedProperty (AC-16)", () => {
  it("saves then unsaves, one record per pair, newest first", () => {
    const a = toggleSavedProperty(seed(), DEMO_TENANT_ID, "prop_fx_04", NOW);
    if (!a.ok) throw new Error("expected ok");
    expect(a.saved).toBe(true);
    expect(a.data.savedProperties).toEqual([{ id: "sp_tenant_demo_prop_fx_04", tenantId: DEMO_TENANT_ID, propertyId: "prop_fx_04", savedAt: NOW.toISOString() }]);
    const later = new Date(NOW.getTime() + 1000);
    const b = toggleSavedProperty(a.data, DEMO_TENANT_ID, "prop_fx_02", later);
    if (!b.ok) throw new Error("expected ok");
    expect(selectSavedProperties(b.data, DEMO_TENANT_ID).map((x) => x.property.id)).toEqual(["prop_fx_02", "prop_fx_04"]);
    const c = toggleSavedProperty(b.data, DEMO_TENANT_ID, "prop_fx_04", later);
    if (!c.ok) throw new Error("expected ok");
    expect(c.saved).toBe(false);
    expect(c.data.savedProperties.map((s) => s.propertyId)).toEqual(["prop_fx_02"]);
  });

  it("can save an unavailable home, and it stays listed; cannot save hidden homes", () => {
    const r = toggleSavedProperty(seed(), DEMO_TENANT_ID, "prop_fx_10", NOW);
    expect(r.ok).toBe(true);
    for (const id of ["prop_fx_11", "prop_fx_12", "nope"]) {
      expect(toggleSavedProperty(seed(), DEMO_TENANT_ID, id, NOW)).toMatchObject({ ok: false, code: "not_found" });
    }
  });

  it("a saved home that later becomes unavailable is still returned, with its new status", () => {
    const saved = toggleSavedProperty(seed(), DEMO_TENANT_ID, "prop_fx_04", NOW);
    if (!saved.ok) throw new Error("expected ok");
    const data: DataState = { ...saved.data, properties: saved.data.properties.map((p) => (p.id === "prop_fx_04" ? { ...p, listingStatus: "unavailable" as const } : p)) };
    expect(selectSavedProperties(data, DEMO_TENANT_ID)[0]?.property.listingStatus).toBe("unavailable");
  });

  it("an unsave still works if the home was hidden meanwhile", () => {
    const saved = toggleSavedProperty(seed(), DEMO_TENANT_ID, "prop_fx_04", NOW);
    if (!saved.ok) throw new Error("expected ok");
    const hidden: DataState = { ...saved.data, properties: saved.data.properties.map((p) => (p.id === "prop_fx_04" ? { ...p, listingStatus: "draft" as const } : p)) };
    const r = toggleSavedProperty(hidden, DEMO_TENANT_ID, "prop_fx_04", NOW);
    expect(r).toMatchObject({ ok: true, saved: false });
  });
});

describe("tenant selectors", () => {
  it("only the demo tenant's own requests are returned (fixtures belong to other tenants)", () => {
    expect(selectTenantRequests(seed(), DEMO_TENANT_ID)).toEqual([]);
    const created = mustCreate(seed());
    expect(selectTenantRequests(created.data, DEMO_TENANT_ID).map((r) => r.id)).toEqual([created.request.id]);
  });

  it("filters open / scheduled / closed and finds upcoming visits by confirmed date", () => {
    const a = mustCreate(seed());
    const b = mustCreate(a.data, { propertyId: "prop_fx_02" });
    const c = mustCreate(b.data, { propertyId: "prop_fx_03" });
    const sched = transitionRequest(b.request, "scheduled", "owner", NOW, { scheduledFor: { date: toISODate(addDays(NOW, 2)), slot: "morning" } });
    const canc = transitionRequest(c.request, "cancelled", "tenant", NOW);
    if (!sched.ok || !canc.ok) throw new Error("transition failed");
    const data: DataState = { ...c.data, visitRequests: c.data.visitRequests.map((r) => (r.id === sched.request.id ? sched.request : r.id === canc.request.id ? canc.request : r)) };
    const mine = selectTenantRequests(data, DEMO_TENANT_ID);
    expect(filterRequests(mine, "all")).toHaveLength(3);
    expect(filterRequests(mine, "open").map((r) => r.status).sort()).toEqual(["pending", "scheduled"]);
    expect(filterRequests(mine, "scheduled").map((r) => r.id)).toEqual([sched.request.id]);
    expect(filterRequests(mine, "closed").map((r) => r.status)).toEqual(["cancelled"]);
    expect(selectUpcomingVisits(data, DEMO_TENANT_ID, NOW).map((r) => r.id)).toEqual([sched.request.id]);
    expect(selectUpcomingVisits(data, DEMO_TENANT_ID, addDays(NOW, 5))).toEqual([]); // date has passed
    void a;
  });
});

describe("tenant profile", () => {
  it("accepts empty details, rejects invalid ones, and clears", () => {
    const empty = saveTenantProfile(seed(), DEMO_TENANT_ID, { name: "", phone: "" });
    expect(empty.ok).toBe(true);
    expect(saveTenantProfile(seed(), DEMO_TENANT_ID, { name: "A1", phone: "123" })).toEqual({
      ok: false,
      errors: { name: "Enter your full name (2–60 letters).", phone: "Enter a valid 10-digit Indian mobile number." },
    });
    const saved = saveTenantProfile(seed(), DEMO_TENANT_ID, { name: "Asha Verma", phone: "98765 43210" });
    if (!saved.ok) throw new Error("expected ok");
    expect(saved.data.tenants.find((t) => t.id === DEMO_TENANT_ID)).toMatchObject({ name: "Asha Verma", phone: "9876543210" });
    expect(clearTenantProfile(saved.data, DEMO_TENANT_ID).tenants.find((t) => t.id === DEMO_TENANT_ID)).toMatchObject({ name: null, phone: null });
  });
});
