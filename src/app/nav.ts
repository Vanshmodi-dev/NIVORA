/**
 * Navigation contracts per shell (blueprint §4.1, §4.3, §7.2).
 *
 * `built: false` items are hidden in production builds so no dead links ship (D-19). In
 * development they are shown so the route map can be exercised against stub pages.
 * Flip `built` to true in the phase that delivers the screen.
 */
export interface NavItem {
  label: string;
  to: string;
  screenId: string;
  built: boolean;
}

export const TENANT_NAV: readonly NavItem[] = [
  { label: "Find a Home", to: "/tenant", screenId: "T-01", built: true },
  { label: "Saved", to: "/tenant/dashboard/saved", screenId: "T-07", built: true },
  { label: "My Visits", to: "/tenant/dashboard/requests", screenId: "T-08", built: true },
  { label: "Dashboard", to: "/tenant/dashboard", screenId: "T-06", built: true },
  { label: "Trust Center", to: "/trust", screenId: "S-01", built: true },
];

export const OWNER_NAV: readonly NavItem[] = [
  { label: "Overview", to: "/owner/dashboard", screenId: "O-02", built: true },
  { label: "My Properties", to: "/owner/properties", screenId: "O-03", built: true },
  { label: "Add Property", to: "/owner/properties/new", screenId: "O-04", built: true },
  { label: "Enquiries & Visits", to: "/owner/requests", screenId: "O-07", built: true },
  { label: "Rent Tracking", to: "/owner/rent", screenId: "O-08", built: true },
  { label: "Maintenance", to: "/owner/maintenance", screenId: "O-09", built: true },
  { label: "Verification Center", to: "/owner/verification", screenId: "O-10", built: true },
  { label: "Settings", to: "/owner/settings", screenId: "O-11", built: true },
];

export function visibleNavItems(items: readonly NavItem[], showUnbuilt: boolean): NavItem[] {
  return items.filter((i) => i.built || showUnbuilt);
}

/** Development builds expose unbuilt routes as clearly labelled stubs; production builds do not. */
export const SHOW_UNBUILT: boolean = import.meta.env.DEV;

/** Every route in the blueprint route map (§4.3) that is not yet built, for dev-only stubs. */
export interface StubRoute {
  path: string;
  screenId: string;
  name: string;
  phase: string;
}

/** Stubs nested under the Tenant dashboard (`/tenant/dashboard/…`). */
export const TENANT_STUBS: readonly StubRoute[] = [
];

export const OWNER_STUBS: readonly StubRoute[] = [
];

export const PUBLIC_STUBS: readonly StubRoute[] = [
];
