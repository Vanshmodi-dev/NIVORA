import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { addDays, toISODate } from "../domain/dates";
import { transitionRequest } from "../domain/requests";
import { DEMO_TENANT_ID } from "../domain/types";
import { STORAGE_KEY, loadState } from "../store/persistence";
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
const tomorrow = toISODate(addDays(new Date(), 1));
const mine = () => appStore.getState().data.visitRequests.filter((r) => r.tenantId === DEMO_TENANT_ID);

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("tenant");
  vi.restoreAllMocks();
});

async function openVisitModal(user: ReturnType<typeof userEvent.setup>, propertyId = "prop_fx_01") {
  await user.click(screen.getByRole("button", { name: "Request a Visit" }));
  void propertyId;
  return screen.getByRole("dialog", { name: "Request a visit" });
}

async function fillValid(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, over: { phone?: string; share?: boolean } = {}) {
  // clear first: the form is prefilled from the saved profile on later requests
  await user.clear(within(dialog).getByLabelText(/Full name/));
  await user.type(within(dialog).getByLabelText(/Full name/), "Asha Verma");
  await user.clear(within(dialog).getByLabelText(/Phone number/));
  await user.type(within(dialog).getByLabelText(/Phone number/), over.phone ?? "+91 98765 43210");
  fireEvent.change(within(dialog).getByLabelText(/Preferred date/), { target: { value: tomorrow } });
  await user.click(within(dialog).getByRole("radio", { name: "Afternoon (12–4)" }));
  await user.type(within(dialog).getByLabelText(/Message to the owner/), "Is parking included?");
  if (over.share) await user.click(within(dialog).getByRole("checkbox", { name: /Share my phone number/ }));
}

describe("Request a Visit — form validation (AC-13)", () => {
  it("opens as a modal naming the property, with the consent box unchecked by default (D7)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    expect(within(dialog).getByText("Sunlit 2 BHK, Malviya Nagar")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: /Share my phone number with the owner/ })).not.toBeChecked();
    expect(within(dialog).getByText(/Unchecked by default/)).toBeInTheDocument();
    expect(within(dialog).getByText(/No SMS will be sent/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/OTP|verification code/i)).not.toBeInTheDocument();
  });

  it("empty submit shows every required-field error, focuses the first, and does not advance", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    expect(within(dialog).getByText("Enter your full name (2–60 letters).")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter a valid 10-digit Indian mobile number.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a date within the next 30 days.")).toBeInTheDocument();
    expect(within(dialog).getByText("Choose a time slot.")).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Full name/)).toHaveFocus();
    expect(within(dialog).queryByRole("heading", { name: "Review your request" })).not.toBeInTheDocument();
    expect(mine()).toHaveLength(0);
  });

  it("rejects 1234567890 and 98765, accepts +91 98765 43210, and rejects a past date", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    const phone = within(dialog).getByLabelText(/Phone number/);
    for (const bad of ["1234567890", "98765"]) {
      await user.clear(phone);
      await user.type(phone, bad);
      await user.tab();
      expect(within(dialog).getByText("Enter a valid 10-digit Indian mobile number.")).toBeInTheDocument();
    }
    await user.clear(phone);
    await user.type(phone, "+91 98765 43210");
    await user.tab();
    expect(within(dialog).queryByText("Enter a valid 10-digit Indian mobile number.")).not.toBeInTheDocument();
    const date = within(dialog).getByLabelText(/Preferred date/);
    fireEvent.change(date, { target: { value: toISODate(addDays(new Date(), -2)) } });
    fireEvent.blur(date);
    expect(within(dialog).getByText("Choose a date within the next 30 days.")).toBeInTheDocument();
  });

  it("shows a message counter and rejects over-long messages", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    const msg = within(dialog).getByLabelText(/Message to the owner/);
    fireEvent.change(msg, { target: { value: "x".repeat(301) } });
    fireEvent.blur(msg);
    expect(within(dialog).getByText("301/300")).toBeInTheDocument();
    expect(within(dialog).getByText("Message is too long (max 300).")).toBeInTheDocument();
  });

  it("closing a dirty form asks first; keeping editing preserves it; discarding creates nothing", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await user.type(within(dialog).getByLabelText(/Full name/), "Asha");
    await user.keyboard("{Escape}");
    const confirm = screen.getByRole("dialog", { name: "Discard this request?" });
    await user.click(within(confirm).getByRole("button", { name: "Keep editing" }));
    expect(within(screen.getByRole("dialog", { name: "Request a visit" })).getByLabelText(/Full name/)).toHaveValue("Asha");
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog", { name: "Discard this request?" })).getByRole("button", { name: "Discard request" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mine()).toHaveLength(0);
  });

  it("an untouched form closes without asking", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    await openVisitModal(user);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("Request a Visit — review, create, confirm (AC-14, AC-26)", () => {
  it("review → submit creates a real Pending record and then shows the truthful confirmation", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    expect(mine()).toHaveLength(0);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));

    const review = screen.getByRole("dialog", { name: "Review your request" });
    expect(within(review).getByText("Asha Verma")).toBeInTheDocument();
    expect(within(review).getByText("+91 98765 43210")).toBeInTheDocument();
    expect(within(review).getByText("No — the owner will not see it")).toBeInTheDocument();
    expect(within(review).getByText(/Prototype request — no real visit is booked/)).toBeInTheDocument();
    expect(mine()).toHaveLength(0); // review is not creation

    await user.click(within(review).getByRole("button", { name: "Submit request" }));

    const done = screen.getByRole("dialog", { name: "Request created" });
    expect(mine()).toHaveLength(1);
    const rec = mine()[0]!;
    expect(rec).toMatchObject({ status: "pending", displayCode: "NIV-VR-1007", propertyId: "prop_fx_01", sharePhoneWithOwner: false, tenantPhoneEntered: "9876543210" });
    expect(within(done).getByTestId("request-id")).toHaveTextContent("NIV-VR-1007");
    expect(within(done).getByText("Pending")).toBeInTheDocument();
    expect(within(done).getByText(/no real visit has been booked and no notification was sent/i)).toBeInTheDocument();
  });

  it("records phone-sharing consent only when the box was ticked (D7)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog, { share: true });
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    const review = screen.getByRole("dialog", { name: "Review your request" });
    expect(within(review).getByText("Yes — you agreed to share it")).toBeInTheDocument();
    await user.click(within(review).getByRole("button", { name: "Submit request" }));
    expect(mine()[0]?.sharePhoneWithOwner).toBe(true);
  });

  it("Edit returns to the form with the values kept", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText(/Full name/)).toHaveValue("Asha Verma");
    expect(screen.getByRole("radio", { name: "Afternoon (12–4)" })).toBeChecked();
  });

  it("the request is then visible in the Tenant dashboard with the same ID and status (AC-14, AC-15)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    await user.click(within(screen.getByRole("dialog", { name: "Request created" })).getByRole("button", { name: "View my visit requests" }));

    expect(where()).toBe("/tenant/dashboard/requests");
    const row = screen.getByTestId("request-row");
    expect(within(row).getByText("NIV-VR-1007")).toBeInTheDocument();
    expect(within(row).getByText("Sunlit 2 BHK, Malviya Nagar")).toBeInTheDocument();
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    // fictional requests from other tenants are not shown to this tenant
    expect(screen.getAllByTestId("request-row")).toHaveLength(1);
  });

  it("survives a browser refresh: the saved state contains the request (AC-14, DoD)", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    const reloaded = loadState(window.localStorage, new Date());
    expect(reloaded.notice).toBeNull();
    const rec = reloaded.data.visitRequests.find((r) => r.displayCode === "NIV-VR-1007");
    expect(rec).toMatchObject({ status: "pending", tenantId: DEMO_TENANT_ID, propertyId: "prop_fx_01" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("NIV-VR-1007");
  });

  it("prefills name and phone from the saved profile on the next request, but never the consent", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().saveTenantProfile({ name: "Asha Verma", phone: "9876543210" }));
    renderAt("/tenant/property/prop_fx_02");
    const dialog = await openVisitModal(user);
    expect(within(dialog).getByLabelText(/Full name/)).toHaveValue("Asha Verma");
    expect(within(dialog).getByLabelText(/Phone number/)).toHaveValue("9876543210");
    expect(within(dialog).getByRole("checkbox", { name: /Share my phone number/ })).not.toBeChecked();
  });
});

describe("Request a Visit — submit-time guards (AC-25, AC-26)", () => {
  it("a home that becomes unavailable before submit creates no record and shows a blocking error", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    // the Owner (another tab / after a role switch) marks the home unavailable meanwhile
    act(() => {
      appStore.setState((s) => ({ data: { ...s.data, properties: s.data.properties.map((p) => (p.id === "prop_fx_01" ? { ...p, listingStatus: "unavailable" as const } : p)) } }));
    });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("This home is no longer available, so a visit can't be requested.");
    expect(screen.queryByRole("dialog", { name: "Request created" })).not.toBeInTheDocument();
    expect(mine()).toHaveLength(0);
    expect(appStore.getState().data.counters.request).toBe(1007);
  });

  it("a second open request for the same home is refused with a link to the existing one", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    let dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Back to property" }));
    expect(screen.getByTestId("open-request-note")).toHaveTextContent("NIV-VR-1007");

    dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("You already have an open request (NIV-VR-1007) for this home.");
    expect(screen.queryByRole("dialog", { name: "Request created" })).not.toBeInTheDocument();
    expect(mine()).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "View request" }));
    expect(where()).toBe("/tenant/dashboard/requests");
  });

  it("a failed storage write shows an error, never a success message, and creates no record", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_01");
    const dialog = await openVisitModal(user);
    await fillValid(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Review request" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Submit request" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your change");
    expect(screen.queryByRole("dialog", { name: "Request created" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Request created/)).not.toBeInTheDocument();
    expect(mine()).toHaveLength(0);
  });

  it("the Request button is disabled for an unavailable home and no modal can be opened", () => {
    renderAt("/tenant/property/prop_fx_10");
    expect(screen.getByRole("button", { name: "Request a Visit" })).toBeDisabled();
  });
});

describe("Saved homes (AC-16)", () => {
  it("saving from a card sets aria-pressed, toasts, updates the nav count and lists it in Saved", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    const card = screen.getAllByTestId("property-card").find((c) => c.getAttribute("data-property-id") === "prop_fx_04")!;
    const heart = within(card).getByRole("button", { name: "Save Budget Single Room, Raja Park" });
    await user.click(heart);
    expect(within(card).getByRole("button", { name: "Remove Budget Single Room, Raja Park from saved homes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Saved to your homes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saved (1)" })).toBeInTheDocument();
    expect(where()).toBe("/tenant/search"); // the heart never navigates
    expect(appStore.getState().data.savedProperties.map((s) => s.propertyId)).toEqual(["prop_fx_04"]);

    await user.click(screen.getByRole("button", { name: "View" })); // toast action
    expect(where()).toBe("/tenant/dashboard/saved");
    expect(within(screen.getByTestId("property-card")).getByText("Budget Single Room, Raja Park")).toBeInTheDocument();
  });

  it("unsaving removes it from the list immediately and shows the empty state", async () => {
    const user = userEvent.setup();
    act(() => void appStore.getState().toggleSaved("prop_fx_04"));
    renderAt("/tenant/dashboard/saved");
    expect(screen.getByTestId("saved-count")).toHaveTextContent("1 saved home");
    await user.click(screen.getByRole("button", { name: /Remove Budget Single Room, Raja Park from saved homes/ }));
    expect(screen.getByText("No saved homes yet.")).toBeInTheDocument();
    expect(screen.getByText("Tap the heart on any home to keep it here.")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Find a Home" })).toHaveAttribute("href", "/tenant/search");
    expect(appStore.getState().data.savedProperties).toEqual([]);
  });

  it("the empty Saved page offers a way back to search", () => {
    renderAt("/tenant/dashboard/saved");
    expect(screen.getByText("No saved homes yet.")).toBeInTheDocument();
  });

  it("can be saved from the details page, including for an unavailable home, and persists", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/property/prop_fx_10");
    await user.click(screen.getByRole("button", { name: "Save this home" }));
    expect(screen.getByRole("button", { name: "Saved" })).toHaveAttribute("aria-pressed", "true");
    expect(loadState(window.localStorage, new Date()).data.savedProperties.map((s) => s.propertyId)).toEqual(["prop_fx_10"]);
  });

  it("a saved home that becomes unavailable stays, flagged, with find-similar and no visit action", () => {
    act(() => void appStore.getState().toggleSaved("prop_fx_04"));
    renderAt("/tenant/dashboard/saved");
    expect(screen.queryByText(/No longer available — a visit/)).not.toBeInTheDocument();
    act(() => {
      appStore.setState((s) => ({ data: { ...s.data, properties: s.data.properties.map((p) => (p.id === "prop_fx_04" ? { ...p, listingStatus: "unavailable" as const } : p)) } }));
    });
    expect(screen.getByText(/No longer available — a visit can't be requested/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find similar homes" })).toHaveAttribute("href", "/tenant/search?locality=raja_park&type=single_room");
    expect(screen.getByTestId("property-card")).toHaveTextContent("No longer available");
  });

  it("a save failure reports an error and changes nothing", async () => {
    const user = userEvent.setup();
    renderAt("/tenant/search");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(screen.getAllByRole("button", { name: /^Save / })[0]!);
    expect(screen.getByText("Couldn't update your saved homes")).toBeInTheDocument();
    expect(screen.queryByText("Saved to your homes")).not.toBeInTheDocument();
    expect(appStore.getState().data.savedProperties).toEqual([]);
  });

  it("shows a count in the Home quick links", () => {
    act(() => void appStore.getState().toggleSaved("prop_fx_04"));
    renderAt("/tenant");
    expect(screen.getByRole("link", { name: "Saved homes (1)" })).toHaveAttribute("href", "/tenant/dashboard/saved");
  });
});

describe("Tenant dashboard (T-06, T-08, T-09)", () => {
  it("starts with an empty, welcoming overview and an empty requests page", () => {
    renderAt("/tenant/dashboard");
    expect(screen.getByRole("heading", { level: 1, name: "Your dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Your journey starts here")).toBeInTheDocument();
  });

  it("the empty requests page offers Find a Home", () => {
    renderAt("/tenant/dashboard/requests");
    expect(screen.getByText("No visit requests yet.")).toBeInTheDocument();
    expect(within(screen.getByRole("main")).getByRole("link", { name: "Find a Home" })).toBeInTheDocument();
  });

  it("the overview summarises saved, open and upcoming from the same store records", () => {
    act(() => {
      appStore.getState().toggleSaved("prop_fx_04");
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    renderAt("/tenant/dashboard");
    expect(screen.getByRole("heading", { level: 2, name: "Hi, Asha" })).toBeInTheDocument();
    expect(screen.getByText("Saved homes").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Open requests").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText("Upcoming visits").previousElementSibling).toHaveTextContent("0");
    expect(screen.getByText(/No visit is scheduled yet/)).toBeInTheDocument();
    expect(screen.getByText("NIV-VR-1007")).toBeInTheDocument();
  });

  it("an owner-side status change in the shared store shows up for the tenant: same record, new status, timeline, next visit (AC-15)", async () => {
    const user = userEvent.setup();
    act(() => {
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    renderAt("/tenant/dashboard/requests");
    expect(within(screen.getByTestId("request-row")).getByText("Pending")).toBeInTheDocument();

    // Phase 5 will add the Owner's screens; here the same pure transition they will use is applied to the store.
    act(() => {
      appStore.setState((s) => {
        const r = s.data.visitRequests.find((x) => x.tenantId === DEMO_TENANT_ID)!;
        const contacted = transitionRequest(r, "contacted", "owner", new Date());
        if (!contacted.ok) throw new Error("contact failed");
        const scheduled = transitionRequest(contacted.request, "scheduled", "owner", new Date(), { scheduledFor: { date: tomorrow, slot: "afternoon" } });
        if (!scheduled.ok) throw new Error("schedule failed");
        return { data: { ...s.data, visitRequests: s.data.visitRequests.map((x) => (x.id === r.id ? scheduled.request : x)) } };
      });
    });

    const row = screen.getByTestId("request-row");
    expect(within(row).getByText("Visit Scheduled")).toBeInTheDocument();
    expect(row).toHaveTextContent(/Visit scheduled for .*Afternoon/);
    await user.click(within(row).getByRole("button", { name: "View details for NIV-VR-1007" }));
    const drawer = screen.getByRole("dialog", { name: "Request NIV-VR-1007" });
    const steps = within(within(drawer).getByRole("list", { name: "Status history" })).getAllByRole("listitem");
    expect(steps.map((s) => s.querySelector("strong")?.textContent)).toEqual(["Pending", "Contacted", "Visit Scheduled"]);
    expect(steps[0]).toHaveTextContent("by you");
    expect(steps[1]).toHaveTextContent("by the owner");
    expect(within(drawer).getByText(/No notification is sent/)).toBeInTheDocument();
    expect(within(drawer).getByText("Phone shared with owner").nextElementSibling).toHaveTextContent("No");
    await user.keyboard("{Escape}");

    // upcoming visit appears on the overview
    await user.click(screen.getByRole("link", { name: "Overview" }));
    expect(screen.getByText("Upcoming visits").previousElementSibling).toHaveTextContent("1");
    expect(screen.getByText(/scheduled in this prototype/)).toBeInTheDocument();
  });

  it("filters requests by Open / Scheduled / Closed with live counts", async () => {
    const user = userEvent.setup();
    act(() => {
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_02", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
      appStore.getState().cancelVisitRequest("req_u_1008");
    });
    renderAt("/tenant/dashboard/requests");
    expect(screen.getByRole("button", { name: "All (2)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open (1)" }));
    expect(screen.getAllByTestId("request-row")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Closed (1)" }));
    expect(within(screen.getByTestId("request-row")).getByText("Cancelled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scheduled (0)" }));
    expect(screen.getByText("No requests match this filter.")).toBeInTheDocument();
  });

  describe("cancelling a request (AC-23)", () => {
    const create = () =>
      act(() => {
        appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
      });

    it("asks first, records the reason, then shows Cancelled with the cancel button gone", async () => {
      const user = userEvent.setup();
      create();
      renderAt("/tenant/dashboard/requests");
      await user.click(screen.getByRole("button", { name: "Cancel request NIV-VR-1007" }));
      const confirm = screen.getByRole("dialog", { name: "Cancel this request?" });
      await user.click(within(confirm).getByRole("button", { name: "Keep request" }));
      expect(mine()[0]?.status).toBe("pending"); // declining changes nothing

      await user.click(screen.getByRole("button", { name: "Cancel request NIV-VR-1007" }));
      await user.type(screen.getByLabelText(/Reason/), "Plans changed");
      await user.click(within(screen.getByRole("dialog", { name: "Cancel this request?" })).getByRole("button", { name: "Cancel request" }));
      expect(mine()[0]).toMatchObject({ status: "cancelled", cancelledBy: "tenant", cancelReason: "Plans changed" });
      expect(within(screen.getByTestId("request-row")).getByText("Cancelled")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cancel request NIV-VR-1007" })).not.toBeInTheDocument();
      expect(screen.getByText(/no message was sent to anyone/i)).toBeInTheDocument();
    });

    it("a stale view cannot cancel a request the owner already completed: error shown, nothing written", async () => {
      const user = userEvent.setup();
      create();
      renderAt("/tenant/dashboard/requests");
      await user.click(screen.getByRole("button", { name: "Cancel request NIV-VR-1007" }));
      act(() => {
        appStore.setState((s) => {
          const r = s.data.visitRequests.find((x) => x.tenantId === DEMO_TENANT_ID)!;
          const sched = transitionRequest(r, "scheduled", "owner", new Date(), { scheduledFor: { date: tomorrow, slot: "morning" } });
          if (!sched.ok) throw new Error("x");
          const done = transitionRequest(sched.request, "completed", "owner", new Date());
          if (!done.ok) throw new Error("y");
          return { data: { ...s.data, visitRequests: s.data.visitRequests.map((x) => (x.id === r.id ? done.request : x)) } };
        });
      });
      await user.click(within(screen.getByRole("dialog", { name: "Cancel this request?" })).getByRole("button", { name: "Cancel request" }));
      expect(screen.getByText("This request is already Visit Completed. The list has been refreshed.")).toBeInTheDocument();
      expect(mine()[0]?.status).toBe("completed");
      expect(screen.queryByText(/cancelled/i)).not.toBeInTheDocument();
    });

    it("only open requests offer Cancel", () => {
      create();
      act(() => void appStore.getState().cancelVisitRequest("req_u_1007"));
      renderAt("/tenant/dashboard/requests");
      expect(screen.queryByRole("button", { name: /^Cancel request/ })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "View details for NIV-VR-1007" })).toBeInTheDocument();
    });
  });

  describe("profile (T-09)", () => {
    it("validates, saves, prefills and clears the details", async () => {
      const user = userEvent.setup();
      renderAt("/tenant/dashboard/profile");
      expect(screen.getByRole("button", { name: "Clear my details" })).toBeDisabled();
      await user.type(screen.getByLabelText("Phone number"), "12345");
      await user.click(screen.getByRole("button", { name: "Save details" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid 10-digit Indian mobile number.");
      expect(appStore.getState().data.tenants.find((t) => t.id === DEMO_TENANT_ID)?.phone).toBeNull();

      await user.clear(screen.getByLabelText("Phone number"));
      await user.type(screen.getByLabelText("Phone number"), "98765 43210");
      await user.type(screen.getByLabelText("Full name"), "Asha Verma");
      await user.click(screen.getByRole("button", { name: "Save details" }));
      expect(screen.getByText("Profile saved in this browser")).toBeInTheDocument();
      expect(appStore.getState().data.tenants.find((t) => t.id === DEMO_TENANT_ID)).toMatchObject({ name: "Asha Verma", phone: "9876543210" });

      await user.click(screen.getByRole("button", { name: "Clear my details" }));
      await user.click(within(screen.getByRole("dialog", { name: "Clear your details?" })).getByRole("button", { name: "Clear my details" }));
      expect(appStore.getState().data.tenants.find((t) => t.id === DEMO_TENANT_ID)).toMatchObject({ name: null, phone: null });
      expect(screen.getByLabelText("Full name")).toHaveValue("");
    });

    it("states that the details stay in this browser and that sharing a phone is a per-request choice", () => {
      renderAt("/tenant/dashboard/profile");
      expect(screen.getByText(/Stored only in this browser for the demo/)).toBeInTheDocument();
      expect(screen.getByText(/always your choice, request by request/)).toBeInTheDocument();
    });
  });

  it("the dashboard has one set of in-page tabs, including the labelled My Rental preview", () => {
    renderAt("/tenant/dashboard", true);
    expect(within(screen.getByRole("navigation", { name: "Dashboard sections" })).getAllByRole("link").map((a) => a.textContent)).toEqual(["Overview", "Saved", "Visit requests", "My Rental (preview)", "Profile"]);
  });

  it("the top navigation shows counts for saved homes and open requests", () => {
    act(() => {
      appStore.getState().toggleSaved("prop_fx_04");
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    renderAt("/tenant");
    expect(screen.getByRole("link", { name: "Saved (1)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Visits (1)" })).toBeInTheDocument();
  });
});

describe("truthfulness and privacy across Phase 3 screens", () => {
  const pages = ["/tenant/dashboard", "/tenant/dashboard/saved", "/tenant/dashboard/requests", "/tenant/dashboard/profile"];

  it.each(pages)("%s claims nothing was sent, booked or verified in the real world", (path) => {
    act(() => {
      appStore.getState().toggleSaved("prop_fx_04");
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: false });
    });
    renderAt(path);
    const text = screen.getByRole("main").textContent ?? "";
    expect(text).not.toMatch(/message sent|notified the owner|booking confirmed|\bpaid\b|\bOTP\b/i);
    expect(text).not.toMatch(/fraud-free|100% safe|guaranteed/i);
    expect(text).not.toMatch(/Verified(?! \(demo\))/);
    expect(text).not.toMatch(/₹2,000|₹4,000|₹5,000/);
  });

  it("no public or search screen ever shows a tenant's phone number", () => {
    act(() => {
      appStore.getState().createVisitRequest({ propertyId: "prop_fx_01", name: "Asha Verma", phone: "9876543210", date: tomorrow, slot: "morning", message: "", sharePhoneWithOwner: true });
    });
    for (const path of ["/", "/tenant", "/tenant/search", "/tenant/property/prop_fx_01", "/trust"]) {
      const { unmount } = renderAt(path);
      expect(document.body.textContent).not.toMatch(/9876543210|98765 43210/);
      unmount();
    }
  });
});
