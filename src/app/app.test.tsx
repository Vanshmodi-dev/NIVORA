import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ToastProvider } from "../components/ui/Toast";
import { DISCLAIMER_TEXT } from "../domain/copy";
import type { Property } from "../domain/types";
import { appStore } from "../store/store";
import { OWNER_NAV, TENANT_NAV, visibleNavItems } from "./nav";
import { AppRoutes } from "./routes";

function renderApp(initial = "/", showUnbuilt = true) {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[initial]}>
        <AppRoutes showUnbuilt={showUnbuilt} />
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  appStore.getState().resetDemo();
  appStore.setState((s) => ({ meta: { ...s.meta, persistence: "ok", persistenceError: null } }));
});

describe("S-00 Welcome (AC-01)", () => {
  it("shows the exact brand content", () => {
    renderApp();
    expect(screen.getByText("NIVORA", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("THE RENTAL LIVING ECOSYSTEM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
    expect(screen.getByText("Discover a rental. Build trust. Feel at home.")).toBeInTheDocument();
    expect(screen.getByText("FIND. TRUST. LIVE.")).toBeInTheDocument();
    expect(screen.getByText("Prototype preview · Choose your journey")).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
  });

  it("presents the two journey cards with the specified copy", () => {
    renderApp();
    const tenant = screen.getByRole("link", { name: /I'm a Tenant/ });
    expect(tenant).toHaveTextContent("Find a place to call home.");
    expect(tenant).toHaveTextContent("Find a Home");
    expect(tenant).toHaveAttribute("href", "/tenant");
    const owner = screen.getByRole("link", { name: /I'm a Property Owner/ });
    expect(owner).toHaveTextContent("List and manage your rental.");
    expect(owner).toHaveTextContent("Manage Properties");
    expect(owner).toHaveAttribute("href", "/owner");
  });

  it("includes the compact Discover · Trust · Manage section", () => {
    renderApp();
    for (const name of ["Discover", "Trust", "Manage"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
  });

  it("asks for no personal information and loads no images or external resources", () => {
    const { container } = renderApp();
    expect(container.querySelector("input, textarea, select, form")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    container.querySelectorAll("a[href]").forEach((a) => expect(a.getAttribute("href")).not.toMatch(/^https?:/));
    expect(screen.queryByText(/phone|password|sign in|log in/i)).not.toBeInTheDocument();
  });

  it("links to the Future roadmap from the header, and every link on Welcome leads somewhere real", () => {
    renderApp();
    expect(screen.getByRole("link", { name: "Future roadmap" })).toHaveAttribute("href", "/roadmap");
    for (const a of screen.getAllByRole("link")) expect(["/", "/roadmap", "/tenant", "/tenant/discover", "/owner", "#main"]).toContain(a.getAttribute("href"));
  });
});

describe("Role cards (AC-02)", () => {
  it("opens the Tenant journey on click and records the persona", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("link", { name: /I'm a Tenant/ }));
    expect(screen.getByRole("heading", { level: 1, name: "Find a home that fits your life." })).toBeInTheDocument();
    expect(appStore.getState().ui.persona).toBe("tenant");
  });

  it("opens the Owner journey on click and records the persona", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("link", { name: /I'm a Property Owner/ }));
    expect(screen.getByRole("heading", { name: /entering the Owner view as the NIVORA demo owner/i })).toBeInTheDocument();
    expect(appStore.getState().ui.persona).toBe("owner");
  });

  it("is operable by keyboard: focus then Enter", async () => {
    const user = userEvent.setup();
    renderApp();
    const card = screen.getByRole("link", { name: /I'm a Tenant/ });
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1, name: "Find a home that fits your life." })).toBeInTheDocument();
  });

  it("keeps each card as a single control (no nested interactive elements)", () => {
    renderApp();
    for (const name of [/I'm a Tenant/, /I'm a Property Owner/]) {
      expect(screen.getByRole("link", { name }).querySelector("a, button, input")).toBeNull();
    }
  });
});

describe("Shells and role switcher", () => {
  it("shows Viewing as: Tenant and switches to Owner and back, keeping each role's last route", async () => {
    const user = userEvent.setup();
    renderApp("/tenant/dashboard/profile");
    expect(screen.getByText(/Viewing as:/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    await user.click(screen.getByRole("button", { name: "Owner view" }));
    expect(appStore.getState().ui.persona).toBe("owner");
    expect(screen.getByRole("heading", { name: /entering the Owner view/i })).toBeInTheDocument();
    expect(appStore.getState().ui.lastRoute.tenant).toBe("/tenant/dashboard/profile");

    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    await user.click(screen.getByRole("button", { name: "Tenant view" }));
    expect(screen.getByRole("heading", { name: "Your details" })).toBeInTheDocument();
  });

  it("switching roles leaves shared data untouched", async () => {
    const user = userEvent.setup();
    renderApp("/tenant");
    const before = appStore.getState().data;
    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    await user.click(screen.getByRole("button", { name: "Owner view" }));
    expect(appStore.getState().data).toBe(before);
  });

  it("offers Back to Welcome from the role menu", async () => {
    const user = userEvent.setup();
    renderApp("/owner");
    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    await user.click(screen.getByRole("button", { name: "Back to Welcome" }));
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
  });

  it("closes the role menu on Escape", async () => {
    const user = userEvent.setup();
    renderApp("/tenant");
    await user.click(screen.getByRole("button", { name: /Viewing as/ }));
    expect(screen.getByRole("button", { name: "Owner view" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Owner view" })).not.toBeInTheDocument();
  });

  it("renders the prototype disclaimer footer in every shell", () => {
    for (const path of ["/", "/tenant", "/owner"]) {
      const { unmount } = renderApp(path);
      expect(screen.getByText(DISCLAIMER_TEXT)).toBeInTheDocument();
      unmount();
    }
  });

  it("provides a skip link and a focusable main landmark", async () => {
    const user = userEvent.setup();
    renderApp("/tenant");
    await user.click(screen.getByRole("link", { name: "Skip to main content" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });
});

describe("No dead links in production builds (D-19)", () => {
  const ALL_OWNER = ["Overview", "My Properties", "Add Property", "Enquiries & Visits", "Rent Tracking", "Maintenance", "Verification Center", "Settings"];

  it("every item in the navigation contracts is built, so production builds list them all", () => {
    expect(visibleNavItems(TENANT_NAV, false).map((i) => i.label)).toEqual(["Find a Home", "Saved", "My Visits", "Dashboard", "Trust Center"]);
    expect(visibleNavItems(OWNER_NAV, false).map((i) => i.label)).toEqual(ALL_OWNER);
    expect(TENANT_NAV.every((i) => i.built) && OWNER_NAV.every((i) => i.built)).toBe(true);
  });

  it("still hides an unbuilt item in production while showing it in development (the D-19 mechanism)", () => {
    const items = [{ label: "Built", to: "/a", screenId: "X-1", built: true }, { label: "Unbuilt", to: "/b", screenId: "X-2", built: false }];
    expect(visibleNavItems(items, false).map((i) => i.label)).toEqual(["Built"]);
    expect(visibleNavItems(items, true).map((i) => i.label)).toEqual(["Built", "Unbuilt"]);
  });

  it("lists all eight Owner destinations in the sidebar, each reaching a real screen", () => {
    renderApp("/owner", false);
    const nav = within(screen.getByRole("navigation", { name: "Owner navigation" }));
    expect(nav.getAllByRole("link").map((a) => a.textContent)).toEqual(ALL_OWNER);
  });

  it("serves unknown routes as Not Found in production-style routing", () => {
    renderApp("/tenant/dashboard/nonexistent", false);
    expect(screen.getByRole("heading", { name: "We can’t find that page" })).toBeInTheDocument();
    renderApp("/owner/nonexistent", false);
    expect(screen.getAllByRole("heading", { name: "We can’t find that page" }).length).toBeGreaterThan(0);
  });

  it("opens the Owner slide-over drawer with every destination and navigates from it", async () => {
    const user = userEvent.setup();
    renderApp("/owner", true);
    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const dialog = screen.getByRole("dialog", { name: "Menu" });
    expect(within(dialog).getAllByRole("link")).toHaveLength(8);
    await user.click(within(dialog).getByRole("link", { name: "Maintenance" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Maintenance" })).toBeInTheDocument();
  });
});

describe("S-02 Not Found", () => {
  it("offers a role-appropriate way back", () => {
    renderApp("/nope");
    expect(screen.getByRole("link", { name: "Back to Welcome" })).toHaveAttribute("href", "/");
    renderApp("/tenant/zzz", false);
    expect(screen.getByRole("link", { name: "Back to Find a Home" })).toHaveAttribute("href", "/tenant");
  });
});

describe("S-03 About this prototype (AC-24)", () => {
  async function openAbout(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /About this prototype/ }));
    return screen.getByRole("dialog", { name: "About this prototype" });
  }

  it("is reachable from every shell and states what is real, simulated and not implemented", async () => {
    for (const path of ["/", "/tenant", "/owner"]) {
      const user = userEvent.setup();
      const { unmount } = renderApp(path);
      const dialog = await openAbout(user);
      expect(within(dialog).getByText(/fictional demonstration data/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/verification statuses are demo data/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/Not implemented:/)).toBeInTheDocument();
      expect(within(dialog).getByText(/no sync across devices or users/i)).toBeInTheDocument();
      expect(within(dialog).getByText(/no affiliation with or endorsement/i)).toBeInTheDocument();
      unmount();
    }
  });

  it("says plainly that location reference data is unverified", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const dialog = await openAbout(user);
    expect(within(dialog).getByTestId("location-verification-status")).toHaveTextContent(/full set of verified places is not ready/i);
  });

  it("shows live counts of sample versus user-added records", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const dialog = await openAbout(user);
    expect(within(dialog).getByText("Properties").parentElement).toHaveTextContent("16 sample · 0 added by you");
    expect(within(dialog).getByText("Visit requests").parentElement).toHaveTextContent("6 sample · 0 added by you");
  });

  it("offers Presenter Mode only as a low-emphasis link (demo/test builds), never simulation controls; no image-credits link yet", async () => {
    const user = userEvent.setup();
    renderApp("/");
    const dialog = await openAbout(user);
    expect(within(dialog).getByRole("button", { name: "Presenter tools…" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Apply|Undo all|Restore seeded|Simulate/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/image credits/i)).not.toBeInTheDocument();
  });

  const addUserProperty = () => {
    const base = appStore.getState().data.properties[0]!;
    const added: Property = { ...base, id: "prop_u_001", title: "User listing", source: "user" };
    appStore.setState((s) => ({ data: { ...s.data, properties: [...s.data.properties, added] } }));
  };

  it("Reset demo data asks for confirmation; cancelling changes nothing", async () => {
    const user = userEvent.setup();
    renderApp("/");
    act(() => {
      addUserProperty();
      appStore.getState().setPersona("tenant");
    });
    const dialog = await openAbout(user);
    await user.click(within(dialog).getByRole("button", { name: "Reset demo data" }));
    const confirm = screen.getByRole("dialog", { name: "Reset demo data?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Reset demo data?" })).not.toBeInTheDocument();
    expect(appStore.getState().data.properties).toHaveLength(17);
    expect(appStore.getState().ui.persona).toBe("tenant");
    expect(screen.queryByText("Demo data reset.")).not.toBeInTheDocument();
  });

  it("confirming Reset restores the starting state, returns to Welcome and then reports success", async () => {
    const user = userEvent.setup();
    renderApp("/tenant");
    act(() => {
      addUserProperty();
      appStore.getState().setPersona("tenant");
    });
    const dialog = await openAbout(user);
    await user.click(within(dialog).getByRole("button", { name: "Reset demo data" }));
    const confirm = screen.getByRole("dialog", { name: "Reset demo data?" });
    await user.click(within(confirm).getByRole("button", { name: "Reset demo data" }));

    expect(appStore.getState().data.properties).toHaveLength(16);
    expect(appStore.getState().data.properties.every((p) => p.source === "fixture")).toBe(true);
    expect(appStore.getState().ui.persona).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Your next chapter starts at home." })).toBeInTheDocument();
    expect(screen.getByText("Demo data reset.")).toBeInTheDocument();
  });

  it("the /?reset=1 shortcut always asks first and does nothing until confirmed", async () => {
    const user = userEvent.setup();
    act(() => addUserProperty());
    renderApp("/?reset=1");
    const confirm = screen.getByRole("dialog", { name: "Reset demo data?" });
    expect(appStore.getState().data.properties).toHaveLength(17);
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(appStore.getState().data.properties).toHaveLength(17);
  });
});

describe("Persistence banner (never silent)", () => {
  it("appears in every shell when storage becomes unavailable, and is absent otherwise", () => {
    for (const path of ["/", "/tenant", "/owner"]) {
      const { unmount } = renderApp(path);
      expect(screen.queryByText(/Changes won't survive a refresh/)).not.toBeInTheDocument();
      act(() => {
        appStore.setState((s) => ({ meta: { ...s.meta, persistence: "memory-only", persistenceError: "blocked" } }));
      });
      expect(screen.getByText(/Changes won't survive a refresh/)).toBeInTheDocument();
      unmount();
      appStore.setState((s) => ({ meta: { ...s.meta, persistence: "ok", persistenceError: null } }));
    }
  });
});
