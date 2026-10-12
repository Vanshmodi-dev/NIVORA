export type GeoStatus = "idle" | "requesting" | "granted" | "denied" | "unavailable" | "timeout" | "skipped";

export interface GeoLike {
  getCurrentPosition(ok: (p: { coords: { latitude: number; longitude: number } }) => void, err: (e: { code: number }) => void, opts?: { timeout?: number; maximumAge?: number }): void;
}

export interface GeoOutcome {
  status: "granted" | "denied" | "unavailable" | "timeout";
  coords?: { lat: number; lng: number };
}

/**
 * Asks the browser for permission, only ever called from a user action. The caller keeps the
 * coordinates in memory (never storage or URL). A position is the user's current location, not
 * their college or office.
 */
export function requestLocation(geo: GeoLike | undefined | null = typeof navigator === "undefined" ? undefined : navigator.geolocation): Promise<GeoOutcome> {
  if (!geo) return Promise.resolve({ status: "unavailable" });
  return new Promise((resolve) => {
    let done = false;
    const finish = (o: GeoOutcome) => {
      if (!done) {
        done = true;
        resolve(o);
      }
    };
    try {
      geo.getCurrentPosition(
        (p) => finish({ status: "granted", coords: { lat: p.coords.latitude, lng: p.coords.longitude } }),
        (e) => finish({ status: e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable" }),
        { timeout: 8000, maximumAge: 0 },
      );
    } catch {
      finish({ status: "unavailable" });
    }
  });
}
