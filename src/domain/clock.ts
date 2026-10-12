/** Single injection point for "now" so seeds, staleness and tests are reproducible. */
export type Clock = () => Date;

let override: Date | null = null;

/**
 * Presenter-only simulated time (founder D6). Only Presenter Mode ever calls this; it never
 * changes the operating-system clock and is never persisted.
 */
export function setClockOverride(d: Date | null): void {
  override = d;
}
export function clearClockOverride(): void {
  override = null;
}

export const systemClock: Clock = () => (override ? new Date(override.getTime()) : new Date());
