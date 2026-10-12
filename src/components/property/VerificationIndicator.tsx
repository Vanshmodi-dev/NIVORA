import { VERIFICATION_CATEGORY_LABEL, VERIFICATION_STATUS_LABEL } from "../../domain/labels";
import { verificationSummary, type EffectiveVerification } from "../../domain/verification";
import styles from "./VerificationIndicator.module.css";

/**
 * Four separate segments — one per check — plus the text summary ("3 of 4 checks verified (demo)").
 * Segments differ by fill pattern, not just colour, and there is never a single combined tick.
 */
export function VerificationIndicator({ effective }: { effective: readonly EffectiveVerification[] }) {
  return (
    <div className={styles.wrap}>
      <ul className={styles.segments} aria-label="Verification checks (demo data)">
        {effective.map((e) => (
          <li key={e.category} className={`${styles.seg} ${styles[e.status]}`} data-status={e.status}>
            <span className="visually-hidden">
              {VERIFICATION_CATEGORY_LABEL[e.category]}: {VERIFICATION_STATUS_LABEL[e.status]}
            </span>
          </li>
        ))}
      </ul>
      <span className={styles.text}>{verificationSummary(effective)}</span>
    </div>
  );
}
