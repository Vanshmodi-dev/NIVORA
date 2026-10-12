import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import styles from "./Breadcrumbs.module.css";

export interface Crumb {
  label: string;
  to?: string;
}

/** Last crumb is plain text (the current page). */
export function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.nav}>
      <ol className={styles.list}>
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={styles.item}>
              {last || !c.to ? <span aria-current={last ? "page" : undefined}>{c.label}</span> : <Link to={c.to}>{c.label}</Link>}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
