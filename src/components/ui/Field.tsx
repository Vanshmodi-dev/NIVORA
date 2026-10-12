import { useId, type ReactNode } from "react";
import styles from "./Field.module.css";

export interface FieldProps {
  label: string;
  /** Use a fixed id for the control (needed when something else must find it, e.g. focus on error). */
  id?: string;
  required?: boolean;
  help?: string;
  error?: string;
  /** Renders the control; receives ids/aria props to spread onto the input. */
  children: (a: { id: string; "aria-invalid"?: true; "aria-describedby"?: string; "aria-required"?: true }) => ReactNode;
}

/** Label above, helper below, inline error below that with `role="alert"` (§14.5). */
export function Field({ label, id: fixedId, required, help, error, children }: FieldProps) {
  const uid = useId();
  const id = fixedId ?? `${uid}-f`;
  const describedBy = [error ? `${uid}-e` : null, help ? `${uid}-h` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({ id, ...(error ? { "aria-invalid": true as const } : {}), ...(describedBy ? { "aria-describedby": describedBy } : {}), ...(required ? { "aria-required": true as const } : {}) })}
      {help && !error && (
        <p id={`${uid}-h`} className={styles.help}>
          {help}
        </p>
      )}
      {error && (
        <p id={`${uid}-e`} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
