import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { Persona } from "../domain/types";
import { appStore, useAppStore } from "../store/store";
import styles from "./RoleSwitcher.module.css";

const LABEL: Record<Persona, string> = { tenant: "Tenant", owner: "Owner" };

/**
 * "Viewing as: Tenant ▾" (blueprint §4.2). Switching never touches shared data; each role keeps
 * its own last route so the presenter returns to where they were.
 */
export function RoleSwitcher({ persona: role }: { persona: Persona }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const lastRoute = useAppStore((s) => s.ui.lastRoute);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const switchTo = (target: Persona) => {
    setOpen(false);
    if (target === role) return;
    appStore.getState().setPersona(target);
    navigate(lastRoute[target] ?? `/${target}`);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.prefix}>Viewing as:</span> <strong>{LABEL[role]}</strong>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <ul className={styles.menu}>
          {(["tenant", "owner"] as const).map((r) => (
            <li key={r}>
              <button type="button" className={styles.item} aria-current={r === role ? "true" : undefined} onClick={() => switchTo(r)}>
                {LABEL[r]} view
              </button>
            </li>
          ))}
          <li className={styles.divider} role="separator" />
          <li>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                navigate("/");
              }}
            >
              Back to Welcome
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
