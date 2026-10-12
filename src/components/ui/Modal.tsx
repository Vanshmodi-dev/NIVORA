import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./Modal.module.css";

/** Only the top-most open modal handles Escape / Tab (supports a confirm dialog over About). */
const stack: symbol[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "dialog" = centred (bottom sheet on mobile); "drawer" = side panel. */
  variant?: "dialog" | "drawer";
  side?: "left" | "right";
  /** Set false while a submit is in flight. */
  dismissible?: boolean;
  /** Visually hide the title but keep it as the accessible name. */
  hideTitle?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  variant = "dialog",
  side = "right",
  dismissible = true,
  hideTitle = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    const id = Symbol("modal");
    stack.push(id);
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Move focus to the dialog title (programmatic focus target).
    panel?.querySelector<HTMLElement>("[data-modal-title]")?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return;
      if (e.key === "Escape" && dismissibleRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panel.contains(active) || active?.hasAttribute("data-modal-title"))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !panel.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const idx = stack.indexOf(id);
      if (idx >= 0) stack.splice(idx, 1);
      document.body.style.overflow = stack.length === 0 ? prevOverflow : "hidden";
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const panelClass = [
    styles.panel,
    variant === "drawer" ? styles.drawer : styles.dialog,
    variant === "drawer" ? (side === "left" ? styles.left : styles.right) : "",
  ].join(" ");

  return createPortal(
    <div className={styles.overlay}>
      {/* Backdrop click is a convenience; Escape and the close button are the keyboard paths. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className={styles.backdrop} onClick={() => dismissible && onClose()} />
      <div ref={panelRef} className={panelClass} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.header}>
          <h2 id={titleId} data-modal-title tabIndex={-1} className={hideTitle ? "visually-hidden" : styles.title}>
            {title}
          </h2>
          {dismissible && (
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
