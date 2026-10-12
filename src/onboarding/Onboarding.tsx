import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Crosshair, GraduationCap, MapPin, Search } from "lucide-react";
import { PropertyCard } from "../components/property/PropertyCard";
import { getTestDestinations } from "../data/reference";
import { formatApproxDistance } from "../domain/geo";
import { FURNISHING_LABEL, PROPERTY_TYPE_LABEL, AMENITY_LABEL } from "../domain/labels";
import { RADIUS_CHOICES_KM, demoPosition, withinRadius, type Origin } from "../domain/nearby";
import { DEFAULT_FILTERS, PROPERTY_TYPES, FURNISHINGS, ROOMS_LABEL, selectSearchResults, type RoomsFilter, type SearchFilters } from "../domain/search";
import type { AmenityId, Furnishing, PropertyType } from "../domain/types";
import { AMENITY_IDS } from "../data/reference";
import { getEffectiveVerification } from "../domain/verification";
import { useIntroPlaying } from "../intro/introStore";
import { prefersReducedMotion } from "../intro/BrandIntro";
import { PresenterBannerSlot } from "../app/presenterSlots";
import { PersistenceBanner } from "../app/chrome";
import { appStore, useAppStore } from "../store/store";
import { useNow } from "../store/useNow";
import { BUDGET_PRESETS } from "./config";
import { guardStep, nextStep, parseFlow, previousStep, PROGRESS_STEPS, progressIndex, resolveOrigin, serializeFlow, type FlowState, type OriginChoice, type StepId } from "./flow";
import { requestLocation, type GeoLike, type GeoStatus } from "./geolocation";
import { searchPlaces, type Place } from "./geocode";
import { Nivi, type NiviMood } from "./Nivi";
import { getHere, getName, markOnboardingDone, normalisePhone, setHere, setName, setPhone, validateName, validatePhone } from "./session";
import styles from "./Onboarding.module.css";

const MapView = lazy(() => import("./MapView"));

const GEO_COPY: Record<GeoStatus, string> = {
  idle: "",
  requesting: "Waiting for your browser’s permission prompt…",
  granted: "Location allowed. It stays in this tab’s memory only.",
  denied: "No problem — location was declined. You can pick a college or office instead.",
  unavailable: "Your browser can’t share a location here. You can pick a college or office instead.",
  timeout: "Your browser didn’t answer in time. You can pick a college or office instead.",
  skipped: "Skipped. You can still pick a college or office.",
};

const toggle = <T,>(list: readonly T[], x: T): T[] => (list.includes(x) ? list.filter((i) => i !== x) : [...list, x]);

function Choice({ selected, onClick, children, wide = false, disabled = false }: { selected: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean; disabled?: boolean }) {
  return (
    <button type="button" className={`${styles.choice} ${wide ? styles.choiceWide : ""} ${selected ? styles.choiceOn : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      <span className={styles.choiceBody}>{children}</span>
      {selected && <Check size={20} aria-hidden="true" />}
    </button>
  );
}

function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    if (prefersReducedMotion() || value === 0) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <p className={styles.bigCount} data-testid="match-count">
      <span aria-hidden="true">{shown}</span>
      <span className="visually-hidden">{value}</span>
    </p>
  );
}

/** A map problem must never take the journey down: show a notice and let everything else carry on. */
class MapBoundary extends Component<{ height: number; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className={styles.mapFallback} style={{ height: this.props.height }} role="status">
          The map couldn’t be shown. Your choices and results still work.
        </div>
      );
    }
    return this.props.children;
  }
}

function MapSlot({ height = 260, ...props }: React.ComponentProps<typeof MapView>) {
  return (
    <MapBoundary height={height}>
      <Suspense fallback={<div className={styles.mapFallback} style={{ height }}>Loading map…</div>}>
        <MapView height={height} reducedMotion={prefersReducedMotion()} {...props} />
      </Suspense>
    </MapBoundary>
  );
}

export interface OnboardingProps {
  /** Injectable for tests; default navigator.geolocation. */
  geolocation?: GeoLike | null;
  /** Injectable for tests; default Nominatim search. */
  search?: (q: string) => Promise<Place[]>;
}

/**
 * Nivi-led, one-question-per-screen onboarding. Answers live in the URL (refresh and Back safe);
 * the phone number and a precise location stay in memory only.
 */
export function Onboarding({ geolocation, search = (q) => searchPlaces(q) }: OnboardingProps) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const url = useMemo(() => parseFlow(params), [params]);
  const [here, setHereState] = useState(getHere());
  const step: StepId = guardStep(url, here);
  const state: FlowState = { ...url, step };
  const { choice, radius, filters } = state;
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const introPlaying = useIntroPlaying();
  const [reactKey, setReactKey] = useState(0);
  const react = () => setReactKey((k) => k + 1);
  const heading = useRef<HTMLHeadingElement>(null);
  const name = getName();

  // form-local state
  const [nameText, setNameText] = useState(name ?? "");
  const [nameErr, setNameErr] = useState<string | null>(null);
  const [phoneText, setPhoneText] = useState("");
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeoStatus>("idle");
  const [originMsg, setOriginMsg] = useState("");
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState<string | null>(null);

  const go = (patch: Partial<FlowState>, replace = false) => setParams(serializeFlow({ ...state, ...patch }), { replace });
  const advance = (patch: Partial<FlowState> = {}) => go({ ...patch, step: nextStep(step, patch.choice ?? choice) });
  const back = () => go({ step: previousStep(step, choice) }, true);

  // Keep the URL in step with what is actually shown (deep links / refresh).
  useEffect(() => {
    if (url.step !== step) setParams(serializeFlow(state), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url.step, step]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [step]);
  useEffect(() => {
    if (step === "results") markOnboardingDone();
  }, [step]);

  const origin: Origin | null = resolveOrigin(choice, here);
  const visibleBase = useMemo(() => selectSearchResults(data, { ...DEFAULT_FILTERS }, now), [data, now]);
  const nearAll = useMemo(() => (origin && radius ? withinRadius(visibleBase, origin, radius) : []), [visibleBase, origin, radius]);
  const matches = useMemo(() => selectSearchResults(data, { ...filters, q: "", locality: null }, now), [data, filters, now]);
  const nearMatches = useMemo(() => (origin && radius ? withinRadius(matches, origin, radius) : []), [matches, origin, radius]);

  const explore = () => {
    markOnboardingDone();
    appStore.getState().setPersona("tenant");
    navigate("/tenant");
  };
  const startOver = () => {
    setHereState(getHere());
    setPlaces(null);
    setQuery("");
    setParams(new URLSearchParams({ s: "name" }), { replace: false });
  };

  const setF = (patch: Partial<SearchFilters>) => {
    react();
    go({ filters: { ...filters, ...patch } }, true);
  };
  const choose = (c: OriginChoice | null) => {
    react();
    go({ choice: c }, true);
  };

  const who = name ? `, ${name}` : "";
  let mood: NiviMood = "happy";
  let message = "";
  let sub: React.ReactNode = null;
  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  const continueBtn = (label: string, onClick: () => void, disabled = false) => (
    <button type="button" className={styles.primary} onClick={onClick} disabled={disabled}>
      {label} <ArrowRight size={20} aria-hidden="true" />
    </button>
  );
  const backBtn = (
    <button type="button" className={styles.ghost} onClick={back}>
      <ArrowLeft size={18} aria-hidden="true" /> Back
    </button>
  );
  const simpleFooter = (continueLabel = "Continue", onContinue: () => void = () => advance(), disabled = false) => (
    <>
      {backBtn}
      {continueBtn(continueLabel, onContinue, disabled)}
    </>
  );

  switch (step) {
    case "name": {
      message = "Hey! What’s your name?";
      const submit = () => {
        const err = validateName(nameText);
        setNameErr(err);
        if (err) return;
        setName(nameText.trim());
        react();
        advance();
      };
      body = (
        <div className={styles.field}>
          <label htmlFor="ob-name" className="visually-hidden">Your name</label>
          <input id="ob-name" className={styles.input} value={nameText} maxLength={60} autoComplete="given-name" placeholder="Your first name" aria-invalid={nameErr ? true : undefined} aria-describedby="ob-name-err"
            onChange={(e) => { setNameText(e.target.value); if (nameErr) setNameErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          <p id="ob-name-err" role="alert" className={styles.err}>{nameErr}</p>
        </div>
      );
      footer = continueBtn("Continue", submit);
      break;
    }

    case "phone": {
      message = "Nice to meet you! What’s your phone number?";
      const submit = () => {
        const err = validatePhone(phoneText);
        setPhoneErr(err);
        if (err) return;
        setPhone(normalisePhone(phoneText));
        setPhoneText("");
        react();
        advance();
      };
      body = (
        <div className={styles.field}>
          <label htmlFor="ob-phone" className="visually-hidden">Mobile number</label>
          <div className={styles.phoneRow}>
            <span className={styles.prefix} aria-hidden="true">+91</span>
            <input id="ob-phone" className={`${styles.input} ${styles.phoneInput}`} type="tel" inputMode="numeric" autoComplete="off" value={phoneText} maxLength={16} placeholder="10-digit mobile number"
              aria-invalid={phoneErr ? true : undefined} aria-describedby="ob-phone-help ob-phone-err"
              onChange={(e) => { setPhoneText(e.target.value); if (phoneErr) setPhoneErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} />
          </div>
          <p id="ob-phone-err" role="alert" className={styles.err}>{phoneErr}</p>
          <p id="ob-phone-help" className={styles.help}>
            Demo only: no OTP or SMS is sent and nothing is verified. Your number stays in this tab’s memory, is never saved to this browser, and is never shared with owners.
          </p>
          <button type="button" className={styles.textBtn} onClick={() => { setPhone(null, true); setPhoneText(""); react(); advance(); }}>
            Use a demo guest instead
          </button>
        </div>
      );
      footer = <>{backBtn}{continueBtn("Continue", submit)}</>;
      break;
    }

    case "locate": {
      mood = "think";
      message = "May I use your location to help find nearby homes?";
      sub = "I’d use it only to look for homes near where you are. It isn’t stored or sent anywhere, and you can say no.";
      const ask = async () => {
        setGeo("requesting");
        const out = await requestLocation(geolocation === undefined ? undefined : geolocation);
        if (out.status === "granted" && out.coords) {
          setHere(out.coords);
          setHereState(out.coords);
        }
        setGeo(out.status);
      };
      body = (
        <div className={styles.stack}>
          <Choice wide selected={geo === "granted"} onClick={ask} disabled={geo === "requesting" || geo === "granted"}>
            <Crosshair size={22} aria-hidden="true" /> Yes, use my location
          </Choice>
          <Choice wide selected={geo === "skipped"} onClick={() => setGeo("skipped")} disabled={geo === "requesting"}>Not now</Choice>
          <p role="status" data-testid="geo-status" className={styles.help}>{GEO_COPY[geo]}</p>
        </div>
      );
      footer = simpleFooter();
      break;
    }

    case "origin": {
      mood = "think";
      message = "Where should I search around?";
      const pickHere = async () => {
        if (getHere()) {
          choose({ kind: "here" });
          setOriginMsg("");
          return;
        }
        setGeo("requesting");
        const out = await requestLocation(geolocation === undefined ? undefined : geolocation);
        setGeo(out.status);
        if (out.status === "granted" && out.coords) {
          setHere(out.coords);
          setHereState(out.coords);
          choose({ kind: "here" });
          setOriginMsg("");
        } else {
          choose({ kind: "place" });
          setOriginMsg(GEO_COPY[out.status]);
        }
      };
      body = (
        <div className={styles.stack}>
          <button type="button" className={`${styles.bigCard} ${choice?.kind === "here" ? styles.bigCardOn : ""}`} aria-pressed={choice?.kind === "here"} onClick={pickHere}>
            <Crosshair size={28} aria-hidden="true" />
            <span><strong>Near my current location</strong><small>Uses your browser’s location, once, if you allow it</small></span>
            {choice?.kind === "here" && <Check size={22} aria-hidden="true" />}
          </button>
          <button type="button" className={`${styles.bigCard} ${choice && choice.kind !== "here" ? styles.bigCardOn : ""}`} aria-pressed={!!choice && choice.kind !== "here"} onClick={() => choose(choice && choice.kind !== "here" ? choice : { kind: "place" })}>
            <GraduationCap size={28} aria-hidden="true" />
            <span><strong>Near my college or office</strong><small>Pick a place by name or on the map</small></span>
            {choice && choice.kind !== "here" && <Check size={22} aria-hidden="true" />}
          </button>
          <p role="status" className={styles.help}>{originMsg}</p>
        </div>
      );
      footer = simpleFooter("Continue", () => advance(), !choice || (choice.kind === "here" && !here));
      break;
    }

    case "place": {
      mood = "think";
      message = "Which college, office or place should I search around?";
      const vgu = getTestDestinations().find((a) => a.id === "anchor_vgu");
      const runSearch = async () => {
        setSearchErr(null);
        setSearching(true);
        try {
          const r = await search(query);
          setPlaces(r);
          if (r.length === 0) setSearchErr("I couldn’t find that. Try a different name, or drop a pin on the map.");
        } catch (e) {
          setPlaces(null);
          setSearchErr(e instanceof Error && e.message ? `${e.message} You can still use the map or the test destination.` : "Search isn’t available right now. You can still use the map.");
        } finally {
          setSearching(false);
        }
      };
      body = (
        <div className={styles.stack}>
          {vgu && (
            <Choice wide selected={choice?.kind === "anchor" && choice.anchorId === vgu.id} onClick={() => choose({ kind: "anchor", anchorId: vgu.id })}>
              <GraduationCap size={22} aria-hidden="true" />
              <span><strong>Vivekananda Global University (VGU)</strong><small className={styles.sm}>Test destination · approximate campus location</small></span>
            </Choice>
          )}
          <form className={styles.searchRow} onSubmit={(e) => { e.preventDefault(); void runSearch(); }} role="search" aria-label="Search for a place">
            <label htmlFor="ob-q" className="visually-hidden">College, office, landmark or address</label>
            <input id="ob-q" className={styles.input} value={query} maxLength={80} placeholder="Search a college, office or landmark" onChange={(e) => setQuery(e.target.value)} />
            <button type="submit" className={styles.searchBtn} disabled={searching || query.trim().length < 3} aria-label="Search places">
              <Search size={20} aria-hidden="true" />
            </button>
          </form>
          <p role="status" className={styles.err}>{searching ? "Searching…" : searchErr}</p>
          {places && places.length > 0 && (
            <ul className={styles.results} aria-label="Search results">
              {places.map((p) => (
                <li key={`${p.lat},${p.lng}`}>
                  <Choice wide selected={choice?.kind === "search" && choice.lat === p.lat && choice.lng === p.lng} onClick={() => choose({ kind: "search", lat: p.lat, lng: p.lng, label: p.label })}>
                    <MapPin size={18} aria-hidden="true" /> {p.label}
                  </Choice>
                </li>
              ))}
            </ul>
          )}
          <MapSlot height={240} origin={origin} radiusKm={null} onPick={(lat, lng) => choose({ kind: "pin", lat: Math.round(lat * 1e4) / 1e4, lng: Math.round(lng * 1e4) / 1e4, label: "your pin" })} />
          <p className={styles.help} role="status">
            {origin ? `Selected: ${origin.label}${origin.kind === "pin" || origin.kind === "search" ? " (approximate point)" : ""}.` : "Tap the map to drop a pin, search above, or use the test destination."}
          </p>
        </div>
      );
      footer = simpleFooter("Continue", () => advance(), !origin);
      break;
    }

    case "radius": {
      mood = "think";
      message = "How far from this place would you like to live?";
      sub = "Straight-line distance on the map, not travel time.";
      body = (
        <div className={styles.stack}>
          <div role="group" aria-label="Distance" className={styles.radiusRow}>
            {RADIUS_CHOICES_KM.map((r) => (
              <button key={r} type="button" className={`${styles.radius} ${radius === r ? styles.choiceOn : ""}`} aria-pressed={radius === r} onClick={() => { react(); go({ radius: r }, true); }}>
                {r} km
              </button>
            ))}
          </div>
          {origin && <MapSlot height={230} origin={origin} radiusKm={radius} />}
        </div>
      );
      footer = simpleFooter("Continue", () => advance(), radius === null);
      break;
    }

    case "count": {
      const n = nearAll.length;
      mood = n > 0 ? "wow" : "think";
      const where = origin ? origin.label : "that place";
      message = n > 0
        ? `Good news${who}! I found ${n} matching ${n === 1 ? "listing" : "listings"} within ${radius} km of ${where}.`
        : `I couldn’t find any demo listings within ${radius} km of ${where}. A bigger radius might help.`;
      sub = "That’s from this prototype’s demo homes only, not every home in the area. Their map positions are simulated.";
      body = (
        <div className={styles.stack}>
          <CountUp value={n} />
          {origin && radius && (
            <MapSlot height={220} origin={origin} radiusKm={radius} homes={nearAll.map((r) => { const p = demoPosition(r.property); return { lat: p.lat, lng: p.lng, label: `${r.property.title} — simulated position` }; })} />
          )}
        </div>
      );
      footer = <>{backBtn}{continueBtn("Continue", () => advance())}</>;
      break;
    }

    case "furnish": {
      message = "How would you like your home furnished?";
      const cur = filters.furnishing;
      body = (
        <div className={styles.stack}>
          {FURNISHINGS.map((f) => (
            <Choice key={f} wide selected={cur.length === 1 && cur[0] === f} onClick={() => setF({ furnishing: [f as Furnishing] })}>{FURNISHING_LABEL[f]}</Choice>
          ))}
          <Choice wide selected={cur.length === 0} onClick={() => setF({ furnishing: [] })}>No preference</Choice>
        </div>
      );
      footer = simpleFooter();
      break;
    }

    case "budget": {
      message = "What monthly rent are you comfortable with?";
      const cur = BUDGET_PRESETS.find((p) => p.min === filters.min && p.max === filters.max)?.id ?? null;
      body = (
        <div className={styles.stack}>
          {BUDGET_PRESETS.map((p) => (
            <Choice key={p.id} wide selected={cur === p.id} onClick={() => setF({ min: p.min, max: p.max })}>{p.label}</Choice>
          ))}
        </div>
      );
      footer = simpleFooter();
      break;
    }

    case "type": {
      message = "What kind of home are you looking for?";
      sub = "Choose one or more, or continue for any.";
      body = (
        <div className={styles.stack}>
          {PROPERTY_TYPES.map((t) => (
            <Choice key={t} wide selected={filters.types.includes(t)} onClick={() => setF({ types: toggle<PropertyType>(filters.types, t) })}>{PROPERTY_TYPE_LABEL[t]}</Choice>
          ))}
        </div>
      );
      footer = simpleFooter();
      break;
    }

    case "rooms": {
      message = "How many bedrooms do you need?";
      body = (
        <div className={styles.stack}>
          {(["any", "1", "2", "3+"] as RoomsFilter[]).map((r) => (
            <Choice key={r} wide selected={filters.rooms === r} onClick={() => setF({ rooms: r })}>
              {r === "any" ? "Any number" : `${ROOMS_LABEL[r]} ${r === "1" ? "bedroom" : "bedrooms"}`}
            </Choice>
          ))}
        </div>
      );
      footer = simpleFooter();
      break;
    }

    case "amenities": {
      message = "Anything you really want your home to have?";
      sub = "Pick as many as you like.";
      body = (
        <div role="group" aria-label="Amenities" className={styles.chips}>
          {AMENITY_IDS.map((a) => (
            <Choice key={a} selected={filters.amenities.includes(a)} onClick={() => setF({ amenities: toggle<AmenityId>(filters.amenities, a) })}>{AMENITY_LABEL[a]}</Choice>
          ))}
        </div>
      );
      footer = (
        <>
          {backBtn}
          <button type="button" className={styles.ghost} onClick={() => go({ step: "results", filters: { ...filters, amenities: [] } })}>Skip</button>
          {continueBtn("Show me homes", () => advance())}
        </>
      );
      break;
    }

    case "results": {
      const n = nearMatches.length;
      mood = n > 0 ? "wow" : "think";
      message = n > 0 ? `All set${who}! Here ${n === 1 ? "is the home" : `are the ${n} homes`} that match.` : `I couldn’t find a match this time${who}. Let’s loosen something.`;
      const chips: { label: string; to: StepId }[] = [];
      if (origin) chips.push({ label: `${radius} km of ${origin.label}`, to: choice?.kind === "here" ? "origin" : "place" });
      if (filters.furnishing.length) chips.push({ label: filters.furnishing.map((f) => FURNISHING_LABEL[f]).join(" / "), to: "furnish" });
      const bp = BUDGET_PRESETS.find((p) => p.min === filters.min && p.max === filters.max);
      if (filters.min !== null || filters.max !== null) chips.push({ label: bp?.label ?? "Custom budget", to: "budget" });
      if (filters.types.length) chips.push({ label: filters.types.map((t) => PROPERTY_TYPE_LABEL[t]).join(" / "), to: "type" });
      if (filters.rooms !== "any") chips.push({ label: `${filters.rooms} ${filters.rooms === "1" ? "bedroom" : "bedrooms"}`, to: "rooms" });
      if (filters.amenities.length) chips.push({ label: filters.amenities.map((a) => AMENITY_LABEL[a]).join(", "), to: "amenities" });
      const fromUrl = `/?${serializeFlow(state).toString()}`;
      body = (
        <div className={styles.reveal}>
          <ul className={styles.summary} aria-label="Your preferences">
            {chips.map((c) => (
              <li key={c.label}>
                <button type="button" className={styles.chipBtn} onClick={() => go({ step: c.to }, true)} aria-label={`Edit: ${c.label}`}>{c.label}</button>
              </li>
            ))}
          </ul>
          <div className={styles.row}>
            <button type="button" className={styles.secondary} onClick={() => go({ step: "furnish" }, true)}>Edit preferences</button>
            <button type="button" className={styles.ghost} onClick={startOver}>Start over</button>
          </div>
          {n === 0 ? (
            <p className={styles.help}>No demo home matches all of that within {radius} km. Try a bigger radius or fewer filters.</p>
          ) : (
            <>
              {origin && radius && (
                <MapSlot height={240} origin={origin} radiusKm={radius} homes={nearMatches.map((r) => { const p = demoPosition(r.property); return { lat: p.lat, lng: p.lng, label: `${r.property.title} — simulated position` }; })} />
              )}
              <p className={styles.help}>Demo homes with simulated map positions. “Verified (demo)” is a label on demo data, not a real check.</p>
              <div className={styles.grid} data-testid="onboarding-results">
                <h2 className="visually-hidden">Matching homes</h2>
                {nearMatches.map(({ property, km }) => (
                  <PropertyCard key={property.id} property={property} effective={getEffectiveVerification(property, data.verificationItems, now)} now={now} from={fromUrl}
                    distanceNote={`${formatApproxDistance(km)} from ${origin?.label ?? "the origin"} · simulated position`} />
                ))}
              </div>
            </>
          )}
          <p className={styles.fineprint}>
            <Link to="/tenant/search">Browse all homes</Link>
          </p>
        </div>
      );
      break;
    }
  }

  const idx = progressIndex(step);
  const total = PROGRESS_STEPS.length;

  return (
    <div className={styles.screen} data-testid="onboarding" data-step={step}>
      <PresenterBannerSlot />
      <PersistenceBanner />
      <header className={styles.topBar}>
        <div className={styles.top}>
          <span className={styles.brand} aria-label="NIVORA">NIVORA</span>
          <button type="button" className={styles.explore} onClick={explore}>Explore on my own</button>
        </div>
        <div className={styles.progress} role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={idx + 1} aria-valuetext={`Step ${idx + 1} of ${total}`}>
          <div className={styles.progressFill} style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <p className={styles.progressText}>{idx + 1} / {total}</p>
      </header>

      <main className={`${styles.stage} ${step === "results" ? styles.stageWide : ""}`} id="main">
        <section className={styles.scene} key={step}>
          <div className={styles.niviRow}>
            <Nivi mood={mood} entered={!introPlaying} reactKey={reactKey} size={step === "results" ? 88 : 120} />
            <div className={styles.bubble}>
              <h1 ref={heading} tabIndex={-1} className={styles.question}>{message}</h1>
              {sub && <p className={styles.sub}>{sub}</p>}
            </div>
          </div>
          <div className={styles.answers}>{body}</div>
        </section>
      </main>

      {footer && <footer className={styles.footer}><div className={styles.footerInner}>{footer}</div></footer>}
    </div>
  );
}

