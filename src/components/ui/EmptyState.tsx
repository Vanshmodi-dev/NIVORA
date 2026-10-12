import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

/** Icon + one-line title + one-sentence explanation + one primary action (§4.4). */
export function EmptyState({ icon, title, description, action, as: Heading = "h2" }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; as?: "h1" | "h2" }) {
  return (
    <div className={styles.empty}>
      {icon && <div className={styles.icon} aria-hidden="true">{icon}</div>}
      <Heading className={styles.title}>{title}</Heading>
      {description && <p className={styles.desc}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
