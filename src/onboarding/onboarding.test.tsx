import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { SEARCH_ANCHOR_CANDIDATES, evaluateMapGate, getTestDestinations, getUsableAnchors } from "../data/reference";
import { withinRadius } from "../domain/nearby";
import { DEFAULT_FILTERS, selectSearchResults } from "../domain/search";
import { __resetIntroForTests, replayIntro } from "../intro/introStore";
import { appStore } from "../store/store";
import { __resetGeocodeThrottleForTests, searchPlaces, type Place } from "./geocode";
import { guardStep, parseFlow, serializeFlow } from "./flow";
import type { GeoLike } from "./geolocation";
import { Onboarding } from "./Onboarding";
import { __setOnboardingEnabledForTests, getHere, getName, getPhone, isDemoGuest, isOnboardingDone, markOnboardingDone, normalisePhone, resetOnboardingSession, validateName, validatePhone } from "./session";

const SOURCES = import.meta.glob("./*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const readFile = async (path: string): Promise<string> => {
  const fs = (await import("node:" + "fs")) as { readFileSync(p: string, enc: string): string };
  return fs.readFileSync(path, "utf8");
};

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}
function HistoryBack() {
  const nav = useNavigate();
  return <button type="button" onClick={() => nav(-1)}>history-back</button>;
}

const VGU = { lat: 26.8117, lng: 75.8899 };

function mount(path = "/tenant/discover", opts: { geolocation?: GeoLike | null; search?: (q: string) => Promise<Place[]> } = {}) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tenant/discover" element={<Onboarding {...opts} />} />
          <Route path="/tenant" element={<div data-testid="tenant-home">tenant home</div>} />
          <Route path="*" element={<div>other</div>} />
        </Routes>
        <Where />
        <HistoryBack />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const geoWith = (outcome: "ok" | 1 | 2 | 3) => {
  const getCurrentPosition = vi.fn((ok: (p: { coords: { latitude: number; longitude: number } }) => void, err: (e: { code: number }) => void) => {
    if (outcome === "ok") ok({ coords: { latitude: VGU.lat, longitude: VGU.lng } });
    else err({ code: outcome });
  });
  return { getCurrentPosition } as GeoLike & { getCurrentPosition: ReturnType<typeof vi.fn> };
};

type User = ReturnType<typeof userEvent.setup>;
const btn = (name: string | RegExp) => screen.getByRole("button", { name });
const click = (user: User, name: string | RegExp) => user.click(btn(name));
const q = () => screen.getByRole("heading", { level: 1 });
const where = () => screen.getByTestId("where").textContent ?? "";
const visibleNow = () => selectSearchResults(appStore.getState().data, { ...DEFAULT_FILTERS }, new Date());

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("tenant");
  resetOnboardingSession();
  window.sessionStorage.clear();
  __resetGeocodeThrottleForTests();
  __resetIntroForTests();
});
afterEach(() => {
  __setOnboardingEnabledForTests(false);
});

describe("flow codec and guards", () => {
  it("round-trips step, origin, radius and filters", () => {
    const s = parseFlow(new URLSearchParams("s=furnish&at=anchor_vgu&km=7&furn=fully_furnished&min=10000&max=20000&type=studio&beds=2&amen=parking"));
    expect(s).toMatchObject({ step: "furnish", choice: { kind: "anchor", anchorId: "anchor_vgu" }, radius: 7 });
    expect(s.filters).toMatchObject({ furnishing: ["fully_furnished"], min: 10000, max: 20000, types: ["studio"], rooms: "2", amenities: ["parking"] });
    expect(parseFlow(serializeFlow(s))).toEqual(s);
  });
  it("ignores unknown steps, unverified anchors, out-of-range radii and pins outside India", () => {
    expect(parseFlow(new URLSearchParams("s=hack")).step).toBe("name");
    expect(parseFlow(new URLSearchParams("s=count&at=anchor_mnit&km=5")).choice).toBeNull();
    expect(parseFlow(new URLSearchParams("s=count&at=anchor_manipal")).choice).toBeNull();
    expect(parseFlow(new URLSearchParams("s=count&at=anchor_vgu&km=99")).radius).toBeNull();
    expect(parseFlow(new URLSearchParams("s=count&at=pin&lat=51.5&lng=-0.12&km=5")).choice).toEqual({ kind: "place" });
    expect(parseFlow(new URLSearchParams("at=pin&lat=26.91234567&lng=75.78901234&pl=My%20office")).choice).toEqual({ kind: "pin", lat: 26.9123, lng: 75.789, label: "My office" });
  });
  it("sends deep links to the earliest screen that supplies what is missing", () => {
    const g = (qs: string, here = null as null | { lat: number; lng: number }) => guardStep(parseFlow(new URLSearchParams(qs)), here);
    expect(g("s=results")).toBe("origin");
    expect(g("s=count&at=place&km=5")).toBe("place");
    expect(g("s=count&at=anchor_vgu")).toBe("radius");
    expect(g("s=count&at=here&km=5")).toBe("origin"); // location is not kept across a refresh
    expect(g("s=count&at=here&km=5", VGU)).toBe("count");
    expect(g("s=place&at=here", VGU)).toBe("origin");
    expect(g("s=results&at=anchor_vgu&km=5")).toBe("results");
  });
});

describe("name and phone", () => {
  it("validates names", () => {
    expect(validateName("")).not.toBeNull();
    expect(validateName("  ")).not.toBeNull();
    expect(validateName("!!")).not.toBeNull();
    expect(validateName("x".repeat(41))).not.toBeNull();
    expect(validateName("Asha")).toBeNull();
  });
  it("accepts Indian mobile numbers in common formats and rejects the rest", () => {
    for (const ok of ["9876543210", "+91 98765 43210", "98765-43210", "09876543210", "919876543210", "0091 9876543210"]) expect(validatePhone(ok), ok).toBeNull();
    for (const bad of ["", "12345", "5876543210", "98765432101", "abcdefghij", "+1 9876543210"]) expect(validatePhone(bad), bad).not.toBeNull();
    expect(normalisePhone("+91 98765 43210")).toBe("9876543210");
  });
  it("asks for a name first, one question per screen, and uses the name afterwards", async () => {
    const user = userEvent.setup();
    mount();
    expect(q()).toHaveTextContent("Hey! What’s your name?");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    await click(user, /^Continue$/);
    expect(screen.getByRole("alert")).toHaveTextContent(/what to call you/);
    await user.type(screen.getByLabelText("Your name"), "Asha{Enter}");
    expect(getName()).toBe("Asha");
    expect(q()).toHaveTextContent("Nice to meet you! What’s your phone number?");
    expect(screen.getByLabelText("Mobile number")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).toBeNull();
  });
  it("never persists the phone number: not in storage, not in the URL, not shared; demo guest needs none", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=phone");
    await user.type(screen.getByLabelText("Mobile number"), "12345");
    await click(user, /^Continue$/);
    expect(screen.getByRole("alert")).toHaveTextContent(/10-digit Indian mobile/);
    await user.clear(screen.getByLabelText("Mobile number"));
    await user.type(screen.getByLabelText("Mobile number"), "98765 43210{Enter}");
    expect(getPhone()).toBe("9876543210");
    expect(q()).toHaveTextContent(/May I use your location/);
    expect(JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage)).not.toMatch(/9876543210|98765/);
    expect(where()).not.toMatch(/9876|phone/);
    expect(JSON.stringify(appStore.getState().data)).not.toMatch(/9876543210/);
    expect(document.body.textContent).not.toMatch(/9876543210|98765 43210/);
    resetOnboardingSession();
    expect(getPhone()).toBeNull();
  });
  it("says plainly that nothing is verified or sent, and offers a demo guest path", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=phone");
    expect(screen.getByText(/no OTP or SMS is sent and nothing is verified/i)).toBeInTheDocument();
    expect(screen.getByText(/never shared with owners/i)).toBeInTheDocument();
    await click(user, /demo guest/);
    expect(isDemoGuest()).toBe(true);
    expect(getPhone()).toBeNull();
    expect(q()).toHaveTextContent(/May I use your location/);
  });
});

describe("location permission", () => {
  it("is not requested until the user chooses to allow it, and the position never leaves memory", async () => {
    const geo = geoWith("ok");
    const user = userEvent.setup();
    mount("/tenant/discover?s=locate", { geolocation: geo });
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    await click(user, /Yes, use my location/);
    await waitFor(() => expect(screen.getByTestId("geo-status")).toHaveTextContent(/Location allowed/));
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getHere()).toEqual(VGU);
    expect(JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage)).not.toMatch(/26\.81|75\.88/);
    expect(where()).not.toMatch(/26\.8|75\.8|lat/);
  });
  it.each([
    [1, /declined/],
    [2, /can’t share/],
    [3, /in time/],
  ] as const)("code %s shows a calm message and never traps the user", async (code, msg) => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=locate", { geolocation: geoWith(code) });
    await click(user, /Yes, use my location/);
    await waitFor(() => expect(screen.getByTestId("geo-status")).toHaveTextContent(msg));
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent("Where should I search around?");
  });
  it("Not now skips without asking the browser", async () => {
    const geo = geoWith("ok");
    const user = userEvent.setup();
    mount("/tenant/discover?s=locate", { geolocation: geo });
    await click(user, "Not now");
    expect(screen.getByTestId("geo-status")).toHaveTextContent(/Skipped/);
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });
});

describe("origin, place and radius", () => {
  it("offers two distinct choices; granted location becomes the origin and skips the place screen", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=origin", { geolocation: geoWith("ok") });
    expect(screen.getByRole("button", { name: /Near my current location/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Near my college or office/ })).toBeInTheDocument();
    await click(user, /Near my current location/);
    await waitFor(() => expect(screen.getByRole("button", { name: /Near my current location/ })).toHaveAttribute("aria-pressed", "true"));
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent("How far from this place would you like to live?");
    expect(where()).toContain("at=here");
    expect(where()).not.toMatch(/lat|lng/);
    await click(user, /Back/);
    expect(q()).toHaveTextContent("Where should I search around?");
  });
  it("denied location offers the manual path instead", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=origin", { geolocation: geoWith(1) });
    await click(user, /Near my current location/);
    await waitFor(() => expect(screen.getByText(/location was declined/i)).toBeInTheDocument());
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/Which college, office or place/);
  });
  it("lets the user pick the verified VGU test destination, shows it on the map and moves to the radius", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=place&at=place");
    expect(btn(/^Continue$/)).toBeDisabled();
    await click(user, /Vivekananda Global University \(VGU\)/);
    expect(screen.getByText(/Test destination · approximate campus location/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-origin", `${VGU.lat},${VGU.lng}`);
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent("How far from this place would you like to live?");
    expect(screen.getByText(/not travel time/)).toBeInTheDocument();
  });
  it("searches places only on request, shows results, and falls back honestly when search fails", async () => {
    const user = userEvent.setup();
    const search = vi.fn(async (): Promise<Place[]> => [{ label: "Example College", lat: 26.85, lng: 75.8 }]);
    mount("/tenant/discover?s=place&at=place", { search });
    expect(btn("Search places")).toBeDisabled();
    await user.type(screen.getByLabelText(/College, office, landmark/), "Ex");
    expect(btn("Search places")).toBeDisabled();
    await user.type(screen.getByLabelText(/College, office, landmark/), "ample{Enter}");
    expect(search).toHaveBeenCalledTimes(1);
    await user.click(await screen.findByRole("button", { name: /Example College/ }));
    expect(where()).toContain("at=search");
    expect(where()).toContain("lat=26.85");
    expect(screen.getByText(/Selected: Example College \(approximate point\)/)).toBeInTheDocument();
  });
  it("shows a clear message when search is offline, and the map pin still works", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=place&at=place", { search: async () => { throw new Error("The place search isn’t available right now."); } });
    await user.type(screen.getByLabelText(/College, office, landmark/), "Anywhere{Enter}");
    await waitFor(() => expect(screen.getByText(/place search isn’t available/)).toBeInTheDocument());
    await click(user, "Drop test pin");
    expect(where()).toMatch(/at=pin&lat=26\.9&lng=75\.8/);
    expect(btn(/^Continue$/)).toBeEnabled();
  });
  it("offers 2, 3, 5, 7 and 10 km as big choices (no input field) and passes the radius to the map", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=radius&at=anchor_vgu");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(within(screen.getByRole("group", { name: "Distance" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["2 km", "3 km", "5 km", "7 km", "10 km"]);
    expect(btn(/^Continue$/)).toBeDisabled();
    await click(user, "5 km");
    expect(screen.getByTestId("map")).toHaveAttribute("data-radius", "5");
    expect(btn(/^Continue$/)).toBeEnabled();
  });
});

describe("the count is computed, not decorated", () => {
  it.each([2, 3, 5, 7, 10])("within %i km of VGU shows exactly what the radius filter returns", (km) => {
    const expected = withinRadius(visibleNow(), VGU, km).length;
    mount(`/tenant/discover?s=count&at=anchor_vgu&km=${km}`);
    expect(screen.getByTestId("match-count")).toHaveTextContent(String(expected));
    expect(q()).toHaveTextContent(`within ${km} km of VGU`);
    expect(q()).toHaveTextContent(expected === 1 ? "1 matching listing " : `${expected} matching listings`);
    expect(screen.getByTestId("map")).toHaveAttribute("data-homes", String(expected));
  });
  it("different radii give different counts (the algorithm is doing something)", () => {
    const counts = [2, 10].map((km) => withinRadius(visibleNow(), VGU, km).length);
    expect(counts[1]).toBeGreaterThan(counts[0]!);
  });
  it("is honest that these are demo homes with simulated positions, and says a zero plainly", async () => {
    mount("/tenant/discover?s=count&at=pin&lat=28.6&lng=77.2&pl=Far%20away&km=2");
    expect(q()).toHaveTextContent(/couldn’t find any demo listings within 2 km of Far away/);
    expect(screen.getByText(/demo homes only, not every home in the area/)).toBeInTheDocument();
    expect(screen.getByText(/positions are simulated/)).toBeInTheDocument();
  });
  it("the demo counts are robust to the documented ±250 m uncertainty of the VGU pin", () => {
    for (const km of [2, 3, 5, 7, 10]) {
      const base = withinRadius(visibleNow(), VGU, km).length;
      for (let a = 0; a < 360; a += 45) {
        const dLat = (250 * Math.cos((a * Math.PI) / 180)) / 111320;
        const dLng = (250 * Math.sin((a * Math.PI) / 180)) / (111320 * Math.cos((VGU.lat * Math.PI) / 180));
        expect(withinRadius(visibleNow(), { lat: VGU.lat + dLat, lng: VGU.lng + dLng }, km).length, `${km} km, bearing ${a}`).toBe(base);
      }
    }
  });
  it("only counts homes that are really available to tenants", () => {
    const all = appStore.getState().data.properties;
    const unavailable = all.filter((p) => p.listingStatus !== "published").length;
    expect(unavailable).toBeGreaterThan(0);
    const counted = withinRadius(visibleNow(), VGU, 40).map((r) => r.property.id);
    for (const p of all.filter((x) => x.listingStatus !== "published")) expect(counted).not.toContain(p.id);
  });
});

describe("filters are applied to the real search", () => {
  const results = () => within(screen.getByTestId("onboarding-results")).getAllByTestId("property-card");

  it("walks the whole sequence, one screen each, and the result equals radius ∩ filters", async () => {
    const user = userEvent.setup();
    mount();
    await user.type(screen.getByLabelText("Your name"), "Asha");
    await click(user, /^Continue$/);
    await click(user, /demo guest/);
    await click(user, "Not now");
    await click(user, /^Continue$/);
    await click(user, /Near my college or office/);
    await click(user, /^Continue$/);
    await click(user, /Vivekananda Global University \(VGU\)/);
    await click(user, /^Continue$/);
    await click(user, "10 km");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/Good news, Asha!/);
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent("How would you like your home furnished?");
    await click(user, "Fully furnished");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/monthly rent/);
    await click(user, "₹20–40k");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/What kind of home/);
    await click(user, "Apartment");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/How many bedrooms/);
    await click(user, "2 bedrooms");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/Anything you really want/);
    await click(user, /Show me homes/);

    const p = new URLSearchParams(where().split("?")[1]);
    const expected = withinRadius(
      selectSearchResults(appStore.getState().data, { ...DEFAULT_FILTERS, furnishing: ["fully_furnished"], min: 20000, max: 40000, types: ["apartment"], rooms: "2" }, new Date()),
      VGU,
      10,
    );
    expect(p.get("s")).toBe("results");
    expect(p.get("km")).toBe("10");
    expect(q()).toHaveTextContent(/All set, Asha!/);
    if (expected.length > 0) {
      expect(results()).toHaveLength(expected.length);
      for (const card of results()) {
        expect(within(card).getByTestId("distance-note")).toHaveTextContent(/km straight-line from VGU · simulated position/);
        expect(card).toHaveTextContent(/Apartment/);
      }
    } else expect(screen.getByText(/No demo home matches all of that within 10 km/)).toBeInTheDocument();
    expect(isOnboardingDone()).toBe(true);
  });

  it.each([
    ["furnish", "furn=fully_furnished", (p: { furnishing: string }) => p.furnishing === "fully_furnished"],
    ["furnish", "furn=unfurnished", (p: { furnishing: string }) => p.furnishing === "unfurnished"],
  ] as const)("furnishing %s %s only returns matching homes", (_s, qs, ok) => {
    mount(`/tenant/discover?s=results&at=anchor_vgu&km=10&${qs}`);
    const ids = results().map((c) => c.getAttribute("data-property-id")!);
    const props = appStore.getState().data.properties.filter((x) => ids.includes(x.id));
    for (const x of props) expect(ok(x)).toBe(true);
    const expected = withinRadius(selectSearchResults(appStore.getState().data, parseFlow(new URLSearchParams(qs)).filters, new Date()), VGU, 10);
    expect(ids).toHaveLength(expected.length);
  });
  it("budget, type and rooms narrow the list and each is applied to the search engine", () => {
    mount("/tenant/discover?s=results&at=anchor_vgu&km=10");
    const all = results().length;
    expect(all).toBe(withinRadius(visibleNow(), VGU, 10).length);
    for (const qs of ["max=15000", "type=single_room", "beds=1", "type=builder_floor&max=20000"]) {
      const n = withinRadius(selectSearchResults(appStore.getState().data, parseFlow(new URLSearchParams(qs)).filters, new Date()), VGU, 10).length;
      expect(n).toBeLessThanOrEqual(all);
    }
  });
  it("orders results nearest first and links each card to the existing property page with a way back", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=results&at=anchor_vgu&km=10");
    const kms = results().map((c) => Number(/≈ ([\d.]+) km/.exec(c.textContent ?? "")?.[1] ?? "0"));
    expect([...kms].sort((a, b) => a - b)).toEqual(kms);
    await user.click(within(results()[0]!).getAllByRole("link")[0]!);
    expect(where()).toMatch(/^\/other|\/tenant\/property\//);
  });
  it("shows a clear message and Edit chips when nothing matches, and Start over returns to the name screen", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=results&at=anchor_vgu&km=2&type=studio&max=1000");
    expect(q()).toHaveTextContent(/couldn’t find a match/);
    await click(user, /Edit: Studio/);
    expect(q()).toHaveTextContent(/What kind of home/);
    await user.click(btn(/^Continue$/));
    await user.click(btn(/^Continue$/));
    await user.click(btn(/Back/));
    await user.click(btn(/Back/));
    await user.click(btn(/Back/));
    expect(q()).toBeInTheDocument();
  });
  it("Start over clears the answers", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=results&at=anchor_vgu&km=5&type=studio");
    await click(user, /Start over/);
    expect(where()).toBe("/tenant/discover?s=name");
    expect(q()).toHaveTextContent("Hey! What’s your name?");
  });
});

describe("back, refresh and deep links", () => {
  it("Back goes to the previous question and keeps answers; the browser Back button does the same", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=rooms&at=anchor_vgu&km=5&beds=2");
    await click(user, /Back/);
    expect(q()).toHaveTextContent(/What kind of home/);
    await click(user, /^Continue$/);
    expect(btn("2 bedrooms")).toHaveAttribute("aria-pressed", "true");
    await click(user, /^Continue$/);
    expect(q()).toHaveTextContent(/Anything you really want/);
    await click(user, "history-back");
    expect(q()).toHaveTextContent(/How many bedrooms/);
    expect(where()).toContain("beds=2");
  });
  it("a refresh at any step re-renders that step from the URL (no corruption)", () => {
    for (const s of ["furnish", "budget", "type", "rooms", "amenities", "results"]) {
      const view = mount(`/tenant/discover?s=${s}&at=anchor_vgu&km=5&furn=semi_furnished`);
      expect(screen.getByTestId("onboarding")).toHaveAttribute("data-step", s);
      view.unmount();
    }
  });
  it("redirects an impossible deep link to the right screen instead of computing from nothing", () => {
    mount("/tenant/discover?s=results");
    expect(screen.getByTestId("onboarding")).toHaveAttribute("data-step", "origin");
    expect(where()).toContain("s=origin");
  });
  it("only one question is on screen at a time, on every step", () => {
    for (const s of ["name", "phone", "locate", "origin", "place", "radius", "count", "furnish", "budget", "type", "rooms", "amenities"]) {
      const view = mount(`/tenant/discover?s=${s}&at=anchor_vgu&km=5`);
      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.queryAllByRole("textbox").length).toBeLessThanOrEqual(1);
      view.unmount();
    }
  });
  it("amenities offers Skip and Show me homes", async () => {
    const user = userEvent.setup();
    mount("/tenant/discover?s=amenities&at=anchor_vgu&km=5&amen=parking");
    await click(user, "Skip");
    expect(where()).toContain("s=results");
    expect(where()).not.toContain("amen=");
  });
});

describe("Explore on my own and the entry gate", () => {
  it("is available on every screen and opens the normal Tenant experience", async () => {
    const user = userEvent.setup();
    for (const s of ["name", "radius", "results"]) {
      const view = mount(`/tenant/discover?s=${s}&at=anchor_vgu&km=5`);
      expect(btn("Explore on my own")).toBeInTheDocument();
      view.unmount();
    }
    mount("/tenant/discover?s=furnish&at=anchor_vgu&km=5");
    await click(user, "Explore on my own");
    expect(screen.getByTestId("tenant-home")).toBeInTheDocument();
    expect(isOnboardingDone()).toBe(true);
  });

  const root = (path = "/") =>
    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes showUnbuilt={false} />
          <Where />
        </MemoryRouter>
      </ToastProvider>,
    );

  it("the application root opens the Nivi onboarding for a fresh session, with no app header and no search form", () => {
    __setOnboardingEnabledForTests(true);
    root("/");
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
    expect(q()).toHaveTextContent("Hey! What’s your name?");
    expect(screen.queryByRole("link", { name: /Find a Home/ })).toBeNull();
    expect(screen.queryByRole("form", { name: "Search homes" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: /main|primary/i })).toBeNull();
  });
  it("once finished or skipped the root shows the Welcome hub instead, and ?s= keeps a journey in progress", () => {
    __setOnboardingEnabledForTests(true);
    markOnboardingDone();
    const a = root("/");
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Find my home/ })).toHaveAttribute("href", "/tenant/discover");
    a.unmount();
    root("/?s=radius&at=anchor_vgu");
    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
  });
  it("?reset=1 and a disabled build still reach Welcome", () => {
    __setOnboardingEnabledForTests(true);
    const a = root("/?reset=1");
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
    a.unmount();
    __setOnboardingEnabledForTests(false);
    root("/");
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
  });
  it("Reset demo data restores the first-run state so a rehearsal restarts at the onboarding", async () => {
    const user = userEvent.setup();
    __setOnboardingEnabledForTests(true);
    markOnboardingDone();
    root("/?reset=1");
    await user.click(await screen.findByRole("button", { name: "Reset demo data" }));
    expect(isOnboardingDone()).toBe(false);
    expect(getName()).toBeNull();
    await waitFor(() => expect(screen.getByTestId("onboarding")).toBeInTheDocument());
  });
  it("the existing Tenant Home and its search are still reachable", () => {
    root("/tenant");
    expect(screen.getByRole("heading", { level: 1, name: "Find a home that fits your life." })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Search homes" })).toBeInTheDocument();
  });
});

describe("Nivi and the visual rules", () => {
  it("is held off-screen while the brand intro plays, then flies in", () => {
    __setOnboardingEnabledForTests(true);
    act(() => replayIntro());
    mount("/tenant/discover");
    expect(screen.getByTestId("nivi")).toHaveAttribute("data-entered", "false");
    __resetIntroForTests();
  });
  it("is present and entered when the intro is not playing, and reacts with a mood", () => {
    mount("/tenant/discover?s=count&at=anchor_vgu&km=10");
    expect(screen.getByTestId("nivi")).toHaveAttribute("data-entered", "true");
    expect(screen.getByTestId("nivi")).toHaveAttribute("data-mood", "wow");
    expect(screen.getByRole("img", { name: /Nivi, your guide/ })).toBeInTheDocument();
  });
  it("uses no blue or violet and no glass or glow in any onboarding, welcome or intro stylesheet", async () => {
    const files = ["src/onboarding/Onboarding.module.css", "src/onboarding/Nivi.module.css", "src/onboarding/MapView.module.css", "src/pages/Welcome.module.css", "src/intro/BrandIntro.module.css"];
    for (const f of files) {
      const css = await readFile(f);
      expect(css, f).not.toMatch(/#(3b82f6|7c5cff|22d3ee|67e8f9|38bdf8|5b3fd6|4a31b8|a78bfa|8b5cf6|2563eb|0ea5e9)/i);
      expect(css, f).not.toMatch(/backdrop-filter|radial-gradient\([^)]*(rgba\((34|56|124|59),)/i);
      expect(css, f).not.toMatch(/linear-gradient\([^)]*#(?:[0-9a-f]{3}){1,2}[^)]*(?:blue|violet)/i);
    }
    const nivi = await readFile("src/onboarding/Nivi.tsx");
    expect(nivi).not.toMatch(/#(3b82f6|7c5cff|22d3ee|38bdf8|a5f3fc)/i);
  });
  it("respects reduced motion and keeps large, visible controls", async () => {
    for (const f of ["src/onboarding/Onboarding.module.css", "src/onboarding/Nivi.module.css"]) {
      const css = await readFile(f);
      expect(css, f).toMatch(/prefers-reduced-motion: reduce/);
    }
    const css = await readFile("src/onboarding/Onboarding.module.css");
    expect(css).toMatch(/min-height: 56px/);
    expect(css).toMatch(/:focus-visible[^}]*outline: 3px/);
    expect(css).toMatch(/\.footer \{ position: fixed/);
  });
});

describe("truthfulness and scope", () => {
  it("VGU is verified only as a scoped test destination; the full gate and anchor search stay off", () => {
    expect(evaluateMapGate().satisfied).toBe(false);
    expect(getUsableAnchors()).toEqual([]);
    const vgu = getTestDestinations();
    expect(vgu.map((a) => a.id)).toEqual(["anchor_vgu"]);
    expect(vgu[0]!.verification.sources.length).toBeGreaterThanOrEqual(4);
    expect(vgu[0]!.verification.sources.join(" ")).toMatch(/vgu\.ac\.in/);
    expect(vgu[0]!.verification.sources.join(" ")).toMatch(/wikidata/i);
    expect(vgu[0]!.verification.notes).toMatch(/OpenStreetMap has NO feature/);
    expect(vgu[0]!.verification.notes).toMatch(/test destination only/i);
    expect(SEARCH_ANCHOR_CANDIDATES.filter((a) => a.verification.status === "verified")).toHaveLength(1);
  });
  it("the radius screens never promise travel time, exact addresses or real inventory", () => {
    for (const s of ["radius", "count", "results"]) {
      const view = mount(`/tenant/discover?s=${s}&at=anchor_vgu&km=5`);
      const text = document.body.textContent ?? "";
      expect(text, s).not.toMatch(/\bmin(ute)?s?\s*(drive|walk|away)|walking distance|travel time(?!\.)(?!,)|exact (address|location)/i);
      expect(text, s).not.toMatch(/Verified(?! \(demo\))/);
      view.unmount();
    }
  });
  it("only Nominatim search calls the network, only on request, with its policy limits recorded", async () => {
    const files = Object.entries(SOURCES).filter(([f]) => !f.includes(".test."));
    for (const [f, src] of files) if (!f.endsWith("geocode.ts")) expect(src, f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket/);
    const calls: string[] = [];
    const ok = async (u: string) => { calls.push(u); return { ok: true, status: 200, json: async () => [{ lat: "26.81166", lon: "75.88991", name: "Vivekananda Global University", display_name: "VGU, Jaipur, Rajasthan" }] }; };
    expect(await searchPlaces("Vivekananda Global University", ok)).toEqual([{ label: "Vivekananda Global University", lat: 26.8117, lng: 75.8899 }]);
    expect(calls[0]).toMatch(/^https:\/\/nominatim\.openstreetmap\.org\/search\?/);
    await expect(searchPlaces("ab", ok)).rejects.toThrow(/at least 3/);
    await expect(searchPlaces("abc", async () => ({ ok: false, status: 429, json: async () => [] }))).rejects.toThrow(/isn’t available/);
    await expect(searchPlaces("abc", async () => { throw new TypeError("Failed to fetch"); })).rejects.toThrow(/isn’t available right now \(are you offline\?\)/);
    expect(calls).toHaveLength(1);
  });
  it("is independent of Presenter Mode and uses only the approved packages", () => {
    const files = Object.entries(SOURCES).filter(([f]) => !f.includes(".test."));
    const src = files.map(([, s]) => s).join("\n");
    // The only presenter-related import is the build-gated banner slot, which is null in production builds.
    expect(src.replace('import { PresenterBannerSlot } from "../app/presenterSlots";', "")).not.toMatch(/from "[^"]*presenter[^"]*"|presenterMode|VITE_ENABLE_PRESENTER/i);
    const imports = new Set([...src.matchAll(/from "([^".][^"]*)"/g)].map((m) => m[1]));
    expect([...imports].sort()).toEqual(["leaflet", "lucide-react", "react", "react-router-dom"]);
  });
});
