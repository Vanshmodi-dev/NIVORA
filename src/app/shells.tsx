import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Wordmark } from "../components/ui/BrandMark";
import { Button } from "../components/ui/Button";
import { Drawer } from "../components/ui/Drawer";
import { isOpenRequest } from "../domain/requests";
import { DEMO_TENANT_ID, type Persona } from "../domain/types";
import { appStore, useAppStore } from "../store/store";
import { AboutMenu } from "./AboutDialog";
import { PresenterBannerSlot } from "./presenterSlots";
import { Footer, NavList, PersistenceBanner, SkipLink } from "./chrome";
import { OWNER_NAV, SHOW_UNBUILT, TENANT_NAV, visibleNavItems } from "./nav";
import { RoleSwitcher } from "./RoleSwitcher";
import styles from "./shells.module.css";

/** Remember each role's last route so role switching returns to where the presenter was (§4.2). */
function useTrackLastRoute(role: Persona) {
  const { pathname, search } = useLocation();
  useEffect(() => {
    appStore.getState().setLastRoute(role, pathname + search);
  }, [role, pathname, search]);
}

/** Public shell (Welcome, Not Found): slim header, no role switcher (§4.1). */
export function PublicShell({ children, dark = false }: { children?: React.ReactNode; dark?: boolean } = {}) {
  return (
    <div className={`${styles.shell} ${dark ? styles.shellDark : ""}`}>
      <SkipLink />
      <PresenterBannerSlot />
      <header className={styles.header}>
        <div className={`container ${styles.bar}`}>
          <Link to="/" className={styles.brand} aria-label="NIVORA — Welcome">
            <Wordmark />
          </Link>
          <div className={styles.actions}>
            <Link to="/roadmap" className={styles.headLink}>
              Future roadmap
            </Link>
            <AboutMenu />
          </div>
        </div>
      </header>
      <PersistenceBanner />
      <main id="main" tabIndex={-1} className={styles.main}>
        {children ?? <Outlet />}
      </main>
      <Footer />
    </div>
  );
}

/** Tenant shell: top navigation bar, no sidebar (§4.1). */
export function TenantShell({ showUnbuilt = SHOW_UNBUILT }: { showUnbuilt?: boolean }) {
  useTrackLastRoute("tenant");
  const savedCount = useAppStore((s) => s.data.savedProperties.filter((x) => x.tenantId === DEMO_TENANT_ID).length);
  const requestCount = useAppStore((s) => s.data.visitRequests.filter((r) => r.tenantId === DEMO_TENANT_ID && isOpenRequest(r.status)).length);
  const counts: Record<string, number> = { Saved: savedCount, "My Visits": requestCount };
  const items = visibleNavItems(TENANT_NAV, showUnbuilt).map((i) => ((counts[i.label] ?? 0) > 0 ? { ...i, label: `${i.label} (${counts[i.label]})` } : i));
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className={styles.shell}>
      <SkipLink />
      <PresenterBannerSlot />
      <header className={styles.header}>
        <div className={`container ${styles.bar}`}>
          <Link to="/tenant" className={styles.brand} aria-label="NIVORA — Tenant home">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className={styles.topNav}>
            <NavList items={items} orientation="horizontal" />
          </nav>
          <div className={styles.actions}>
            <RoleSwitcher persona="tenant" />
            <AboutMenu />
            {items.length > 0 && (
              <Button variant="secondary" size="sm" className={styles.menuButton} aria-label="Open navigation menu" onClick={() => setMenuOpen(true)}>
                <Menu size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </header>
      <PersistenceBanner />
      <main id="main" tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="left">
        <nav aria-label="Primary mobile">
          <NavList items={items} orientation="vertical" onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Drawer>
    </div>
  );
}

/**
 * Owner shell: left sidebar ≥1024px (hidden when there are no built items), slim top bar,
 * slide-over navigation below that width (§4.1). The mobile bottom tab bar arrives with the
 * first built Owner screens (Phase 4); with no built items there is nothing to put in it.
 */
export function OwnerShell({ showUnbuilt = SHOW_UNBUILT }: { showUnbuilt?: boolean }) {
  useTrackLastRoute("owner");
  const items = visibleNavItems(OWNER_NAV, showUnbuilt);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  // The wizard has its own Back/Next bar, so the bottom tab bar is hidden there (§4.1).
  const wizard = /^\/owner\/properties\/(new|[^/]+\/edit)$/.test(pathname);
  const primary = items.filter((i) => ["Overview", "My Properties", "Enquiries & Visits"].includes(i.label));
  const showBar = items.length > 0 && !wizard;
  return (
    <div className={styles.shell}>
      <SkipLink />
      <PresenterBannerSlot />
      <header className={styles.header}>
        <div className={`${styles.bar} ${styles.ownerBar}`}>
          <Link to="/owner" className={styles.brand} aria-label="NIVORA — Owner home">
            <Wordmark />
          </Link>
          <div className={styles.actions}>
            <RoleSwitcher persona="owner" />
            <AboutMenu />
            {items.length > 0 && (
              <Button variant="secondary" size="sm" className={styles.menuButton} aria-label="Open navigation menu" onClick={() => setMenuOpen(true)}>
                <Menu size={18} aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </header>
      <PersistenceBanner />
      <div className={styles.ownerBody}>
        {items.length > 0 && (
          <aside className={styles.sidebar}>
            <nav aria-label="Owner navigation">
              <NavList items={items} orientation="vertical" />
            </nav>
          </aside>
        )}
        <main id="main" tabIndex={-1} className={`${styles.main} ${styles.ownerMain} ${showBar ? styles.withBar : ""}`}>
          <Outlet />
        </main>
      </div>
      <Footer />
      {showBar && (
        <nav aria-label="Owner quick navigation" className={styles.bottomBar}>
          {primary.map((i) => (
            <NavLink key={i.to} to={i.to} end className={({ isActive }) => `${styles.bottomItem} ${isActive ? styles.bottomOn : ""}`}>
              {i.label === "Enquiries & Visits" ? "Requests" : i.label === "My Properties" ? "Properties" : i.label}
            </NavLink>
          ))}
          <button type="button" className={styles.bottomItem} onClick={() => setMenuOpen(true)} aria-haspopup="dialog">
            More
          </button>
        </nav>
      )}
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" side="left">
        <nav aria-label="Owner navigation mobile">
          <NavList items={items} orientation="vertical" onNavigate={() => setMenuOpen(false)} />
        </nav>
      </Drawer>
    </div>
  );
}

/**
 * The Trust Center is a shared screen (`/trust`). It renders inside the shell of the role the
 * visitor chose, or the public shell when no role has been chosen yet.
 */
export function PersonaShell({ showUnbuilt = SHOW_UNBUILT }: { showUnbuilt?: boolean }) {
  const persona = useAppStore((s) => s.ui.persona);
  if (persona === "tenant") return <TenantShell showUnbuilt={showUnbuilt} />;
  if (persona === "owner") return <OwnerShell showUnbuilt={showUnbuilt} />;
  return <PublicShell />;
}
