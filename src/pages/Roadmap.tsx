import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { buttonClassName } from "../components/ui/Button";
import { FUTURE_VERIFICATION_NOTE } from "../domain/trustContent";
import styles from "./Roadmap.module.css";

interface Concept {
  id: string;
  title: string;
  status: string;
  body: string[];
  extra?: string;
}

/**
 * R-01 Future roadmap (P2, blueprint §10). Descriptive text only: every section is a FUTURE concept
 * and nothing here can be bought, booked, quoted or joined. No prices are shown anywhere (D-20).
 */
const CONCEPTS: Concept[] = [
  {
    id: "agreements",
    title: "NIVORA Agreements",
    status: "Future concept",
    body: [
      "A rental-agreement workflow with a document preview, important dates and renewal reminders.",
      "Real use needs legal design for Indian rental agreements, identity checks, e-signature integrations and records handling. None of this exists in the prototype; the only touchpoint is a read-only sample agreement summary in My Rental.",
    ],
  },
  {
    id: "move",
    title: "NIVORA Move",
    status: "Proposed concept",
    body: [
      "A proposed moving and settling-in service: transport of belongings, transport with furniture placement, moving with setup and cleaning, vendor coordination and a move-in checklist.",
      "It is not an operational service in this prototype: there is nothing to book, no quote, no waitlist and no sign-up.",
    ],
    extra: "Pricing: not yet validated",
  },
  {
    id: "protect",
    title: "NIVORA Protect",
    status: "Future concept",
    body: [
      "A possible exploration of insurance partnerships for owners' belongings and tenants' possessions.",
      "Any offering would depend on insurer partnerships, regulatory requirements, eligibility, policy wording, exclusions, distribution permissions and claims processes. NIVORA makes no statement about cover, reimbursement or liability.",
    ],
  },
  {
    id: "expansion",
    title: "Property-management expansion",
    status: "Future concept",
    body: [
      "Fuller tenancy lifecycle management, agreements and renewals, maintenance coordination, owner subscriptions, corporate rentals, student housing, PG and co-living, and other rental segments.",
      "A well-defined core (discovery, trust, visit requests and status tracking) comes first, because every later module reuses the same shared records.",
    ],
  },
];

export function Roadmap() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <p className="overline">THE RENTAL LIVING ECOSYSTEM</p>
        <h1>Future roadmap</h1>
        <p className={styles.lead}>
          Where NIVORA could go next. Everything on this page is a <strong>concept, not a service</strong>: none of it is available, bookable or
          purchasable in this prototype.
        </p>
      </header>

      <div className={styles.grid}>
        {CONCEPTS.map((c) => (
          <section key={c.id} className={styles.card} aria-labelledby={`rm-${c.id}`} data-testid="roadmap-concept">
            <div className={styles.cardHead}>
              <h2 id={`rm-${c.id}`}>{c.title}</h2>
              <Badge tone="neutral">{c.status} — not available</Badge>
            </div>
            {c.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {c.extra && <p className={styles.pricing}>{c.extra}</p>}
          </section>
        ))}
      </div>

      <section className={styles.card} aria-labelledby="rm-verify">
        <div className={styles.cardHead}>
          <h2 id="rm-verify">Real verification</h2>
          <Badge tone="neutral">Future concept — not available</Badge>
        </div>
        <p>{FUTURE_VERIFICATION_NOTE}</p>
      </section>

      <div>
        <Link to="/" className={buttonClassName("secondary")}>
          Back to Welcome
        </Link>
      </div>
    </div>
  );
}
