import type { ReactNode } from "react";
import { Check } from "lucide-react";
import styles from "./Chip.module.css";

/** Toggle chip (36 px). Selected = tint + check icon + `aria-pressed`, never colour alone (§14.5). */
export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`${styles.chip} ${selected ? styles.selected : ""}`} aria-pressed={selected} onClick={onClick} disabled={disabled}>
      {selected && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={styles.group}>
      {children}
    </div>
  );
}
