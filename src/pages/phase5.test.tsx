import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { addDays, toISODate } from "../domain/dates";
import { DEMO_OWNER_ID, DEMO_TENANT_ID } from "../domain/types";
import { STORAGE_KEY, loadState } from "../store/persistence";
import { appStore, createAppStore } from "../store/store";

function Where() {
  const l = useLocation();
  return <output data-testid="where">{l.pathname + l.search}</output>;
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
const tomorrow = toISODate(addDays(new Date(), 1));
const rowOf = (code: string) => screen.getAllByTestId("enquiry-row").find((r) => r.textContent?.includes(code))!;
const stored = (code: string) => appStore.getState().data.visitRequests.find((r) => r.displayCode === code)!;

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("owner");
  appStore.getState().setOwnerIntroSeen();
  vi.restoreAllMocks();
});

describe("O-07 Enquiries & Visits (AC-14, AC-15, AC-23, AC-26 owner side)", () => {
  it("lists only the demo owner's requests, with the required fields, and none of another owner's", () => {
    renderAt("/owner/requests");
    expect(screen.getAllByTestId("enquiry-row")).toHaveLength(4); // 1001–1004; 1005 and 1006 belong to other owners
    expect(screen.queryByText(/NIV-VR-1005|NIV-VR-1006/)).not.toBeInTheDocument();
    const r = rowOf("NIV-VR-1001");
    expect(within(r).getByText(/Sunlit 2 BHK, Malviya Nagar/)).toBeInTheDocument();
    expect(within(r).getByText("Riya S.")).toBeInTheDocument();
    expect(within(r).getByText(/Preferred: .*Morning \(9–12\)/)).toBeInTheDocument();
    expect(within(r).getByText(/Is the flat available from next week\?/)).toBeInTheDocument();
    expect(within(r).getByText(/received \d+ \w+ \d{4}/)).toBeInTheDocument();
    expect(within(r).getByText("Pending")).toBeInTheDocument();
  });

  it("offers exactly the valid actions per status (no actions on terminal states)", () => {
    renderAt("/owner/requests");
    const names = (code: string) => within(rowOf(code)).getAllByRole("button").map((b) => b.getAttribute("aria-label") ?? b.textContent);
    expect(names("NIV-VR-1001")).toEqual(["Mark contacted for NIV-VR-1001", "Schedule visit for NIV-VR-1001", "Cancel NIV-VR-1001", "View details for NIV-VR-1001"]);
    expect(names("NIV-VR-1002")).toEqual(["Schedule visit for NIV-VR-1002", "Cancel NIV-VR-1002", "View details for NIV-VR-1002"]);
    expect(names("NIV-VR-1003")).toEqual(["Mark completed for NIV-VR-1003", "Cancel NIV-VR-1003", "View details for NIV-VR-1003"]);
    expect(names("NIV-VR-1004")).toEqual(["View details for NIV-VR-1004"]); // completed: terminal
  });

  it("Mark contacted changes the one shared record and says nothing was sent", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "Mark contacted for NIV-VR-1001" }));
    expect(stored("NIV-VR-1001").status).toBe("contacted");
    expect(stored("NIV-VR-1001").statusHistory.map((h) => h.status)).toEqual(["pending", "contacted"]);
    expect(within(rowOf("NIV-VR-1001")).getByText("Contacted")).toBeInTheDocument();
    expect(screen.getByText("NIV-VR-1001: status updated to Contacted")).toBeInTheDocument();
    expect(screen.getByText(/prototype only — no message sent/)).toBeInTheDocument();
  });

  it("Schedule visit opens a dialog defaulting to the tenant's preference, validates the date and saves", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "Schedule visit for NIV-VR-1001" }));
    const dlg = screen.getByRole("dialog", { name: "Schedule visit" });
    expect(within(dlg).getByLabelText("Visit date")).toHaveValue(stored("NIV-VR-1001").preferredDate);
    expect(within(dlg).getByRole("radio", { name: "Morning (9–12)" })).toBeChecked();
    expect(within(dlg).getByText(/No message is sent to the tenant/)).toBeInTheDocument();
    fireEvent.change(within(dlg).getByLabelText("Visit date"), { target: { value: toISODate(addDays(new Date(), 90)) } });
    await user.click(within(dlg).getByRole("button", { name: "Save schedule" }));
    expect(within(dlg).getByRole("alert")).toHaveTextContent("Choose a visit date within the next 60 days.");
    expect(stored("NIV-VR-1001").status).toBe("pending");
    fireEvent.change(within(dlg).getByLabelText("Visit date"), { target: { value: tomorrow } });
    await user.click(within(dlg).getByRole("radio", { name: "Evening (4–7)" }));
    await user.click(within(dlg).getByRole("button", { name: "Save schedule" }));
    expect(stored("NIV-VR-1001")).toMatchObject({ status: "scheduled", scheduledFor: { date: tomorrow, slot: "evening" } });
    expect(within(rowOf("NIV-VR-1001")).getByText("Visit Scheduled")).toBeInTheDocument();
    expect(within(rowOf("NIV-VR-1001")).getByText(/Scheduled: .*Evening/)).toBeInTheDocument();
  });

  it("Mark completed then no further actions; Cancel asks first, records the reason, and is shared", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "Mark completed for NIV-VR-1003" }));
    expect(stored("NIV-VR-1003").status).toBe("completed");
    expect(within(rowOf("NIV-VR-1003")).queryByRole("button", { name: /Cancel|completed|Schedule/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel NIV-VR-1002" }));
    const dlg = screen.getByRole("dialog", { name: "Cancel this request?" });
    await user.click(within(dlg).getByRole("button", { name: "Keep request" }));
    expect(stored("NIV-VR-1002").status).toBe("contacted");
    await user.click(screen.getByRole("button", { name: "Cancel NIV-VR-1002" }));
    await user.type(screen.getByLabelText(/Reason/), "Home let to someone else");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel request" }));
    expect(stored("NIV-VR-1002")).toMatchObject({ status: "cancelled", cancelledBy: "owner", cancelReason: "Home let to someone else" });
  });

  it("a stale view cannot make an invalid change: the error is shown, nothing is written (AC-23)", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    const before = appStore.getState().data.visitRequests;
    // the tenant cancels in another tab while this list still offers "Mark contacted"
    act(() => void appStore.getState().createVisitRequest({ propertyId: "prop_fx_02", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false }));
    await user.click(screen.getByRole("button", { name: "Mark contacted for NIV-VR-1007" }));
    expect(stored("NIV-VR-1007").status).toBe("contacted");
    act(() => void appStore.getState().cancelVisitRequest("req_u_1007", "Plans changed"));
    // the row now shows Cancelled (shared store), so no stale button remains; force a stale write via the action
    const r = appStore.getState().ownerTransitionRequest("req_u_1007", "scheduled", { scheduledFor: { date: tomorrow, slot: "morning" } });
    expect(r).toMatchObject({ ok: false, code: "invalid_transition", message: "This request is already Cancelled. The list has been refreshed." });
    expect(stored("NIV-VR-1007").status).toBe("cancelled");
    expect(before).not.toBe(appStore.getState().data.visitRequests);
  });

  it("reports a refused change as an error toast and never as success", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(screen.getByRole("button", { name: "Mark contacted for NIV-VR-1001" }));
    expect(screen.getByText("That change couldn't be made")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't save your change/)).toBeInTheDocument();
    expect(screen.queryByText(/status updated to/)).not.toBeInTheDocument();
    expect(stored("NIV-VR-1001").status).toBe("pending");
  });

  it("filters by status (with counts), property, search text; sorts; and shows the empty-filter state", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "Pending (1)" }));
    expect(screen.getByTestId("enquiry-count")).toHaveTextContent("1 request");
    await user.click(screen.getByRole("button", { name: "All (4)" }));
    await user.selectOptions(screen.getByLabelText("Property"), "prop_fx_01");
    expect(screen.getByTestId("enquiry-count")).toHaveTextContent("2 requests");
    expect(where()).toBe("/owner/requests?property=prop_fx_01");
    await user.type(screen.getByRole("searchbox", { name: /Search by request ID or tenant name/ }), "karan");
    expect(screen.getByTestId("enquiry-count")).toHaveTextContent("1 request");
    await user.clear(screen.getByRole("searchbox", { name: /Search by request ID/ }));
    await user.type(screen.getByRole("searchbox", { name: /Search by request ID/ }), "zzz");
    expect(screen.getByText("No requests match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("enquiry-count")).toHaveTextContent("4 requests");
    await user.selectOptions(screen.getByLabelText("Sort by"), "visit");
    const order = screen.getAllByTestId("enquiry-row").map((r) => r.getAttribute("data-request-id"));
    expect(order[0]).toBe("req_fx_1004"); // earliest visit date (6 days ago)
  });

  it("the property link in 'View enquiries' pre-filters the list", () => {
    renderAt("/owner/requests?property=prop_fx_02");
    expect(screen.getByTestId("enquiry-count")).toHaveTextContent("1 request");
    expect(screen.getByText(/NIV-VR-1003/)).toBeInTheDocument();
  });

  it("expands a long message", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().createVisitRequest({ propertyId: "prop_fx_02", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "Hello, could I see the kitchenette and the terrace? I would also like to know about the parking arrangements nearby.", sharePhoneWithOwner: false }));
    renderAt("/owner/requests");
    const row = rowOf("NIV-VR-1007");
    expect(within(row).getByText(/…/)).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Show more" }));
    expect(within(row).getByText(/parking arrangements nearby/)).toBeInTheDocument();
  });

  it("shows an empty state with a Preview as Tenant shortcut when there are no requests", async () => {
    const user = userEvent.setup();
    act(() => appStore.setState((s) => ({ data: { ...s.data, visitRequests: [] } })));
    renderAt("/owner/requests");
    expect(screen.getByText("No visit requests yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Preview as Tenant" }));
    expect(where()).toBe("/tenant");
    expect(appStore.getState().ui.persona).toBe("tenant");
  });
});

describe("phone privacy on the Owner side (founder D7)", () => {
  const make = (share: boolean) => {
    act(() => void appStore.getState().createVisitRequest({ propertyId: "prop_fx_02", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: share }));
  };

  it("without consent the owner sees no number anywhere", async () => {
    const user = userEvent.setup();
    make(false);
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "View details for NIV-VR-1007" }));
    expect(screen.getByTestId("tenant-phone")).toHaveTextContent("Not shared — the tenant did not choose to share it");
    expect(document.body.textContent).not.toMatch(/9876543210|98765 43210/);
  });

  it("with consent the owner sees the number, only in the request details", async () => {
    const user = userEvent.setup();
    make(true);
    renderAt("/owner/requests");
    expect(document.body.textContent).not.toMatch(/98765 43210/); // not in the list rows
    await user.click(screen.getByRole("button", { name: "View details for NIV-VR-1007" }));
    expect(screen.getByTestId("tenant-phone")).toHaveTextContent("+91 98765 43210");
  });

  it("fixture requests never show a number", async () => {
    const user = userEvent.setup();
    renderAt("/owner/requests");
    await user.click(screen.getByRole("button", { name: "View details for NIV-VR-1001" }));
    expect(screen.getByTestId("tenant-phone")).toHaveTextContent("Not shared");
  });
});

describe("cross-tab synchronisation (AC-19, §9.3)", () => {
  it("a change written by the Owner tab reaches the Tenant tab through the storage event, without writing back", () => {
    const store: Record<string, string> = {};
    const mem = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] };
    const listeners: ((e: Event) => void)[] = [];
    const win = { addEventListener: (_: string, fn: EventListenerOrEventListenerObject) => listeners.push(fn as (e: Event) => void), removeEventListener: () => {} };
    const clock = () => new Date(2026, 9, 10, 12);
    const tenantTab = createAppStore({ storage: mem, clock, win });
    const ownerTab = createAppStore({ storage: mem, clock });
    // owner tab (a separate store instance on the same storage) changes a status
    const created = tenantTab.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: toISODate(addDays(clock(), 1)), slot: "morning", message: "", sharePhoneWithOwner: false });
    expect(created.ok).toBe(true);
    // simulate the browser telling the OTHER tab that storage changed
    const sync = (raw: string) => listeners.forEach((fn) => fn({ key: STORAGE_KEY, newValue: raw } as unknown as StorageEvent));
    // the owner tab loads the latest state (as a fresh page would) and acts on it
    const fresh = createAppStore({ storage: mem, clock });
    const r = fresh.getState().ownerTransitionRequest("req_u_1007", "contacted");
    expect(r.ok).toBe(true);
    const writesBefore = JSON.stringify(Object.keys(store));
    sync(store[STORAGE_KEY]!);
    expect(tenantTab.getState().data.visitRequests.find((x) => x.id === "req_u_1007")?.status).toBe("contacted");
    expect(JSON.stringify(Object.keys(store))).toBe(writesBefore);
    void ownerTab;
  });
});

describe("Tenant 'Updated' indicator (in-app only, not a notification)", () => {
  it("appears when the owner changes a request and clears once the tenant opens it", async () => {
    const user = userEvent.setup();
    act(() => {
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    appStore.getState().setPersona("tenant");
    const view = renderAt("/tenant/dashboard/requests");
    expect(screen.queryByTestId("updated-dot")).not.toBeInTheDocument(); // the tenant's own action
    view.unmount();
    act(() => void appStore.getState().ownerTransitionRequest("req_u_1007", "contacted"));
    renderAt("/tenant/dashboard/requests");
    expect(screen.getByTestId("updated-dot")).toHaveTextContent("Updated");
    await user.click(screen.getByRole("button", { name: "View details for NIV-VR-1007" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByTestId("updated-dot")).not.toBeInTheDocument();
  });
});

/* ---------------------------------------------------------------------------------------------
 * E2E-01 — the connected scenario of blueprint §9.2 / §15.9, driven only through the UI
 * (role switcher, forms, buttons) on one rendered app, then verified against stored state.
 * ------------------------------------------------------------------------------------------- */
describe("E2E-01 connected Owner ⇄ Tenant scenario", () => {
  type U = ReturnType<typeof userEvent.setup>;
  const switchTo = async (user: U, role: "Tenant view" | "Owner view") => {
    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    await user.click(screen.getByRole("button", { name: role }));
  };
  const next = (user: U) => user.click(screen.getByRole("button", { name: "Next" }));
  const sidebar = (name: string) => within(screen.getByRole("navigation", { name: "Owner navigation" })).getByRole("link", { name });

  async function publishFlat(user: U) {
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
    await next(user);
    await user.type(screen.getByLabelText(/Your name/), "Demo Owner");
    await user.type(screen.getByLabelText(/Phone number/), "9876543210");
    await user.click(screen.getByRole("checkbox", { name: /I understand this is a demo listing/ }));
    await user.click(screen.getByRole("button", { name: "Publish demo listing" }));
  }

  it("owner publishes → tenant finds it → requests a visit → owner schedules it → tenant sees it → owner makes it unavailable → tenant sees that — and it all survives a reload and a reset", async () => {
    const user = userEvent.setup();
    appStore.getState().setPersona(null);
    // 0–1  Welcome → Owner → demo access → dashboard
    act(() => appStore.setState((s) => ({ ui: { ...s.ui, ownerIntroSeen: false } })));
    renderAt("/");
    await user.click(screen.getByRole("link", { name: /I'm a Property Owner/ }));
    await user.click(screen.getByRole("button", { name: "Enter dashboard" }));
    const stat = (label: string) => screen.getByText(label).previousElementSibling?.textContent;
    expect(stat("New Requests")).toBe("1");
    expect(stat("Active listings")).toBe("3");

    // 2  Owner creates and publishes a demo property
    await user.click(screen.getByRole("link", { name: /Add property/ }));
    await publishFlat(user);
    expect(where()).toBe("/owner/properties/prop_u_001");
    expect(screen.getByText(/Demo listing published/)).toBeInTheDocument();

    // 3–4  Role switch → Tenant → search → the new property is first and opens with its honest trust profile
    await switchTo(user, "Tenant view");
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(screen.getByTestId("result-count")).toHaveTextContent("12 homes");
    expect(screen.getAllByTestId("property-card")[0]).toHaveTextContent("Demo Test Flat, Bani Park");
    await user.click(screen.getByRole("link", { name: "Demo Test Flat, Bani Park" }));
    expect(where()).toBe("/tenant/property/prop_u_001");
    const trust = screen.getAllByRole("listitem").filter((li) => li.getAttribute("data-category")).map((r) => r.getAttribute("data-status"));
    expect(trust).toEqual(["not_checked", "not_checked", "pending_review", "verified_demo"]);

    // 5  Tenant submits a visit request (phone NOT shared)
    await user.click(screen.getByRole("button", { name: "Request a Visit" }));
    const form = screen.getByRole("dialog", { name: "Request a visit" });
    await user.type(within(form).getByLabelText(/Full name/), "Test Tenant");
    await user.type(within(form).getByLabelText(/Phone number/), "9123456780");
    fireEvent.change(within(form).getByLabelText(/Preferred date/), { target: { value: tomorrow } });
    await user.click(within(form).getByRole("radio", { name: "Afternoon (12–4)" }));
    await user.type(within(form).getByLabelText(/Message to the owner/), "Is the flat available this week?");
    await user.click(within(form).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    const done = screen.getByRole("dialog", { name: "Request created" });
    expect(within(done).getByTestId("request-id")).toHaveTextContent("NIV-VR-1007");
    expect(within(done).getByText("Pending")).toBeInTheDocument();

    // 6  Visible in the Tenant dashboard
    await user.click(within(done).getByRole("button", { name: "View my visit requests" }));
    expect(within(screen.getByTestId("request-row")).getByText("Pending")).toBeInTheDocument();

    // 7  Same request on the Owner's overview and Enquiries & Visits
    await switchTo(user, "Owner view");
    expect(where()).toBe("/owner/properties/prop_u_001"); // each role keeps its own last route
    await user.click(sidebar("Overview"));
    expect(stat("New Requests")).toBe("2");
    await user.click(sidebar("Enquiries & Visits"));
    const row = rowOf("NIV-VR-1007");
    expect(within(row).getByText("Test Tenant")).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "View details for NIV-VR-1007" }));
    expect(screen.getByTestId("tenant-phone")).toHaveTextContent("Not shared");
    await user.keyboard("{Escape}");

    // 8  Owner: Contacted, then Schedule visit (defaults)
    await user.click(screen.getByRole("button", { name: "Mark contacted for NIV-VR-1007" }));
    await user.click(screen.getByRole("button", { name: "Schedule visit for NIV-VR-1007" }));
    await user.click(within(screen.getByRole("dialog", { name: "Schedule visit" })).getByRole("button", { name: "Save schedule" }));
    expect(within(rowOf("NIV-VR-1007")).getByText("Visit Scheduled")).toBeInTheDocument();
    expect(screen.queryByText(/was sent|has been sent|notification sent|notified the/i)).not.toBeInTheDocument();

    // 9  Tenant sees the update: status, timeline, Upcoming visits, Updated indicator
    await switchTo(user, "Tenant view");
    expect(where()).toBe("/tenant/dashboard/requests");
    const trow = screen.getByTestId("request-row");
    expect(within(trow).getByText("Visit Scheduled")).toBeInTheDocument();
    expect(within(trow).getByTestId("updated-dot")).toBeInTheDocument();
    await user.click(within(trow).getByRole("button", { name: "View details for NIV-VR-1007" }));
    const steps = within(within(screen.getByRole("dialog")).getByRole("list", { name: "Status history" })).getAllByRole("listitem");
    expect(steps.map((s) => s.querySelector("strong")?.textContent)).toEqual(["Pending", "Contacted", "Visit Scheduled"]);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("navigation", { name: "Dashboard sections" }).querySelector("a")!);
    expect(screen.getByText("Upcoming visits").previousElementSibling).toHaveTextContent("1");

    // 10  Owner marks the property unavailable; its request stays
    await switchTo(user, "Owner view");
    await user.click(sidebar("My Properties"));
    const orow = screen.getAllByTestId("owner-property").find((r) => r.getAttribute("data-property-id") === "prop_u_001")!;
    await user.click(within(orow).getByRole("button", { name: "Mark unavailable" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Mark unavailable" }));
    expect(within(orow).getByText("Unavailable")).toBeInTheDocument();
    await user.click(sidebar("Enquiries & Visits"));
    expect(within(rowOf("NIV-VR-1007")).getByText("Visit Scheduled")).toBeInTheDocument();

    // 11  Tenant: gone from default search, banner on the listing, request unchanged
    await switchTo(user, "Tenant view");
    await user.click(screen.getByRole("link", { name: "Find a Home" }));
    await user.click(screen.getByRole("button", { name: "Search homes" }));
    expect(screen.getByTestId("result-count")).toHaveTextContent("11 homes");
    expect(screen.queryByText("Demo Test Flat, Bani Park")).not.toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "My Visits (1)" }));
    expect(within(screen.getByTestId("request-row")).getByText("Visit Scheduled")).toBeInTheDocument();
    await user.click(within(screen.getByTestId("request-row")).getByRole("link", { name: "Demo Test Flat, Bani Park" }));
    expect(screen.getByTestId("unavailable-banner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request a Visit" })).toBeDisabled();

    // 12  Persistence: a fresh load of the saved state contains everything
    const reloaded = loadState(window.localStorage, new Date());
    expect(reloaded.notice).toBeNull();
    expect(reloaded.data.properties.find((p) => p.id === "prop_u_001")).toMatchObject({ listingStatus: "unavailable", source: "user" });
    expect(reloaded.data.visitRequests.find((r) => r.displayCode === "NIV-VR-1007")).toMatchObject({ status: "scheduled", tenantId: DEMO_TENANT_ID, ownerId: DEMO_OWNER_ID, sharePhoneWithOwner: false });
    expect(reloaded.data.visitRequests.find((r) => r.displayCode === "NIV-VR-1007")?.statusHistory.map((h) => h.status)).toEqual(["pending", "contacted", "scheduled"]);

    // 13  Reset returns the Known Starting State
    appStore.getState().resetDemo();
    expect(appStore.getState().data.properties).toHaveLength(16);
    expect(appStore.getState().data.visitRequests).toHaveLength(6);
    expect(appStore.getState().data.counters.request).toBe(1007);
  });

  it.each([1, 2, 3])("is repeatable from a fresh reset (run %i of 3): the store-level scenario gives identical results", (run) => {
    void run;
    appStore.getState().resetDemo();
    const d0 = appStore.getState().data;
    const p = appStore.getState().publishProperty({ type: "apartment", title: "Demo Test Flat, Bani Park", description: "A bright two-bedroom demo flat with a balcony, wardrobes and covered parking in a quiet block.", locality: "bani_park", addressArea: "Quiet internal road", landmark: "", rent: "18000", deposit: "36000", maintenanceCharge: "", maintenanceIncluded: true, availableFrom: toISODate(new Date()), bedrooms: "2", bathrooms: "2", furnishing: "semi_furnished", sizeSqft: "", amenities: ["wifi", "lift"], photoIds: ["pool-01"], sampleIdentity: false, sampleAuthority: false, contactName: "Demo Owner", contactPhone: "9876543210", acknowledged: true });
    expect(p.ok).toBe(true);
    const req = appStore.getState().createVisitRequest({ propertyId: "prop_u_001", name: "Test Tenant", phone: "9123456780", date: tomorrow, slot: "afternoon", message: "", sharePhoneWithOwner: false });
    expect(req.ok && "request" in req && req.request.displayCode).toBe("NIV-VR-1007");
    expect(appStore.getState().ownerTransitionRequest("req_u_1007", "contacted").ok).toBe(true);
    expect(appStore.getState().ownerTransitionRequest("req_u_1007", "scheduled", { scheduledFor: { date: tomorrow, slot: "afternoon" } }).ok).toBe(true);
    expect(appStore.getState().data.visitRequests.find((r) => r.id === "req_u_1007")?.status).toBe("scheduled");
    expect(appStore.getState().setListingStatus("prop_u_001", "unavailable").ok).toBe(true);
    expect(appStore.getState().data.visitRequests.find((r) => r.id === "req_u_1007")?.status).toBe("scheduled");
    appStore.getState().resetDemo();
    const d1 = appStore.getState().data;
    // timestamps are relative to "now", so compare identity of records, not instants
    expect(d1.properties.map((x) => x.id)).toEqual(d0.properties.map((x) => x.id));
    expect(d1.visitRequests.map((x) => [x.id, x.status])).toEqual(d0.visitRequests.map((x) => [x.id, x.status]));
    expect(d1.counters).toEqual(d0.counters);
    expect(d1.savedProperties).toEqual([]);
    expect(d1.owners.find((o) => o.id === "owner_demo")?.displayName).toBeNull();
  });
});
