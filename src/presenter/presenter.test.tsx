import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { PRESENTER_ENABLED } from "../app/features";
import { ToastProvider } from "../components/ui/Toast";
import { buildSeed } from "../data/seed";
import { clearClockOverride, systemClock } from "../domain/clock";
import { addDays } from "../domain/dates";
import { getEffectiveVerification } from "../domain/verification";
import { STORAGE_KEY } from "../store/persistence";
import { appStore } from "../store/store";
import { enterPresenterMode, exitPresenterMode, initPresenter, setSimulatedDate } from "./session";
import { SIM_STATUSES, ageAvailability, completeReview, restoreSeededVerification, simulateVerification, undoAll } from "./simulate";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname}</output>;
}
function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes showUnbuilt={false} />
        <Where />
      </MemoryRouter>
    </ToastProvider>,
  );
}
const where = () => screen.getByTestId("where").textContent;
const NOW = new Date(2026, 9, 10, 12, 0, 0);
const seed = () => buildSeed(NOW);

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("tenant");
  window.sessionStorage.clear();
  clearClockOverride();
  vi.restoreAllMocks();
});
afterEach(() => clearClockOverride());

describe("build flag (founder D4)", () => {
  it("is enabled in the test/dev/demo modes (and disabled by .env.production — checked by `npm run check:bundles`)", () => {
    expect(PRESENTER_ENABLED).toBe(true);
  });
});

describe("simulation functions (AC-36)", () => {
  const item = (data: ReturnType<typeof seed>, id: string) => data.verificationItems.find((i) => i.id === id)!;

  it("offers the three demonstrated outcomes plus Not yet checked, and allows any → any", () => {
    expect([...SIM_STATUSES].sort()).toEqual(["needs_reverification", "not_checked", "pending_review", "verified_demo"]);
    let data = seed();
    for (const to of ["pending_review", "needs_reverification", "verified_demo", "not_checked"] as const) {
      const r = simulateVerification(data, "ver_prop_fx_01_identity", to, NOW);
      if (!r.ok) throw new Error(r.message);
      data = r.data;
      expect(item(data, "ver_prop_fx_01_identity").status).toBe(to);
    }
  });

  it("labels the record as simulated, logs it, and adds a property history event", () => {
    const r = simulateVerification(seed(), "ver_prop_fx_01_identity", "pending_review", NOW);
    if (!r.ok) throw new Error("x");
    const i = item(r.data, "ver_prop_fx_01_identity");
    expect(i).toMatchObject({ status: "pending_review", source: "simulated_review", note: "Simulated by presenter (demo)" });
    expect(i.simulatedAt).toBe(NOW.toISOString());
    expect(r.data.presenter.simulationLog).toHaveLength(1);
    expect(r.data.presenter.simulationLog[0]).toMatchObject({ target: "ver_prop_fx_01_identity", field: "status", from: "verified_demo", to: "pending_review" });
    expect(r.data.properties.find((p) => p.id === "prop_fx_01")?.history[0]).toMatchObject({ type: "simulated", summary: expect.stringContaining("simulated by presenter") });
  });

  it("refuses a no-op and an unknown item without changing anything", () => {
    const data = seed();
    expect(simulateVerification(data, "ver_prop_fx_01_identity", "verified_demo", NOW)).toMatchObject({ ok: false });
    expect(simulateVerification(data, "nope", "pending_review", NOW)).toMatchObject({ ok: false });
  });

  it("age-availability makes a fresh check stale on read (effective Needs re-verification)", () => {
    const data = seed();
    const r = ageAvailability(data, "prop_fx_01", 20, NOW);
    if (!r.ok) throw new Error("x");
    const p = r.data.properties.find((x) => x.id === "prop_fx_01")!;
    expect(getEffectiveVerification(p, r.data.verificationItems, NOW).find((e) => e.category === "availability")).toMatchObject({ status: "needs_reverification", stale: true });
    expect(getEffectiveVerification(data.properties[0]!, data.verificationItems, NOW).find((e) => e.category === "availability")?.stale).toBe(false);
  });

  it("completeReview publishes a pending-review listing only", () => {
    const r = completeReview(seed(), "prop_fx_11", NOW);
    if (!r.ok) throw new Error("x");
    expect(r.data.properties.find((p) => p.id === "prop_fx_11")?.listingStatus).toBe("published");
    expect(completeReview(seed(), "prop_fx_01", NOW)).toMatchObject({ ok: false });
  });

  it("Undo all returns every record to exactly its previous value (statuses, timestamps, history, log)", () => {
    const base = seed();
    let data = base;
    for (const step of [
      (d: typeof base) => simulateVerification(d, "ver_prop_fx_01_identity", "pending_review", NOW),
      (d: typeof base) => simulateVerification(d, "ver_prop_fx_01_identity", "needs_reverification", new Date(NOW.getTime() + 1000)),
      (d: typeof base) => simulateVerification(d, "ver_prop_fx_04_authority", "verified_demo", new Date(NOW.getTime() + 2000)),
      (d: typeof base) => ageAvailability(d, "prop_fx_02", 15, new Date(NOW.getTime() + 3000)),
      (d: typeof base) => completeReview(d, "prop_fx_11", new Date(NOW.getTime() + 4000)),
    ]) {
      const r = step(data);
      if (!r.ok) throw new Error(r.message);
      data = r.data;
    }
    expect(data.presenter.simulationLog).toHaveLength(5);
    expect(undoAll(data)).toEqual(base);
  });

  it("Undo all leaves unrelated, user-created records untouched", () => {
    let data = seed();
    const sim = simulateVerification(data, "ver_prop_fx_01_identity", "pending_review", NOW);
    if (!sim.ok) throw new Error("x");
    data = { ...sim.data, savedProperties: [{ id: "sp1", tenantId: "tenant_demo", propertyId: "prop_fx_04", savedAt: NOW.toISOString() }] };
    expect(undoAll(data).savedProperties).toHaveLength(1);
  });

  it("Restore seeded state resets fixtures to seed values, even real owner changes, and clears the log", () => {
    let data = seed();
    const a = simulateVerification(data, "ver_prop_fx_02_authority", "verified_demo", NOW);
    if (!a.ok) throw new Error("x");
    const b = ageAvailability(a.data, "prop_fx_01", 20, NOW);
    if (!b.ok) throw new Error("x");
    data = b.data;
    const restored = restoreSeededVerification(data, NOW);
    expect(restored.verificationItems).toEqual(seed().verificationItems);
    expect(restored.properties.find((p) => p.id === "prop_fx_01")?.availabilityConfirmedAt).toBe(seed().properties.find((p) => p.id === "prop_fx_01")?.availabilityConfirmedAt);
    expect(restored.presenter.simulationLog).toEqual([]);
    expect(restored.properties.every((p) => p.history.every((h) => h.type !== "simulated"))).toBe(true);
  });

  it("Restore seeded state returns a user-created property's checks to their publish-time status (seedStatus)", () => {
    const base = seed();
    const user = { ...base.verificationItems[0]!, id: "ver_prop_u_001_identity", propertyId: "prop_u_001", status: "not_checked" as const, seedStatus: "not_checked" as const, source: "owner_declared" as const };
    const withUser = { ...base, verificationItems: [...base.verificationItems, user] };
    const sim = simulateVerification(withUser, user.id, "verified_demo", NOW);
    if (!sim.ok) throw new Error("x");
    const restored = restoreSeededVerification(sim.data, NOW);
    expect(restored.verificationItems.find((i) => i.id === user.id)).toMatchObject({ status: "not_checked", source: "owner_declared", simulatedAt: null });
  });
});

describe("deliberate entry, banner and exit (PM-2 … PM-4)", () => {
  async function openAbout(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /About this prototype/ }));
    return screen.getByRole("dialog", { name: "About this prototype" });
  }

  it("normal screens carry no simulation controls and no banner; /presenter redirects home when inactive", async () => {
    renderAt("/presenter");
    await waitFor(() => expect(where()).toBe("/"));
    expect(screen.queryByRole("region", { name: "Presenter Mode" })).not.toBeInTheDocument();
    expect(screen.queryByText(/PRESENTER MODE/)).not.toBeInTheDocument();
  });

  it("the About dialog offers only a low-emphasis link; entering needs the acknowledgement; cancelling changes nothing", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    const about = await openAbout(user);
    expect(within(about).queryByRole("button", { name: /Apply|Undo all|Restore seeded/ })).not.toBeInTheDocument();
    await user.click(within(about).getByRole("button", { name: "Presenter tools…" }));
    const dlg = screen.getByRole("dialog", { name: "Enter Presenter Mode?" });
    expect(within(dlg).getByText(/Nothing is actually verified/)).toBeInTheDocument();
    expect(within(dlg).getByRole("button", { name: "Enter Presenter Mode" })).toBeDisabled();
    await user.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(appStore.getState().ui.presenterMode).toBe(false);
    await user.click(within(screen.getByRole("dialog", { name: "About this prototype" })).getByRole("button", { name: "Presenter tools…" }));
    await user.click(screen.getByRole("checkbox", { name: "I understand these are simulated" }));
    await user.click(screen.getByRole("button", { name: "Enter Presenter Mode" }));
    expect(appStore.getState().ui.presenterMode).toBe(true);
    expect(await screen.findByRole("region", { name: "Presenter Mode" })).toHaveTextContent("PRESENTER MODE · Simulated tools active");
  });

  it.each(["/", "/tenant", "/owner/dashboard"])("the banner appears in every shell (%s) while active, and Exit hides it", async (path) => {
    const user = userEvent.setup();
    if (path.startsWith("/owner")) {
      appStore.getState().setPersona("owner");
      appStore.getState().setOwnerIntroSeen();
    }
    renderAt(path);
    act(() => enterPresenterMode());
    const banner = await screen.findByRole("region", { name: "Presenter Mode" });
    await user.click(within(banner).getByRole("button", { name: "Exit" }));
    expect(screen.queryByRole("region", { name: "Presenter Mode" })).not.toBeInTheDocument();
    expect(appStore.getState().ui.presenterMode).toBe(false);
  });

  it("the mode flag is session-scoped: never in the saved state, restored from the session on refresh, absent in a new session", () => {
    act(() => enterPresenterMode());
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").ui?.presenterMode).toBeUndefined();
    expect(window.sessionStorage.getItem("nivora.presenter.session")).toBe("1");
    // simulated refresh: flag cleared from memory, session survives
    appStore.setState((s) => ({ ui: { ...s.ui, presenterMode: false } }));
    window.sessionStorage.setItem("nivora.presenter.session", "1");
    const stop = initPresenter();
    expect(appStore.getState().ui.presenterMode).toBe(true);
    stop();
    // new session
    appStore.setState((s) => ({ ui: { ...s.ui, presenterMode: false } }));
    window.sessionStorage.clear();
    const stop2 = initPresenter();
    expect(appStore.getState().ui.presenterMode).toBe(false);
    stop2();
  });

  it("Reset demo data ends Presenter Mode and the simulated date", () => {
    const stop = initPresenter();
    act(() => {
      enterPresenterMode();
      setSimulatedDate("2026-12-01");
    });
    expect(appStore.getState().ui.presenterNowOverride).not.toBeNull();
    act(() => appStore.getState().resetDemo());
    expect(appStore.getState().ui.presenterMode).toBe(false);
    expect(appStore.getState().ui.presenterNowOverride).toBeNull();
    expect(window.sessionStorage.getItem("nivora.presenter.session")).toBeNull();
    stop();
  });
});

describe("S-04 Presenter Panel (AC-36)", () => {
  beforeEach(() => {
    act(() => enterPresenterMode());
  });

  it("states that nothing is real verification and that hiding is not a security boundary", async () => {
    renderAt("/presenter");
    expect(await screen.findByRole("heading", { name: "Presenter Panel" })).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is real verification/)).toBeInTheDocument();
    expect(screen.getByText(/not a security boundary/)).toBeInTheDocument();
    expect(screen.getByText(/not an administrative system/)).toBeInTheDocument();
  });

  it("simulates Pending review / Verified (demo) / Needs re-verification and the Tenant and Owner screens show it with the Simulated label", async () => {
    const user = userEvent.setup();
    const panel = renderAt("/presenter");
    await screen.findByRole("heading", { name: "Presenter Panel" });
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_01");
    await user.selectOptions(screen.getByLabelText("New status for Owner identity"), "pending_review");
    await user.click(screen.getByRole("button", { name: "Apply simulated status to Owner identity" }));
    expect(screen.getByText("Owner identity set to Pending review")).toBeInTheDocument();
    expect(appStore.getState().data.verificationItems.find((i) => i.id === "ver_prop_fx_01_identity")).toMatchObject({ status: "pending_review", source: "simulated_review" });
    expect(screen.getByText("Simulated")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(1); // log table

    panel.unmount();
    renderAt("/tenant/property/prop_fx_01");
    const row = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "identity")!;
    expect(row).toHaveAttribute("data-status", "pending_review");
    expect(within(row).getByText("Simulated by presenter (demo)")).toBeInTheDocument();
  });

  it("Undo all (with confirmation) and Restore seeded state revert the simulation; the log is emptied", async () => {
    const user = userEvent.setup();
    renderAt("/presenter");
    await screen.findByRole("heading", { name: "Presenter Panel" });
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_01");
    await user.selectOptions(screen.getByLabelText("New status for Authority to list"), "needs_reverification");
    await user.click(screen.getByRole("button", { name: "Apply simulated status to Authority to list" }));
    expect(appStore.getState().data.presenter.simulationLog).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Undo all simulated changes" }));
    const dlg = screen.getByRole("dialog", { name: "Undo all simulated changes?" });
    await user.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(appStore.getState().data.presenter.simulationLog).toHaveLength(1); // cancel changes nothing
    await user.click(screen.getByRole("button", { name: "Undo all simulated changes" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Undo all simulated changes" }));
    expect(appStore.getState().data.presenter.simulationLog).toEqual([]);
    expect(appStore.getState().data.verificationItems.find((i) => i.id === "ver_prop_fx_01_authority")?.status).toBe("verified_demo");
    expect(screen.getByText("No simulated changes yet.")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("New status for Listing accuracy"), "not_checked");
    await user.click(screen.getByRole("button", { name: "Apply simulated status to Listing accuracy" }));
    await user.click(screen.getByRole("button", { name: "Restore seeded verification state" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Restore seeded state" }));
    expect(appStore.getState().data.verificationItems.find((i) => i.id === "ver_prop_fx_01_listing_accuracy")?.status).toBe("verified_demo");
    expect(appStore.getState().data.presenter.simulationLog).toEqual([]);
  });

  it("can age availability and complete a pending review; the review shows the listing to Tenants", async () => {
    const user = userEvent.setup();
    renderAt("/presenter");
    await screen.findByRole("heading", { name: "Presenter Panel" });
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_11");
    await user.click(screen.getByRole("button", { name: "Simulate review completed" }));
    expect(appStore.getState().data.properties.find((p) => p.id === "prop_fx_11")?.listingStatus).toBe("published");
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_01");
    await user.click(screen.getByRole("button", { name: "20 days ago" }));
    const av = getEffectiveVerification(appStore.getState().data.properties.find((p) => p.id === "prop_fx_01")!, appStore.getState().data.verificationItems, new Date()).find((e) => e.category === "availability");
    expect(av?.status).toBe("needs_reverification");
  });

  it("a failed storage write reports an error and changes nothing", async () => {
    const user = userEvent.setup();
    renderAt("/presenter");
    await screen.findByRole("heading", { name: "Presenter Panel" });
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_01");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(screen.getByRole("button", { name: "Apply simulated status to Owner identity" }));
    expect(screen.getByText("Couldn't apply that")).toBeInTheDocument();
    expect(appStore.getState().data.presenter.simulationLog).toEqual([]);
  });

  it("Exit Presenter Mode removes access to the panel again", async () => {
    const user = userEvent.setup();
    renderAt("/presenter");
    await user.click(await screen.findByRole("button", { name: "Exit Presenter Mode" }));
    await waitFor(() => expect(where()).toBe("/"));
  });
});

describe("simulated date (founder D6)", () => {
  it("changes only what the app displays, is marked in the banner, never touches the real clock, and is cleared on exit", async () => {
    const user = userEvent.setup();
    const realNow = Date.now();
    act(() => enterPresenterMode());
    const view = renderAt("/presenter");
    await screen.findByRole("heading", { name: "Presenter Panel" });
    const future = new Date(Date.now() + 30 * 86_400_000);
    const iso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    await user.type(screen.getByLabelText("Date"), iso);
    await user.click(screen.getByRole("button", { name: "Use simulated date" }));
    expect(screen.getByRole("region", { name: "Presenter Mode" })).toHaveTextContent("Simulated date:");
    expect(systemClock().getTime()).toBeGreaterThan(realNow + 25 * 86_400_000);
    expect(Math.abs(Date.now() - realNow)).toBeLessThan(5000); // the real clock is untouched
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").ui?.presenterNowOverride).toBeUndefined(); // never persisted

    view.unmount();
    // 30 days later every sample listing's availability check is stale on the Tenant's screen
    renderAt("/tenant/property/prop_fx_01");
    const row = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "availability")!;
    expect(row).toHaveAttribute("data-status", "needs_reverification");

    act(() => exitPresenterMode());
    expect(appStore.getState().ui.presenterNowOverride).toBeNull();
    expect(Math.abs(systemClock().getTime() - Date.now())).toBeLessThan(5000);
    expect(screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "availability")).toHaveAttribute("data-status", "verified_demo");
    void addDays;
  });
});
