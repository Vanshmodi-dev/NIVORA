/**
 * Per-tab onboarding session. Deliberately NOT part of the persisted app store:
 *  - the first name may be kept for the tab (sessionStorage) so greetings survive a refresh;
 *  - the phone number lives in memory only (never localStorage, sessionStorage or the URL);
 *  - a precise browser location lives in memory only and is lost on refresh.
 */
export const ONBOARDING_DONE_KEY = "nivora.onboarding.done";
export const ONBOARDING_NAME_KEY = "nivora.onboarding.name";

/** Like the intro, onboarding is a presentation layer: automated tests opt in explicitly. */
let enabled = import.meta.env.MODE !== "test";
export const isOnboardingEnabled = () => enabled;
export const __setOnboardingEnabledForTests = (v: boolean) => {
  enabled = v;
};

const read = (k: string): string | null => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) window.sessionStorage.removeItem(k);
    else window.sessionStorage.setItem(k, v);
  } catch {
    /* in-memory fallbacks below keep the page working */
  }
};

let memoryName: string | null = null;
let memoryDone = false;
let phone: string | null = null;
let demoGuest = false;
let here: { lat: number; lng: number } | null = null;

export const isOnboardingDone = () => memoryDone || read(ONBOARDING_DONE_KEY) === "1";
export const markOnboardingDone = () => {
  memoryDone = true;
  write(ONBOARDING_DONE_KEY, "1");
};

export const getName = () => memoryName ?? read(ONBOARDING_NAME_KEY);
export const setName = (n: string) => {
  memoryName = n;
  write(ONBOARDING_NAME_KEY, n);
};

export const getPhone = () => phone;
export const isDemoGuest = () => demoGuest;
export const setPhone = (p: string | null, guest = false) => {
  phone = p;
  demoGuest = guest;
};

export const getHere = () => here;
export const setHere = (c: { lat: number; lng: number } | null) => {
  here = c;
};

/** Forget everything: used by "Reset demo data" so a rehearsal restarts from the intro. */
export function resetOnboardingSession(): void {
  memoryName = null;
  memoryDone = false;
  phone = null;
  demoGuest = false;
  here = null;
  write(ONBOARDING_DONE_KEY, null);
  write(ONBOARDING_NAME_KEY, null);
}

/* ---------------------------------------------------------------- validation */

export function validateName(raw: string): string | null {
  const t = raw.trim();
  if (t === "") return "Please tell me what to call you.";
  if (t.length > 40) return "That’s a bit long — 40 characters or fewer, please.";
  if (!/[\p{L}\p{N}]/u.test(t)) return "Please use letters or numbers.";
  return null;
}

/** Indian mobile number: 10 digits starting 6–9, optional +91 / 91 / 0 prefix, spaces and dashes allowed. */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function validatePhone(raw: string): string | null {
  if (raw.trim() === "") return "Please enter your mobile number, or continue as a demo guest.";
  return normalisePhone(raw) ? null : "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.";
}
