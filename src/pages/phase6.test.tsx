import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../app/routes";
import { ToastProvider } from "../components/ui/Toast";
import { buildSeed } from "../data/seed";
import { addDays } from "../domain/dates";
import {
  allowedMaintenanceMoves,
  createMaintenanceRequest,
  defaultRentMonth,
  recordRentPaid,
  renewalInfo,
  selectLifecycleStats,
  selectMaintenanceForOwner,
  selectMaintenanceForTenant,
  selectRentRows,
  selectTenantTenancy,
  summariseRent,
  updateMaintenanceStatus,
} from "../domain/lifecycle";
import { DEMO_OWNER_ID, DEMO_TENANT_ID } from "../domain/types";
import { appStore } from "../store/store";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const seed = () => buildSeed(NOW);

function renderAt(path: string) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes showUnbuilt={false} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.getState().setPersona("owner");
  appStore.getState().setOwnerIntroSeen();
  vi.restoreAllMocks();
});

describe("rent domain (AC-31)", () => {
  it("builds rows only for the owner's tenancies, with derived statuses (paid / due / overdue)", () => {
    const rows = selectRentRows(seed(), DEMO_OWNER_ID, NOW);
    expect(rows).toHaveLength(10); // tn_demo: 6, tn_fx_2: 4
    const st = (id: string) => rows.filter((r) => r.tenancy.id === id).map((r) => r.status);
    expect(st("tn_demo").filter((s) => s === "overdue")).toHaveLength(1);
    expect(st("tn_demo").filter((s) => s === "due")).toHaveLength(1);
    expect(st("tn_fx_2").filter((s) => s === "overdue")).toHaveLength(0);
    expect(selectRentRows(seed(), "owner_fx_a", NOW)).toEqual([]);
  });

  it("summarises a month: expected, recorded paid (demo), outstanding, overdue count", () => {
    const rows = selectRentRows(seed(), DEMO_OWNER_ID, NOW);
    const month = defaultRentMonth(rows, NOW)!;
    const s = summariseRent(rows.filter((r) => r.record.month === month));
    expect(s.expected).toBe(s.paid + s.outstanding);
    expect(s.expected).toBe(24000 + 11500); // the current cycle is still due for both tenancies
    expect(s.paid).toBe(0);
    expect(s.overdueCount).toBe(0);
    const overdueMonth = rows.find((r) => r.status === "overdue")!.record.month;
    expect(summariseRent(rows.filter((r) => r.record.month === overdueMonth)).overdueCount).toBe(1);
  });

  it("Record as paid (demo) sets paidAt only, once, and only for the owner's own records", () => {
    const data = seed();
    const row = selectRentRows(data, DEMO_OWNER_ID, NOW).find((r) => r.status === "overdue")!;
    const r = recordRentPaid(data, DEMO_OWNER_ID, row.record.id, NOW);
    if (!r.ok) throw new Error(r.message);
    expect(r.record).toMatchObject({ paidAt: NOW.toISOString(), recordedBy: "owner" });
    expect(selectRentRows(r.data, DEMO_OWNER_ID, NOW).find((x) => x.record.id === row.record.id)?.status).toBe("paid");
    expect(recordRentPaid(r.data, DEMO_OWNER_ID, row.record.id, NOW)).toMatchObject({ ok: false, code: "already_paid" });
    expect(recordRentPaid(data, "owner_fx_a", row.record.id, NOW)).toMatchObject({ ok: false, code: "not_found" });
    expect(recordRentPaid(data, DEMO_OWNER_ID, "nope", NOW)).toMatchObject({ ok: false, code: "not_found" });
  });
});

describe("tenancy, renewal and maintenance domain (AC-30, AC-32)", () => {
  it("finds the demo tenant's tenancy and computes the renewal countdown (74 days at seed)", () => {
    const tn = selectTenantTenancy(seed(), DEMO_TENANT_ID)!;
    expect(tn.id).toBe("tn_demo");
    expect(renewalInfo(tn, NOW)).toEqual({ daysLeft: 74, reminderWindowDays: 60, inWindow: false });
    expect(renewalInfo(tn, addDays(NOW, 20)).inWindow).toBe(true);
    expect(selectTenantTenancy(seed(), "tenant_fx_1")).toBeNull();
  });

  it("creates a maintenance request with the specified validation and a sequential NIV-RM id", () => {
    const base = seed();
    const bad = createMaintenanceRequest(base, { tenantId: DEMO_TENANT_ID, category: "", description: "short", priority: "" }, NOW);
    expect(bad).toMatchObject({ ok: false, code: "invalid" });
    if (!bad.ok && bad.code === "invalid") expect(Object.keys(bad.errors).sort()).toEqual(["category", "description", "priority"]);
    const ok = createMaintenanceRequest(base, { tenantId: DEMO_TENANT_ID, category: "plumbing", description: "The bathroom tap is dripping constantly", priority: "low" }, NOW);
    if (!ok.ok) throw new Error("x");
    expect(ok.request).toMatchObject({ displayCode: "NIV-RM-1004", status: "open", createdBy: "tenant", tenancyId: "tn_demo", propertyId: "prop_fx_15", source: "user" });
    expect(ok.data.counters.maintenance).toBe(1005);
    expect(createMaintenanceRequest(base, { tenantId: "tenant_fx_1", category: "plumbing", description: "A long enough description here", priority: "low" }, NOW)).toMatchObject({ ok: false, code: "no_tenancy" });
  });

  it("owner updates move open → in progress → resolved only, with notes, validated against the stored status", () => {
    const data = seed();
    expect(allowedMaintenanceMoves("open")).toEqual(["in_progress", "resolved"]);
    expect(allowedMaintenanceMoves("resolved")).toEqual([]);
    const a = updateMaintenanceStatus(data, DEMO_OWNER_ID, "maint_fx_1001", "in_progress", "  Plumber booked (demo)  ", NOW);
    if (!a.ok) throw new Error(a.message);
    expect(a.request.updates.at(-1)).toMatchObject({ status: "in_progress", by: "owner", note: "Plumber booked (demo)" });
    const b = updateMaintenanceStatus(a.data, DEMO_OWNER_ID, "maint_fx_1001", "resolved", "", NOW);
    expect(b.ok).toBe(true);
    if (b.ok) expect(updateMaintenanceStatus(b.data, DEMO_OWNER_ID, "maint_fx_1001", "open", "", NOW)).toMatchObject({ ok: false, code: "invalid_transition", message: "This request is already Resolved." });
    expect(updateMaintenanceStatus(data, DEMO_OWNER_ID, "maint_fx_1003", "in_progress", "", NOW)).toMatchObject({ ok: false, code: "invalid_transition" });
    expect(updateMaintenanceStatus(data, DEMO_OWNER_ID, "maint_fx_1001", "resolved", "x".repeat(201), NOW)).toMatchObject({ ok: false, code: "invalid_note" });
    expect(updateMaintenanceStatus(data, "owner_fx_a", "maint_fx_1001", "resolved", "", NOW)).toMatchObject({ ok: false, code: "not_found" });
  });

  it("owner and tenant selectors return the same records; overview figures count unresolved requests", () => {
    const data = seed();
    expect(selectMaintenanceForOwner(data, DEMO_OWNER_ID).map((m) => m.id).sort()).toEqual(["maint_fx_1001", "maint_fx_1002", "maint_fx_1003"]);
    expect(selectMaintenanceForTenant(data, DEMO_TENANT_ID).map((m) => m.id).sort()).toEqual(["maint_fx_1001", "maint_fx_1002"]);
    expect(selectLifecycleStats(data, DEMO_OWNER_ID, NOW).openMaintenance).toBe(2);
  });
});

describe("O-08 Rent Tracking (AC-31)", () => {
  it("is labelled as a demo preview, shows summary tiles and one row per record with a status badge", () => {
    renderAt("/owner/rent");
    expect(screen.getByRole("heading", { level: 1, name: "Rent Tracking" })).toBeInTheDocument();
    expect(screen.getByText("Preview · demo data")).toBeInTheDocument();
    expect(screen.getByText(/Nothing here moves real money/)).toBeInTheDocument();
    expect(screen.getByText("Recorded as paid (demo)")).toBeInTheDocument();
    expect(screen.getAllByTestId("rent-row").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /^Pay/ })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/UPI|card number|bank account|IFSC/i);
  });

  it("filters by status and property, and the month selector changes the rows and the tiles", async () => {
    const user = userEvent.setup();
    renderAt("/owner/rent");
    const months = within(screen.getByLabelText("Month")).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    await user.selectOptions(screen.getByLabelText("Month"), months.at(-1)!); // oldest month
    await user.click(screen.getByRole("button", { name: "Paid" }));
    expect(screen.getAllByTestId("rent-row").every((r) => r.getAttribute("data-status") === "paid")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Overdue" }));
    expect(screen.getByText("No records match these filters.")).toBeInTheDocument();
  });

  it("Record as paid (demo) asks first, says it's a demo status, updates the shared record and the Tenant's My Rental", async () => {
    const user = userEvent.setup();
    const owner = renderAt("/owner/rent");
    await user.selectOptions(screen.getByLabelText("Month"), String(selectRentRows(appStore.getState().data, DEMO_OWNER_ID, new Date()).find((r) => r.status === "overdue")!.record.month));
    await user.click(screen.getByRole("button", { name: "Overdue" }));
    const row = screen.getByTestId("rent-row");
    const id = row.getAttribute("data-rent-id")!;
    await user.click(within(row).getByRole("button", { name: /as paid \(demo\)/ }));
    const dlg = screen.getByRole("dialog", { name: "Record this rent as paid?" });
    expect(within(dlg).getByText(/No payment is made or checked/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Cancel" }));
    expect(appStore.getState().data.rentRecords.find((r) => r.id === id)?.paidAt).toBeNull();
    await user.click(within(screen.getByTestId("rent-row")).getByRole("button", { name: /as paid \(demo\)/ }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Record as paid (demo)" }));
    expect(appStore.getState().data.rentRecords.find((r) => r.id === id)).toMatchObject({ recordedBy: "owner" });
    expect(screen.getByText("Recorded as paid (demo)", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/no payment was made or checked/)).toBeInTheDocument();
    owner.unmount();

    appStore.getState().setPersona("tenant");
    renderAt("/tenant/dashboard/rental");
    const paid = screen.getAllByTestId("tenant-rent-row").filter((r) => r.getAttribute("data-status") === "paid");
    expect(paid.length).toBe(5); // all five past months of the demo tenancy are now recorded as paid
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
  });

  it("a storage failure reports an error and records nothing", async () => {
    const user = userEvent.setup();
    renderAt("/owner/rent");
    await user.click(screen.getAllByRole("button", { name: /as paid \(demo\)/ })[0]!);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Record as paid (demo)" }));
    expect(screen.getByText("Couldn't record that")).toBeInTheDocument();
    expect(appStore.getState().data.rentRecords.filter((r) => r.recordedBy === "owner").length).toBe(seed().rentRecords.filter((r) => r.paidAt).length);
  });

  it("shows an empty state when there are no rent records", () => {
    act(() => appStore.setState((s) => ({ data: { ...s.data, rentRecords: [] } })));
    renderAt("/owner/rent");
    expect(screen.getByText("No rent records yet.")).toBeInTheDocument();
  });
});

describe("O-09 Maintenance and T-10 My Rental (AC-30, AC-32)", () => {
  it("owner sees the seeded requests, updates one with a note, and the Tenant sees the same status and note", async () => {
    const user = userEvent.setup();
    const owner = renderAt("/owner/maintenance");
    expect(screen.getByText("Preview · demo data")).toBeInTheDocument();
    expect(screen.getByText(/No technician is dispatched/)).toBeInTheDocument();
    expect(screen.getAllByTestId("maintenance-row")).toHaveLength(3);
    const row = () => screen.getAllByTestId("maintenance-row").find((r) => r.textContent?.includes("NIV-RM-1001"))!;
    expect(within(row()).getByText("Open")).toBeInTheDocument();
    await user.click(within(row()).getByRole("button", { name: "Update status for NIV-RM-1001" }));
    const drawer = screen.getByRole("dialog", { name: "Update NIV-RM-1001" });
    expect(within(drawer).getByLabelText("New status")).toHaveValue("in_progress");
    await user.type(within(drawer).getByLabelText(/Note/), "Plumber booked for Friday (demo)");
    await user.click(within(drawer).getByRole("button", { name: "Save update" }));
    expect(within(row()).getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText(/no technician was dispatched and no message was sent/)).toBeInTheDocument();
    expect(appStore.getState().data.maintenanceRequests.find((m) => m.id === "maint_fx_1001")?.updates.at(-1)?.note).toBe("Plumber booked for Friday (demo)");
    // resolved requests have no update action
    expect(within(screen.getAllByTestId("maintenance-row").find((r) => r.textContent?.includes("NIV-RM-1003"))!).queryByRole("button", { name: /Update/ })).not.toBeInTheDocument();
    owner.unmount();

    appStore.getState().setPersona("tenant");
    renderAt("/tenant/dashboard/rental");
    const trow = screen.getAllByTestId("tenant-maintenance-row").find((r) => r.textContent?.includes("NIV-RM-1001"))!;
    expect(within(trow).getByText("In Progress")).toBeInTheDocument();
    expect(within(trow).getByText(/Plumber booked for Friday \(demo\)/)).toBeInTheDocument();
  });

  it("tenant raises a request (validated), and the owner sees it with the same ID and an Open status", async () => {
    const user = userEvent.setup();
    appStore.getState().setPersona("tenant");
    const tenant = renderAt("/tenant/dashboard/rental");
    await user.click(screen.getByRole("button", { name: "Raise request" }));
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByText("Describe the problem in 10–300 characters.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/Category/), "electrical");
    await user.type(screen.getByLabelText(/Describe the problem/), "The hallway light flickers and sometimes goes out");
    await user.selectOptions(screen.getByLabelText(/Priority/), "high");
    await user.click(screen.getByRole("button", { name: "Raise request" }));
    expect(screen.getByText("Request NIV-RM-1004 raised")).toBeInTheDocument();
    expect(screen.getByText(/no technician was booked/i)).toBeInTheDocument();
    expect(appStore.getState().data.maintenanceRequests[0]).toMatchObject({ displayCode: "NIV-RM-1004", status: "open", createdBy: "tenant" });
    tenant.unmount();

    appStore.getState().setPersona("owner");
    renderAt("/owner/maintenance");
    const row = screen.getAllByTestId("maintenance-row").find((r) => r.textContent?.includes("NIV-RM-1004"))!;
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(within(row).getByText(/Priority: High/)).toBeInTheDocument();
  });

  it("My Rental is labelled a preview and shows agreement summary, move-in checklist, rent status, maintenance and a renewal reminder", async () => {
    const user = userEvent.setup();
    appStore.getState().setPersona("tenant");
    renderAt("/tenant/dashboard/rental");
    expect(screen.getByText("Preview · demo data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agreement overview" })).toBeInTheDocument();
    expect(screen.getByText(/does not generate or store legal agreements/)).toBeInTheDocument();
    expect(screen.getAllByText("₹24,000").length).toBeGreaterThan(0);
    const box = screen.getByRole("checkbox", { name: "Collect the keys" });
    await user.click(box);
    expect(box).toBeChecked();
    expect(screen.getByTestId("renewal-banner")).toHaveTextContent("Your tenancy ends in 74 days. Renewal reminders would appear here.");
    expect(screen.getByText(/There is no Pay button/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay|sign|download/i })).not.toBeInTheDocument();
    expect(screen.getAllByTestId("tenant-rent-row").some((r) => r.getAttribute("data-status") === "overdue")).toBe(true);
  });

  it("without a tenancy My Rental shows an empty state instead of fabricated data", () => {
    appStore.getState().setPersona("tenant");
    act(() => appStore.setState((s) => ({ data: { ...s.data, tenancies: [] } })));
    renderAt("/tenant/dashboard/rental");
    expect(screen.getByText("No rental to show")).toBeInTheDocument();
  });
});

describe("Owner overview cards for the P1 modules", () => {
  it("show rent recorded as paid (demo) with the overdue count, and open maintenance, from the shared records", async () => {
    const user = userEvent.setup();
    renderAt("/owner/dashboard");
    expect(screen.getByText("Open maintenance requests").previousElementSibling).toHaveTextContent("2");
    expect(screen.getByText(/Rent recorded as paid \(demo\)/)).toBeInTheDocument();
    await user.click(screen.getByText("Open maintenance requests"));
    expect(screen.getByRole("heading", { level: 1, name: "Maintenance" })).toBeInTheDocument();
  });
});
