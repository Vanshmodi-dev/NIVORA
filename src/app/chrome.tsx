import { NavLink } from "react-router-dom";
import { DISCLAIMER_TEXT } from "../domain/copy";
import { useAppStore } from "../store/store";
import type { NavItem } from "./nav";
import styles from "./chrome.module.css";

/** In-page skip link. Hash routing means `href="#main"` would change the route, so focus directly. */
export function SkipLink() {
  return (
    <a
      href="#main"
      className={styles.skip}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById("main")?.focus();
      }}
    >
      Skip to main content
    </a>
  );
}

/** Persistent banner when browser storage fails — changes are kept in memory only (§9.3). */
export function PersistenceBanner() {
  const persistence = useAppStore((s) => s.meta.persistence);
  if (persistence === "ok") return null;
  return (
    <div className={styles.banner} role="status">
      Changes won&apos;t survive a refresh in this browser. Browser storage is unavailable, so this demo is running in memory only.
    </div>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <p>{DISCLAIMER_TEXT}</p>
      </div>
    </footer>
  );
}

export function NavList({ items, onNavigate, orientation }: { items: readonly NavItem[]; onNavigate?: () => void; orientation: "horizontal" | "vertical" }) {
  if (items.length === 0) return null;
  return (
    <ul className={orientation === "horizontal" ? styles.navH : styles.navV}>
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end
            onClick={onNavigate}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ""}`}
          >
            {item.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
