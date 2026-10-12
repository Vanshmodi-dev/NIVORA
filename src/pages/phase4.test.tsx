import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { toISODate } from "../domain/dates";
import { DEMO_OWNER_ID } from "../domain/types";
import { loadState } from "../store/persistence";
import { appStore } from "../store/store";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
}

function renderAt(path: string, showUnbuilt = false) {
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
const ownerProps = () => appStore.getState().data.properties.filter((p) => p.ownerId === DEMO_OWNER_ID);
const today = toISODate(new Date());

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("owner");
  appStore.getState().setOwnerIntroSeen();
  vi.restoreAllMocks();
});

type U = ReturnType<typeof userEvent.setup>;
const next = (user: U) => user.click(screen.getByRole("button", { name: "Next" }));

async function fillAllSteps(user: U, opts: { sampleDocs?: boolean } = {}) {
  await user.selectOptions(screen.getByLabelText(/Property type/), "apartment");
  await user.type(screen.getByLabelText(/^Title/), "Demo Test Flat, Bani Park");
  await user.type(screen.getByLabelText(/^Description/), "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.");
  await next(user);
  await user.click(screen.getByRole("combobox"));
  await user.keyboard("bani{ArrowDown}{Enter}");
  await user.type(screen.getByLabelText(/Address area/), "Quiet internal road");
  await next(user);
  await user.type(screen.getByLabelText(/Monthly rent/), "18000");
  await user.type(screen.getByLabelText(/^Deposit/), "36000");
  await next(user);
  await user.selectOptions(screen.getByLabelText(/Rooms \/ bedrooms/), "2");
  await user.selectOptions(screen.getByLabelText(/^Bathrooms/), "2");
  await user.selectOptions(screen.getByLabelText(/^Furnishing/), "semi_furnished");
  await next(user);
  await user.click(screen.getByRole("button", { name: "Wi-Fi" }));
  await user.click(screen.getByRole("button", { name: "Lift" }));
  await next(user);
  await user.click(screen.getByRole("button", { name: "Demo image 1" }));
  await user.click(screen.getByRole("button", { name: "Demo image 2" }));
  await next(user);
  if (opts.sampleDocs) for (const cb of screen.getAllByRole("checkbox", { name: /Attach sample document/ })) await user.click(cb);
  await next(user);
}

describe("Owner navigation (AC-03 owner)", () => {
  it("first visit shows the demo-access card; Enter dashboard continues; later visits skip it (O-01)", async () => {
    const user = userEvent.setup();
    act(() => appStore.setState((s) => ({ ui: { ...s.ui, ownerIntroSeen: false } })));
    renderAt("/owner");
    expect(screen.getByRole("heading", { name: /demo owner/i })).toBeInTheDocument();
    expect(screen.getByText(/No account is created/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/password|phone|name/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enter dashboard" }));
    expect(where()).toBe("/owner/dashboard");
    expect(appStore.getState().ui.ownerIntroSeen).toBe(true);
  });

  it("with the intro seen, /owner goes straight to the dashboard", () => {
    renderAt("/owner");
    expect(where()).toBe("/owner/dashboard");
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeInTheDocument();
  });

  it("every built sidebar item reaches a real screen — never a blank or 404 page", async () => {
    const user = userEvent.setup();
    renderAt("/owner/dashboard");
    const nav = () => within(screen.getByRole("navigation", { name: "Owner navigation" }));
    const expected: [string, RegExp][] = [
      ["My Properties", /My Properties/],
      ["Add Property", /Add a demo property/],
      ["Enquiries & Visits", /Enquiries & Visits/],
      ["Verification Center", /Verification Center/],
      ["Settings", /Profile & settings/],
      ["Overview", /Overview/],
    ];
    for (const [link, heading] of expected) {
      await user.click(nav().getByRole("link", { name: link }));
      expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      expect(screen.queryByText("We can’t find that page")).not.toBeInTheDocument();
    }
  });

  it("the mobile bottom bar and the More sheet expose the same set of destinations", async () => {
    const user = userEvent.setup();
    renderAt("/owner/dashboard");
    const bar = within(screen.getByRole("navigation", { name: "Owner quick navigation" }));
    expect(bar.getAllByRole("link").map((a) => a.textContent)).toEqual(["Overview", "Properties", "Requests"]);
    await user.click(bar.getByRole("button", { name: "More" }));
    const sheet = within(screen.getByRole("dialog", { name: "Menu" }));
    expect(sheet.getAllByRole("link").map((a) => a.textContent)).toEqual(["Overview", "My Properties", "Add Property", "Enquiries & Visits", "Rent Tracking", "Maintenance", "Verification Center", "Settings"]);
  });

  it("the bottom bar is hidden in the wizard (it has its own Back/Next bar)", () => {
    renderAt("/owner/properties/new");
    expect(screen.queryByRole("navigation", { name: "Owner quick navigation" })).not.toBeInTheDocument();
  });
});

describe("O-02 Owner overview", () => {
  it("shows the starting figures from the shared data: 7 / 3 / New Requests 1 / Scheduled 1", () => {
    renderAt("/owner/dashboard");
    const stat = (label: string) => screen.getByText(label).previousElementSibling?.textContent;
    expect(stat("Total properties")).toBe("7");
    expect(stat("Active listings")).toBe("3");
    expect(stat("New Requests")).toBe("1");
    expect(stat("Scheduled visits")).toBe("1");
    expect(Number(stat("Pending verification tasks"))).toBeGreaterThan(0);
    expect(screen.getByText(/derived from this prototype's demo data/)).toBeInTheDocument();
  });

  it("lists items needing attention and recent activity with working links", async () => {
    const user = userEvent.setup();
    renderAt("/owner/dashboard");
    const attn = within(screen.getByRole("region", { name: "Needs your attention" }));
    expect(attn.getByRole("link", { name: /New request NIV-VR-1001/ })).toBeInTheDocument();
    expect(attn.getByRole("link", { name: /Re-confirm availability for Modern 1 BHK/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Recent activity" })).getAllByRole("listitem")).toHaveLength(5);
    await user.click(attn.getByRole("link", { name: /Re-confirm availability/ }));
    expect(where()).toBe("/owner/verification?property=prop_fx_05");
  });
});

describe("O-03 My Properties (AC-16 owner list)", () => {
  it("lists exactly the seven demo-owner properties with status, rent and request counts", () => {
    renderAt("/owner/properties");
    const rows = screen.getAllByTestId("owner-property");
    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.getAttribute("data-property-id")).sort()).toEqual(["prop_fx_01", "prop_fx_02", "prop_fx_05", "prop_fx_11", "prop_fx_12", "prop_fx_15", "prop_fx_16"]);
    const fx1 = rows.find((r) => r.getAttribute("data-property-id") === "prop_fx_01")!;
    expect(within(fx1).getByText("Published")).toBeInTheDocument();
    expect(within(fx1).getByText(/₹22,000/)).toBeInTheDocument();
    expect(within(fx1).getByText("Requests: 2 open · 2 total")).toBeInTheDocument();
    expect(within(fx1).getByText(/4 of 4 checks verified \(demo\)/)).toBeInTheDocument();
    expect(screen.queryByText("Sunlit 2 BHK, Malviya Nagar", { selector: "a" })).toBeInTheDocument();
    // other owners' properties never appear
    expect(screen.queryByText(/Garden-Facing 3 BHK/)).not.toBeInTheDocument();
  });

  it("filters by status, searches, sorts and shows an empty-filter state", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties");
    await user.click(screen.getByRole("button", { name: "Published" }));
    expect(screen.getByTestId("owner-count")).toHaveTextContent("3 properties");
    await user.click(screen.getByRole("button", { name: "Draft" }));
    expect(screen.getByTestId("owner-count")).toHaveTextContent("1 property");
    await user.click(screen.getByRole("button", { name: "All" }));
    await user.type(screen.getByRole("searchbox", { name: "Search my properties" }), "mansarovar");
    expect(screen.getByTestId("owner-count")).toHaveTextContent("2 properties");
    await user.selectOptions(screen.getByLabelText("Sort by"), "rent_desc");
    expect(screen.getAllByTestId("owner-property")[0]?.getAttribute("data-property-id")).toBe("prop_fx_05"); // ₹12,000 vs ₹11,500
    await user.clear(screen.getByRole("searchbox", { name: "Search my properties" }));
    await user.type(screen.getByRole("searchbox", { name: "Search my properties" }), "zzz");
    expect(screen.getByText("No properties match this filter.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filter" }));
    expect(screen.getByTestId("owner-count")).toHaveTextContent("7 properties");
  });

  it("shows an empty state with a call to action when the owner has no properties", () => {
    act(() => appStore.setState((s) => ({ data: { ...s.data, properties: s.data.properties.filter((p) => p.ownerId !== DEMO_OWNER_ID) } })));
    renderAt("/owner/properties");
    expect(screen.getByText("You haven't listed a home yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add your first demo property" })).toHaveAttribute("href", "/owner/properties/new");
  });

  it("row actions: availability toggle asks first (and changes the shared record), links go to the right places", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties");
    const row = () => screen.getAllByTestId("owner-property").find((r) => r.getAttribute("data-property-id") === "prop_fx_02")!;
    expect(within(row()).getByRole("link", { name: "Review verification" })).toHaveAttribute("href", "/owner/verification?property=prop_fx_02");
    expect(within(row()).getByRole("link", { name: "View enquiries" })).toHaveAttribute("href", "/owner/requests?property=prop_fx_02");
    await user.click(within(row()).getByRole("button", { name: "Mark unavailable" }));
    const dlg = screen.getByRole("dialog", { name: "Mark this home unavailable?" });
    expect(within(dlg).getByText(/Existing visit requests are kept/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(appStore.getState().data.properties.find((p) => p.id === "prop_fx_02")?.listingStatus).toBe("published");
    await user.click(within(row()).getByRole("button", { name: "Mark unavailable" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark unavailable" }));
    expect(appStore.getState().data.properties.find((p) => p.id === "prop_fx_02")?.listingStatus).toBe("unavailable");
    expect(within(row()).getByText("Unavailable")).toBeInTheDocument();
    await user.click(within(row()).getByRole("button", { name: "Mark available" }));
    expect(appStore.getState().data.properties.find((p) => p.id === "prop_fx_02")?.listingStatus).toBe("published");
  });

  it("draft and pending-review rows offer no availability toggle", () => {
    renderAt("/owner/properties?status=draft");
    const row = screen.getByTestId("owner-property");
    expect(within(row).queryByRole("button", { name: /Mark (un)?available/ })).not.toBeInTheDocument();
    expect(within(row).getByText("Not visible to tenants")).toBeInTheDocument();
  });
});

describe("O-04 Add Property wizard (AC-28)", () => {
  it("blocks Next on each invalid step with the specified messages and focuses the first error", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await next(user);
    expect(screen.getByText("Choose a property type.")).toBeInTheDocument();
    expect(screen.getByText("Enter a title of 10–80 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a description of 40–1000 characters.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Property type/)).toHaveFocus());
    expect(screen.getByRole("heading", { name: "Basic information" })).toBeInTheDocument(); // did not advance
    await user.type(screen.getByLabelText(/^Description/), "Call me on 98765 43210 for details about this wonderful demo flat please.");
    await user.selectOptions(screen.getByLabelText(/Property type/), "apartment");
    await user.type(screen.getByLabelText(/^Title/), "Demo Test Flat, Bani Park");
    await next(user);
    expect(screen.getByText("Please don't include phone numbers or emails in the description.")).toBeInTheDocument();
  });

  it("Back keeps entered values; studio / single room fixes rooms at 1", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await user.selectOptions(screen.getByLabelText(/Property type/), "studio");
    await user.type(screen.getByLabelText(/^Title/), "Compact Studio Demo");
    await user.type(screen.getByLabelText(/^Description/), "A compact demo studio with a kitchenette, wardrobe and air conditioning for one person.");
    await next(user);
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Compact Studio Demo");
    await next(user);
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("sod{ArrowDown}{Enter}");
    await user.type(screen.getByLabelText(/Address area/), "Calm residential street");
    await next(user);
    await user.type(screen.getByLabelText(/Monthly rent/), "9000");
    expect(screen.getByRole("button", { name: /Use 2× rent/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Use 2× rent/ }));
    expect(screen.getByLabelText(/^Deposit/)).toHaveValue("18000");
    await next(user);
    const rooms = screen.getByLabelText(/Rooms \/ bedrooms/);
    expect(rooms).toBeDisabled();
    expect(rooms).toHaveValue("1");
    expect(screen.getByText("Studios and single rooms are always one room.")).toBeInTheDocument();
  });

  it("validates rent, deposit and date on the rental step", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await user.selectOptions(screen.getByLabelText(/Property type/), "apartment");
    await user.type(screen.getByLabelText(/^Title/), "Demo Test Flat, Bani Park");
    await user.type(screen.getByLabelText(/^Description/), "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.");
    await next(user);
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("bani{ArrowDown}{Enter}");
    await user.type(screen.getByLabelText(/Address area/), "Quiet internal road");
    await next(user);
    await user.type(screen.getByLabelText(/Monthly rent/), "500");
    await user.type(screen.getByLabelText(/^Deposit/), "9999999");
    fireEvent.change(screen.getByLabelText(/Available from/), { target: { value: "2020-01-01" } });
    await next(user);
    expect(screen.getByText(/between ₹1,000 and ₹3,00,000/)).toBeInTheDocument();
    expect(screen.getByText("Enter a deposit between ₹0 and 12 times the rent.")).toBeInTheDocument();
    expect(screen.getByText("Choose a date from today up to 180 days ahead.")).toBeInTheDocument();
  });

  it("photos: at least one is required; selected photos can be reordered and removed; the placeholder notice is honest", async () => {
    const user = userEvent.setup();
    const seedRender = renderAt("/owner/properties/new");
    act(() => {
      appStore.getState().setWizardDraft({ step: 6, form: { ...(appStore.getState().ui.wizardDraft as { form?: object } | null)?.form, type: "apartment", title: "Demo Test Flat, Bani Park", description: "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.", locality: "bani_park", addressArea: "Quiet internal road", landmark: "", rent: "18000", deposit: "36000", maintenanceCharge: "", maintenanceIncluded: true, availableFrom: today, bedrooms: "2", bathrooms: "2", furnishing: "semi_furnished", sizeSqft: "", amenities: [], photoIds: [], sampleIdentity: false, sampleAuthority: false, contactName: "", contactPhone: "", acknowledged: false } as never });
    });
    // remount to pick up the saved working copy at step 6
    seedRender.unmount();
    renderAt("/owner/properties/new");
    expect(screen.getAllByRole("heading", { name: "Photographs" }).length).toBeGreaterThan(0);
    // 6 of the 24 owner-pool slots have licensed images installed (demo-minimum set); the notice must say the rest are placeholders.
    expect(screen.getByText(/Only some licensed demo images have been added to this build so far/)).toBeInTheDocument();
    expect(screen.queryByText(/licensed demo images haven't been added to this build yet/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nothing is uploaded/)).toBeInTheDocument();
    await next(user);
    expect(screen.getAllByText("Choose at least one photo (up to 6).").length).toBeGreaterThan(0);
    await user.click(screen.getAllByRole("button", { name: "Demo image 3" })[0]!);
    await user.click(screen.getAllByRole("button", { name: "Demo image 5" })[0]!);
    const chosen = () => screen.getAllByRole("listitem").filter((li) => /Demo image \d/.test(li.textContent ?? "")).map((li) => li.textContent?.replace(/\s+/g, " ").trim());
    expect(chosen()[0]).toMatch(/Cover · Demo image 3/);
    await user.click(screen.getAllByRole("button", { name: "Move demo image 5 up" })[0]!);
    expect(chosen()[0]).toMatch(/Cover · Demo image 5/);
    await user.click(screen.getAllByRole("button", { name: "Remove demo image 5" })[0]!);
    expect(chosen()[0]).toMatch(/Cover · Demo image 3/);
  });

  it("the working copy survives a refresh (unmount + remount) at the same step", async () => {
    const user = userEvent.setup();
    const first = renderAt("/owner/properties/new");
    await user.selectOptions(screen.getByLabelText(/Property type/), "apartment");
    await user.type(screen.getByLabelText(/^Title/), "Demo Test Flat, Bani Park");
    await user.type(screen.getByLabelText(/^Description/), "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.");
    await next(user);
    first.unmount();
    // the saved copy is also in persistent storage
    expect(loadState(window.localStorage, new Date()).ui.wizardDraft).toMatchObject({ step: 2, form: { title: "Demo Test Flat, Bani Park" } });
    renderAt("/owner/properties/new");
    expect(screen.getByRole("heading", { name: "Location" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Demo Test Flat, Bani Park");
  });

  it("Cancel asks first; discarding clears the working copy and creates nothing", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await user.type(screen.getByLabelText(/^Title/), "Half finished");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const dlg = screen.getByRole("dialog", { name: "Leave without saving?" });
    await user.click(within(dlg).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByLabelText(/^Title/)).toHaveValue("Half finished");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave and discard" }));
    expect(where()).toBe("/owner/properties");
    expect(appStore.getState().ui.wizardDraft).toBeNull();
    expect(ownerProps()).toHaveLength(7);
  });

  it("review shows every step with Edit links, requires the acknowledgement and the contact details once", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await fillAllSteps(user);
    expect(screen.getByRole("heading", { name: "Review and publish" })).toBeInTheDocument();
    expect(screen.getByText("Demo Test Flat, Bani Park")).toBeInTheDocument();
    expect(screen.getByText("₹18,000")).toBeInTheDocument();
    expect(screen.getByText("Wi-Fi, Lift")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Enter your full name (2–60 letters).").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Please confirm you understand this is a demo listing.").length).toBeGreaterThan(0);
    expect(ownerProps()).toHaveLength(7);
    await user.click(screen.getByRole("button", { name: "Edit Rental details" }));
    expect(screen.getByRole("heading", { name: "Rental details" })).toBeInTheDocument();
  });

  it("publishing creates a Published, tenant-visible property with the specified verification states (AC-28)", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await fillAllSteps(user);
    await user.type(screen.getByLabelText(/Your name/), "Demo Owner");
    await user.type(screen.getByLabelText(/Phone number/), "9876543210");
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a demo listing/ }));
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));

    expect(where()).toBe("/owner/properties/prop_u_001");
    expect(screen.getByText(/Demo listing published/)).toBeInTheDocument();
    expect(screen.getByText(/visible to Tenants in this prototype/)).toBeInTheDocument();
    const p = appStore.getState().data.properties.find((x) => x.id === "prop_u_001")!;
    expect(p).toMatchObject({ listingStatus: "published", source: "user", rent: 18000, ownerId: DEMO_OWNER_ID });
    const items = appStore.getState().data.verificationItems.filter((i) => i.propertyId === "prop_u_001").map((i) => [i.category, i.status]);
    expect(items).toEqual([["identity", "not_checked"], ["authority", "not_checked"], ["listing_accuracy", "pending_review"], ["availability", "verified_demo"]]);
    expect(appStore.getState().ui.wizardDraft).toBeNull();
    expect(appStore.getState().data.owners.find((o) => o.id === DEMO_OWNER_ID)).toMatchObject({ displayName: "Demo Owner", phone: "9876543210" });
    // persisted
    expect(loadState(window.localStorage, new Date()).data.properties.some((x) => x.id === "prop_u_001")).toBe(true);
  });

  it("an attached sample document yields Pending review, and a second listing does not ask for contact details again", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().saveOwnerProfile({ name: "Asha Verma", phone: "9876543210" }));
    renderAt("/owner/properties/new");
    await fillAllSteps(user, { sampleDocs: true });
    expect(screen.queryByLabelText(/Your name/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a demo listing/ }));
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));
    const items = appStore.getState().data.verificationItems.filter((i) => i.propertyId === "prop_u_001");
    expect(items.find((i) => i.category === "identity")?.status).toBe("pending_review");
    expect(items.find((i) => i.category === "authority")?.status).toBe("pending_review");
  });

  it("step 7 says nothing is collected or verified, and never offers a Verified outcome", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/new");
    await fillAllSteps(user).then(() => user.click(screen.getByRole("button", { name: "Back" })));
    expect(screen.getByText(/No documents are collected, uploaded or checked/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Verified(?! \(demo\))/);
    expect(screen.queryByRole("button", { name: /simulate/i })).not.toBeInTheDocument();
  });

  it("a storage failure on publish shows an error, creates nothing and keeps the draft", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().saveOwnerProfile({ name: "Asha Verma", phone: "9876543210" }));
    renderAt("/owner/properties/new");
    await fillAllSteps(user);
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a demo listing/ }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your change");
    expect(where()).toBe("/owner/properties/new");
    expect(ownerProps()).toHaveLength(7);
    expect(screen.queryByText(/Demo listing published/)).not.toBeInTheDocument();
  });
});

describe("the connected publish → discover scenario (§9 steps 1–4)", () => {
  it("a listing published by the Owner is found and opened by the Tenant, with its honest trust profile", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().saveOwnerProfile({ name: "Asha Verma", phone: "9876543210" }));
    const owner = renderAt("/owner/properties/new");
    await fillAllSteps(user);
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a demo listing/ }));
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));
    await user.click(screen.getAllByRole("button", { name: "Preview as Tenant" })[0]!);
    expect(where()).toBe("/tenant/property/prop_u_001");
    expect(appStore.getState().ui.persona).toBe("tenant");
    expect(screen.getByRole("heading", { level: 1, name: "Demo Test Flat, Bani Park" })).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem").filter((li) => li.getAttribute("data-category")).map((r) => r.getAttribute("data-status"));
    expect(rows).toEqual(["not_checked", "not_checked", "pending_review", "verified_demo"]);
    owner.unmount();
    renderAt("/tenant/search");
    expect(screen.getByTestId("result-count")).toHaveTextContent("12 homes");
    expect(screen.getAllByTestId("property-card")[0]).toHaveTextContent("Demo Test Flat, Bani Park");
  });
});

describe("O-05 Property manage, O-06 edit and availability (AC-27, AC-29)", () => {
  it("shows the tabs with the right content, the activity log and Preview as Tenant (AC-29)", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/prop_fx_01");
    expect(screen.getByRole("heading", { level: 1, name: "Sunlit 2 BHK, Malviya Nagar" })).toBeInTheDocument();
    expect(screen.getByText("Demo listing")).toBeInTheDocument();
    expect(screen.getByText(/2 total, 1 Pending/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Requests" }));
    expect(screen.getByText(/NIV-VR-1001/)).toBeInTheDocument();
    expect(screen.getByText(/Riya S\./)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Verification" }));
    expect(screen.getByText("Verification details (demo data)")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Activity" }));
    expect(within(screen.getByRole("list", { name: "Activity log" })).getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    await user.click(screen.getByRole("button", { name: "Preview as Tenant" }));
    expect(where()).toBe("/tenant/property/prop_fx_01");
    expect(screen.getByRole("heading", { level: 1, name: "Sunlit 2 BHK, Malviya Nagar" })).toBeInTheDocument();
  });

  it("a draft can be inspected but has nothing to preview", () => {
    renderAt("/owner/properties/prop_fx_12");
    expect(screen.getByRole("button", { name: "Preview as Tenant" })).toBeDisabled();
    expect(screen.getByText(/Tenants can't see a draft listing/)).toBeInTheDocument();
  });

  it("other owners' properties and unknown ids are Not Found", () => {
    renderAt("/owner/properties/prop_fx_03");
    expect(screen.getByRole("heading", { name: "We can’t find that page" })).toBeInTheDocument();
  });

  it("editing rent, amenities and description updates the shared record and the Tenant views (AC-27)", async () => {
    const user = userEvent.setup();
    const edit = renderAt("/owner/properties/prop_fx_01/edit");
    await user.clear(screen.getByLabelText(/^Description/));
    await user.type(screen.getByLabelText(/^Description/), "Freshly painted two-bedroom flat with a balcony, wardrobes and covered parking in a quiet block.");
    await user.click(screen.getByRole("button", { name: "Next" })); // location
    await user.click(screen.getByRole("button", { name: "Next" })); // rental
    await user.clear(screen.getByLabelText(/Monthly rent/));
    await user.type(screen.getByLabelText(/Monthly rent/), "23500");
    await user.click(screen.getByRole("button", { name: "Next" })); // specs
    await user.click(screen.getByRole("button", { name: "Next" })); // amenities
    await user.click(screen.getByRole("button", { name: "Power backup" })); // remove
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(where()).toBe("/owner/properties/prop_fx_01");
    const p = appStore.getState().data.properties.find((x) => x.id === "prop_fx_01")!;
    expect(p.rent).toBe(23500);
    expect(p.amenities).not.toContain("power_backup");
    expect(p.history[0]?.summary).toMatch(/Rent ₹22,000 → ₹23,500/);
    expect(screen.getByText("Changes saved")).toBeInTheDocument();
    edit.unmount();
    // Tenant view of the very same record
    renderAt("/tenant/property/prop_fx_01");
    expect(screen.getAllByText("₹23,500").length).toBeGreaterThan(0);
    expect(screen.getByText(/Freshly painted/)).toBeInTheDocument();
    expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0); // accuracy was reset (D-16)
    const accuracy = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "listing_accuracy")!;
    expect(accuracy).toHaveAttribute("data-status", "pending_review");
    expect(within(accuracy).getAllByText(/Photos, rent and specifications/).length).toBeGreaterThan(0);
  });

  it("saving an edit with nothing changed says so and does not log a change", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/prop_fx_01/edit");
    const before = appStore.getState().data.properties.find((x) => x.id === "prop_fx_01")!.history.length;
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("No changes to save")).toBeInTheDocument();
    expect(appStore.getState().data.properties.find((x) => x.id === "prop_fx_01")!.history).toHaveLength(before);
  });

  it("edit mode skips the verification and acknowledgement steps and reports invalid edits on the right step", async () => {
    const user = userEvent.setup();
    renderAt("/owner/properties/prop_fx_01/edit");
    expect(within(screen.getByRole("navigation", { name: "Listing steps" })).getAllByRole("listitem")).toHaveLength(7);
    await user.clear(screen.getByLabelText(/^Title/));
    await user.type(screen.getByLabelText(/^Title/), "Short");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText("Enter a title of 10–80 characters.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Basic information" })).toBeInTheDocument();
    expect(appStore.getState().data.properties.find((x) => x.id === "prop_fx_01")!.title).toBe("Sunlit 2 BHK, Malviya Nagar");
  });

  it("marking unavailable (confirmed) hides it from Tenants, keeps requests; marking available restores it (AC-27)", async () => {
    const user = userEvent.setup();
    const owner = renderAt("/owner/properties/prop_fx_01");
    await user.click(screen.getByRole("button", { name: "Mark unavailable" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark unavailable" }));
    expect(screen.getByRole("button", { name: "Mark available" })).toBeInTheDocument();
    expect(appStore.getState().data.visitRequests.filter((r) => r.propertyId === "prop_fx_01")).toHaveLength(2);
    owner.unmount();

    const tenantSearch = renderAt("/tenant/search");
    expect(screen.getByTestId("result-count")).toHaveTextContent("10 homes");
    expect(screen.queryByText("Sunlit 2 BHK, Malviya Nagar")).not.toBeInTheDocument();
    tenantSearch.unmount();
    const details = renderAt("/tenant/property/prop_fx_01");
    expect(screen.getByTestId("unavailable-banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request a Visit" })).toBeDisabled();
    details.unmount();

    const back = renderAt("/owner/properties/prop_fx_01");
    await user.click(screen.getByRole("button", { name: "Mark available" }));
    back.unmount();
    renderAt("/tenant/search");
    expect(screen.getByTestId("result-count")).toHaveTextContent("11 homes");
    expect(screen.getByText("Sunlit 2 BHK, Malviya Nagar")).toBeInTheDocument();
  });
});

describe("O-10 Verification Center (AC-17 owner)", () => {
  it("shows all four checks per owner property with exact statuses, sources and dates, and no simulation controls", () => {
    renderAt("/owner/verification");
    expect(screen.getByText(/identity is not ownership/)).toBeInTheDocument();
    expect(screen.getByText(/No real document is collected/)).toBeInTheDocument();
    const fx5 = screen.getAllByTestId("vc-property").find((s) => s.getAttribute("data-property-id") === "prop_fx_05")!;
    const statuses = within(fx5).getAllByRole("listitem").map((li) => li.getAttribute("data-status"));
    expect(statuses).toEqual(["verified_demo", "not_checked", "pending_review", "needs_reverification"]);
    expect(within(fx5).getByText(/hasn't been confirmed for more than 14 days/)).toBeInTheDocument();
    expect(screen.queryByText(/simulate|presenter/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Verified(?! \(demo\))/);
  });

  it("Reconfirm availability makes FX-05's stale check fresh, owner-declared and visible to Tenants", async () => {
    const user = userEvent.setup();
    const vc = renderAt("/owner/verification");
    await user.click(screen.getByRole("button", { name: "Reconfirm availability for Modern 1 BHK, Mansarovar" }));
    const fx5 = screen.getAllByTestId("vc-property").find((s) => s.getAttribute("data-property-id") === "prop_fx_05")!;
    expect(within(fx5).getAllByRole("listitem").map((li) => li.getAttribute("data-status"))[3]).toBe("verified_demo");
    expect(within(fx5).getByText(/Owner declared/)).toBeInTheDocument();
    expect(screen.getByText("Availability re-confirmed")).toBeInTheDocument();
    vc.unmount();
    renderAt("/tenant/property/prop_fx_05");
    const row = screen.getAllByRole("listitem").find((li) => li.getAttribute("data-category") === "availability")!;
    expect(row).toHaveAttribute("data-status", "verified_demo");
    expect(within(row).getByText(/Owner-confirmed on/)).toBeInTheDocument();
  });

  it("Attach sample document (demo) moves Not yet checked → Pending review, never Verified", async () => {
    const user = userEvent.setup();
    renderAt("/owner/verification");
    await user.click(screen.getByRole("button", { name: /Attach sample document \(demo\) for Authority to list on Modern 1 BHK/ }));
    expect(appStore.getState().data.verificationItems.find((i) => i.id === "ver_prop_fx_05_authority")?.status).toBe("pending_review");
    expect(screen.getByText(/No document was uploaded or checked/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attach sample document \(demo\) for Authority to list on Modern 1 BHK/ })).not.toBeInTheDocument();
  });

  it("an unavailable listing cannot be re-confirmed until it is made available", () => {
    renderAt("/owner/verification");
    const fx15 = screen.getAllByTestId("vc-property").find((s) => s.getAttribute("data-property-id") === "prop_fx_15")!;
    expect(within(fx15).getByText("Mark the home available before re-confirming.")).toBeInTheDocument();
  });

  it("highlights the property named in the link (?property=)", () => {
    renderAt("/owner/verification?property=prop_fx_02");
    expect(screen.getAllByTestId("vc-property").find((s) => s.getAttribute("data-property-id") === "prop_fx_02")!.className).toMatch(/focused/);
  });
});

describe("O-11 Settings", () => {
  it("validates and saves the owner details, states there is no real account, and resets with confirmation", async () => {
    const user = userEvent.setup();
    renderAt("/owner/settings");
    expect(screen.getByText(/no real account/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Phone number"), "123");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit Indian mobile number.");
    await user.clear(screen.getByLabelText("Phone number"));
    await user.type(screen.getByLabelText("Phone number"), "9876543210");
    await user.type(screen.getByLabelText("Name"), "Asha Verma");
    await user.click(screen.getByRole("button", { name: "Save details" }));
    expect(appStore.getState().data.owners.find((o) => o.id === DEMO_OWNER_ID)).toMatchObject({ displayName: "Asha Verma", phone: "9876543210" });
    await user.click(screen.getByRole("button", { name: "Reset demo data" }));
    await user.click(within(screen.getByRole("dialog", { name: "Reset demo data?" })).getByRole("button", { name: "Reset demo data" }));
    expect(appStore.getState().data.owners.find((o) => o.id === DEMO_OWNER_ID)?.displayName).toBeNull();
    expect(where()).toBe("/");
  });
});
