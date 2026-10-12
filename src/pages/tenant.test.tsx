import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AppRoutes } from "../app/routes";
import { Gallery } from "../components/property/Gallery";
import { ToastProvider } from "../components/ui/Toast";
import { appStore } from "../store/store";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderAt(path: string, showUnbuilt = true) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes showUnbuilt={showUnbuilt} />
        <Where />
      </MemoryRouter>
    </ToastProvider>,
  );
}

const where = () => screen.getByTestId("where").textContent;
const count = () => screen.getByTestId("result-count").textContent;
const cardTitles = () => screen.getAllByTestId("property-card").map((c) => within(c).getByRole("heading", { level: 3 }).textContent);

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("tenant");
});

describe("T-01 Tenant Home", () => {
  it("shows the heading, the search panel and four featured demo homes", () => {
    renderAt("/tenant");
    expect(screen.getByRole("heading", { level: 1, name: "Find a home that fits your life." })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Search homes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Featured demo homes" })).toBeInTheDocument();
    expect(screen.getAllByTestId("property-card")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "See how trust works" })).toHaveAttribute("href", "/trust");
  });

  it("shows 'Near a college or office' as disabled, with the reason, because locations are unverified", () => {
    renderAt("/tenant");
    const radio = screen.getByRole("radio", { name: "Near a college or office" });
    expect(radio).toHaveAttribute("aria-disabled", "true");
    expect(radio).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/full set of verified places isn't ready/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/radius/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("an empty search is valid and lists every available demo home (AC-05)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(where()).toBe("/tenant/search");
    expect(count()).toBe("11 homes");
  });

  it("rejects a minimum rent above the maximum with an inline error and does not navigate (AC-04)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    await user.type(screen.getByLabelText("Minimum rent (₹)"), "30000");
    await user.type(screen.getByLabelText("Maximum rent (₹)"), "10000");
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Maximum rent must be at least the minimum.");
    expect(where()).toBe("/tenant");
    // fixing it clears the error and allows the search
    await user.clear(screen.getByLabelText("Minimum rent (₹)"));
    await user.type(screen.getByLabelText("Minimum rent (₹)"), "5000");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(where()).toBe("/tenant/search?min=5000&max=10000");
  });

  it("strips non-digits from rent inputs", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    const max = screen.getByLabelText("Maximum rent (₹)");
    await user.type(max, "₹1a2,5b00");
    expect(max).toHaveValue("12500");
  });

  it("carries locality (chosen by keyboard), type, rooms and amenity into the URL", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    const combo = screen.getByRole("combobox", { name: "Locality" });
    await user.click(combo);
    await user.keyboard("malv");
    expect(screen.getByRole("option", { name: "Malviya Nagar" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(combo).toHaveValue("Malviya Nagar");
    // regression: the scrolling listbox must never be a Tab stop (it closed on blur and dropped focus to <body>)
    await user.click(combo);
    expect(screen.getByRole("listbox", { name: "Locality" })).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Apartment" }));
    await user.click(screen.getByRole("button", { name: "2" }));
    await user.click(screen.getByRole("button", { name: "Lift" }));
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(where()).toBe("/tenant/search?locality=malviya_nagar&type=apartment&beds=2&amen=lift");
    expect(cardTitles()).toEqual(["Sunlit 2 BHK, Malviya Nagar"]);
  });

  it("rent presets fill both inputs", async () => {
    const user = userEvent.setup();
    renderAt("/tenant");
    await user.click(screen.getByRole("button", { name: "₹10–20k" }));
    expect(screen.getByLabelText("Minimum rent (₹)")).toHaveValue("10000");
    expect(screen.getByLabelText("Maximum rent (₹)")).toHaveValue("20000");
  });
});

describe("T-02 Search results", () => {
  it("lists the 11 available demo homes by default, with count = cards (AC-05)", () => {
    renderAt("/tenant/search");
    expect(count()).toBe("11 homes");
    expect(screen.getAllByTestId("property-card")).toHaveLength(11);
  });

  it("restores filters from the URL on load (refresh-safe) and keeps count = cards (AC-06, AC-19)", () => {
    renderAt("/tenant/search?type=studio&max=15000");
    expect(count()).toBe("2 homes");
    expect([...cardTitles()].sort()).toEqual(["Compact Studio, C-Scheme", "Cozy Studio, Jawahar Nagar"]);
    expect(screen.getAllByTestId("property-card")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Remove filter: Studio" })).toBeInTheDocument();
  });

  it("changing a quick filter updates the URL, the list and the count", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    await user.click(screen.getByRole("button", { name: "Type" }));
    await user.click(screen.getByRole("button", { name: "Studio" }));
    expect(where()).toBe("/tenant/search?type=studio");
    expect(count()).toBe("2 homes");
    expect(screen.getAllByTestId("property-card")).toHaveLength(2);
  });

  it("an invalid rent range never changes the results and shows the error", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    await user.click(screen.getByRole("button", { name: "Rent" }));
    await user.type(screen.getByLabelText("Minimum rent (₹)"), "20000");
    expect(count()).toBe("4 homes"); // min alone is valid and applied
    await user.type(screen.getByLabelText("Maximum rent (₹)"), "1");
    expect(screen.getByRole("alert")).toHaveTextContent("Maximum rent must be at least the minimum.");
    expect(count()).toBe("4 homes"); // unchanged while invalid
    expect(where()).toBe("/tenant/search?min=20000");
  });

  it("More filters applies together on 'Show n homes' with a live count (AC-06)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    await user.click(screen.getByRole("button", { name: /More filters/ }));
    const drawer = screen.getByRole("dialog", { name: "More filters" });
    await user.click(within(drawer).getByRole("button", { name: "Fully furnished" }));
    expect(within(drawer).getByRole("button", { name: "Show 4 homes" })).toBeInTheDocument();
    expect(count()).toBe("11 homes"); // not applied yet
    await user.click(within(drawer).getByRole("radio", { name: "Include unavailable" }));
    expect(within(drawer).getByRole("button", { name: "Show 5 homes" })).toBeInTheDocument(); // + the unavailable villa
    await user.click(within(drawer).getByRole("button", { name: "Show 5 homes" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(count()).toBe("5 homes");
    expect(where()).toBe("/tenant/search?furn=fully_furnished&avail=any");
    expect(screen.getByRole("button", { name: /More filters \(2\)/ })).toBeInTheDocument();
  });

  it("verification filter 'All 4 checks verified (demo)' returns only fully verified, fresh listings", () => {
    renderAt("/tenant/search?verif=all4");
    expect(count()).toBe("3 homes");
    expect(cardTitles()).not.toContain("Modern 1 BHK, Mansarovar");
  });

  it("Clear all resets every filter, restores the 11 homes and confirms (AC-10)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search?type=studio&locality=sodala&sort=rent_desc");
    expect(count()).toBe("0 homes");
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(where()).toBe("/tenant/search");
    expect(count()).toBe("11 homes");
    expect(screen.getByText("Filters cleared")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear all" })).toBeDisabled();
  });

  it("shows a helpful zero-result state with removable filters and working suggestions", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search?locality=malviya_nagar&max=15000");
    expect(count()).toBe("0 homes");
    expect(screen.getByText("No homes match these filters.")).toBeInTheDocument();
    expect(screen.queryByTestId("property-card")).not.toBeInTheDocument();
    const suggestion = screen.getByRole("button", { name: /Remove the maximum rent \(2 homes\)/ });
    expect(screen.getByRole("button", { name: "Clear all filters" })).toBeInTheDocument();
    await user.click(suggestion);
    expect(where()).toBe("/tenant/search?locality=malviya_nagar");
    expect(count()).toBe("2 homes");
  });

  it("removing a single active filter chip updates the results", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search?locality=malviya_nagar&max=25000");
    expect(count()).toBe("1 home");
    await user.click(screen.getByRole("button", { name: "Remove filter: Max ₹25,000" }));
    expect(count()).toBe("2 homes");
  });

  it("opens the correct property from a card and returns to the same filtered URL (AC-12)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search?type=studio");
    await user.click(screen.getByRole("link", { name: "Compact Studio, C-Scheme" }));
    expect(where()).toBe("/tenant/property/prop_fx_02");
    expect(screen.getByRole("heading", { level: 1, name: "Compact Studio, C-Scheme" })).toBeInTheDocument();
    expect(screen.getByText("₹14,500", { selector: "dd" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back to results" }));
    expect(where()).toBe("/tenant/search?type=studio");
    expect(count()).toBe("2 homes");
  });

  it("cards show demo labelling, availability, a four-segment verification summary, a save control and no map", () => {
    renderAt("/tenant/search?locality=malviya_nagar");
    const card = screen.getAllByTestId("property-card")[0]!;
    expect(within(card).getByText("Demo")).toBeInTheDocument();
    expect(within(card).getByText("Available now")).toBeInTheDocument();
    expect(within(card).getByText(/\d of 4 checks verified \(demo\)/)).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: /^Save / })).toHaveAttribute("aria-pressed", "false");
    // Both Malviya Nagar fixtures have a licensed cover installed: it is local and carries the illustrative chip.
    const img = card.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toMatch(/^\/images\/fx\d\d-1\.jpg$/);
    expect(within(card).getByText("Illustrative photo")).toBeInTheDocument();
    for (const el of document.querySelectorAll("img")) expect(el.getAttribute("src")).toMatch(/^\/images\//);
    expect(screen.queryByRole("button", { name: /map/i })).not.toBeInTheDocument();
  });

  it("keeps the selected sort in the URL", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    await user.selectOptions(screen.getByLabelText("Sort by"), "rent_desc");
    expect(where()).toBe("/tenant/search?sort=rent_desc");
    expect(cardTitles()[0]).toBe("Premium 3 BHK, Bani Park");
  });
});

describe("T-03 Property details (AC-12, AC-17, AC-21)", () => {
  it("shows all four trust categories as separate rows, in order, with exact statuses (FX-01)", () => {
    renderAt("/tenant/property/prop_fx_01");
    const rows = screen.getAllByRole("listitem").filter((li) => li.getAttribute("data-category"));
    expect(rows.map((r) => r.getAttribute("data-category"))).toEqual(["identity", "authority", "listing_accuracy", "availability"]);
    expect(rows.map((r) => r.getAttribute("data-status"))).toEqual(["verified_demo", "verified_demo", "verified_demo", "verified_demo"]);
    expect(screen.getByText("Verification details (demo data)")).toBeInTheDocument();
    expect(screen.getAllByText("4 of 4 checks verified (demo)").length).toBeGreaterThan(0);
  });

  it("shows a mostly unchecked profile for FX-04 without a single combined tick", () => {
    renderAt("/tenant/property/prop_fx_04");
    const statuses = screen.getAllByRole("listitem").filter((li) => li.getAttribute("data-category")).map((r) => r.getAttribute("data-status"));
    expect(statuses).toEqual(["not_checked", "not_checked", "not_checked", "verified_demo"]);
    expect(screen.getAllByText("Not yet checked")).toHaveLength(3);
    expect(screen.getAllByText("1 of 4 checks verified (demo)").length).toBeGreaterThan(0);
  });

  it("flags FX-05's stale availability as 'Needs re-verification' although its stored status is verified", () => {
    renderAt("/tenant/property/prop_fx_05");
    const row = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "availability")!;
    expect(row).toHaveAttribute("data-status", "needs_reverification");
    expect(within(row).getByText("Needs re-verification")).toBeInTheDocument();
    expect(appStore.getState().data.verificationItems.find((v) => v.id === "ver_prop_fx_05_availability")?.status).toBe("verified_demo");
  });

  it("separates identity from authority and explains what a check does not cover", () => {
    renderAt("/tenant/property/prop_fx_01");
    expect(screen.getByRole("heading", { level: 3, name: "Owner identity" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Authority to list" })).toBeInTheDocument();
    expect(screen.getAllByText(/Does not prove they own or may rent the property/).length).toBeGreaterThan(0);
  });

  it("reflects a change in the shared store (same record, no copy)", () => {
    renderAt("/tenant/property/prop_fx_01");
    expect(screen.getAllByText("₹22,000").length).toBeGreaterThan(0);
    act(() => {
      appStore.setState((s) => ({ data: { ...s.data, properties: s.data.properties.map((p) => (p.id === "prop_fx_01" ? { ...p, rent: 23500 } : p)) } }));
    });
    expect(screen.getAllByText("₹23,500").length).toBeGreaterThan(0);
    expect(screen.queryByText("₹22,000")).not.toBeInTheDocument();
  });

  it("an unavailable home stays reachable, with a banner, no request, and a find-similar link", () => {
    renderAt("/tenant/property/prop_fx_10");
    expect(screen.getByTestId("unavailable-banner")).toHaveTextContent("This home is no longer available.");
    expect(screen.getByRole("button", { name: "Request a Visit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request a Visit" })).toHaveAccessibleDescription(/no longer available/);
    expect(screen.getByRole("link", { name: "Find similar homes" })).toHaveAttribute("href", "/tenant/search?locality=vaishali_nagar&type=independent_house");
  });

  it("'Request a Visit' is enabled for a published home and says nothing is sent to a real landlord", () => {
    renderAt("/tenant/property/prop_fx_01");
    const btn = screen.getByRole("button", { name: "Request a Visit" });
    expect(btn).toBeEnabled();
    expect(btn).toHaveAccessibleDescription(/not sent to a real landlord/);
  });

  it.each(["prop_fx_11", "prop_fx_12", "prop_nope"])("%s is Not Found for tenants", (id) => {
    renderAt(`/tenant/property/${id}`);
    expect(screen.getByRole("heading", { name: "We can’t find that page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Find a Home" })).toBeInTheDocument();
  });

  it("opens the Trust Center drawer from the trust block", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    await user.click(screen.getByRole("button", { name: "How trust works on NIVORA" }));
    const drawer = screen.getByRole("dialog", { name: "How trust works on NIVORA" });
    expect(within(drawer).getByText("The four checks")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows no map, no tenant phone number and no owner contact details", () => {
    renderAt("/tenant/property/prop_fx_01");
    expect(screen.getByText(/Owner contact details are not shown/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\+91|\b[6-9]\d{9}\b/);
  });

  it("shows the installed licensed cover locally, with the illustrative chip and the not-this-property notice", () => {
    renderAt("/tenant/property/prop_fx_01");
    expect(document.querySelector('img[src="/images/fx01-1.jpg"]')).not.toBeNull();
    expect(screen.getAllByText("Illustrative photo").length).toBeGreaterThan(0);
    expect(screen.getByText(/Illustrative images — not photographs of this specific property/)).toBeInTheDocument();
  });

  it("uses a placeholder, with no illustrative-images claim, for photos that are not installed", () => {
    render(<Gallery photoIds={["fx01-1"]} fallbackAlt="Apartment in Malviya Nagar (image unavailable)" registry={{}} />);
    expect(screen.getByTestId("image-placeholder")).toBeInTheDocument();
    expect(screen.queryByText("Illustrative photo")).not.toBeInTheDocument();
    expect(screen.queryByText(/Illustrative images/)).not.toBeInTheDocument();
  });
});

describe("S-01 Trust Center (AC-17, AC-18)", () => {
  it("explains the four checks, the four statuses with canonical labels, freshness and what is not claimed", () => {
    renderAt("/trust");
    expect(screen.getByRole("heading", { level: 1, name: "How trust works on NIVORA" })).toBeInTheDocument();
    for (const h of ["The four checks", "What each status means", "How availability stays fresh", "What NIVORA does not claim", "In a real product"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    for (const label of ["Verified (demo)", "Pending review", "Not yet checked", "Needs re-verification"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/14 days/)).toBeInTheDocument();
    expect(screen.getByText("Future concept — not available")).toBeInTheDocument();
  });

  it("shows two different trust profiles read from the shared fixtures", () => {
    renderAt("/trust");
    expect(screen.getByText("Example A — broad coverage")).toBeInTheDocument();
    expect(screen.getByText("Example B — mostly unchecked")).toBeInTheDocument();
    expect(screen.getByText("Sunlit 2 BHK, Malviya Nagar (demo listing)")).toBeInTheDocument();
    expect(screen.getByText("Budget Single Room, Raja Park (demo listing)")).toBeInTheDocument();
  });

  it("renders inside the Tenant shell for a tenant and the public shell with no role", () => {
    renderAt("/trust");
    expect(screen.getByText(/Viewing as:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trust Center" })).toBeInTheDocument();
    act(() => appStore.getState().setPersona(null));
    expect(screen.queryByText(/Viewing as:/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "How trust works on NIVORA" })).toBeInTheDocument();
  });

  it("is reachable from the Tenant top navigation in a production-style build", async () => {
    const user = userEvent.setup();
    renderAt("/tenant", false);
    await user.click(screen.getByRole("link", { name: "Trust Center" }));
    expect(where()).toBe("/trust");
    expect(screen.getByRole("link", { name: "Saved" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Visits" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /My Rental/ })).not.toBeInTheDocument();
  });
});

describe("Truthfulness across Phase 2 screens (AC-18, AC-37)", () => {
  const pages = ["/tenant", "/tenant/search", "/tenant/property/prop_fx_01", "/tenant/property/prop_fx_04", "/tenant/property/prop_fx_10", "/trust"];

  it.each(pages)("%s makes no guarantee, fraud-free, travel-time or unlabelled-verified claims", (path) => {
    renderAt(path);
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/fraud-free|100% safe|trusted by|guaranteed|risk-free listing/i);
    expect(text).not.toMatch(/travel time|walking distance|walkable|\bcommute\b|\d+\s*min(ute)?s?\s*(drive|walk|away)/i);
    expect(text).not.toMatch(/Verified(?! \(demo\))/);
    expect(text).not.toMatch(/Re-review/);
    expect(text).not.toMatch(/₹2,000|₹4,000|₹5,000/);
  });

  it("never names a real institution or presents anchors as available", () => {
    renderAt("/tenant");
    expect(document.body.textContent).not.toMatch(/MNIT|University of Rajasthan|World Trade Park|JECC|Manipal|Mahindra/);
  });
});
