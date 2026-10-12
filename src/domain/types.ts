/**
 * Canonical domain types (blueprint §13). All records are fictional demo data.
 * Dates are `YYYY-MM-DD`; timestamps are ISO-8601 strings.
 */
export type ISODate = string;
export type ISOTimestamp = string;

export type RecordSource = "fixture" | "user";
export type Persona = "tenant" | "owner";

export type PropertyType =
  | "apartment"
  | "independent_house"
  | "builder_floor"
  | "studio"
  | "single_room";

export type Furnishing = "unfurnished" | "semi_furnished" | "fully_furnished";

/** Listing lifecycle (D-04). Tenants only ever see `published` / `unavailable`. */
export type ListingStatus = "draft" | "pending_review" | "published" | "unavailable";

export type LocalityId =
  | "malviya_nagar"
  | "c_scheme"
  | "vaishali_nagar"
  | "mansarovar"
  | "raja_park"
  | "bani_park"
  | "jagatpura"
  | "sitapura"
  | "jawahar_nagar"
  | "sodala"
  | "gopalpura";

export type AmenityId =
  | "parking"
  | "wifi"
  | "lift"
  | "power_backup"
  | "water_24h"
  | "modular_kitchen"
  | "security"
  | "air_conditioning"
  | "balcony"
  | "gym_access"
  | "pet_friendly"
  | "gated_society";

export type VerificationCategory = "identity" | "authority" | "listing_accuracy" | "availability";

export type VerificationStatus =
  | "verified_demo"
  | "pending_review"
  | "not_checked"
  | "needs_reverification";

/** `simulated_review` is written only by Presenter Demo Mode (blueprint §9.6, P1). */
export type VerificationSource = "demo_fixture" | "owner_declared" | "simulated_review";

/** One canonical vocabulary for both roles (D-03). Initial status is `pending`. */
export type RequestStatus = "pending" | "contacted" | "scheduled" | "completed" | "cancelled";
export type TimeSlot = "morning" | "afternoon" | "evening";
export type Actor = "tenant" | "owner" | "system";

export type MaintenanceCategory =
  | "plumbing"
  | "electrical"
  | "appliance"
  | "cleaning"
  | "furniture"
  | "other";
export type MaintenancePriority = "low" | "medium" | "high";
export type MaintenanceStatus = "open" | "in_progress" | "resolved";

export interface OwnerProfile {
  id: string;
  displayName: string | null;
  phone: string | null;
  isDemo: true;
  source: RecordSource;
}

export interface TenantProfile {
  id: string;
  name: string | null;
  phone: string | null;
  isDemo: true;
  source: RecordSource;
}

export interface HistoryEvent {
  at: ISOTimestamp;
  type: string;
  summary: string;
}

export interface HouseRules {
  minLeaseMonths: 6 | 11 | 12;
  maxOccupants: number;
  petsAllowed: boolean;
  smokingAllowed: boolean;
}

export interface Property {
  id: string;
  displayCode: string;
  ownerId: string;
  title: string;
  description: string;
  type: PropertyType;
  locality: LocalityId;
  addressArea: string;
  landmark: string | null;
  lat: number;
  lng: number;
  locationPrecision: "locality_approximate";
  rent: number;
  deposit: number;
  maintenanceCharge: number | null;
  maintenanceIncluded: boolean;
  availableFrom: ISODate;
  bedrooms: number;
  bathrooms: number;
  furnishing: Furnishing;
  sizeSqft: number | null;
  amenities: AmenityId[];
  houseRules: HouseRules | null;
  /** Ids into the licensed image set (§14.13). No assets exist yet; UI falls back to the placeholder. */
  photoIds: string[];
  listingStatus: ListingStatus;
  availabilityConfirmedAt: ISOTimestamp | null;
  publishedAt: ISOTimestamp | null;
  history: HistoryEvent[];
  source: RecordSource;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface VerificationItem {
  id: string;
  propertyId: string;
  category: VerificationCategory;
  status: VerificationStatus;
  source: VerificationSource;
  checkedAt: ISODate | null;
  evidenceLabel: string | null;
  note: string | null;
  /** Status assigned at seed/publish — basis for "Restore seeded verification state". */
  seedStatus: VerificationStatus;
  simulatedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface StatusHistoryEntry {
  status: RequestStatus;
  at: ISOTimestamp;
  by: Actor;
  note?: string;
}

export interface VisitRequest {
  id: string;
  displayCode: string;
  propertyId: string;
  ownerId: string;
  tenantId: string;
  tenantNameEntered: string;
  /** 10 digits as entered in the mock form; `null` for fixtures (never a dialable-looking number). */
  tenantPhoneEntered: string | null;
  /**
   * Explicit tenant consent (unchecked by default, founder decision D7). Owner screens may show
   * `tenantPhoneEntered` ONLY when this is true — use `getOwnerVisiblePhone`.
   */
  sharePhoneWithOwner: boolean;
  preferredDate: ISODate;
  preferredSlot: TimeSlot;
  message: string | null;
  status: RequestStatus;
  scheduledFor: { date: ISODate; slot: TimeSlot } | null;
  cancelledBy: "tenant" | "owner" | null;
  cancelReason: string | null;
  statusHistory: StatusHistoryEntry[];
  tenantLastSeenStatusAt: ISOTimestamp | null;
  propertySnapshot: { title: string; locality: LocalityId; rent: number; photoId: string | null };
  source: RecordSource;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

export interface SavedProperty {
  id: string;
  tenantId: string;
  propertyId: string;
  savedAt: ISOTimestamp;
}

export interface Tenancy {
  id: string;
  propertyId: string;
  ownerId: string;
  tenantId: string;
  startDate: ISODate;
  endDate: ISODate;
  monthlyRent: number;
  deposit: number;
  dueDay: number;
  noticeDays: number;
  source: RecordSource;
}

export interface RentRecord {
  id: string;
  tenancyId: string;
  /** `YYYY-MM` */
  month: string;
  amount: number;
  dueDate: ISODate;
  paidAt: ISOTimestamp | null;
  recordedBy: "owner" | null;
}

export type RentStatus = "paid" | "due" | "overdue";

export interface MaintenanceUpdate {
  at: ISOTimestamp;
  by: "tenant" | "owner";
  status: MaintenanceStatus;
  note?: string;
}

export interface MaintenanceRequest {
  id: string;
  displayCode: string;
  tenancyId: string;
  propertyId: string;
  category: MaintenanceCategory;
  description: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  createdBy: "tenant" | "owner";
  updates: MaintenanceUpdate[];
  source: RecordSource;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** Presenter Demo Mode log entry (P1; the field exists from Phase 1 so reset/persistence cover it). */
export interface SimulationLogEntry {
  id: string;
  target: string;
  field: string;
  from: string | null;
  to: string | null;
  at: ISOTimestamp;
  /** JSON of the record fields as they were before the change — what "Undo all" restores. */
  snapshot: string | null;
}

export interface Counters {
  /** Next visit-request sequence number (fixtures consume 1001–1006). */
  request: number;
  /** Next user-created property sequence (id `prop_u_###`). */
  property: number;
  /** Next maintenance sequence (fixtures consume 1001–1003). */
  maintenance: number;
}

export interface DataState {
  owners: OwnerProfile[];
  tenants: TenantProfile[];
  properties: Property[];
  verificationItems: VerificationItem[];
  visitRequests: VisitRequest[];
  savedProperties: SavedProperty[];
  tenancies: Tenancy[];
  rentRecords: RentRecord[];
  maintenanceRequests: MaintenanceRequest[];
  presenter: { simulationLog: SimulationLogEntry[] };
  counters: Counters;
}

export type MapMode = "auto" | "street" | "schematic";

export interface UiState {
  persona: Persona | null;
  lastRoute: { tenant: string | null; owner: string | null };
  mapMode: MapMode;
  ownerIntroSeen: boolean;
  /** Working copy of the Add Property wizard (Phase 4). */
  wizardDraft: unknown | null;
  /** Presenter Mode flag. Session-scoped by design (§9.6): never written to persistent storage. */
  presenterMode: boolean;
  /**
   * Presenter-only simulated "now" (founder D6). Session-scoped like `presenterMode`: never persisted,
   * cleared on exit and on reset, and the OS clock is never touched.
   */
  presenterNowOverride: string | null;
}

export const DEMO_TENANT_ID = "tenant_demo";
export const DEMO_OWNER_ID = "owner_demo";
