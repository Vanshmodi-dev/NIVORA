import { buildSeed } from "../data/seed";
import { toISODate, toTimestamp, addDays } from "../domain/dates";
import { VERIFICATION_CATEGORY_LABEL, VERIFICATION_STATUS_LABEL } from "../domain/labels";
import type { DataState, HistoryEvent, SimulationLogEntry, VerificationItem, VerificationStatus } from "../domain/types";

/**
 * Presenter Demo Mode simulation (blueprint §9.6). EVERYTHING here is simulated: nothing is
 * checked, no document is read, no person or property is verified. Pure functions over
 * `DataState`; the panel is the only caller. This module is only reachable from the lazily
 * loaded presenter chunk, which is absent from production builds.
 */
export const SIMULATED_EVENT_TYPE = "simulated";
export const SIMULATED_NOTE = "Simulated by presenter (demo)";

/** The outcomes a presenter can demonstrate. Any status may be set from any status. */
export const SIM_STATUSES: readonly VerificationStatus[] = ["pending_review", "verified_demo", "needs_reverification", "not_checked"];

export type SimResult = { ok: true; data: DataState } | { ok: false; message: string };

const nextLogId = (log: readonly SimulationLogEntry[]) => `sim_${String(log.length + 1).padStart(3, "0")}`;

function withEvent(history: HistoryEvent[], at: string, summary: string): HistoryEvent[] {
  return [{ at, type: SIMULATED_EVENT_TYPE, summary }, ...history];
}

export function simulateVerification(data: DataState, itemId: string, to: VerificationStatus, now: Date): SimResult {
  const item = data.verificationItems.find((i) => i.id === itemId);
  if (!item) return { ok: false, message: "That verification item could not be found." };
  if (item.status === to) return { ok: false, message: `This check is already ${VERIFICATION_STATUS_LABEL[to]}.` };
  const at = toTimestamp(now);
  const snapshot = JSON.stringify({ status: item.status, source: item.source, simulatedAt: item.simulatedAt, checkedAt: item.checkedAt, note: item.note, evidenceLabel: item.evidenceLabel, updatedAt: item.updatedAt });
  const updated: VerificationItem = { ...item, status: to, source: "simulated_review", simulatedAt: at, checkedAt: to === "not_checked" ? null : toISODate(now), note: SIMULATED_NOTE, updatedAt: at };
  const summary = `Verification (demo): ${VERIFICATION_CATEGORY_LABEL[item.category]} → ${VERIFICATION_STATUS_LABEL[to]} — simulated by presenter`;
  return {
    ok: true,
    data: {
      ...data,
      verificationItems: data.verificationItems.map((i) => (i.id === itemId ? updated : i)),
      properties: data.properties.map((p) => (p.id === item.propertyId ? { ...p, history: withEvent(p.history, at, summary) } : p)),
      presenter: { simulationLog: [...data.presenter.simulationLog, { id: nextLogId(data.presenter.simulationLog), target: itemId, field: "status", from: item.status, to, at, snapshot }] },
    },
  };
}

/** Sets the availability confirmation to N days ago so staleness (§8.4) can be shown. */
export function ageAvailability(data: DataState, propertyId: string, days: number, now: Date): SimResult {
  const p = data.properties.find((x) => x.id === propertyId);
  if (!p) return { ok: false, message: "That property could not be found." };
  const at = toTimestamp(now);
  const to = toTimestamp(addDays(now, -days));
  const snapshot = JSON.stringify({ availabilityConfirmedAt: p.availabilityConfirmedAt });
  return {
    ok: true,
    data: {
      ...data,
      properties: data.properties.map((x) => (x.id === propertyId ? { ...x, availabilityConfirmedAt: to, history: withEvent(x.history, at, `Availability confirmation set to ${days} days ago — simulated by presenter`) } : x)),
      presenter: { simulationLog: [...data.presenter.simulationLog, { id: nextLogId(data.presenter.simulationLog), target: propertyId, field: "availabilityConfirmedAt", from: p.availabilityConfirmedAt, to, at, snapshot }] },
    },
  };
}

/** "Simulate review completed": a pending-review listing becomes published (and so Tenant-visible). */
export function completeReview(data: DataState, propertyId: string, now: Date): SimResult {
  const p = data.properties.find((x) => x.id === propertyId);
  if (!p) return { ok: false, message: "That property could not be found." };
  if (p.listingStatus !== "pending_review") return { ok: false, message: "Only a listing that is pending review can be completed." };
  const at = toTimestamp(now);
  const snapshot = JSON.stringify({ listingStatus: p.listingStatus, publishedAt: p.publishedAt });
  return {
    ok: true,
    data: {
      ...data,
      properties: data.properties.map((x) => (x.id === propertyId ? { ...x, listingStatus: "published" as const, publishedAt: x.publishedAt ?? at, history: withEvent(x.history, at, "Review completed — simulated by presenter") } : x)),
      presenter: { simulationLog: [...data.presenter.simulationLog, { id: nextLogId(data.presenter.simulationLog), target: propertyId, field: "listingStatus", from: p.listingStatus, to: "published", at, snapshot }] },
    },
  };
}

/** Reverts every logged change to its previous value (newest first) and clears the log. */
export function undoAll(data: DataState): DataState {
  let next = data;
  for (const entry of [...data.presenter.simulationLog].reverse()) {
    const prev = entry.snapshot ? (JSON.parse(entry.snapshot) as Record<string, unknown>) : {};
    if (entry.field === "status") {
      next = { ...next, verificationItems: next.verificationItems.map((i) => (i.id === entry.target ? ({ ...i, ...prev } as VerificationItem) : i)) };
    } else {
      next = { ...next, properties: next.properties.map((p) => (p.id === entry.target ? { ...p, ...prev } : p)) };
    }
  }
  const simulatedAt = new Set(data.presenter.simulationLog.map((e) => e.at));
  next = { ...next, properties: next.properties.map((p) => ({ ...p, history: p.history.filter((h) => !(h.type === SIMULATED_EVENT_TYPE && simulatedAt.has(h.at))) })), presenter: { simulationLog: [] } };
  return next;
}

/**
 * "Restore seeded verification state": every fixture's four verification items and availability
 * timestamp return to their seed values; every user-created property's items return to the status
 * assigned at publish (`seedStatus`). Listings completed by simulation return to their seeded status.
 */
export function restoreSeededVerification(data: DataState, now: Date): DataState {
  const seed = buildSeed(now);
  const seedProp = new Map(seed.properties.map((p) => [p.id, p]));
  const seedItem = new Map(seed.verificationItems.map((i) => [i.id, i]));
  const reviewed = new Set(data.presenter.simulationLog.filter((e) => e.field === "listingStatus").map((e) => e.target));
  return {
    ...data,
    verificationItems: data.verificationItems.map((i) => {
      const s = seedItem.get(i.id);
      if (s) return { ...i, status: s.status, source: s.source, checkedAt: s.checkedAt, evidenceLabel: s.evidenceLabel, note: s.note, simulatedAt: null, updatedAt: s.updatedAt };
      return { ...i, status: i.seedStatus, source: i.source === "simulated_review" ? (i.category === "listing_accuracy" ? "demo_fixture" : "owner_declared") : i.source, simulatedAt: null };
    }),
    properties: data.properties.map((p) => {
      const s = seedProp.get(p.id);
      const history = p.history.filter((h) => h.type !== SIMULATED_EVENT_TYPE);
      if (!s) return { ...p, history };
      return { ...p, history, availabilityConfirmedAt: s.availabilityConfirmedAt, ...(reviewed.has(p.id) ? { listingStatus: s.listingStatus, publishedAt: s.publishedAt } : {}) };
    }),
    presenter: { simulationLog: [] },
  };
}
