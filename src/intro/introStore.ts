import { useSyncExternalStore } from "react";

/**
 * Brand-intro playback state. Deliberately tiny and separate from the app store: the intro is
 * presentation only, never persisted in app data, and knows nothing about Presenter Mode.
 *
 * "Seen" is remembered per browser tab (sessionStorage), so a refresh or an in-app route change
 * does not replay it, while opening the app in a new tab or session does.
 */
export const INTRO_SEEN_KEY = "nivora.intro.seen";

/** The intro is a brand moment, not a test fixture: automated tests opt in explicitly. */
export const INTRO_ENABLED = import.meta.env.MODE !== "test";

let playing = false;
let checked = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readSeen(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
  } catch {
    return false; // storage blocked: behave as unseen for this page load only (see `checked`)
  }
}

function writeSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
  } catch {
    /* ignore: the in-memory `checked` flag still prevents a replay during this page load */
  }
}

/** Called once when the app mounts: plays the intro on first entry only. */
export function maybeAutoPlayIntro(enabled: boolean = INTRO_ENABLED): void {
  if (checked) return;
  checked = true;
  if (enabled && !readSeen()) {
    playing = true;
    emit();
  }
}

/** Optional replay (About dialog). */
export function replayIntro(): void {
  playing = true;
  emit();
}

/** Skip or natural end. */
export function finishIntro(): void {
  writeSeen();
  if (playing) {
    playing = false;
    emit();
  }
}

export function useIntroPlaying(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => playing,
    () => false,
  );
}

/** Test helper. */
export function __resetIntroForTests(): void {
  playing = false;
  checked = false;
  listeners.clear();
}
