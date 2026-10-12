import { approximateCoordinates } from "./geo";
import { addDays, startOfDay, toISODate, toTimestamp } from "./dates";
import { getLocality } from "../data/reference";
import { formatRupees } from "./format";
import { REQUEST_STATUS_LABEL, VERIFICATION_CATEGORY_LABEL } from "./labels";
import {
  ACCURACY_FIELDS,
  parseListing,
  propertyToForm,
  validateListing,
  type ListingErrors,
  type ListingForm,
  type ListingValues,
} from "./listing";
import { transitionRequest, type TransitionPayload, type TransitionResult } from "./requests";
import type {
  DataState,
  HistoryEvent,
  OwnerProfile,
  Property,
  RequestStatus,
  VerificationCategory,
  VerificationItem,
  VisitRequest,
} from "./types";
import { normalizePhone, validateProfile } from "./validators";
import { VERIFICATION_CATEGORIES, getEffectiveVerification } from "./verification";

/**
 * Pure Owner write paths and selectors (blueprint §7). Same contract as the Tenant mutations:
 * current state in, new state (or a typed refusal) out. Everything an Owner changes lives in the
 * same records the Tenant screens read, so there is no second copy to drift (§9.1).
 */

export type OwnerFailure = { ok: false; code: "not_found" | "forbidden" | "invalid_transition" | "not_permitted"; message: string };

const ownerOf = (data: DataState, ownerId: string): OwnerProfile | undefined => data.owners.find((o) => o.id === ownerId);
const needsContact = (o: OwnerProfile | undefined) => !o || !o.displayName || !o.phone;

function findOwned(data: DataState, ownerId: string, propertyId: string): Property | OwnerFailure {
  const p = data.properties.find((x) => x.id === propertyId);
  if (!p) return { ok: false, code: "not_found", message: "That property could not be found." };
  if (p.ownerId !== ownerId) return { ok: false, code: "forbidden", message: "That property belongs to another owner." };
  return p;
}
const isFailure = (x: Property | OwnerFailure): x is OwnerFailure => "ok" in x;

/* ---------------------------------------------------------------- publish */

export type PublishResult =
  | { ok: true; data: DataState; property: Property }
  | { ok: false; code: "invalid"; firstInvalidStep: number; errors: ListingErrors; message: string };

export const OWNER_PROPERTY_ID = (seq: number) => `prop_u_${String(seq).padStart(3, "0")}`;
/** Fixtures use P001–P016; user-created listings continue the series. */
export const OWNER_DISPLAY_CODE = (seq: number) => `NIV-DEMO-P${String(16 + seq).padStart(3, "0")}`;

function initialVerificationItems(propertyId: string, now: Date, sampleIdentity: boolean, sampleAuthority: boolean): VerificationItem[] {
  const at = toTimestamp(now);
  const today = toISODate(now);
  const make = (category: VerificationCategory, status: VerificationItem["status"], opts: Partial<VerificationItem> = {}): VerificationItem => ({
    id: `ver_${propertyId}_${category}`,
    propertyId,
    category,
    status,
    source: "owner_declared",
    checkedAt: status === "not_checked" ? null : today,
    evidenceLabel: null,
    note: null,
    seedStatus: status,
    simulatedAt: null,
    createdAt: at,
    updatedAt: at,
    ...opts,
  });
  // Publishing never marks anything verified, except the owner's own availability declaration
  // (labelled owner-declared). Identity/authority only become Pending if a sample document was attached.
  return [
    make("identity", sampleIdentity ? "pending_review" : "not_checked", { evidenceLabel: sampleIdentity ? "Sample document (demo)" : null }),
    make("authority", sampleAuthority ? "pending_review" : "not_checked", { evidenceLabel: sampleAuthority ? "Sample document (demo)" : null }),
    make("listing_accuracy", "pending_review", { source: "demo_fixture", note: "Awaiting review (demo)" }),
    make("availability", "verified_demo", { note: "Confirmed by the owner when the listing was published." }),
  ];
}

function upsertOwner(owners: OwnerProfile[], id: string, patch: { displayName: string | null; phone: string | null }): OwnerProfile[] {
  if (owners.some((o) => o.id === id)) return owners.map((o) => (o.id === id ? { ...o, ...patch } : o));
  return [...owners, { id, ...patch, isDemo: true, source: "user" }];
}

export function publishProperty(data: DataState, ownerId: string, form: ListingForm, now: Date): PublishResult {
  const needContact = needsContact(ownerOf(data, ownerId));
  const checked = validateListing(form, { today: now, needContact });
  if (checked.firstInvalidStep !== null) {
    return { ok: false, code: "invalid", firstInvalidStep: checked.firstInvalidStep, errors: checked.errors, message: "Please fix the highlighted fields." };
  }
  const v = parseListing(form);
  const seq = data.counters.property;
  const id = OWNER_PROPERTY_ID(seq);
  const at = toTimestamp(now);
  const { lat, lng } = approximateCoordinates(getLocality(v.locality), id);
  const property: Property = {
    id,
    displayCode: OWNER_DISPLAY_CODE(seq),
    ownerId,
    ...v,
    lat,
    lng,
    locationPrecision: "locality_approximate",
    houseRules: null,
    listingStatus: "published",
    availabilityConfirmedAt: at,
    publishedAt: at,
    history: [
      { at, type: "created", summary: "Demo listing created" },
      { at, type: "published", summary: "Listing published (demo)" },
    ],
    source: "user",
    createdAt: at,
    updatedAt: at,
  };
  const name = needContact ? form.contactName.trim() : null;
  const phone = needContact ? normalizePhone(form.contactPhone) : null;
  const owners = needContact ? upsertOwner(data.owners, ownerId, { displayName: name ?? ownerOf(data, ownerId)?.displayName ?? null, phone: phone ?? ownerOf(data, ownerId)?.phone ?? null }) : data.owners;
  return {
    ok: true,
    property,
    data: {
      ...data,
      owners,
      properties: [property, ...data.properties],
      verificationItems: [...data.verificationItems, ...initialVerificationItems(id, now, form.sampleIdentity, form.sampleAuthority)],
      counters: { ...data.counters, property: seq + 1 },
    },
  };
}

/* ---------------------------------------------------------------- edit */

export type UpdateResult =
  | { ok: true; data: DataState; property: Property; changed: boolean }
  | { ok: false; code: "invalid"; firstInvalidStep: number; errors: ListingErrors; message: string }
  | OwnerFailure;

const FIELD_LABELS: Record<string, string> = {
  type: "type", title: "title", description: "description", locality: "locality", addressArea: "address area", landmark: "landmark",
  deposit: "deposit", maintenanceCharge: "maintenance charge", maintenanceIncluded: "maintenance", availableFrom: "available-from date",
  bedrooms: "rooms", bathrooms: "bathrooms", furnishing: "furnishing", sizeSqft: "size", amenities: "amenities", photoIds: "photos",
};

/** Edit steps (the verification-information and acknowledgement steps only apply when publishing). */
export const EDIT_STEPS = [1, 2, 3, 4, 5, 6] as const;

export function updateProperty(data: DataState, ownerId: string, propertyId: string, form: ListingForm, now: Date): UpdateResult {
  const found = findOwned(data, ownerId, propertyId);
  if (isFailure(found)) return found;
  const before = found;
  const checked = validateListing(form, { today: now, needContact: false, keepAvailableFrom: before.availableFrom }, EDIT_STEPS);
  if (checked.firstInvalidStep !== null) {
    return { ok: false, code: "invalid", firstInvalidStep: checked.firstInvalidStep, errors: checked.errors, message: "Please fix the highlighted fields." };
  }
  const v = parseListing(form);
  const changes: string[] = [];
  const keys = Object.keys(v) as (keyof ListingValues)[];
  for (const k of keys) {
    if (k === "rent") {
      if (v.rent !== before.rent) changes.push(`Rent ${formatRupees(before.rent)} → ${formatRupees(v.rent)}`);
      continue;
    }
    if (k === "amenities") {
      // order is irrelevant: compare as sets
      if (JSON.stringify([...v.amenities].sort()) !== JSON.stringify([...before.amenities].sort())) changes.push(FIELD_LABELS.amenities as string);
      continue;
    }
    if (JSON.stringify(v[k]) !== JSON.stringify(before[k as keyof Property])) changes.push(FIELD_LABELS[k] ?? String(k));
  }
  if (changes.length === 0) return { ok: true, data, property: before, changed: false };

  const at = toTimestamp(now);
  const localityChanged = v.locality !== before.locality;
  const coords = localityChanged ? approximateCoordinates(getLocality(v.locality), before.id) : { lat: before.lat, lng: before.lng };
  const event: HistoryEvent = { at, type: "updated", summary: `Details updated: ${changes.join(", ")}` };
  const property: Property = { ...before, ...v, ...coords, history: [event, ...before.history], updatedAt: at };

  const accuracyTouched = ACCURACY_FIELDS.some((k) => JSON.stringify(v[k as keyof ListingValues]) !== JSON.stringify(before[k as keyof Property]));
  let items = data.verificationItems;
  if (accuracyTouched && (before.listingStatus === "published" || before.listingStatus === "unavailable")) {
    items = items.map((i) =>
      i.propertyId === before.id && i.category === "listing_accuracy" && i.status === "verified_demo"
        ? { ...i, status: "pending_review" as const, note: "Details changed after last check", checkedAt: toISODate(now), simulatedAt: null, updatedAt: at }
        : i,
    );
  }
  return { ok: true, changed: true, property, data: { ...data, properties: data.properties.map((p) => (p.id === before.id ? property : p)), verificationItems: items } };
}

/* ---------------------------------------------------------------- availability and verification */

export type PropertyResult = { ok: true; data: DataState; property: Property } | OwnerFailure;

/**
 * Availability toggle (§7.5). Published → Unavailable hides the home from default search; request
 * history is never touched. Unavailable → Published re-confirms availability as owner-declared.
 */
export function setListingStatus(data: DataState, ownerId: string, propertyId: string, to: "published" | "unavailable", now: Date): PropertyResult {
  const found = findOwned(data, ownerId, propertyId);
  if (isFailure(found)) return found;
  const p = found;
  const allowed = (p.listingStatus === "published" && to === "unavailable") || (p.listingStatus === "unavailable" && to === "published");
  if (!allowed) {
    return { ok: false, code: "invalid_transition", message: `A ${p.listingStatus.replace("_", " ")} listing can't be changed to ${to} from here.` };
  }
  const at = toTimestamp(now);
  const event: HistoryEvent = { at, type: to, summary: to === "unavailable" ? "Marked unavailable (demo)" : "Marked available again; availability re-confirmed (demo)" };
  const property: Property = {
    ...p,
    listingStatus: to,
    availabilityConfirmedAt: to === "published" ? at : p.availabilityConfirmedAt,
    history: [event, ...p.history],
    updatedAt: at,
  };
  const items = to === "published" ? confirmAvailabilityItem(data.verificationItems, p.id, now) : data.verificationItems;
  return { ok: true, property, data: { ...data, properties: data.properties.map((x) => (x.id === p.id ? property : x)), verificationItems: items } };
}

function confirmAvailabilityItem(items: VerificationItem[], propertyId: string, now: Date): VerificationItem[] {
  const at = toTimestamp(now);
  return items.map((i) =>
    i.propertyId === propertyId && i.category === "availability"
      ? { ...i, status: "verified_demo" as const, source: "owner_declared" as const, checkedAt: toISODate(now), simulatedAt: null, note: "Confirmed by the owner", updatedAt: at }
      : i,
  );
}

export function reconfirmAvailability(data: DataState, ownerId: string, propertyId: string, now: Date): PropertyResult {
  const found = findOwned(data, ownerId, propertyId);
  if (isFailure(found)) return found;
  const p = found;
  if (p.listingStatus !== "published") {
    return { ok: false, code: "invalid_transition", message: "Only a published listing can be re-confirmed. Mark it available first." };
  }
  const at = toTimestamp(now);
  const property: Property = {
    ...p,
    availabilityConfirmedAt: at,
    history: [{ at, type: "availability_confirmed", summary: "Availability re-confirmed by the owner (demo)" }, ...p.history],
    updatedAt: at,
  };
  return { ok: true, property, data: { ...data, properties: data.properties.map((x) => (x.id === p.id ? property : x)), verificationItems: confirmAvailabilityItem(data.verificationItems, p.id, now) } };
}

/** Mock "attach sample document (demo)" for identity / authority: Not yet checked → Pending review. */
export function attachSampleDocument(data: DataState, ownerId: string, propertyId: string, category: "identity" | "authority", now: Date): PropertyResult {
  const found = findOwned(data, ownerId, propertyId);
  if (isFailure(found)) return found;
  const p = found;
  const item = data.verificationItems.find((i) => i.propertyId === p.id && i.category === category);
  if (!item || item.status !== "not_checked") {
    return { ok: false, code: "invalid_transition", message: `${VERIFICATION_CATEGORY_LABEL[category]} isn't waiting for a document.` };
  }
  const at = toTimestamp(now);
  const items = data.verificationItems.map((i) =>
    i.id === item.id ? { ...i, status: "pending_review" as const, source: "owner_declared" as const, evidenceLabel: "Sample document (demo)", checkedAt: toISODate(now), note: "Sample document attached (demo)", updatedAt: at } : i,
  );
  const property: Property = { ...p, history: [{ at, type: "verification", summary: `${VERIFICATION_CATEGORY_LABEL[category]}: sample document attached (demo)` }, ...p.history], updatedAt: at };
  return { ok: true, property, data: { ...data, properties: data.properties.map((x) => (x.id === p.id ? property : x)), verificationItems: items } };
}

export type OwnerProfileResult = { ok: true; data: DataState } | { ok: false; errors: Partial<Record<"name" | "phone", string>> };

export function saveOwnerProfile(data: DataState, ownerId: string, values: { name: string; phone: string }): OwnerProfileResult {
  const checked = validateProfile(values);
  if (!checked.ok) return checked;
  return { ok: true, data: { ...data, owners: upsertOwner(data.owners, ownerId, { displayName: checked.value.name, phone: checked.value.phone }) } };
}

/* ---------------------------------------------------------------- owner request actions (Phase 5) */

export type OwnerRequestResult = { ok: true; data: DataState; request: VisitRequest } | Exclude<TransitionResult, { ok: true }> | OwnerFailure;

export const SCHEDULE_RANGE_ERROR = "Choose a visit date within the next 60 days.";

/**
 * Owner status change on a request for one of THEIR properties. Validates against the CURRENT
 * stored status (stale tabs cannot write invalid transitions) and writes nothing on failure.
 */
export function ownerTransitionRequest(data: DataState, ownerId: string, requestId: string, to: RequestStatus, payload: TransitionPayload, now: Date): OwnerRequestResult {
  const current = data.visitRequests.find((r) => r.id === requestId && r.ownerId === ownerId);
  if (!current) return { ok: false, code: "not_found", message: "That request could not be found." };
  if (to === "scheduled" && payload.scheduledFor) {
    const min = toISODate(startOfDay(now));
    const max = toISODate(addDays(startOfDay(now), 60));
    const d = payload.scheduledFor.date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (d < min || d > max)) return { ok: false, code: "invalid_schedule", message: SCHEDULE_RANGE_ERROR };
  }
  const result = transitionRequest(current, to, "owner", now, payload);
  if (!result.ok) return result;
  return { ok: true, request: result.request, data: { ...data, visitRequests: data.visitRequests.map((r) => (r.id === requestId ? result.request : r)) } };
}

/* ---------------------------------------------------------------- selectors */

export function selectOwnerProperties(data: Pick<DataState, "properties">, ownerId: string): Property[] {
  return data.properties.filter((p) => p.ownerId === ownerId);
}

export function selectOwnerRequests(data: Pick<DataState, "visitRequests">, ownerId: string): VisitRequest[] {
  return data.visitRequests
    .filter((r) => r.ownerId === ownerId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export interface OwnerStats {
  total: number;
  active: number;
  pendingVerificationTasks: number;
  newRequests: number;
  scheduledVisits: number;
}

const OPEN_VERIFICATION: ReadonlySet<string> = new Set(["pending_review", "not_checked", "needs_reverification"]);

export function selectOwnerStats(data: Pick<DataState, "properties" | "verificationItems" | "visitRequests">, ownerId: string, now: Date): OwnerStats {
  const props = selectOwnerProperties(data, ownerId);
  let tasks = 0;
  for (const p of props) {
    if (p.listingStatus !== "published" && p.listingStatus !== "pending_review") continue;
    tasks += getEffectiveVerification(p, data.verificationItems, now).filter((e) => OPEN_VERIFICATION.has(e.status)).length;
  }
  const reqs = selectOwnerRequests(data, ownerId);
  const today = toISODate(startOfDay(now));
  return {
    total: props.length,
    active: props.filter((p) => p.listingStatus === "published").length,
    pendingVerificationTasks: tasks,
    newRequests: reqs.filter((r) => r.status === "pending").length,
    scheduledVisits: reqs.filter((r) => r.status === "scheduled" && r.scheduledFor !== null && r.scheduledFor.date >= today).length,
  };
}

export interface AttentionItem {
  key: string;
  text: string;
  to: string;
}

/** "Needs your attention": new requests, stale availability, pending verification (max 5). */
export function selectAttention(data: Pick<DataState, "properties" | "verificationItems" | "visitRequests">, ownerId: string, now: Date, max = 5): AttentionItem[] {
  const out: AttentionItem[] = [];
  const newReqs = selectOwnerRequests(data, ownerId).filter((r) => r.status === "pending");
  for (const r of newReqs) out.push({ key: `req-${r.id}`, text: `New request ${r.displayCode} for ${r.propertySnapshot.title}`, to: "/owner/requests" });
  for (const p of selectOwnerProperties(data, ownerId)) {
    if (p.listingStatus !== "published") continue;
    const eff = getEffectiveVerification(p, data.verificationItems, now);
    if (eff.find((e) => e.category === "availability")?.stale) out.push({ key: `stale-${p.id}`, text: `Re-confirm availability for ${p.title}`, to: `/owner/verification?property=${p.id}` });
  }
  const tasks = selectOwnerStats(data, ownerId, now).pendingVerificationTasks;
  if (tasks > 0) out.push({ key: "verification", text: `${tasks} verification ${tasks === 1 ? "item needs" : "items need"} attention (demo data)`, to: "/owner/verification" });
  return out.slice(0, max);
}

export interface ActivityItem {
  key: string;
  at: string;
  text: string;
}

export function selectRecentActivity(data: Pick<DataState, "properties" | "visitRequests">, ownerId: string, max = 5): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const p of selectOwnerProperties(data, ownerId)) {
    p.history.forEach((h, i) => items.push({ key: `${p.id}-h${i}`, at: h.at, text: `${p.title}: ${h.summary}` }));
  }
  for (const r of selectOwnerRequests(data, ownerId)) {
    r.statusHistory.forEach((h, i) =>
      items.push({ key: `${r.id}-s${i}`, at: h.at, text: `${r.displayCode} (${r.propertySnapshot.title}) → ${REQUEST_STATUS_LABEL[h.status]}, by ${h.by === "tenant" ? "the tenant" : h.by === "owner" ? "you" : "the system"}` }),
    );
  }
  return items.sort((a, b) => b.at.localeCompare(a.at) || a.key.localeCompare(b.key)).slice(0, max);
}

export function countRequestsByProperty(data: Pick<DataState, "visitRequests">, propertyId: string): { open: number; total: number } {
  const list = data.visitRequests.filter((r) => r.propertyId === propertyId);
  return { open: list.filter((r) => r.status === "pending" || r.status === "contacted" || r.status === "scheduled").length, total: list.length };
}

export { propertyToForm, VERIFICATION_CATEGORIES };
