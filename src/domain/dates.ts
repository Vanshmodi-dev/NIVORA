export const MS_PER_DAY = 86_400_000;

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + n);
  return copy;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar date as `YYYY-MM-DD`. */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toISOMonth(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function toTimestamp(d: Date): string {
  return d.toISOString();
}

/** Whole days elapsed from `from` to `to` (can be negative). */
export function daysBetween(from: Date | string, to: Date | string): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  return Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/** Parses `YYYY-MM-DD` as a local date at midnight. */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
