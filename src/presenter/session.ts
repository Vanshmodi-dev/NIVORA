import { clearClockOverride, setClockOverride } from "../domain/clock";
import { saveState } from "../store/persistence";
import { appStore, STORAGE_FAILURE_MESSAGE } from "../store/store";
import type { DataState } from "../domain/types";

/**
 * Presenter Mode session handling. The flag lives in `ui.presenterMode` (never in the persistent
 * saved state) and in `sessionStorage`, so it survives a refresh in the same tab but a new tab or
 * session always starts inactive (§9.6 PM-4). Hiding any of this is NOT a security boundary (PM-6).
 */
const SESSION_KEY = "nivora.presenter.session";

function session(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function enterPresenterMode(): void {
  try {
    session()?.setItem(SESSION_KEY, "1");
  } catch {
    /* session storage unavailable: the mode simply will not survive a refresh */
  }
  appStore.setState((s) => ({ ui: { ...s.ui, presenterMode: true } }));
}

export function exitPresenterMode(): void {
  clearClockOverride();
  appStore.setState((s) => ({ ui: { ...s.ui, presenterMode: false, presenterNowOverride: null } }));
}

/** Sets or clears the simulated date. Only meaningful (and only reachable) inside Presenter Mode. */
export function setSimulatedDate(isoDate: string | null): void {
  if (!isoDate) {
    clearClockOverride();
    appStore.setState((s) => ({ ui: { ...s.ui, presenterNowOverride: null } }));
    return;
  }
  const [y, m, d] = isoDate.split("-").map(Number);
  const when = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  setClockOverride(when);
  appStore.setState((s) => ({ ui: { ...s.ui, presenterNowOverride: when.toISOString() } }));
}

/**
 * Called once at start-up in builds that include Presenter Mode: restores the flag after a refresh
 * and keeps the clock override and the session flag consistent with the store (including on reset).
 */
export function initPresenter(): () => void {
  if (session()?.getItem(SESSION_KEY) === "1") appStore.setState((s) => ({ ui: { ...s.ui, presenterMode: true } }));
  return appStore.subscribe((state, prev) => {
    if (prev.ui.presenterMode && !state.ui.presenterMode) {
      try {
        session()?.removeItem(SESSION_KEY);
      } catch {
        /* ignore */
      }
    }
    if (state.ui.presenterNowOverride === null && prev.ui.presenterNowOverride !== null) clearClockOverride();
  });
}

/** Writes simulated data storage-first, like every other write: nothing changes if the write fails. */
export function commitSimulated(next: DataState): { ok: true } | { ok: false; message: string } {
  // Use the raw storage object (no probe): a probe failure must not be mistaken for "no storage".
  let storage: Storage | null = null;
  try {
    storage = typeof window === "undefined" ? null : window.localStorage;
  } catch {
    storage = null;
  }
  if (storage) {
    const saved = saveState(storage, next, appStore.getState().ui);
    if (!saved.ok) return { ok: false, message: STORAGE_FAILURE_MESSAGE };
  }
  appStore.setState({ data: next });
  return { ok: true };
}
