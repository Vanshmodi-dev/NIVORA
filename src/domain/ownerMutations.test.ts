import { describe, expect, it } from "vitest";
import { buildSeed } from "../data/seed";
import { addDays, toISODate } from "./dates";
import { EMPTY_LISTING, propertyToForm, validateListingStep, type ListingForm } from "./listing";
import {
  attachSampleDocument,
  ownerTransitionRequest,
  publishProperty,
  reconfirmAvailability,
  saveOwnerProfile,
  selectAttention,
  selectOwnerProperties,
  selectOwnerRequests,
  selectOwnerStats,
  selectRecentActivity,
  setListingStatus,
  updateProperty,
} from "./ownerMutations";
import { createVisitRequest } from "./mutations";
import { selectSearchResults, DEFAULT_FILTERS } from "./search";
import { DEMO_OWNER_ID, DEMO_TENANT_ID, type DataState } from "./types";
import { getEffectiveVerification } from "./verification";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const seed = (): DataState => buildSeed(NOW);
const today = toISODate(NOW);

const valid = (over: Partial<ListingForm> = {}): ListingForm => ({
  ...EMPTY_LISTING,
  type: "apartment",
  title: "Demo Test Flat, Bani Park",
  description: "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.",
  locality: "bani_park",
  addressArea: "Quiet internal road",
  landmark: "",
  rent: "18000",
  deposit: "36000",
  maintenanceIncluded: true,
  availableFrom: today,
  bedrooms: "2",
  bathrooms: "2",
  furnishing: "semi_furnished",
  sizeSqft: "",
  amenities: ["wifi", "lift"],
  photoIds: ["pool-01", "pool-02"],
  contactName: "Demo Owner",
  contactPhone: "9876543210",
  acknowledged: true,
  ...over,
});

function mustPublish(data: DataState, over: Partial<ListingForm> = {}) {
  const r = publishProperty(data, DEMO_OWNER_ID, valid(over), NOW);
  if (!r.ok) throw new Error(`publish failed: ${JSON.stringify(r)}`);
  return r;
}

describe("listing validation per step (AC-28)", () => {
  const ctx = { today: NOW, needContact: true };
  it("step 1: type, title 10–80, description 40–1000, no contact details", () => {
    expect(validateListingStep(1, EMPTY_LISTING, ctx)).toEqual({
      type: "Choose a property type.",
      title: "Enter a title of 10–80 characters.",
      description: "Enter a description of 40–1000 characters.",
    });
    expect(validateListingStep(1, valid(), ctx)).toEqual({});
    expect(validateListingStep(1, valid({ description: "Call me on 98765 43210 for details about this wonderful demo flat please." }), ctx).description).toBe("Please don't include phone numbers or emails in the description.");
    expect(validateListingStep(1, valid({ description: "Write to owner@example.com for details about this wonderful demo flat please." }), ctx).description).toMatch(/phone numbers or emails/);
  });
  it("step 2: locality, address area 5–100, landmark ≤ 80", () => {
    expect(Object.keys(validateListingStep(2, EMPTY_LISTING, ctx)).sort()).toEqual(["addressArea", "locality"]);
    expect(validateListingStep(2, valid({ landmark: "x".repeat(81) }), ctx).landmark).toBe("Landmark must be 80 characters or fewer.");
  });
  it("step 3: rent range, deposit up to 12× rent, date within 180 days", () => {
    expect(validateListingStep(3, valid({ rent: "500" }), ctx).rent).toMatch(/between ₹1,000 and ₹3,00,000/);
    expect(validateListingStep(3, valid({ rent: "300001" }), ctx).rent).toBeDefined();
    expect(validateListingStep(3, valid({ rent: "10000", deposit: "120001" }), ctx).deposit).toBeDefined();
    expect(validateListingStep(3, valid({ rent: "10000", deposit: "120000" }), ctx).deposit).toBeUndefined();
    expect(validateListingStep(3, valid({ availableFrom: toISODate(addDays(NOW, -1)) }), ctx).availableFrom).toBeDefined();
    expect(validateListingStep(3, valid({ availableFrom: toISODate(addDays(NOW, 181)) }), ctx).availableFrom).toBeDefined();
    expect(validateListingStep(3, valid({ availableFrom: toISODate(addDays(NOW, 180)) }), ctx).availableFrom).toBeUndefined();
    expect(validateListingStep(3, valid({ maintenanceIncluded: false, maintenanceCharge: "abc" }), ctx).maintenanceCharge).toBeDefined();
  });
  it("step 4: rooms and bathrooms 1–6, furnishing, optional size 100–10,000", () => {
    expect(Object.keys(validateListingStep(4, EMPTY_LISTING, ctx)).sort()).toEqual(["bathrooms", "bedrooms", "furnishing"]);
    expect(validateListingStep(4, valid({ bedrooms: "7" }), ctx).bedrooms).toBeDefined();
    expect(validateListingStep(4, valid({ sizeSqft: "50" }), ctx).sizeSqft).toBeDefined();
    expect(validateListingStep(4, valid({ sizeSqft: "" }), ctx)).toEqual({});
  });
  it("step 6: at least one and at most six photos", () => {
    expect(validateListingStep(6, valid({ photoIds: [] }), ctx).photoIds).toBe("Choose at least one photo (up to 6).");
    expect(validateListingStep(6, valid({ photoIds: ["a", "b", "c", "d", "e", "f", "g"] }), ctx).photoIds).toBeDefined();
  });
  it("step 8: contact details only when the owner profile is empty; acknowledgement always", () => {
    expect(Object.keys(validateListingStep(8, EMPTY_LISTING, ctx)).sort()).toEqual(["acknowledged", "contactName", "contactPhone"]);
    expect(Object.keys(validateListingStep(8, EMPTY_LISTING, { today: NOW, needContact: false }))).toEqual(["acknowledged"]);
  });
});

describe("publishProperty (AC-28, §9 steps 2–3)", () => {
  it("creates a Published, user-sourced property with id, code, history and approximate location", () => {
    const r = mustPublish(seed());
    const p = r.property;
    expect(p).toMatchObject({ id: "prop_u_001", displayCode: "NIV-DEMO-P017", ownerId: DEMO_OWNER_ID, listingStatus: "published", source: "user", title: "Demo Test Flat, Bani Park", rent: 18000, deposit: 36000, bedrooms: 2, locationPrecision: "locality_approximate" });
    expect(p.history.map((h) => h.type)).toEqual(["created", "published"]);
    expect(p.photoIds).toEqual(["pool-01", "pool-02"]);
    expect(r.data.properties).toHaveLength(17);
    expect(r.data.counters.property).toBe(2);
  });

  it("creates exactly four verification items: nothing is auto-verified except owner-declared availability", () => {
    const r = mustPublish(seed());
    const items = r.data.verificationItems.filter((i) => i.propertyId === "prop_u_001");
    expect(items.map((i) => [i.category, i.status])).toEqual([
      ["identity", "not_checked"],
      ["authority", "not_checked"],
      ["listing_accuracy", "pending_review"],
      ["availability", "verified_demo"],
    ]);
    expect(items.find((i) => i.category === "availability")?.source).toBe("owner_declared");
    expect(items.every((i) => i.seedStatus === i.status)).toBe(true);
  });

  it("an attached sample document makes identity / authority Pending review, never Verified", () => {
    const r = mustPublish(seed(), { sampleIdentity: true, sampleAuthority: true });
    const items = r.data.verificationItems.filter((i) => i.propertyId === "prop_u_001");
    expect(items.find((i) => i.category === "identity")).toMatchObject({ status: "pending_review", evidenceLabel: "Sample document (demo)" });
    expect(items.find((i) => i.category === "authority")?.status).toBe("pending_review");
  });

  it("stores the owner contact details once (digits only) when the profile was empty", () => {
    const r = mustPublish(seed(), { contactPhone: "+91 98765 43210" });
    expect(r.data.owners.find((o) => o.id === DEMO_OWNER_ID)).toMatchObject({ displayName: "Demo Owner", phone: "9876543210" });
    // a second publish does not ask for contact details again
    const second = publishProperty(r.data, DEMO_OWNER_ID, valid({ title: "Second Demo Flat, Sodala", contactName: "", contactPhone: "" }), NOW);
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.property.id).toBe("prop_u_002");
  });

  it("is rejected with the first failing step and creates nothing when invalid", () => {
    const data = seed();
    const r = publishProperty(data, DEMO_OWNER_ID, valid({ rent: "5", acknowledged: false }), NOW);
    expect(r).toMatchObject({ ok: false, code: "invalid", firstInvalidStep: 3 });
    expect(data.properties).toHaveLength(16);
  });

  it("the new listing is immediately discoverable by Tenants (same record, no sync step) — §9.4", () => {
    const r = mustPublish(seed());
    const ids = selectSearchResults(r.data, DEFAULT_FILTERS, NOW).map((p) => p.id);
    expect(ids).toContain("prop_u_001");
    expect(ids[0]).toBe("prop_u_001"); // newest first
    expect(selectSearchResults(r.data, { ...DEFAULT_FILTERS, locality: "bani_park" }, NOW).map((p) => p.id)).toContain("prop_u_001");
  });
});

describe("updateProperty (AC-27)", () => {
  it("applies changes to the shared record, logs them, and reports unchanged edits as unchanged", () => {
    const data = seed();
    const form = propertyToForm(data.properties.find((p) => p.id === "prop_fx_01")!);
    const same = updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", form, NOW);
    expect(same).toMatchObject({ ok: true, changed: false });

    const r = updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, rent: "23500", description: "Updated description for the demo flat. It now mentions the refreshed paint and a new wardrobe." }, NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.property.rent).toBe(23500);
    expect(r.property.history[0]?.summary).toMatch(/Rent ₹22,000 → ₹23,500/);
    expect(r.property.history[0]?.summary).toMatch(/description/);
    expect(r.data.properties.find((p) => p.id === "prop_fx_01")?.rent).toBe(23500);
  });

  it("changing rent or photos on a verified listing resets Listing accuracy to Pending review (D-16)", () => {
    const data = seed();
    const form = propertyToForm(data.properties.find((p) => p.id === "prop_fx_01")!);
    const r = updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, rent: "24000" }, NOW);
    if (!r.ok) throw new Error("expected ok");
    const eff = getEffectiveVerification(r.property, r.data.verificationItems, NOW);
    expect(eff.find((e) => e.category === "listing_accuracy")).toMatchObject({ status: "pending_review" });
    expect(r.data.verificationItems.find((i) => i.id === "ver_prop_fx_01_listing_accuracy")?.note).toBe("Details changed after last check");
    // identity stays as it was
    expect(eff.find((e) => e.category === "identity")?.status).toBe("verified_demo");
  });

  it("changing only the description does not touch verification", () => {
    const data = seed();
    const form = propertyToForm(data.properties.find((p) => p.id === "prop_fx_01")!);
    const r = updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, description: "A new description that is long enough to pass validation for the demo listing text." }, NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.verificationItems).toBe(data.verificationItems);
  });

  it("an unchanged past available-from date is fine, but a NEW past date is rejected (regression)", () => {
    const data = seed();
    const fx1 = data.properties.find((p) => p.id === "prop_fx_01")!;
    expect(fx1.availableFrom < today).toBe(true);
    const form = propertyToForm(fx1);
    expect(updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, title: "Sunlit 2 BHK, Malviya Nagar (edited)" }, NOW).ok).toBe(true);
    expect(updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, availableFrom: toISODate(addDays(NOW, -9)) }, NOW)).toMatchObject({ ok: false, code: "invalid", firstInvalidStep: 3 });
  });

  it("refuses invalid edits and other owners' properties", () => {
    const data = seed();
    const form = propertyToForm(data.properties.find((p) => p.id === "prop_fx_01")!);
    expect(updateProperty(data, DEMO_OWNER_ID, "prop_fx_01", { ...form, title: "x" }, NOW)).toMatchObject({ ok: false, code: "invalid", firstInvalidStep: 1 });
    expect(updateProperty(data, DEMO_OWNER_ID, "prop_fx_03", propertyToForm(data.properties.find((p) => p.id === "prop_fx_03")!), NOW)).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("availability handling (AC-27)", () => {
  it("Mark unavailable hides the home from default search but keeps every request untouched", () => {
    const data = seed();
    const before = data.visitRequests;
    const r = setListingStatus(data, DEMO_OWNER_ID, "prop_fx_01", "unavailable", NOW);
    if (!r.ok) throw new Error("expected ok");
    expect(r.property.listingStatus).toBe("unavailable");
    expect(r.property.history[0]?.type).toBe("unavailable");
    expect(selectSearchResults(r.data, DEFAULT_FILTERS, NOW).map((p) => p.id)).not.toContain("prop_fx_01");
    expect(selectSearchResults(r.data, { ...DEFAULT_FILTERS, avail: "any" }, NOW).map((p) => p.id)).toContain("prop_fx_01");
    expect(r.data.visitRequests).toBe(before); // request history never deleted or changed
    expect(selectOwnerRequests(r.data, DEMO_OWNER_ID).filter((q) => q.propertyId === "prop_fx_01")).toHaveLength(2);
  });

  it("Mark available restores it and re-confirms availability as owner-declared", () => {
    const off = setListingStatus(seed(), DEMO_OWNER_ID, "prop_fx_05", "unavailable", NOW);
    if (!off.ok) throw new Error("x");
    const on = setListingStatus(off.data, DEMO_OWNER_ID, "prop_fx_05", "published", NOW);
    if (!on.ok) throw new Error("x");
    expect(on.property.listingStatus).toBe("published");
    expect(on.property.availabilityConfirmedAt).toBe(NOW.toISOString());
    const av = getEffectiveVerification(on.property, on.data.verificationItems, NOW).find((e) => e.category === "availability");
    expect(av).toMatchObject({ status: "verified_demo", stale: false });
    expect(av?.item.source).toBe("owner_declared");
  });

  it("only published ⇄ unavailable is allowed; drafts and pending listings cannot be toggled", () => {
    expect(setListingStatus(seed(), DEMO_OWNER_ID, "prop_fx_12", "published", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(setListingStatus(seed(), DEMO_OWNER_ID, "prop_fx_11", "unavailable", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(setListingStatus(seed(), DEMO_OWNER_ID, "prop_fx_01", "published", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(setListingStatus(seed(), DEMO_OWNER_ID, "prop_fx_03", "unavailable", NOW)).toMatchObject({ ok: false, code: "forbidden" });
  });
});

describe("verification actions (AC-17 owner)", () => {
  it("Reconfirm availability turns FX-05's stale check into a fresh, owner-declared Verified (demo)", () => {
    const data = seed();
    const p = data.properties.find((x) => x.id === "prop_fx_05")!;
    expect(getEffectiveVerification(p, data.verificationItems, NOW).find((e) => e.category === "availability")?.status).toBe("needs_reverification");
    const r = reconfirmAvailability(data, DEMO_OWNER_ID, "prop_fx_05", NOW);
    if (!r.ok) throw new Error("x");
    const av = getEffectiveVerification(r.property, r.data.verificationItems, NOW).find((e) => e.category === "availability");
    expect(av).toMatchObject({ status: "verified_demo", stale: false });
    expect(av?.item.checkedAt).toBe(today);
    expect(av?.item.source).toBe("owner_declared");
  });

  it("reconfirming an unavailable listing is refused", () => {
    expect(reconfirmAvailability(seed(), DEMO_OWNER_ID, "prop_fx_15", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
  });

  it("attaching a sample document moves Not yet checked → Pending review, once", () => {
    const data = seed();
    const r = attachSampleDocument(data, DEMO_OWNER_ID, "prop_fx_05", "authority", NOW);
    if (!r.ok) throw new Error("x");
    expect(r.data.verificationItems.find((i) => i.id === "ver_prop_fx_05_authority")).toMatchObject({ status: "pending_review", evidenceLabel: "Sample document (demo)" });
    expect(attachSampleDocument(r.data, DEMO_OWNER_ID, "prop_fx_05", "authority", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    // never creates a Verified status
    expect(r.data.verificationItems.filter((i) => i.propertyId === "prop_fx_05").some((i) => i.id.endsWith("authority") && i.status === "verified_demo")).toBe(false);
  });
});

describe("owner profile", () => {
  it("validates and stores name and phone", () => {
    expect(saveOwnerProfile(seed(), DEMO_OWNER_ID, { name: "A", phone: "1" })).toMatchObject({ ok: false });
    const r = saveOwnerProfile(seed(), DEMO_OWNER_ID, { name: "Asha Verma", phone: "98765 43210" });
    if (!r.ok) throw new Error("x");
    expect(r.data.owners.find((o) => o.id === DEMO_OWNER_ID)).toMatchObject({ displayName: "Asha Verma", phone: "9876543210" });
  });
});

describe("owner selectors (AC-16 owner list, dashboard figures)", () => {
  it("lists exactly the seven demo-owner properties at the starting state", () => {
    expect(selectOwnerProperties(seed(), DEMO_OWNER_ID).map((p) => p.id.slice(-2)).sort()).toEqual(["01", "02", "05", "11", "12", "15", "16"]);
  });

  it("starting figures: 7 total, 3 active, New Requests 1, Scheduled visits 1", () => {
    const s = selectOwnerStats(seed(), DEMO_OWNER_ID, NOW);
    expect(s).toMatchObject({ total: 7, active: 3, newRequests: 1, scheduledVisits: 1 });
    expect(s.pendingVerificationTasks).toBeGreaterThan(0);
  });

  it("pending verification tasks count only published / pending-review listings' open items (effective)", () => {
    // FX-02: auth pending (1). FX-05: auth not_checked, accuracy pending, availability stale (3). FX-11: identity pending, authority not_checked, accuracy pending (3). FX-01: none.
    expect(selectOwnerStats(seed(), DEMO_OWNER_ID, NOW).pendingVerificationTasks).toBe(7);
  });

  it("a new tenant request raises New Requests; the owner sees the same record", () => {
    const created = createVisitRequest(seed(), { tenantId: DEMO_TENANT_ID, propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: toISODate(addDays(NOW, 1)), slot: "morning", message: "", sharePhoneWithOwner: false }, NOW);
    if (!created.ok) throw new Error("x");
    expect(selectOwnerStats(created.data, DEMO_OWNER_ID, NOW).newRequests).toBe(2);
    expect(selectOwnerRequests(created.data, DEMO_OWNER_ID)[0]?.displayCode).toBe("NIV-VR-1007");
  });

  it("attention list leads with new requests, then stale availability, then verification", () => {
    const a = selectAttention(seed(), DEMO_OWNER_ID, NOW);
    expect(a.map((x) => x.key.split("-")[0])).toEqual(["req", "stale", "verification"]);
    expect(a.length).toBeLessThanOrEqual(5);
  });

  it("recent activity merges listing history and request history, newest first, max 5", () => {
    const act = selectRecentActivity(seed(), DEMO_OWNER_ID);
    expect(act).toHaveLength(5);
    expect([...act].sort((a, b) => b.at.localeCompare(a.at)).map((x) => x.key)).toEqual(act.map((x) => x.key));
  });
});

describe("ownerTransitionRequest (AC-14, AC-15, AC-23 owner side)", () => {
  const tomorrow = toISODate(addDays(NOW, 1));
  const withRequest = () => {
    const c = createVisitRequest(seed(), { tenantId: DEMO_TENANT_ID, propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false }, NOW);
    if (!c.ok) throw new Error("x");
    return c;
  };

  it("Contacted → Visit Scheduled → Completed updates the one shared record and history", () => {
    const c = withRequest();
    const contacted = ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "contacted", {}, NOW);
    if (!contacted.ok) throw new Error(JSON.stringify(contacted));
    const sched = ownerTransitionRequest(contacted.data, DEMO_OWNER_ID, c.request.id, "scheduled", { scheduledFor: { date: tomorrow, slot: "afternoon" } }, NOW);
    if (!sched.ok) throw new Error(JSON.stringify(sched));
    const done = ownerTransitionRequest(sched.data, DEMO_OWNER_ID, c.request.id, "completed", {}, NOW);
    if (!done.ok) throw new Error(JSON.stringify(done));
    expect(done.request.statusHistory.map((h) => h.status)).toEqual(["pending", "contacted", "scheduled", "completed"]);
    expect(done.data.visitRequests.filter((r) => r.id === c.request.id)).toHaveLength(1);
  });

  it("schedule date must be today … +60 days; missing schedule is refused", () => {
    const c = withRequest();
    expect(ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "scheduled", {}, NOW)).toMatchObject({ ok: false, code: "missing_schedule" });
    expect(ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "scheduled", { scheduledFor: { date: toISODate(addDays(NOW, 61)), slot: "morning" } }, NOW)).toMatchObject({ ok: false, code: "invalid_schedule", message: "Choose a visit date within the next 60 days." });
    expect(ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "scheduled", { scheduledFor: { date: toISODate(addDays(NOW, -1)), slot: "morning" } }, NOW)).toMatchObject({ ok: false, code: "invalid_schedule" });
  });

  it("a request the tenant already cancelled cannot be moved on (stale view) and nothing is written", () => {
    const c = withRequest();
    const cancelled = ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "cancelled", { note: "Owner unavailable" }, NOW);
    if (!cancelled.ok) throw new Error("x");
    expect(cancelled.request.cancelledBy).toBe("owner");
    const again = ownerTransitionRequest(cancelled.data, DEMO_OWNER_ID, c.request.id, "contacted", {}, NOW);
    expect(again).toMatchObject({ ok: false, code: "invalid_transition", message: "This request is already Cancelled. The list has been refreshed." });
  });

  it("an owner can only act on requests for their own properties", () => {
    expect(ownerTransitionRequest(seed(), DEMO_OWNER_ID, "req_fx_1006", "contacted", {}, NOW)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("only valid actions per status are accepted (Completed/Cancelled are terminal; no skipping)", () => {
    const c = withRequest();
    expect(ownerTransitionRequest(c.data, DEMO_OWNER_ID, c.request.id, "completed", {}, NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(ownerTransitionRequest(seed(), DEMO_OWNER_ID, "req_fx_1004", "cancelled", {}, NOW)).toMatchObject({ ok: false, code: "invalid_transition" }); // completed fixture
  });
});
