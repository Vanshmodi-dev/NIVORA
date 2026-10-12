import { startOfDay, parseISODate } from "./dates";
import type { RentRecord, RentStatus } from "./types";

/**
 * Derived on read, never stored (§7.7): paid if `paidAt` is set; else overdue when the due date
 * is before today; else due. This is a recorded demo status, not a financial transaction.
 */
export function deriveRentStatus(record: Pick<RentRecord, "paidAt" | "dueDate">, now: Date): RentStatus {
  if (record.paidAt) return "paid";
  return parseISODate(record.dueDate) < startOfDay(now) ? "overdue" : "due";
}
