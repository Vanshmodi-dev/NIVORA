import { toISODate } from "./dates";
import { isOpenRequest, transitionRequest } from "./requests";
import { isTenantVisible } from "./search";
import type { DataState, SavedProperty, TenantProfile, TimeSlot, VisitRequest } from "./types";
import { validateProfile, validateVisitForm, type FieldErrors, type VisitFormValues } from "./validators";

/**
 * Pure tenant write paths (blueprint §13.5). Each takes the CURRENT state and returns a new one
 * (or a typed refusal). Nothing here touches storage or the DOM, so rules live in one place and a
 * UI bug cannot create an invalid record. Success is only ever returned together with new state.
 */

export interface VisitInput extends VisitFormValues {
  tenantId: string;
  propertyId: string;
  /** Explicit consent to share the phone number with the owner — false unless the tenant ticked it (D7). */
  sharePhoneWithOwner: boolean;
}

export type CreateVisitResult =
  | { ok: true; data: DataState; request: VisitRequest }
  | { ok: false; code: "invalid"; message: string; errors: FieldErrors }
  | { ok: false; code: "not_found" | "not_available"; message: string }
  | { ok: false; code: "duplicate"; message: string; existing: VisitRequest };

export const NOT_AVAILABLE_MESSAGE = "This home is no longer available, so a visit can't be requested.";
export const NOT_FOUND_MESSAGE = "This home isn't available to view.";

/** The Tenant's open (pending / contacted / scheduled) request for a property, if any. */
export function findOpenRequest(data: Pick<DataState, "visitRequests">, tenantId: string, propertyId: string): VisitRequest | null {
  return data.visitRequests.find((r) => r.tenantId === tenantId && r.propertyId === propertyId && isOpenRequest(r.status)) ?? null;
}

/**
 * Creates a visit request. Order of checks (§6.6): the property is re-read from the latest state
 * and must be published; then the duplicate guard; then field validation.
 */
export function createVisitRequest(data: DataState, input: VisitInput, now: Date): CreateVisitResult {
  const property = data.properties.find((p) => p.id === input.propertyId);
  if (!property || !isTenantVisible(property)) return { ok: false, code: "not_found", message: NOT_FOUND_MESSAGE };
  if (property.listingStatus !== "published") return { ok: false, code: "not_available", message: NOT_AVAILABLE_MESSAGE };

  const existing = findOpenRequest(data, input.tenantId, input.propertyId);
  if (existing) {
    return { ok: false, code: "duplicate", existing, message: `You already have an open request (${existing.displayCode}) for this home.` };
  }

  const checked = validateVisitForm(input, now);
  if (!checked.ok) return { ok: false, code: "invalid", errors: checked.errors, message: "Please fix the highlighted fields." };
  const v = checked.value;

  const seq = data.counters.request;
  const at = now.toISOString();
  const request: VisitRequest = {
    id: `req_u_${seq}`,
    displayCode: `NIV-VR-${seq}`,
    propertyId: property.id,
    ownerId: property.ownerId,
    tenantId: input.tenantId,
    tenantNameEntered: v.name,
    tenantPhoneEntered: v.phone,
    sharePhoneWithOwner: input.sharePhoneWithOwner === true,
    preferredDate: v.date,
    preferredSlot: v.slot as TimeSlot,
    message: v.message,
    status: "pending",
    scheduledFor: null,
    cancelledBy: null,
    cancelReason: null,
    statusHistory: [{ status: "pending", at, by: "tenant" }],
    tenantLastSeenStatusAt: null,
    propertySnapshot: { title: property.title, locality: property.locality, rent: property.rent, photoId: property.photoIds[0] ?? null },
    source: "user",
    createdAt: at,
    updatedAt: at,
  };

  return {
    ok: true,
    request,
    data: {
      ...data,
      visitRequests: [request, ...data.visitRequests],
      tenants: upsertTenant(data.tenants, input.tenantId, { name: v.name, phone: v.phone }),
      counters: { ...data.counters, request: seq + 1 },
    },
  };
}

function upsertTenant(tenants: TenantProfile[], id: string, patch: { name: string | null; phone: string | null }): TenantProfile[] {
  if (tenants.some((t) => t.id === id)) return tenants.map((t) => (t.id === id ? { ...t, ...patch } : t));
  return [...tenants, { id, ...patch, isDemo: true, source: "user" }];
}

export type CancelResult =
  | { ok: true; data: DataState; request: VisitRequest }
  | { ok: false; code: "not_found" | "invalid_transition" | "not_permitted" | "missing_schedule" | "invalid_schedule"; message: string };

/**
 * Tenant cancels their own open request. Validates against the CURRENT stored status, so a stale
 * view cannot write an invalid transition; on failure nothing is written (AC-23).
 */
export function cancelVisitRequest(data: DataState, tenantId: string, requestId: string, reason: string, now: Date): CancelResult {
  const current = data.visitRequests.find((r) => r.id === requestId && r.tenantId === tenantId);
  if (!current) return { ok: false, code: "not_found", message: "That request could not be found." };
  const result = transitionRequest(current, "cancelled", "tenant", now, { note: reason });
  if (!result.ok) return result;
  return { ok: true, request: result.request, data: { ...data, visitRequests: data.visitRequests.map((r) => (r.id === requestId ? result.request : r)) } };
}

export type ToggleSavedResult =
  | { ok: true; data: DataState; saved: boolean }
  | { ok: false; code: "not_found"; message: string };

/** Save / unsave. Published and unavailable homes can be saved; draft and pending ones cannot be seen at all. */
export function toggleSavedProperty(data: DataState, tenantId: string, propertyId: string, now: Date): ToggleSavedResult {
  const existing = data.savedProperties.find((s) => s.tenantId === tenantId && s.propertyId === propertyId);
  if (existing) {
    return { ok: true, saved: false, data: { ...data, savedProperties: data.savedProperties.filter((s) => s.id !== existing.id) } };
  }
  const property = data.properties.find((p) => p.id === propertyId);
  if (!property || !isTenantVisible(property)) return { ok: false, code: "not_found", message: NOT_FOUND_MESSAGE };
  const saved: SavedProperty = { id: `sp_${tenantId}_${propertyId}`, tenantId, propertyId, savedAt: now.toISOString() };
  return { ok: true, saved: true, data: { ...data, savedProperties: [saved, ...data.savedProperties] } };
}

/**
 * "Updated" indicator (in-app only, not a notification): the latest status change was made by
 * someone other than the tenant and the tenant hasn't opened the request since.
 */
export function hasUnseenUpdate(r: Pick<VisitRequest, "statusHistory" | "tenantLastSeenStatusAt">): boolean {
  const last = r.statusHistory[r.statusHistory.length - 1];
  if (!last || last.by === "tenant") return false;
  return r.tenantLastSeenStatusAt === null || r.tenantLastSeenStatusAt < last.at;
}

export function markRequestSeen(data: DataState, tenantId: string, requestId: string): DataState {
  const r = data.visitRequests.find((x) => x.id === requestId && x.tenantId === tenantId);
  const last = r?.statusHistory[r.statusHistory.length - 1];
  if (!r || !last || r.tenantLastSeenStatusAt === last.at) return data;
  return { ...data, visitRequests: data.visitRequests.map((x) => (x.id === requestId ? { ...x, tenantLastSeenStatusAt: last.at } : x)) };
}

export type ProfileResult =
  | { ok: true; data: DataState }
  | { ok: false; errors: Partial<Record<"name" | "phone", string>> };

export function saveTenantProfile(data: DataState, tenantId: string, values: { name: string; phone: string }): ProfileResult {
  const checked = validateProfile(values);
  if (!checked.ok) return checked;
  return { ok: true, data: { ...data, tenants: upsertTenant(data.tenants, tenantId, checked.value) } };
}

export function clearTenantProfile(data: DataState, tenantId: string): DataState {
  return { ...data, tenants: data.tenants.map((t) => (t.id === tenantId ? { ...t, name: null, phone: null } : t)) };
}

/**
 * The ONLY way owner screens may obtain a tenant's phone number (founder decision D7): it is
 * returned only when the tenant explicitly consented on that request; otherwise `null`.
 */
export function getOwnerVisiblePhone(request: Pick<VisitRequest, "tenantPhoneEntered" | "sharePhoneWithOwner">): string | null {
  return request.sharePhoneWithOwner && request.tenantPhoneEntered ? request.tenantPhoneEntered : null;
}

/* ---------------------------------------------------------------- tenant selectors */

const byUpdatedDesc = (a: VisitRequest, b: VisitRequest) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id);

export function selectTenantRequests(data: Pick<DataState, "visitRequests">, tenantId: string): VisitRequest[] {
  return data.visitRequests.filter((r) => r.tenantId === tenantId).sort(byUpdatedDesc);
}

export type RequestFilter = "all" | "open" | "scheduled" | "closed";

export function filterRequests(list: readonly VisitRequest[], filter: RequestFilter): VisitRequest[] {
  switch (filter) {
    case "all": return [...list];
    case "open": return list.filter((r) => isOpenRequest(r.status));
    case "scheduled": return list.filter((r) => r.status === "scheduled");
    case "closed": return list.filter((r) => r.status === "completed" || r.status === "cancelled");
  }
}

/** Scheduled visits whose confirmed date is today or later, soonest first. */
export function selectUpcomingVisits(data: Pick<DataState, "visitRequests">, tenantId: string, now: Date): VisitRequest[] {
  const today = toISODate(now);
  return data.visitRequests
    .filter((r) => r.tenantId === tenantId && r.status === "scheduled" && r.scheduledFor !== null && r.scheduledFor.date >= today)
    .sort((a, b) => (a.scheduledFor?.date ?? "").localeCompare(b.scheduledFor?.date ?? ""));
}

export function selectSavedProperties(data: Pick<DataState, "savedProperties" | "properties">, tenantId: string) {
  return data.savedProperties
    .filter((s) => s.tenantId === tenantId)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .flatMap((s) => {
      const property = data.properties.find((p) => p.id === s.propertyId);
      return property ? [{ saved: s, property }] : [];
    });
}
