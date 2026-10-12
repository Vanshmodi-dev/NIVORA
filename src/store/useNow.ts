import { useMemo } from "react";
import { useAppStore } from "./store";

/**
 * "Now" for screens. Normally the real current time; inside Presenter Mode it may be a simulated
 * date (founder D6), which re-renders every screen that uses it. The OS clock is never changed.
 */
export function useNow(): Date {
  const override = useAppStore((s) => s.ui.presenterNowOverride);
  return useMemo(() => (override ? new Date(override) : new Date()), [override]);
}
