import { daysBetween } from "./dates";
import type {
  ISOTimestamp,
  Property,
  VerificationCategory,
  VerificationItem,
  VerificationStatus,
} from "./types";

/** Availability confirmations older than this are treated as stale (D-13, §8.4). */
export const AVAILABILITY_FRESH_DAYS = 14;

export const VERIFICATION_CATEGORIES: readonly VerificationCategory[] = [
  "identity",
  "authority",
  "listing_accuracy",
  "availability",
] as const;

export interface EffectiveVerification {
  category: VerificationCategory;
  /** Status as stored. */
  stored: VerificationStatus;
  /** Status after applying freshness rules — this is what the UI shows and filters on. */
  status: VerificationStatus;
  stale: boolean;
  item: VerificationItem;
}

export function isAvailabilityStale(
  confirmedAt: ISOTimestamp | null,
  now: Date,
): boolean {
  if (!confirmedAt) return true;
  return daysBetween(confirmedAt, now) > AVAILABILITY_FRESH_DAYS;
}

/**
 * Effective verification for one property: all four categories, in canonical order.
 * A stored `verified_demo` availability check becomes `needs_reverification` once stale (§8.4).
 * Derived on read — never stored.
 */
export function getEffectiveVerification(
  property: Pick<Property, "id" | "availabilityConfirmedAt">,
  items: readonly VerificationItem[],
  now: Date,
): EffectiveVerification[] {
  const out: EffectiveVerification[] = [];
  for (const category of VERIFICATION_CATEGORIES) {
    const item = items.find((i) => i.propertyId === property.id && i.category === category);
    if (!item) continue;
    const stale =
      category === "availability" &&
      item.status === "verified_demo" &&
      isAvailabilityStale(property.availabilityConfirmedAt, now);
    out.push({
      category,
      stored: item.status,
      status: stale ? "needs_reverification" : item.status,
      stale,
      item,
    });
  }
  return out;
}

export function verifiedCount(effective: readonly EffectiveVerification[]): number {
  return effective.filter((e) => e.status === "verified_demo").length;
}

/** `3 of 4 checks verified (demo)` — counts effective `verified_demo` only. Never a lone tick. */
export function verificationSummary(effective: readonly EffectiveVerification[]): string {
  return `${verifiedCount(effective)} of ${VERIFICATION_CATEGORIES.length} checks verified (demo)`;
}
