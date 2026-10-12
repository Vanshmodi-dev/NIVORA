import { daysBetween, parseISODate, startOfDay, toISOMonth, toTimestamp } from "./dates";
import type {
  DataState,
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequest,
  MaintenanceStatus,
  RentRecord,
  RentStatus,
  Tenancy,
} from "./types";
import { deriveRentStatus } from "./rent";

/**
 * Tenancy lifecycle previews (blueprint §6.9, §7.7, §7.8): rent status tracking and maintenance
 * requests. Both sides read and write the SAME records. Rent "paid" is a recorded demo status, not a
 * transaction; maintenance has no technician dispatch. Nothing here talks to anything external.
 */

export const MAINTENANCE_CATEGORIES: readonly MaintenanceCategory[] = ["plumbing", "electrical", "appliance", "cleaning", "furniture", "other"];
export const MAINTENANCE_PRIORITIES: readonly MaintenancePriority[] = ["low", "medium", "high"];

/* ------------------------------------------------------------------ rent */

export interface RentRow {
  record: RentRecord;
  tenancy: Tenancy;
  propertyTitle: string;
  tenantName: string;
  status: RentStatus;
}

export function selectRentRows(data: Pick<DataState, "rentRecords" | "tenancies" | "properties" | "tenants">, ownerId: string, now: Date): RentRow[] {
  const rows: RentRow[] = [];
  for (const record of data.rentRecords) {
    const tenancy = data.tenancies.find((t) => t.id === record.tenancyId);
    if (!tenancy || tenancy.ownerId !== ownerId) continue;
    rows.push({
      record,
      tenancy,
      propertyTitle: data.properties.find((p) => p.id === tenancy.propertyId)?.title ?? "Property",
      tenantName: data.tenants.find((t) => t.id === tenancy.tenantId)?.name ?? "Demo tenant",
      status: deriveRentStatus(record, now),
    });
  }
  return rows.sort((a, b) => b.record.dueDate.localeCompare(a.record.dueDate) || a.record.id.localeCompare(b.record.id));
}

export interface RentSummary {
  expected: number;
  paid: number;
  outstanding: number;
  overdueCount: number;
}

export function summariseRent(rows: readonly RentRow[]): RentSummary {
  const sum = (list: readonly RentRow[]) => list.reduce((n, r) => n + r.record.amount, 0);
  return {
    expected: sum(rows),
    paid: sum(rows.filter((r) => r.status === "paid")),
    outstanding: sum(rows.filter((r) => r.status !== "paid")),
    overdueCount: rows.filter((r) => r.status === "overdue").length,
  };
}

/** The month the Owner's summary tiles open on: the current month if there are records for it, else the latest. */
export function defaultRentMonth(rows: readonly RentRow[], now: Date): string | null {
  const months = [...new Set(rows.map((r) => r.record.month))].sort().reverse();
  const current = toISOMonth(now);
  return months.includes(current) ? current : (months[0] ?? null);
}

export type RentResult = { ok: true; data: DataState; record: RentRecord } | { ok: false; code: "not_found" | "already_paid"; message: string };

/** "Record as paid (demo)": records a status only. No money moves and nothing is checked. */
export function recordRentPaid(data: DataState, ownerId: string, rentId: string, now: Date): RentResult {
  const record = data.rentRecords.find((r) => r.id === rentId);
  const tenancy = record ? data.tenancies.find((t) => t.id === record.tenancyId) : undefined;
  if (!record || !tenancy || tenancy.ownerId !== ownerId) return { ok: false, code: "not_found", message: "That rent record could not be found." };
  if (record.paidAt) return { ok: false, code: "already_paid", message: "This month is already recorded as paid." };
  const updated: RentRecord = { ...record, paidAt: toTimestamp(now), recordedBy: "owner" };
  return { ok: true, record: updated, data: { ...data, rentRecords: data.rentRecords.map((r) => (r.id === rentId ? updated : r)) } };
}

/* ------------------------------------------------------------------ tenancy (tenant side) */

export function selectTenantTenancy(data: Pick<DataState, "tenancies">, tenantId: string): Tenancy | null {
  return data.tenancies.find((t) => t.tenantId === tenantId) ?? null;
}

export interface RenewalInfo {
  daysLeft: number;
  /** Reminders would start this many days before the end date (§6.9: display only). */
  reminderWindowDays: number;
  inWindow: boolean;
}

export function renewalInfo(tenancy: Pick<Tenancy, "endDate">, now: Date): RenewalInfo {
  const daysLeft = daysBetween(startOfDay(now), parseISODate(tenancy.endDate));
  return { daysLeft, reminderWindowDays: 60, inWindow: daysLeft <= 60 };
}

/* ------------------------------------------------------------------ maintenance */

export function selectMaintenanceForOwner(data: Pick<DataState, "maintenanceRequests" | "tenancies">, ownerId: string): MaintenanceRequest[] {
  const ids = new Set(data.tenancies.filter((t) => t.ownerId === ownerId).map((t) => t.id));
  return data.maintenanceRequests.filter((m) => ids.has(m.tenancyId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export function selectMaintenanceForTenant(data: Pick<DataState, "maintenanceRequests" | "tenancies">, tenantId: string): MaintenanceRequest[] {
  const ids = new Set(data.tenancies.filter((t) => t.tenantId === tenantId).map((t) => t.id));
  return data.maintenanceRequests.filter((m) => ids.has(m.tenancyId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export const isOpenMaintenance = (s: MaintenanceStatus) => s !== "resolved";

export const DESCRIPTION_ERROR = "Describe the problem in 10–300 characters.";
export const CATEGORY_ERROR = "Choose a category.";
export const PRIORITY_ERROR = "Choose a priority.";
export const NOTE_ERROR = "A note can be up to 200 characters.";

export interface MaintenanceInput {
  tenantId: string;
  category: string;
  description: string;
  priority: string;
}

export type MaintenanceFieldErrors = Partial<Record<"category" | "description" | "priority", string>>;

export type CreateMaintenanceResult =
  | { ok: true; data: DataState; request: MaintenanceRequest }
  | { ok: false; code: "invalid"; errors: MaintenanceFieldErrors; message: string }
  | { ok: false; code: "no_tenancy"; message: string };

export function createMaintenanceRequest(data: DataState, input: MaintenanceInput, now: Date): CreateMaintenanceResult {
  const tenancy = selectTenantTenancy(data, input.tenantId);
  if (!tenancy) return { ok: false, code: "no_tenancy", message: "You don't have a tenancy to raise a request for." };
  const errors: MaintenanceFieldErrors = {};
  const d = input.description.trim();
  if (!MAINTENANCE_CATEGORIES.includes(input.category as MaintenanceCategory)) errors.category = CATEGORY_ERROR;
  if (d.length < 10 || d.length > 300) errors.description = DESCRIPTION_ERROR;
  if (!MAINTENANCE_PRIORITIES.includes(input.priority as MaintenancePriority)) errors.priority = PRIORITY_ERROR;
  if (Object.keys(errors).length > 0) return { ok: false, code: "invalid", errors, message: "Please fix the highlighted fields." };

  const seq = data.counters.maintenance;
  const at = toTimestamp(now);
  const request: MaintenanceRequest = {
    id: `maint_u_${seq}`,
    displayCode: `NIV-RM-${seq}`,
    tenancyId: tenancy.id,
    propertyId: tenancy.propertyId,
    category: input.category as MaintenanceCategory,
    description: d,
    priority: input.priority as MaintenancePriority,
    status: "open",
    createdBy: "tenant",
    updates: [],
    source: "user",
    createdAt: at,
    updatedAt: at,
  };
  return { ok: true, request, data: { ...data, maintenanceRequests: [request, ...data.maintenanceRequests], counters: { ...data.counters, maintenance: seq + 1 } } };
}

const NEXT: Record<MaintenanceStatus, readonly MaintenanceStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};
export const allowedMaintenanceMoves = (from: MaintenanceStatus): readonly MaintenanceStatus[] => NEXT[from];

export type UpdateMaintenanceResult =
  | { ok: true; data: DataState; request: MaintenanceRequest }
  | { ok: false; code: "not_found" | "invalid_transition" | "invalid_note"; message: string };

/** Owner status update with an optional note. Validated against the CURRENT stored status. */
export function updateMaintenanceStatus(data: DataState, ownerId: string, requestId: string, to: MaintenanceStatus, note: string, now: Date): UpdateMaintenanceResult {
  const current = data.maintenanceRequests.find((m) => m.id === requestId);
  const tenancy = current ? data.tenancies.find((t) => t.id === current.tenancyId) : undefined;
  if (!current || !tenancy || tenancy.ownerId !== ownerId) return { ok: false, code: "not_found", message: "That maintenance request could not be found." };
  if (!NEXT[current.status].includes(to)) {
    return { ok: false, code: "invalid_transition", message: current.status === "resolved" ? "This request is already Resolved." : `A request that is ${current.status.replace("_", " ")} can't move to ${to.replace("_", " ")}.` };
  }
  const trimmed = note.trim();
  if (trimmed.length > 200) return { ok: false, code: "invalid_note", message: NOTE_ERROR };
  const at = toTimestamp(now);
  const updated: MaintenanceRequest = { ...current, status: to, updatedAt: at, updates: [...current.updates, { at, by: "owner", status: to, ...(trimmed ? { note: trimmed } : {}) }] };
  return { ok: true, request: updated, data: { ...data, maintenanceRequests: data.maintenanceRequests.map((m) => (m.id === requestId ? updated : m)) } };
}

/* ------------------------------------------------------------------ owner overview figures */

export interface LifecycleStats {
  rentMonth: string | null;
  rent: RentSummary;
  openMaintenance: number;
}

export function selectLifecycleStats(data: DataState, ownerId: string, now: Date): LifecycleStats {
  const rows = selectRentRows(data, ownerId, now);
  const month = defaultRentMonth(rows, now);
  return {
    rentMonth: month,
    rent: summariseRent(rows.filter((r) => r.record.month === month)),
    openMaintenance: selectMaintenanceForOwner(data, ownerId).filter((m) => isOpenMaintenance(m.status)).length,
  };
}
