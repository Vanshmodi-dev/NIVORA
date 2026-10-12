import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import styles from "./Toast.module.css";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastInput {
  id: number;
}

interface ToastApi {
  toast: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_TOASTS = 3;
const SUCCESS_MS = 4000;

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const ICONS = {
  success: <CircleCheck size={18} aria-hidden="true" />,
  error: <CircleAlert size={18} aria-hidden="true" />,
  info: <Info size={18} aria-hidden="true" />,
};

/**
 * Toast host. Success/info auto-dismiss after 4 s; errors persist until dismissed.
 * Max 3 stacked. The live region is always mounted so announcements are reliable.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++;
      setItems((cur) => {
        const next = [...cur, { ...input, id }];
        while (next.length > MAX_TOASTS) {
          const dropped = next.shift();
          if (dropped) {
            const t = timers.current.get(dropped.id);
            if (t) clearTimeout(t);
            timers.current.delete(dropped.id);
          }
        }
        return next;
      });
      if (input.tone !== "error") {
        timers.current.set(id, setTimeout(() => dismiss(id), SUCCESS_MS));
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.host} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.tone]}`} data-testid="toast">
            <span className={styles.icon}>{ICONS[t.tone]}</span>
            <div className={styles.text}>
              <strong>{t.title}</strong>
              {t.description && <span>{t.description}</span>}
            </div>
            {t.action && (
              <button
                type="button"
                className={styles.action}
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className={styles.dismiss} onClick={() => dismiss(t.id)} aria-label="Dismiss notification">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
