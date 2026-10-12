import { parseISODate } from "./dates";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** `₹1,25,000` (Indian digit grouping). */
export function formatRupees(n: number): string {
  return `₹${inr.format(Math.round(n))}`;
}

/** Compact marker form: `₹14.5k`, `₹22k`, `₹950`. */
export function formatRupeesCompact(n: number): string {
  if (n < 1000) return `₹${Math.round(n)}`;
  const k = Math.round((n / 1000) * 10) / 10;
  return `₹${Number.isInteger(k) ? k : k.toFixed(1)}k`;
}

/** `12 Oct 2026` from `YYYY-MM-DD` or an ISO timestamp. */
export function formatDate(value: string): string {
  const d = value.length === 10 ? parseISODate(value) : new Date(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** `+91 98765 43210` from a stored 10-digit number. */
export function formatPhone(digits: string): string {
  if (!/^\d{10}$/.test(digits)) return digits;
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}
