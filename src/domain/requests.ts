import { REQUEST_STATUS_LABEL } from "./labels";
import type { Actor, ISODate, RequestStatus, TimeSlot, VisitRequest } from "./types";

/**
 * The single place visit-request transitions are decided (§6.7, §13.5).
 * Tenant and Owner screens both read the same record, so there is no second copy to drift.
 */
const OWNER_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ["contacted", "scheduled", "cancelled"],
  contacted: ["scheduled", "cancelled"],
  scheduled: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Tenants may only cancel, and only while the request is still open. */
const TENANT_TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ["cancelled"],
  contacted: ["cancelled"],
  scheduled: ["cancelled"],
  completed: [],
  cancelled: [],
};

export const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = ["pending", "contacted", "scheduled"];

export function isOpenRequest(status: RequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

export function allowedTransitions(from: RequestStatus, actor: Actor): readonly RequestStatus[] {
  if (actor === "owner") return OWNER_TRANSITIONS[from];
  if (actor === "tenant") return TENANT_TRANSITIONS[from];
  return [];
}

export type TransitionErrorCode =
  | "invalid_transition"
  | "not_permitted"
  | "missing_schedule"
  | "invalid_schedule";

export interface TransitionPayload {
  scheduledFor?: { date: ISODate; slot: TimeSlot };
  /** Cancellation reason (≤120 chars) or a note on the history entry. */
  note?: string;
}

export type TransitionResult =
  | { ok: true; request: VisitRequest }
  | { ok: false; code: TransitionErrorCode; message: string };

const SLOTS: readonly TimeSlot[] = ["morning", "afternoon", "evening"];

/**
 * Pure transition. Validates against the CURRENT stored status (callers must pass the latest
 * record), so a stale tab cannot write an invalid transition. Nothing is written on failure.
 */
export function transitionRequest(
  request: VisitRequest,
  to: RequestStatus,
  actor: Actor,
  now: Date,
  payload: TransitionPayload = {},
): TransitionResult {
  const from = request.status;
  const ownerAllowed = OWNER_TRANSITIONS[from].includes(to);

  if (!allowedTransitions(from, actor).includes(to)) {
    if (actor === "tenant" && ownerAllowed) {
      return {
        ok: false,
        code: "not_permitted",
        message: "Only the owner can make that change. You can cancel an open request.",
      };
    }
    return {
      ok: false,
      code: "invalid_transition",
      message:
        OWNER_TRANSITIONS[from].length === 0
          ? `This request is already ${REQUEST_STATUS_LABEL[from]}. The list has been refreshed.`
          : `A request that is ${REQUEST_STATUS_LABEL[from]} can't move to ${REQUEST_STATUS_LABEL[to]}.`,
    };
  }

  let scheduledFor = request.scheduledFor;
  if (to === "scheduled") {
    const s = payload.scheduledFor;
    if (!s) {
      return { ok: false, code: "missing_schedule", message: "Choose a visit date and time slot." };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !SLOTS.includes(s.slot)) {
      return { ok: false, code: "invalid_schedule", message: "Choose a valid visit date and time slot." };
    }
    scheduledFor = { date: s.date, slot: s.slot };
  }

  const at = now.toISOString();
  const note = payload.note?.trim() ? payload.note.trim().slice(0, 120) : undefined;
  return {
    ok: true,
    request: {
      ...request,
      status: to,
      scheduledFor,
      cancelledBy: to === "cancelled" ? (actor === "owner" ? "owner" : "tenant") : request.cancelledBy,
      cancelReason: to === "cancelled" ? (note ?? null) : request.cancelReason,
      statusHistory: [...request.statusHistory, { status: to, at, by: actor, ...(note ? { note } : {}) }],
      updatedAt: at,
    },
  };
}
