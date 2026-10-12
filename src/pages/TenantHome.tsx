import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { PropertyCard } from "../components/property/PropertyCard";
import { SearchPanel } from "../components/search/SearchPanel";
import { buttonClassName } from "../components/ui/Button";
import { selectSavedProperties, selectTenantRequests } from "../domain/mutations";
import { isOpenRequest } from "../domain/requests";
import { selectFeatured } from "../domain/search";
import { DEMO_TENANT_ID } from "../domain/types";
import { getEffectiveVerification } from "../domain/verification";
import { useAppStore } from "../store/store";
import styles from "./TenantHome.module.css";
import { useNow } from "../store/useNow";

/** T-01 Tenant Home — "Find a home that fits your life." */
export function TenantHome() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const featured = useMemo(() => selectFeatured(data, now), [data, now]);
  const savedCount = selectSavedProperties(data, DEMO_TENANT_ID).length;
  const openCount = selectTenantRequests(data, DEMO_TENANT_ID).filter((r) => isOpenRequest(r.status)).length;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className="container">
          <p className="overline">Jaipur · demo listings</p>
          <h1 className={styles.title}>Find a home that fits your life.</h1>
          <p className={styles.sub}>Search demonstration homes by locality, rent, type and more. Every listing here is fictional.</p>
          <p className={styles.guided}>
            <Link to="/tenant/discover" className={buttonClassName("primary")}>Start guided search</Link>
            <span className={styles.guidedNote}>Answer a few quick questions, or use the full search below.</span>
          </p>
          <SearchPanel />
          <p className={styles.quick}>
            <Link to="/tenant/dashboard/saved">Saved homes{savedCount > 0 ? ` (${savedCount})` : ""}</Link>
            <Link to="/tenant/dashboard/requests">My visit requests{openCount > 0 ? ` (${openCount})` : ""}</Link>
          </p>
        </div>
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="featured-title">
        <div className={styles.sectionHead}>
          <h2 id="featured-title">Featured demo homes</h2>
          <Link to="/tenant/search" className={buttonClassName("secondary", "sm")}>
            Browse all homes
          </Link>
        </div>
        {featured.length === 0 ? (
          <p className={styles.muted}>No homes are available to show right now.</p>
        ) : (
          <div className={styles.grid}>
            {featured.map((p) => (
              <PropertyCard key={p.id} property={p} effective={getEffectiveVerification(p, data.verificationItems, now)} now={now} from="/tenant" />
            ))}
          </div>
        )}
        <p className={styles.muted}>Featured homes are a spread across different trust profiles. They are not ranked or recommended.</p>
      </section>

      <section className={`container ${styles.section}`} aria-labelledby="trust-intro-title">
        <div className={styles.trust}>
          <span className={styles.trustIcon} aria-hidden="true">
            <ShieldCheck size={24} />
          </span>
          <div className={styles.trustText}>
            <h2 id="trust-intro-title">See what has been checked — and what hasn&apos;t</h2>
            <ul>
              <li>Trust is shown as four separate checks, not one tick.</li>
              <li>&ldquo;Verified (demo)&rdquo; means a check is marked complete in demo data. It is not a real verification.</li>
              <li>Availability confirmations go out of date after 14 days and are flagged.</li>
            </ul>
            <Link to="/trust" className={buttonClassName("secondary", "sm")}>
              See how trust works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
