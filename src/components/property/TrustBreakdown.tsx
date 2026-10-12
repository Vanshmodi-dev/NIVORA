import { Badge } from "../ui/Badge";
import { formatDate } from "../../domain/format";
import { VERIFICATION_CATEGORY_LABEL, VERIFICATION_STATUS_LABEL, VERIFICATION_STATUS_TONE } from "../../domain/labels";
import { TRUST_CATEGORY_INFO, TRUST_STATUS_INFO, trustRowExplanation } from "../../domain/trustContent";
import { verificationSummary, type EffectiveVerification } from "../../domain/verification";
import styles from "./TrustBreakdown.module.css";

function dateLine(e: EffectiveVerification): string | null {
  const { item } = e;
  if (!item.checkedAt) return null;
  if (e.category === "availability") {
    return `${item.source === "owner_declared" ? "Owner-confirmed" : "Last confirmed"} on ${formatDate(item.checkedAt)}`;
  }
  return `Status recorded ${formatDate(item.checkedAt)}`;
}

/**
 * Four separate checkable categories, always all four, always in this order (§6.5.1, §8).
 * Shows what has been checked AND what has not; never one combined tick, never a guarantee.
 */
export function TrustBreakdown({ effective, onOpenTrustCenter }: { effective: readonly EffectiveVerification[]; onOpenTrustCenter?: () => void }) {
  return (
    <section aria-labelledby="trust-heading" className={styles.section}>
      <div className={styles.head}>
        <h2 id="trust-heading" className={styles.heading}>
          Verification details (demo data)
        </h2>
        <p className={styles.summary}>{verificationSummary(effective)}</p>
      </div>
      <ul className={styles.rows}>
        {effective.map((e) => {
          const date = dateLine(e);
          const status = TRUST_STATUS_INFO[e.status];
          return (
            <li key={e.category} className={styles.row} data-category={e.category} data-status={e.status}>
              <div className={styles.rowHead}>
                <h3 className={styles.cat}>{VERIFICATION_CATEGORY_LABEL[e.category]}</h3>
                <Badge tone={VERIFICATION_STATUS_TONE[e.status]}>{VERIFICATION_STATUS_LABEL[e.status]}</Badge>
              </div>
              <p className={styles.expl}>{trustRowExplanation(e.category, e.status)}</p>
              {date && <p className={styles.date}>{date}</p>}
              {e.item.source === "simulated_review" && <p className={styles.sim}>Simulated by presenter (demo)</p>}
              <details className={styles.more}>
                <summary>What this means</summary>
                <ul>
                  <li><strong>This check covers:</strong> {TRUST_CATEGORY_INFO[e.category].covers}</li>
                  <li><strong>It does not cover:</strong> {TRUST_CATEGORY_INFO[e.category].doesNotCover}</li>
                  <li><strong>This status means:</strong> {status.means}</li>
                  <li><strong>It does not mean:</strong> {status.doesNotMean}</li>
                </ul>
              </details>
            </li>
          );
        })}
      </ul>
      <p className={styles.note}>
        Each check is separate: a status on one check says nothing about the others, and none of them is a guarantee about the home or the owner.
      </p>
      {onOpenTrustCenter && (
        <button type="button" className={styles.link} onClick={onOpenTrustCenter}>
          How trust works on NIVORA
        </button>
      )}
    </section>
  );
}
