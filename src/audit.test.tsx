import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "./app/routes";
import { ToastProvider } from "./components/ui/Toast";
import { enterPresenterMode } from "./presenter/session";
import { appStore } from "./store/store";

/**
 * Phase 7 copy and truthfulness audit (TP-1 … TP-12): every route in the route map is rendered in
 * a realistic state and its visible text is searched for banned claims.
 */
function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes showUnbuilt={false} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const ROUTES: { path: string; persona: "tenant" | "owner" | null }[] = [
  { path: "/", persona: null },
  { path: "/roadmap", persona: null },
  { path: "/trust", persona: null },
  { path: "/credits", persona: null },
  { path: "/tenant", persona: "tenant" },
  { path: "/tenant/search", persona: "tenant" },
  { path: "/tenant/discover", persona: "tenant" },
  { path: "/tenant/discover?s=phone", persona: "tenant" },
  { path: "/tenant/discover?s=origin", persona: "tenant" },
  { path: "/tenant/discover?s=count&at=anchor_vgu&km=7", persona: "tenant" },
  { path: "/tenant/discover?s=results&at=anchor_vgu&km=10", persona: "tenant" },
  { path: "/tenant/discover?s=results&at=anchor_vgu&km=2&type=studio&max=1000", persona: "tenant" },
  { path: "/tenant/search?locality=sodala&type=studio", persona: "tenant" },
  { path: "/tenant/property/prop_fx_01", persona: "tenant" },
  { path: "/tenant/property/prop_fx_04", persona: "tenant" },
  { path: "/tenant/property/prop_fx_05", persona: "tenant" },
  { path: "/tenant/property/prop_fx_10", persona: "tenant" },
  { path: "/tenant/property/prop_nope", persona: "tenant" },
  { path: "/tenant/dashboard", persona: "tenant" },
  { path: "/tenant/dashboard/saved", persona: "tenant" },
  { path: "/tenant/dashboard/requests", persona: "tenant" },
  { path: "/tenant/dashboard/rental", persona: "tenant" },
  { path: "/tenant/dashboard/profile", persona: "tenant" },
  { path: "/owner", persona: "owner" },
  { path: "/owner/dashboard", persona: "owner" },
  { path: "/owner/properties", persona: "owner" },
  { path: "/owner/properties/new", persona: "owner" },
  { path: "/owner/properties/prop_fx_01", persona: "owner" },
  { path: "/owner/properties/prop_fx_05/edit", persona: "owner" },
  { path: "/owner/requests", persona: "owner" },
  { path: "/owner/rent", persona: "owner" },
  { path: "/owner/maintenance", persona: "owner" },
  { path: "/owner/verification", persona: "owner" },
  { path: "/owner/settings", persona: "owner" },
  { path: "/presenter", persona: "owner" },
];

const BANNED: [string, RegExp][] = [
  ["guarantee / fraud-free claims", /fraud-free|fraud free|100% safe|completely safe|risk-free|guaranteed|trusted by|verified by NIVORA|NIVORA[- ]verified/i],
  ["travel-time claims", /travel time|walking distance|walkable|\bcommute\b|\d+\s*min(ute)?s?\s*(drive|walk|away)/i],
  ["a verification label without (demo)", /Verified(?! \(demo\))/],
  ["a fifth verification state", /Re-review|re_review/i],
  ["NIVORA Move ideation prices", /₹\s?(2,000|4,000|5,000|2000|4000|5000)(?![\d,])/],
  ["a claim that something real was sent or completed", /message (was |has been )?sent|notification sent|has been notified|booking confirmed|booked for you|payment (received|successful|completed)|agreement (signed|executed)|SMS (was |has been )?sent|WhatsApp (was |has been )?sent/i],
  ["a dialable-looking phone number", /(?:\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/],
  ["a real institution used as a listing detail", /Manipal|Mahindra World City/],
  ["a fake testimonial / invented statistic", /testimonial|customers love|\d+\+? (happy )?(tenants|owners|users) (trust|use)|as seen (on|in)/i],
];

/**
 * A banned phrase is only a violation when it is ASSERTED. The Trust Center legitimately says what
 * statuses do NOT mean ("does not guarantee…", "not risk-free"), so a match with a negation in the
 * preceding 90 characters is allowed.
 */
function expectClean(path: string, text: string, skip: string[] = []) {
  for (const [name, re] of BANNED) {
    if (skip.includes(name)) continue;
    const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(global)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 90), m.index ?? 0);
      const negated = /\b(not|never|no|n't|nor)\b/i.test(before);
      expect(negated, `${path}: ${name}: “${m[0]}” in “…${before.slice(-50)}${m[0]}”`).toBe(true);
    }
  }
}

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setOwnerIntroSeen();
});

describe("copy audit across the whole route map", () => {
  it.each(ROUTES)("$path contains no banned claim", async ({ path, persona }) => {
    appStore.getState().setPersona(persona);
    if (path === "/presenter") act(() => enterPresenterMode());
    renderAt(path);
    if (path === "/presenter") await screen.findByRole("heading", { name: "Presenter Panel" });
    await waitFor(() => expect(document.body.textContent?.length ?? 0).toBeGreaterThan(40));
    const text = document.body.textContent ?? "";
    expectClean(path, text);
  });

  it("the audit also covers states created by use: requests, saved homes, published listings, rent and maintenance", async () => {
    appStore.getState().setPersona("tenant");
    act(() => {
      appStore.getState().toggleSaved("prop_fx_04");
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    for (const path of ["/tenant/dashboard", "/tenant/dashboard/saved", "/tenant/dashboard/requests"]) {
      const view = renderAt(path);
      const text = document.body.textContent ?? "";
      expectClean(path, text, ["a dialable-looking phone number"]); // the tenant's own request page may show what they typed; checked separately
      view.unmount();
    }
  });

  it("the tenant's phone number never appears on any screen unless the tenant opted in, and then only on the owner's request details", async () => {
    const user = userEvent.setup();
    appStore.getState().setPersona("tenant");
    act(() => void appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9123456780", date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), slot: "morning", message: "", sharePhoneWithOwner: false }));
    for (const { path, persona } of ROUTES.filter((r) => r.persona !== null && r.path !== "/presenter" && r.path !== "/tenant/dashboard/profile")) {
      appStore.getState().setPersona(persona);
      const view = renderAt(path);
      expect(document.body.textContent, path).not.toMatch(/9123456780|91234 56780/);
      view.unmount();
    }
    appStore.getState().setPersona("owner");
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "View details for NIV-VR-1007" }));
    expect(screen.getByTestId("tenant-phone")).not.toHaveTextContent(/91234/);
  });
});

describe("R-01 Future roadmap (AC-33)", () => {
  it("shows all four concepts, each tagged as not available, with no actionable controls", () => {
    renderAt("/roadmap");
    const concepts = screen.getAllByTestId("roadmap-concept");
    expect(concepts.map((c) => within(c).getByRole("heading", { level: 2 }).textContent)).toEqual(["NIVORA Agreements", "NIVORA Move", "NIVORA Protect", "Property-management expansion"]);
    for (const c of concepts) expect(c.textContent).toMatch(/Future concept|Proposed concept/);
    expect(screen.getAllByText(/not available/).length).toBeGreaterThanOrEqual(4);
    expect(screen.queryByRole("button")).not.toBeNull(); // header controls only (About)
    const main = within(screen.getByRole("main"));
    expect(main.queryByRole("button")).not.toBeInTheDocument();
    expect(main.queryByRole("textbox")).not.toBeInTheDocument();
    expect(main.getAllByRole("link").map((a) => a.textContent)).toEqual(["Back to Welcome"]);
    expect(document.body.textContent).not.toMatch(/book now|get a quote|join (the )?waitlist|notify me|sign up|buy|subscribe|add to cart|checkout/i);
  });

  it("NIVORA Move reads 'Pricing: not yet validated' and shows no currency amounts anywhere on the page", () => {
    renderAt("/roadmap");
    expect(screen.getByText("Pricing: not yet validated")).toBeInTheDocument();
    expect(screen.getByRole("main").textContent).not.toMatch(/₹|\bINR\b|\bRs\.?\s?\d/);
  });

  it("is reachable from the Welcome header and the About dialog, and is a public page without a role switcher", async () => {
    const user = userEvent.setup();
    appStore.getState().setPersona(null);
    renderAt("/");
    await user.click(screen.getByRole("link", { name: "Future roadmap" }));
    expect(screen.getByRole("heading", { level: 1, name: "Future roadmap" })).toBeInTheDocument();
    expect(screen.queryByText(/Viewing as:/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /About this prototype/ }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Read the future roadmap" })).toHaveAttribute("href", "/roadmap");
  });
});
