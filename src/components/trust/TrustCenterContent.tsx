import { Badge } from "../ui/Badge";
import { TrustBreakdown } from "../property/TrustBreakdown";
import { AVAILABILITY_FRESH_DAYS, VERIFICATION_CATEGORIES, getEffectiveVerification } from "../../domain/verification";
import { VERIFICATION_CATEGORY_LABEL, VERIFICATION_STATUS_LABEL, VERIFICATION_STATUS_TONE } from "../../domain/labels";
import { FUTURE_VERIFICATION_NOTE, NOT_CLAIMED, TRUST_CATEGORY_INFO, TRUST_STATUS_INFO } from "../../domain/trustContent";
import type { DataState, VerificationStatus } from "../../domain/types";
import styles from "./TrustCenterContent.module.css";

const STATUSES: VerificationStatus[] = ["verified_demo", "pending_review", "not_checked", "needs_reverification"];

/** Examples are read from the shared fixtures: broad coverage (FX-01) vs mostly unchecked (FX-04). */
const EXAMPLES = [
  { id: "prop_fx_01", heading: "Example A — broad coverage" },
  { id: "prop_fx_04", heading: "Example B — mostly unchecked" },
] as const;

/**
 * Trust Center (S-01): what each check means, what each status means and does not mean, how
 * freshness works, and what NIVORA does not claim. Used as a page and as a drawer from property details.
 */
export function TrustCenterContent({ data, now, compact = false }: { data: Pick<DataState, "properties" | "verificationItems">; now: Date; compact?: boolean }) {
  const examples = EXAMPLES.map((ex) => {
    const property = data.properties.find((p) => p.id === ex.id);
    return property ? { ...ex, property, effective: getEffectiveVerification(property, data.verificationItems, now) } : null;
  }).filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <div className={styles.content}>
      <p className={styles.demo}>All verification information in this prototype is fictional demo data.</p>

      <section aria-labelledby="tc-checks" className={styles.block}>
        <h2 id="tc-checks">The four checks</h2>
        <p>Trust is shown as four separate checks. Each one answers a different question, and none stands in for the others.</p>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard users must be able to scroll this table */}
        <div className={styles.tableWrap} role="region" aria-label="The four checks (scrollable table)" tabIndex={0}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Check</th>
                <th scope="col">What it covers</th>
                <th scope="col">What it does not cover</th>
              </tr>
            </thead>
            <tbody>
              {VERIFICATION_CATEGORIES.map((c) => (
                <tr key={c}>
                  <th scope="row">{VERIFICATION_CATEGORY_LABEL[c]}</th>
                  <td>{TRUST_CATEGORY_INFO[c].covers}</td>
                  <td>{TRUST_CATEGORY_INFO[c].doesNotCover}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="tc-status" className={styles.block}>
        <h2 id="tc-status">What each status means</h2>
        <ul className={styles.statusList}>
          {STATUSES.map((s) => (
            <li key={s}>
              <Badge tone={VERIFICATION_STATUS_TONE[s]}>{VERIFICATION_STATUS_LABEL[s]}</Badge>
              <p><strong>Means:</strong> {TRUST_STATUS_INFO[s].means}</p>
              <p><strong>Does not mean:</strong> {TRUST_STATUS_INFO[s].doesNotMean}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tc-fresh" className={styles.block}>
        <h2 id="tc-fresh">How availability stays fresh</h2>
        <p>
          An owner&apos;s availability confirmation is only treated as current for {AVAILABILITY_FRESH_DAYS} days. After that the
          check shows <strong>Needs re-verification</strong> until the owner confirms again. A home with an out-of-date check stays
          visible: the status is information, not a block.
        </p>
        <p className={styles.example}>
          Example: confirmed on day 0 → current through day {AVAILABILITY_FRESH_DAYS} → on day {AVAILABILITY_FRESH_DAYS + 1} it
          needs re-verification.
        </p>
      </section>

      {!compact && examples.length > 0 && (
        <section aria-labelledby="tc-examples" className={styles.block}>
          <h2 id="tc-examples">Two homes, two different trust profiles</h2>
          <p>A single tick would hide these differences, which is why NIVORA shows each check separately.</p>
          <div className={styles.examples}>
            {examples.map((ex) => (
              <div key={ex.id} className={styles.exampleCard}>
                <h3>{ex.heading}</h3>
                <p className={styles.exampleTitle}>{ex.property.title} (demo listing)</p>
                <ul className={styles.mini}>
                  {ex.effective.map((e) => (
                    <li key={e.category}>
                      <span>{VERIFICATION_CATEGORY_LABEL[e.category]}</span>
                      <Badge tone={VERIFICATION_STATUS_TONE[e.status]}>{VERIFICATION_STATUS_LABEL[e.status]}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {/* Full row-by-row breakdown of the stronger example, as shown on a property page */}
          {examples[0] && <TrustBreakdown effective={examples[0].effective} />}
        </section>
      )}

      <section aria-labelledby="tc-not" className={styles.block}>
        <h2 id="tc-not">What NIVORA does not claim</h2>
        <ul className={styles.plain}>
          {NOT_CLAIMED.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="tc-future" className={styles.block}>
        <h2 id="tc-future">In a real product</h2>
        <p className={styles.future}>
          <Badge tone="neutral">Future concept — not available</Badge>
        </p>
        <p>{FUTURE_VERIFICATION_NOTE}</p>
      </section>
    </div>
  );
}
