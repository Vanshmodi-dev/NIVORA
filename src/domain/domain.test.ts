import { describe, expect, it } from "vitest";
import { addDays, daysBetween, toISODate } from "./dates";
import { formatApproxDistance, haversineKm, approximateCoordinates, MAX_COORDINATE_OFFSET_M } from "./geo";
import { formatDate, formatPhone, formatRupees, formatRupeesCompact } from "./format";
import { allowedTransitions, isOpenRequest, transitionRequest } from "./requests";
import { deriveRentStatus } from "./rent";
import { normalizePhone, visitRequestInputSchema } from "./validators";
import {
  AVAILABILITY_FRESH_DAYS,
  getEffectiveVerification,
  isAvailabilityStale,
  verificationSummary,
} from "./verification";
import { REQUEST_STATUS_LABEL, VERIFICATION_STATUS_LABEL } from "./labels";
import type { RequestStatus, VerificationItem, VisitRequest } from "./types";

const NOW = new Date(2026, 9, 10, 12, 0, 0);

describe("haversine and distance formatting", () => {
  it("is zero for identical points and symmetric", () => {
    const a = { lat: 26.9, lng: 75.8 };
    const b = { lat: 26.85, lng: 75.76 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });

  it("matches the known length of one degree of longitude at the equator (~111.2 km)", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 1 })).toBeCloseTo(111.19, 1);
  });

  it("matches a known city-scale distance within a small tolerance", () => {
    // 0.05 deg latitude ≈ 5.56 km
    expect(haversineKm({ lat: 26.85, lng: 75.8 }, { lat: 26.9, lng: 75.8 })).toBeCloseTo(5.56, 1);
  });

  it("always labels distances as approximate straight-line, never as time", () => {
    expect(formatApproxDistance(3.24)).toBe("≈ 3.2 km straight-line");
    expect(formatApproxDistance(0.65)).toBe("≈ 650 m straight-line");
    expect(formatApproxDistance(0.99)).toBe("≈ 1.0 km straight-line");
    for (const km of [0.1, 0.65, 1, 3.2, 12]) {
      expect(formatApproxDistance(km)).not.toMatch(/min|walk|drive|commute/i);
    }
  });

  it("derives deterministic coordinates within 600 m of the centroid", () => {
    const centroid = { lat: 26.8545, lng: 75.8115 };
    const a = approximateCoordinates(centroid, "prop_fx_01");
    expect(approximateCoordinates(centroid, "prop_fx_01")).toEqual(a);
    expect(approximateCoordinates(centroid, "prop_fx_02")).not.toEqual(a);
    expect(haversineKm(centroid, a) * 1000).toBeLessThanOrEqual(MAX_COORDINATE_OFFSET_M + 5);
  });
});

describe("formatting", () => {
  it("formats rupees with Indian grouping and compact marker form", () => {
    expect(formatRupees(125000)).toBe("₹1,25,000");
    expect(formatRupees(22000)).toBe("₹22,000");
    expect(formatRupeesCompact(14500)).toBe("₹14.5k");
    expect(formatRupeesCompact(22000)).toBe("₹22k");
    expect(formatRupeesCompact(950)).toBe("₹950");
  });

  it("formats dates and phone numbers", () => {
    expect(formatDate("2026-10-12")).toBe("12 Oct 2026");
    expect(formatPhone("9876543210")).toBe("+91 98765 43210");
  });
});

describe("verification — effective status and freshness", () => {
  const item = (category: VerificationItem["category"], status: VerificationItem["status"]): VerificationItem => ({
    id: `v_${category}`,
    propertyId: "p1",
    category,
    status,
    source: "demo_fixture",
    checkedAt: null,
    evidenceLabel: null,
    note: null,
    seedStatus: status,
    simulatedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  const items = [
    item("identity", "verified_demo"),
    item("authority", "not_checked"),
    item("listing_accuracy", "pending_review"),
    item("availability", "verified_demo"),
  ];

  it("keeps a fresh availability confirmation verified", () => {
    const fresh = addDays(NOW, -AVAILABILITY_FRESH_DAYS).toISOString();
    const eff = getEffectiveVerification({ id: "p1", availabilityConfirmedAt: fresh }, items, NOW);
    expect(eff.find((e) => e.category === "availability")?.status).toBe("verified_demo");
    expect(isAvailabilityStale(fresh, NOW)).toBe(false);
  });

  it("flags availability older than 14 days as needing re-verification", () => {
    const old = addDays(NOW, -(AVAILABILITY_FRESH_DAYS + 1)).toISOString();
    const eff = getEffectiveVerification({ id: "p1", availabilityConfirmedAt: old }, items, NOW);
    const av = eff.find((e) => e.category === "availability");
    expect(av?.status).toBe("needs_reverification");
    expect(av?.stored).toBe("verified_demo");
    expect(av?.stale).toBe(true);
    expect(VERIFICATION_STATUS_LABEL[av!.status]).toBe("Needs re-verification");
  });

  it("returns four categories in canonical order and never makes other categories stale", () => {
    const old = addDays(NOW, -100).toISOString();
    const eff = getEffectiveVerification({ id: "p1", availabilityConfirmedAt: old }, items, NOW);
    expect(eff.map((e) => e.category)).toEqual(["identity", "authority", "listing_accuracy", "availability"]);
    expect(eff[0]?.status).toBe("verified_demo");
  });

  it("counts only effective verified_demo and always says (demo)", () => {
    const old = addDays(NOW, -30).toISOString();
    const stale = getEffectiveVerification({ id: "p1", availabilityConfirmedAt: old }, items, NOW);
    expect(verificationSummary(stale)).toBe("1 of 4 checks verified (demo)");
    const fresh = getEffectiveVerification({ id: "p1", availabilityConfirmedAt: NOW.toISOString() }, items, NOW);
    expect(verificationSummary(fresh)).toBe("2 of 4 checks verified (demo)");
  });

  it("treats a missing confirmation date as stale", () => {
    expect(isAvailabilityStale(null, NOW)).toBe(true);
  });
});

describe("visit-request transitions", () => {
  const base = (status: RequestStatus): VisitRequest => ({
    id: "r1",
    displayCode: "NIV-VR-1",
    propertyId: "p1",
    ownerId: "o1",
    tenantId: "t1",
    tenantNameEntered: "Test",
    tenantPhoneEntered: null,
    sharePhoneWithOwner: false,
    preferredDate: "2026-10-12",
    preferredSlot: "morning",
    message: null,
    status,
    scheduledFor: null,
    cancelledBy: null,
    cancelReason: null,
    statusHistory: [{ status: "pending", at: NOW.toISOString(), by: "tenant" }],
    tenantLastSeenStatusAt: null,
    propertySnapshot: { title: "T", locality: "c_scheme", rent: 1, photoId: null },
    source: "user",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });
  const sched = { scheduledFor: { date: "2026-10-12", slot: "afternoon" as const } };
  const ALL: RequestStatus[] = ["pending", "contacted", "scheduled", "completed", "cancelled"];

  it("uses the canonical labels, with Pending as the initial status", () => {
    expect(REQUEST_STATUS_LABEL.pending).toBe("Pending");
    expect(REQUEST_STATUS_LABEL.scheduled).toBe("Visit Scheduled");
    expect(REQUEST_STATUS_LABEL.completed).toBe("Visit Completed");
  });

  it("matches the owner transition table exactly", () => {
    const expected: Record<RequestStatus, RequestStatus[]> = {
      pending: ["contacted", "scheduled", "cancelled"],
      contacted: ["scheduled", "cancelled"],
      scheduled: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };
    for (const from of ALL) expect([...allowedTransitions(from, "owner")]).toEqual(expected[from]);
  });

  it("lets tenants cancel open requests only", () => {
    for (const from of ALL) {
      expect([...allowedTransitions(from, "tenant")]).toEqual(isOpenRequest(from) ? ["cancelled"] : []);
    }
    const r = transitionRequest(base("pending"), "contacted", "tenant", NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_permitted");
  });

  it("applies a valid transition: status, history entry, updatedAt, without mutating the input", () => {
    const original = base("pending");
    const later = new Date(NOW.getTime() + 60_000);
    const r = transitionRequest(original, "contacted", "owner", later);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.status).toBe("contacted");
      expect(r.request.statusHistory).toHaveLength(2);
      expect(r.request.statusHistory[1]).toMatchObject({ status: "contacted", by: "owner" });
      expect(r.request.updatedAt).toBe(later.toISOString());
    }
    expect(original.status).toBe("pending");
    expect(original.statusHistory).toHaveLength(1);
  });

  it("requires a valid schedule to move to Visit Scheduled", () => {
    const missing = transitionRequest(base("pending"), "scheduled", "owner", NOW);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("missing_schedule");
    const bad = transitionRequest(base("pending"), "scheduled", "owner", NOW, {
      scheduledFor: { date: "tomorrow", slot: "morning" },
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.code).toBe("invalid_schedule");
    const ok = transitionRequest(base("contacted"), "scheduled", "owner", NOW, sched);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.request.scheduledFor).toEqual(sched.scheduledFor);
  });

  it("records who cancelled and the reason", () => {
    const r = transitionRequest(base("scheduled"), "cancelled", "tenant", NOW, { note: "Plans changed" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.cancelledBy).toBe("tenant");
      expect(r.request.cancelReason).toBe("Plans changed");
    }
  });

  it("rejects every transition out of a terminal state with the 'already' message and writes nothing", () => {
    for (const terminal of ["completed", "cancelled"] as const) {
      for (const to of ALL) {
        const r = transitionRequest(base(terminal), to, "owner", NOW, sched);
        expect(r.ok).toBe(false);
        if (!r.ok) {
          expect(r.code).toBe("invalid_transition");
          expect(r.message).toBe(`This request is already ${REQUEST_STATUS_LABEL[terminal]}. The list has been refreshed.`);
        }
      }
    }
  });

  it("rejects skipping steps (pending → completed)", () => {
    const r = transitionRequest(base("pending"), "completed", "owner", NOW);
    expect(r.ok).toBe(false);
  });
});

describe("validators (visit request form rules)", () => {
  it("normalises Indian mobile numbers", () => {
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("098765-43210")).toBe("9876543210");
    expect(normalizePhone("919876543210")).toBe("9876543210");
  });

  it("rejects numbers that are too short or do not start with 6–9", () => {
    expect(normalizePhone("1234567890")).toBeNull();
    expect(normalizePhone("98765")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("98765432101")).toBeNull();
  });

  const schema = visitRequestInputSchema(NOW);
  const valid = { name: "Asha Verma", phone: "+91 98765 43210", date: toISODate(addDays(NOW, 1)), slot: "afternoon" as const };

  it("accepts a valid request and stores the phone as 10 digits", () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBe("9876543210");
  });

  const messagesFor = (input: unknown) => {
    const r = schema.safeParse(input);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  it("returns the specified error copy", () => {
    expect(messagesFor({ ...valid, name: "" })).toContain("Enter your full name (2–60 letters).");
    expect(messagesFor({ ...valid, name: "A1!" })).toContain("Enter your full name (2–60 letters).");
    expect(messagesFor({ ...valid, phone: "98765" })).toContain("Enter a valid 10-digit Indian mobile number.");
    expect(messagesFor({ ...valid, slot: undefined })).toContain("Choose a time slot.");
    expect(messagesFor({ ...valid, message: "x".repeat(301) })).toContain("Message is too long (max 300).");
  });

  it("limits the visit date to today … today+30 days", () => {
    expect(messagesFor({ ...valid, date: toISODate(addDays(NOW, -1)) })).toContain("Choose a date within the next 30 days.");
    expect(messagesFor({ ...valid, date: toISODate(addDays(NOW, 31)) })).toContain("Choose a date within the next 30 days.");
    expect(schema.safeParse({ ...valid, date: toISODate(NOW) }).success).toBe(true);
    expect(schema.safeParse({ ...valid, date: toISODate(addDays(NOW, 30)) }).success).toBe(true);
  });
});

describe("rent status derivation", () => {
  it("is paid, due or overdue purely from paidAt and the due date", () => {
    expect(deriveRentStatus({ paidAt: NOW.toISOString(), dueDate: "2020-01-05" }, NOW)).toBe("paid");
    expect(deriveRentStatus({ paidAt: null, dueDate: toISODate(addDays(NOW, 3)) }, NOW)).toBe("due");
    expect(deriveRentStatus({ paidAt: null, dueDate: toISODate(NOW) }, NOW)).toBe("due");
    expect(deriveRentStatus({ paidAt: null, dueDate: toISODate(addDays(NOW, -1)) }, NOW)).toBe("overdue");
  });
});

describe("date helpers", () => {
  it("counts whole days between two moments", () => {
    expect(daysBetween(addDays(NOW, -20), NOW)).toBe(20);
    expect(daysBetween(NOW, addDays(NOW, 3))).toBe(3);
  });
});
