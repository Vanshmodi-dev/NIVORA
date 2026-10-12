import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { appStore } from "../store/store";
import { BrandIntro, computeLayout } from "./BrandIntro";
import { IntroHost } from "./IntroHost";
import { INTRO_SEEN_KEY, __resetIntroForTests, finishIntro, maybeAutoPlayIntro, replayIntro } from "./introStore";
import { TIMELINE, buildParticles, crispAlpha, easeOutCubic, mulberry32, particlePosition, sweepPosition } from "./particles";

const SOURCES = import.meta.glob("./*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const mockMatchMedia = (reduce: boolean) =>
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: reduce && q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }));

beforeEach(() => {
  __resetIntroForTests();
  window.sessionStorage.clear();
  mockMatchMedia(false);
  // jsdom has no canvas: the intro must fall back to its static reveal, which is also the failure path.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.getElementById("root")?.remove();
});

describe("particle choreography (pure)", () => {
  it("is deterministic and bounded", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
  it("every particle starts away from its target and lands exactly on it", () => {
    const ps = buildParticles([[100, 50], [120, 60], [140, 70]], 800, 600);
    for (const p of ps) {
      const start = particlePosition(p, 0);
      expect(Math.hypot(start.x - p.tx, start.y - p.ty)).toBeGreaterThan(50);
      const end = particlePosition(p, TIMELINE.assembleEnd + 50);
      expect(end.x).toBeCloseTo(p.tx, 5);
      expect(end.y).toBeCloseTo(p.ty, 5);
      expect(end.progress).toBe(1);
    }
  });
  it("crisp logo and light sweep follow the documented timeline, within 3–4 seconds in total", () => {
    expect(crispAlpha(0)).toBeCloseTo(0);
    expect(crispAlpha(TIMELINE.crispEnd)).toBe(1);
    expect(sweepPosition(TIMELINE.sweepStart)).toBeCloseTo(-0.2);
    expect(sweepPosition(TIMELINE.sweepEnd)).toBeCloseTo(1.2);
    expect(TIMELINE.total).toBeGreaterThanOrEqual(3000);
    expect(TIMELINE.total + TIMELINE.fadeOut).toBeLessThanOrEqual(4500);
    expect(TIMELINE.taglineAt).toBeGreaterThan(TIMELINE.descriptorAt);
  });
  it("lays the logo out inside the viewport at every supported width", () => {
    for (const [w, h] of [[320, 640], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
      const L = computeLayout(w, h);
      expect(L.bx).toBeGreaterThanOrEqual(0);
      expect(L.bx + L.bw).toBeLessThanOrEqual(w);
      expect(L.by).toBeGreaterThanOrEqual(0);
      expect(L.by + L.bh).toBeLessThan(h);
    }
  });
});

describe("playback rules", () => {
  it("auto-play honours the seen flag and the enabled switch", () => {
    __resetIntroForTests();
    maybeAutoPlayIntro(false);
    __resetIntroForTests();
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    maybeAutoPlayIntro(true);
    render(<IntroHost />);
    expect(screen.queryByTestId("brand-intro")).toBeNull();
  });
  it("shows on first entry when enabled and unseen, then marks itself seen when finished", () => {
    __resetIntroForTests();
    maybeAutoPlayIntro(true);
    render(<IntroHost />);
    expect(screen.getByTestId("brand-intro")).toBeInTheDocument();
    act(() => finishIntro());
    expect(screen.queryByTestId("brand-intro")).toBeNull();
    expect(window.sessionStorage.getItem(INTRO_SEEN_KEY)).toBe("1");
  });
  it("replay works on demand, even after it has been seen", () => {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    render(<IntroHost />);
    expect(screen.queryByTestId("brand-intro")).toBeNull();
    act(() => replayIntro());
    expect(screen.getByTestId("brand-intro")).toBeInTheDocument();
  });
  it("still works when session storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    __resetIntroForTests();
    maybeAutoPlayIntro(true);
    render(<IntroHost />);
    expect(screen.getByTestId("brand-intro")).toBeInTheDocument();
    expect(() => act(() => finishIntro())).not.toThrow();
    expect(screen.queryByTestId("brand-intro")).toBeNull();
  });
});

describe("the overlay", () => {
  it("falls back to a readable static reveal when canvas is unavailable, with all brand text", () => {
    render(<BrandIntro onDone={() => {}} />);
    return screen.findByTestId("brand-intro").then((el) => {
      expect(el).toHaveAttribute("data-mode", "static");
      expect(el).toHaveTextContent("NIVORA");
      expect(el).toHaveTextContent("THE RENTAL LIVING ECOSYSTEM");
      expect(el).toHaveTextContent("Your next chapter starts at home.");
    });
  });
  it("has a visible Skip intro button that is focused and ends the intro", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const done = vi.fn();
    render(<BrandIntro onDone={done} />);
    const skip = screen.getByRole("button", { name: "Skip intro" });
    expect(skip).toHaveFocus();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(skip);
    act(() => void vi.advanceTimersByTime(600));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("Escape also skips, and a second trigger does not finish twice", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<BrandIntro onDone={done} />);
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); });
    act(() => void vi.advanceTimersByTime(600));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("reduced motion shows the static reveal and ends quickly on its own", () => {
    vi.useFakeTimers();
    mockMatchMedia(true);
    const done = vi.fn();
    render(<BrandIntro onDone={done} />);
    expect(screen.getByTestId("brand-intro")).toHaveAttribute("data-mode", "static");
    expect(document.querySelector("canvas")).toBeNull();
    act(() => void vi.advanceTimersByTime(1500));
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("a failsafe always ends the intro even if the animation never completes", () => {
    vi.useFakeTimers();
    const done = vi.fn();
    render(<BrandIntro onDone={done} />);
    act(() => void vi.advanceTimersByTime(TIMELINE.total + 3000));
    expect(done).toHaveBeenCalled();
  });
  it("makes the app inert only while it plays, and releases it on unmount", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    const view = render(<BrandIntro onDone={() => {}} />);
    expect(root).toHaveAttribute("inert");
    view.unmount();
    expect(root).not.toHaveAttribute("inert");
  });
  it("does not replay on in-app navigation: it lives outside the router", async () => {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    appStore.getState().setPersona("tenant");
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <IntroHost />
        <MemoryRouter initialEntries={["/tenant"]}>
          <AppRoutes showUnbuilt={false} />
        </MemoryRouter>
      </ToastProvider>,
    );
    await user.click(screen.getByRole("link", { name: "Saved" }));
    await user.click(screen.getAllByRole("link", { name: "Find a Home" })[0]!);
    expect(screen.queryByTestId("brand-intro")).toBeNull();
  });
});

describe("scope, motion and bundle hygiene", () => {
  it("is independent of Presenter Mode, the network and extra packages", () => {
    const src = Object.entries(SOURCES).filter(([f]) => !f.includes(".test.")).map(([, s]) => s).join("\n");
    expect(src).not.toMatch(/from "[^"]*presenter|presenterMode|features"|VITE_ENABLE_PRESENTER/i);
    expect(src).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|gsap|framer-motion|three|lottie|tsparticles/i);
    const imports = new Set([...src.matchAll(/from "([^".][^"]*)"/g)].map((m) => m[1]));
    expect([...imports].sort()).toEqual(["react", "react-dom"]);
  });
  it("disables animation under prefers-reduced-motion and keeps Skip visible and focusable", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(p: string, enc: string): string };
    const css = fs.readFileSync("src/intro/BrandIntro.module.css", "utf8");
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/\.skip:focus-visible/);
    expect(css).toMatch(/\.skip \{[^}]*min-height: 44px/);
  });
});
