import { useId } from "react";
import { MAX_RENT, parseRentInput } from "../../domain/search";
import styles from "./RentFields.module.css";

export interface RentFieldsProps {
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
  error?: string | null;
}

/** Min / max monthly rent. Digits only; values clamp to ₹0–₹3,00,000 (§6.1). */
export function RentFields({ min, max, onChange, error }: RentFieldsProps) {
  const uid = useId();
  const errId = `${uid}-err`;
  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-min`}>Minimum rent (₹)</label>
          <input
            id={`${uid}-min`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="No minimum"
            value={min === null ? "" : String(min)}
            onChange={(e) => onChange(parseRentInput(e.target.value), max)}
            aria-describedby={error ? errId : undefined}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${uid}-max`}>Maximum rent (₹)</label>
          <input
            id={`${uid}-max`}
            inputMode="numeric"
            autoComplete="off"
            placeholder="No maximum"
            value={max === null ? "" : String(max)}
            onChange={(e) => onChange(min, parseRentInput(e.target.value))}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
          />
        </div>
      </div>
      <p className={styles.hint}>Up to ₹{MAX_RENT.toLocaleString("en-IN")} per month.</p>
      {error && (
        <p id={errId} role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
