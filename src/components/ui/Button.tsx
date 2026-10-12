import { forwardRef, type ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive" | "navy";
export type ButtonSize = "md" | "sm";

/** Class names so router links can be styled as buttons without nesting interactive elements. */
export function buttonClassName(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string): string {
  return [styles.btn, styles[variant], size === "sm" ? styles.sm : "", extra ?? ""].filter(Boolean).join(" ");
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Only for genuinely asynchronous work (no fake spinners — blueprint §3.3). */
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, disabled, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </button>
  );
});
