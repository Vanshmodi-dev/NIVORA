import { NavLink, Outlet } from "react-router-dom";
import styles from "./dashboard.module.css";

/**
 * Tenant dashboard frame (T-06 … T-09): header plus in-page tabs — no second sidebar, so
 * navigation is never duplicated (§4.1). "My Rental" is a P1 preview, labelled as such.
 */
export function DashboardLayout() {
  const tabs = [
    { to: "/tenant/dashboard", label: "Overview", end: true },
    { to: "/tenant/dashboard/saved", label: "Saved", end: false },
    { to: "/tenant/dashboard/requests", label: "Visit requests", end: false },
    { to: "/tenant/dashboard/rental", label: "My Rental (preview)", end: false },
    { to: "/tenant/dashboard/profile", label: "Profile", end: false },
  ];
  return (
    <div className={`container ${styles.page}`}>
      <h1>Your dashboard</h1>
      <nav aria-label="Dashboard sections" className={styles.tabs}>
        <ul>
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink to={t.to} end={t.end} className={({ isActive }) => `${styles.tab} ${isActive ? styles.tabOn : ""}`}>
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  );
}
