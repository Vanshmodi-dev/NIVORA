import { addDays, toISODate, toISOMonth, toTimestamp } from "../domain/dates";
import { approximateCoordinates } from "../domain/geo";
import { VERIFICATION_CATEGORIES } from "../domain/verification";
import { getLocality } from "./reference";
import {
  DEMO_OWNER_ID,
  DEMO_TENANT_ID,
  type AmenityId,
  type DataState,
  type Furnishing,
  type ListingStatus,
  type LocalityId,
  type MaintenanceRequest,
  type OwnerProfile,
  type Property,
  type PropertyType,
  type RentRecord,
  type RequestStatus,
  type StatusHistoryEntry,
  type Tenancy,
  type TenantProfile,
  type TimeSlot,
  type UiState,
  type VerificationCategory,
  type VerificationItem,
  type VerificationStatus,
  type VisitRequest,
} from "../domain/types";

/**
 * Deterministic, fictional demonstration data (blueprint §13.7). Everything here is invented:
 * no real landlords, buildings or contacts. Dates are stored as offsets and resolved against
 * `now` at seed time, so staleness and "upcoming" states are reproducible whenever the demo runs.
 */

/** Bump when the shape or content of the seed changes; mismatching saved data is re-seeded. */
export const SEED_VERSION = 2;

type Code = "V" | "P" | "N" | "R" | "S";

const CODE_STATUS: Record<Code, VerificationStatus> = {
  V: "verified_demo",
  P: "pending_review",
  N: "not_checked",
  R: "needs_reverification",
  /** Stored as verified but with an old confirmation date, so it is stale on read. */
  S: "verified_demo",
};

interface FixtureSpec {
  n: number;
  title: string;
  type: PropertyType;
  locality: LocalityId;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  amenities: AmenityId[];
  owner: string;
  status: ListingStatus;
  /** Identity, Authority, Accuracy, Availability */
  ver: [Code, Code, Code, Code];
  /** availableFrom = today + offset (days) */
  availOffset: number;
  confirmedDaysAgo: number | null;
  publishedDaysAgo: number | null;
  sizeSqft: number | null;
  addressArea: string;
  landmark: string | null;
  description: string;
  photoCount: number;
  maintenanceIncluded?: boolean;
  maintenanceCharge?: number | null;
}

/* Titles and descriptions never name a real institution or landmark (D-26). */
const FIXTURES: FixtureSpec[] = [
  { n: 1, title: "Sunlit 2 BHK, Malviya Nagar", type: "apartment", locality: "malviya_nagar", rent: 22000, bedrooms: 2, bathrooms: 2, furnishing: "semi_furnished", amenities: ["parking", "lift", "wifi", "power_backup"], owner: "owner_demo", status: "published", ver: ["V", "V", "V", "V"], availOffset: -4, confirmedDaysAgo: 3, publishedDaysAgo: 6, sizeSqft: 1050, addressArea: "Residential lane near a neighbourhood market", landmark: "Close to a small community park", description: "Bright east-facing two-bedroom flat on the third floor with a balcony, wardrobes in both bedrooms and covered parking. Quiet residential block with a lift.", photoCount: 5, maintenanceIncluded: true },
  { n: 2, title: "Compact Studio, C-Scheme", type: "studio", locality: "c_scheme", rent: 14500, bedrooms: 1, bathrooms: 1, furnishing: "fully_furnished", amenities: ["wifi", "air_conditioning", "security"], owner: "owner_demo", status: "published", ver: ["V", "P", "V", "V"], availOffset: -2, confirmedDaysAgo: 5, publishedDaysAgo: 12, sizeSqft: 420, addressArea: "Central lane with cafés and shops nearby", landmark: null, description: "Efficient fully furnished studio with a built-in kitchenette, air conditioning and fast Wi-Fi already set up. Gated entry with a guard on duty.", photoCount: 5, maintenanceCharge: 1500 },
  { n: 3, title: "Garden-Facing 3 BHK House", type: "independent_house", locality: "vaishali_nagar", rent: 38000, bedrooms: 3, bathrooms: 3, furnishing: "semi_furnished", amenities: ["parking", "water_24h", "power_backup", "security"], owner: "owner_fx_b", status: "published", ver: ["V", "V", "P", "V"], availOffset: -7, confirmedDaysAgo: 4, publishedDaysAgo: 9, sizeSqft: 2100, addressArea: "Quiet lane with tree-lined street", landmark: "Opposite a small garden", description: "Spacious independent house with a front lawn, three bedrooms with attached bathrooms and parking for two cars. Round-the-clock water supply and inverter backup.", photoCount: 5 },
  { n: 4, title: "Budget Single Room, Raja Park", type: "single_room", locality: "raja_park", rent: 6500, bedrooms: 1, bathrooms: 1, furnishing: "unfurnished", amenities: ["water_24h"], owner: "owner_fx_a", status: "published", ver: ["N", "N", "N", "V"], availOffset: -1, confirmedDaysAgo: 2, publishedDaysAgo: 20, sizeSqft: 160, addressArea: "Lane behind a local market", landmark: null, description: "Simple single room on the ground floor with an attached bathroom and its own entrance. Basic and affordable; no furniture provided.", photoCount: 4 },
  { n: 5, title: "Modern 1 BHK, Mansarovar", type: "apartment", locality: "mansarovar", rent: 12000, bedrooms: 1, bathrooms: 1, furnishing: "semi_furnished", amenities: ["lift", "parking"], owner: "owner_demo", status: "published", ver: ["V", "N", "P", "S"], availOffset: -10, confirmedDaysAgo: 20, publishedDaysAgo: 28, sizeSqft: 640, addressArea: "Planned colony with wide internal roads", landmark: "Near a neighbourhood playground", description: "Contemporary one-bedroom flat with a modular wardrobe, a compact balcony and lift access. Availability was last confirmed a while ago, so it shows as needing re-verification.", photoCount: 4 },
  { n: 6, title: "Builder Floor 2 BHK, Jagatpura", type: "builder_floor", locality: "jagatpura", rent: 16500, bedrooms: 2, bathrooms: 2, furnishing: "unfurnished", amenities: ["parking", "water_24h"], owner: "owner_fx_c", status: "published", ver: ["V", "V", "V", "V"], availOffset: -3, confirmedDaysAgo: 6, publishedDaysAgo: 15, sizeSqft: 900, addressArea: "Residential colony with quiet lanes", landmark: null, description: "First-floor builder floor with two airy bedrooms, a separate dining nook and a private stair entrance. Unfurnished, ready for you to set up.", photoCount: 3 },
  { n: 7, title: "Premium 3 BHK, Bani Park", type: "apartment", locality: "bani_park", rent: 52000, bedrooms: 3, bathrooms: 3, furnishing: "fully_furnished", amenities: ["lift", "gym_access", "gated_society", "security", "air_conditioning"], owner: "owner_fx_b", status: "published", ver: ["V", "V", "V", "V"], availOffset: -6, confirmedDaysAgo: 2, publishedDaysAgo: 3, sizeSqft: 1800, addressArea: "Gated society on a calm internal road", landmark: "Society clubhouse on site", description: "Fully furnished three-bedroom apartment in a gated society with a small gym, lift access, split air conditioners in every bedroom and 24-hour security.", photoCount: 5 },
  { n: 8, title: "Office-Ready 2 BHK, Sitapura", type: "apartment", locality: "sitapura", rent: 19000, bedrooms: 2, bathrooms: 2, furnishing: "semi_furnished", amenities: ["wifi", "power_backup", "parking"], owner: "owner_fx_c", status: "published", ver: ["P", "P", "P", "V"], availOffset: -2, confirmedDaysAgo: 7, publishedDaysAgo: 18, sizeSqft: 980, addressArea: "Newer apartment cluster near the main road", landmark: null, description: "Two-bedroom apartment with a dedicated work corner, broadband connection and power backup. Verification for this listing is still in progress in the demo data.", photoCount: 3 },
  { n: 9, title: "Cozy Studio, Jawahar Nagar", type: "studio", locality: "jawahar_nagar", rent: 11000, bedrooms: 1, bathrooms: 1, furnishing: "fully_furnished", amenities: ["wifi", "air_conditioning"], owner: "owner_fx_a", status: "published", ver: ["V", "P", "V", "V"], availOffset: -5, confirmedDaysAgo: 8, publishedDaysAgo: 22, sizeSqft: 380, addressArea: "Residential block off a busy main road", landmark: null, description: "Fully furnished studio with a bed, study desk, wardrobe and air conditioning. Quiet building with a small shared terrace.", photoCount: 3 },
  { n: 10, title: "Spacious 4 BHK Villa, Vaishali Nagar", type: "independent_house", locality: "vaishali_nagar", rent: 75000, bedrooms: 4, bathrooms: 4, furnishing: "fully_furnished", amenities: ["parking", "security", "balcony", "gated_society"], owner: "owner_fx_b", status: "unavailable", ver: ["V", "V", "V", "V"], availOffset: -30, confirmedDaysAgo: 6, publishedDaysAgo: 45, sizeSqft: 3200, addressArea: "Gated enclave with wide roads", landmark: "Enclave garden on site", description: "Large four-bedroom villa with private garden, multiple balconies and parking for three cars. Currently unavailable; kept to show how unavailable listings behave.", photoCount: 4 },
  { n: 11, title: "Quiet 1 BHK, Sodala", type: "apartment", locality: "sodala", rent: 13500, bedrooms: 1, bathrooms: 1, furnishing: "semi_furnished", amenities: ["lift", "water_24h"], owner: "owner_demo", status: "pending_review", ver: ["P", "N", "P", "V"], availOffset: 10, confirmedDaysAgo: 4, publishedDaysAgo: null, sizeSqft: 600, addressArea: "Calm residential street", landmark: null, description: "One-bedroom flat awaiting review in the demo data, so it is visible to the owner only and not to tenants.", photoCount: 3 },
  { n: 12, title: "Draft: 2 BHK, Gopalpura", type: "apartment", locality: "gopalpura", rent: 17000, bedrooms: 2, bathrooms: 2, furnishing: "unfurnished", amenities: [], owner: "owner_demo", status: "draft", ver: ["N", "N", "N", "N"], availOffset: 30, confirmedDaysAgo: null, publishedDaysAgo: null, sizeSqft: null, addressArea: "Main road corridor", landmark: null, description: "Incomplete draft listing used to demonstrate resuming a draft. Not visible to tenants.", photoCount: 1 },
  { n: 13, title: "Furnished 2 BHK, Malviya Nagar", type: "apartment", locality: "malviya_nagar", rent: 28000, bedrooms: 2, bathrooms: 2, furnishing: "fully_furnished", amenities: ["parking", "wifi", "air_conditioning", "modular_kitchen"], owner: "owner_fx_a", status: "published", ver: ["V", "V", "P", "V"], availOffset: -2, confirmedDaysAgo: 5, publishedDaysAgo: 8, sizeSqft: 1100, addressArea: "Well-connected residential block", landmark: null, description: "Move-in-ready furnished two-bedroom flat with a modular kitchen, air conditioning, Wi-Fi and a reserved parking slot.", photoCount: 4 },
  { n: 14, title: "Single Room, Jawahar Nagar", type: "single_room", locality: "jawahar_nagar", rent: 7500, bedrooms: 1, bathrooms: 1, furnishing: "unfurnished", amenities: ["wifi"], owner: "owner_fx_c", status: "published", ver: ["V", "N", "V", "V"], availOffset: 0, confirmedDaysAgo: 3, publishedDaysAgo: 5, sizeSqft: 180, addressArea: "Residential lane in an older colony", landmark: null, description: "Clean single room on the first floor with an attached bathroom and shared Wi-Fi. Unfurnished.", photoCount: 3 },
  { n: 15, title: "Corner 2 BHK, C-Scheme (currently let)", type: "apartment", locality: "c_scheme", rent: 24000, bedrooms: 2, bathrooms: 2, furnishing: "semi_furnished", amenities: ["parking", "lift", "security"], owner: "owner_demo", status: "unavailable", ver: ["V", "V", "V", "V"], availOffset: -150, confirmedDaysAgo: 12, publishedDaysAgo: 160, sizeSqft: 1000, addressArea: "Corner building on a central street", landmark: null, description: "Corner two-bedroom flat currently let to a tenant. Used for the rent and maintenance previews.", photoCount: 3 },
  { n: 16, title: "Airy 1 BHK, Mansarovar (currently let)", type: "apartment", locality: "mansarovar", rent: 11500, bedrooms: 1, bathrooms: 1, furnishing: "unfurnished", amenities: ["water_24h", "parking"], owner: "owner_demo", status: "unavailable", ver: ["V", "V", "P", "V"], availOffset: -200, confirmedDaysAgo: 9, publishedDaysAgo: 210, sizeSqft: 620, addressArea: "Planned colony with wide roads", landmark: null, description: "Airy one-bedroom flat currently let to a tenant. Used for the rent and maintenance previews.", photoCount: 3 },
];

const pad2 = (n: number) => String(n).padStart(2, "0");
const fxId = (n: number) => pad2(n);
const propId = (n: number) => `prop_fx_${fxId(n)}`;

function buildProperty(spec: FixtureSpec, now: Date): Property {
  const id = propId(spec.n);
  const centroid = getLocality(spec.locality);
  const { lat, lng } = approximateCoordinates(centroid, id);
  const published = spec.publishedDaysAgo != null ? toTimestamp(addDays(now, -spec.publishedDaysAgo)) : null;
  const created = toTimestamp(addDays(now, -(spec.publishedDaysAgo ?? 2) - 1));
  const history = [{ at: created, type: "created", summary: "Demo listing created (fixture)" }];
  if (published) history.push({ at: published, type: "published", summary: "Listing published (demo)" });
  if (spec.status === "unavailable") {
    history.push({ at: toTimestamp(addDays(now, -2)), type: "unavailable", summary: "Marked unavailable (demo)" });
  }
  return {
    id,
    displayCode: `NIV-DEMO-P${String(spec.n).padStart(3, "0")}`,
    ownerId: spec.owner,
    title: spec.title,
    description: spec.description,
    type: spec.type,
    locality: spec.locality,
    addressArea: spec.addressArea,
    landmark: spec.landmark,
    lat,
    lng,
    locationPrecision: "locality_approximate",
    rent: spec.rent,
    deposit: spec.rent * 2,
    maintenanceCharge: spec.maintenanceCharge ?? null,
    maintenanceIncluded: spec.maintenanceIncluded ?? spec.maintenanceCharge == null,
    availableFrom: toISODate(addDays(now, spec.availOffset)),
    bedrooms: spec.bedrooms,
    bathrooms: spec.bathrooms,
    furnishing: spec.furnishing,
    sizeSqft: spec.sizeSqft,
    amenities: spec.amenities,
    houseRules: null,
    photoIds: Array.from({ length: spec.photoCount }, (_, i) => `fx${fxId(spec.n)}-${i + 1}`),
    listingStatus: spec.status,
    availabilityConfirmedAt:
      spec.confirmedDaysAgo != null ? toTimestamp(addDays(now, -spec.confirmedDaysAgo)) : null,
    publishedAt: published,
    history,
    source: "fixture",
    createdAt: created,
    updatedAt: created,
  };
}

function buildVerificationItems(spec: FixtureSpec, property: Property, now: Date): VerificationItem[] {
  return VERIFICATION_CATEGORIES.map((category: VerificationCategory, idx) => {
    const code = spec.ver[idx] as Code;
    const status = CODE_STATUS[code];
    let checkedAt: string | null = null;
    if (code !== "N") {
      checkedAt =
        category === "availability" && property.availabilityConfirmedAt
          ? toISODate(new Date(property.availabilityConfirmedAt))
          : toISODate(addDays(now, -(5 + ((spec.n * 3 + idx * 7) % 20))));
    }
    const hasEvidence = (category === "identity" || category === "authority") && code !== "N";
    return {
      id: `ver_${property.id}_${category}`,
      propertyId: property.id,
      category,
      status,
      source: "demo_fixture" as const,
      checkedAt,
      evidenceLabel: hasEvidence ? "Sample document (demo)" : null,
      note: code === "P" ? "Awaiting review (demo)" : null,
      seedStatus: status,
      simulatedAt: null,
      createdAt: property.createdAt,
      updatedAt: property.createdAt,
    };
  });
}

interface RequestSpec {
  n: number;
  propertyN: number;
  tenantN: number;
  name: string;
  status: RequestStatus;
  createdDaysAgo: number;
  preferredOffset: number;
  slot: TimeSlot;
  message: string | null;
  scheduledOffset?: number;
  cancelledBy?: "tenant" | "owner";
}

const REQUESTS: RequestSpec[] = [
  { n: 1001, propertyN: 1, tenantN: 1, name: "Riya S.", status: "pending", createdDaysAgo: 1, preferredOffset: 2, slot: "morning", message: "Is the flat available from next week?" },
  { n: 1002, propertyN: 1, tenantN: 2, name: "Karan M.", status: "contacted", createdDaysAgo: 3, preferredOffset: 4, slot: "evening", message: null },
  { n: 1003, propertyN: 2, tenantN: 3, name: "Meera P.", status: "scheduled", createdDaysAgo: 4, preferredOffset: 3, slot: "afternoon", message: "Would like to see the kitchenette.", scheduledOffset: 3 },
  { n: 1004, propertyN: 5, tenantN: 4, name: "Arjun T.", status: "completed", createdDaysAgo: 12, preferredOffset: -6, slot: "morning", message: null, scheduledOffset: -6 },
  { n: 1005, propertyN: 10, tenantN: 5, name: "Sana K.", status: "cancelled", createdDaysAgo: 14, preferredOffset: -10, slot: "afternoon", message: null, cancelledBy: "tenant" },
  { n: 1006, propertyN: 3, tenantN: 6, name: "Dev R.", status: "pending", createdDaysAgo: 2, preferredOffset: 5, slot: "evening", message: "Do you allow a small pet?" },
];

function buildRequest(spec: RequestSpec, properties: Property[], now: Date): VisitRequest {
  const property = properties.find((p) => p.id === propId(spec.propertyN));
  if (!property) throw new Error(`Seed error: missing property ${spec.propertyN}`);
  const created = addDays(now, -spec.createdDaysAgo);
  const at = (offsetHours: number) => toTimestamp(new Date(created.getTime() + offsetHours * 3_600_000));
  const history: StatusHistoryEntry[] = [{ status: "pending", at: at(0), by: "tenant" }];
  if (spec.status === "contacted") history.push({ status: "contacted", at: at(5), by: "owner" });
  if (spec.status === "scheduled") {
    history.push({ status: "contacted", at: at(5), by: "owner" }, { status: "scheduled", at: at(20), by: "owner" });
  }
  if (spec.status === "completed") {
    history.push({ status: "scheduled", at: at(6), by: "owner" }, { status: "completed", at: toTimestamp(addDays(now, -5)), by: "owner" });
  }
  if (spec.status === "cancelled") history.push({ status: "cancelled", at: at(30), by: spec.cancelledBy ?? "tenant" });
  const last = history[history.length - 1];
  return {
    id: `req_fx_${spec.n}`,
    displayCode: `NIV-VR-${spec.n}`,
    propertyId: property.id,
    ownerId: property.ownerId,
    tenantId: `tenant_fx_${spec.tenantN}`,
    tenantNameEntered: spec.name,
    /* No contact details in fixtures: nothing dialable, and no consent to share one (D7). */
    tenantPhoneEntered: null,
    sharePhoneWithOwner: false,
    preferredDate: toISODate(addDays(now, spec.preferredOffset)),
    preferredSlot: spec.slot,
    message: spec.message,
    status: spec.status,
    scheduledFor:
      spec.scheduledOffset != null
        ? { date: toISODate(addDays(now, spec.scheduledOffset)), slot: spec.slot }
        : null,
    cancelledBy: spec.cancelledBy ?? null,
    cancelReason: null,
    statusHistory: history,
    tenantLastSeenStatusAt: null,
    propertySnapshot: {
      title: property.title,
      locality: property.locality,
      rent: property.rent,
      photoId: property.photoIds[0] ?? null,
    },
    source: "fixture",
    createdAt: at(0),
    updatedAt: last ? last.at : at(0),
  };
}

function monthlyDueDate(now: Date, monthsAgo: number, dueDay: number): Date {
  return new Date(now.getFullYear(), now.getMonth() - monthsAgo, dueDay);
}

function buildRent(tenancy: Tenancy, now: Date, pastMonths: number[], unpaidMonthsAgo: number[]): RentRecord[] {
  const records: RentRecord[] = pastMonths.map((monthsAgo) => {
    const due = monthlyDueDate(now, monthsAgo, tenancy.dueDay);
    const unpaid = unpaidMonthsAgo.includes(monthsAgo);
    return {
      id: `rent_${tenancy.id}_${toISOMonth(due)}`,
      tenancyId: tenancy.id,
      month: toISOMonth(due),
      amount: tenancy.monthlyRent,
      dueDate: toISODate(due),
      paidAt: unpaid ? null : toTimestamp(addDays(due, 1)),
      recordedBy: unpaid ? null : "owner",
    };
  });
  /* Current cycle is always still "due": its due date is a few days after the seed day. */
  const currentDue = addDays(now, 5);
  records.push({
    id: `rent_${tenancy.id}_${toISOMonth(currentDue)}`,
    tenancyId: tenancy.id,
    month: toISOMonth(currentDue),
    amount: tenancy.monthlyRent,
    dueDate: toISODate(currentDue),
    paidAt: null,
    recordedBy: null,
  });
  return records;
}

export function buildSeed(now: Date): DataState {
  const owners: OwnerProfile[] = [
    { id: DEMO_OWNER_ID, displayName: null, phone: null, isDemo: true, source: "fixture" },
    { id: "owner_fx_a", displayName: "Sample Owner A", phone: null, isDemo: true, source: "fixture" },
    { id: "owner_fx_b", displayName: "Sample Owner B", phone: null, isDemo: true, source: "fixture" },
    { id: "owner_fx_c", displayName: "Sample Owner C", phone: null, isDemo: true, source: "fixture" },
  ];

  const sampleTenantNames = ["Riya S.", "Karan M.", "Meera P.", "Arjun T.", "Sana K.", "Dev R.", "Neha V."];
  const tenants: TenantProfile[] = [
    { id: DEMO_TENANT_ID, name: null, phone: null, isDemo: true, source: "fixture" },
    ...sampleTenantNames.map((name, i) => ({
      id: `tenant_fx_${i + 1}`,
      name,
      phone: null,
      isDemo: true as const,
      source: "fixture" as const,
    })),
  ];

  const properties = FIXTURES.map((s) => buildProperty(s, now));
  const verificationItems = FIXTURES.flatMap((s, i) => {
    const property = properties[i];
    return property ? buildVerificationItems(s, property, now) : [];
  });
  const visitRequests = REQUESTS.map((r) => buildRequest(r, properties, now));

  const tenancies: Tenancy[] = [
    { id: "tn_demo", propertyId: propId(15), ownerId: DEMO_OWNER_ID, tenantId: DEMO_TENANT_ID, startDate: toISODate(addDays(now, -150)), endDate: toISODate(addDays(now, 74)), monthlyRent: 24000, deposit: 48000, dueDay: 5, noticeDays: 30, source: "fixture" },
    { id: "tn_fx_2", propertyId: propId(16), ownerId: DEMO_OWNER_ID, tenantId: "tenant_fx_7", startDate: toISODate(addDays(now, -200)), endDate: toISODate(addDays(now, 165)), monthlyRent: 11500, deposit: 23000, dueDay: 5, noticeDays: 30, source: "fixture" },
  ];
  const [tnDemo, tnTwo] = tenancies;
  const rentRecords = [
    ...(tnDemo ? buildRent(tnDemo, now, [5, 4, 3, 2, 1], [2]) : []),
    ...(tnTwo ? buildRent(tnTwo, now, [3, 2, 1], []) : []),
  ];

  const at = (daysAgo: number) => toTimestamp(addDays(now, -daysAgo));
  const maintenanceRequests: MaintenanceRequest[] = [
    { id: "maint_fx_1001", displayCode: "NIV-RM-1001", tenancyId: "tn_demo", propertyId: propId(15), category: "plumbing", description: "Leaking kitchen tap", priority: "medium", status: "open", createdBy: "tenant", updates: [], source: "fixture", createdAt: at(6), updatedAt: at(6) },
    { id: "maint_fx_1002", displayCode: "NIV-RM-1002", tenancyId: "tn_demo", propertyId: propId(15), category: "appliance", description: "AC not cooling", priority: "high", status: "in_progress", createdBy: "tenant", updates: [{ at: at(3), by: "owner", status: "in_progress", note: "Technician visit pencilled in (demo)" }], source: "fixture", createdAt: at(8), updatedAt: at(3) },
    { id: "maint_fx_1003", displayCode: "NIV-RM-1003", tenancyId: "tn_fx_2", propertyId: propId(16), category: "other", description: "Repaint bedroom wall", priority: "low", status: "resolved", createdBy: "owner", updates: [{ at: at(20), by: "owner", status: "resolved" }], source: "fixture", createdAt: at(30), updatedAt: at(20) },
  ];

  return {
    owners,
    tenants,
    properties,
    verificationItems,
    visitRequests,
    savedProperties: [],
    tenancies,
    rentRecords,
    maintenanceRequests,
    presenter: { simulationLog: [] },
    counters: { request: 1007, property: 1, maintenance: 1004 },
  };
}

export function buildInitialUi(): UiState {
  return {
    persona: null,
    lastRoute: { tenant: null, owner: null },
    mapMode: "auto",
    ownerIntroSeen: false,
    wizardDraft: null,
    presenterMode: false,
    presenterNowOverride: null,
  };
}
