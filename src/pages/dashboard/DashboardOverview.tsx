import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { buttonClassName } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { formatDate } from "../../domain/format";
import { SLOT_LABEL } from "../../domain/labels";
import { selectSavedProperties, selectTenantRequests, selectUpcomingVisits } from "../../domain/mutations";
import { isOpenRequest } from "../../domain/requests";
import { DEMO_TENANT_ID } from "../../domain/types";
import { useAppStore } from "../../store/store";
import { RequestRow } from "./RequestRow";
import styles from "./dashboard.module.css";
import { useNow } from "../../store/useNow";

/** T-06 Dashboard Overview — the return point for the Tenant journey. */
export function DashboardOverview() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const profile = data.tenants.find((t) => t.id === DEMO_TENANT_ID);
  const requests = selectTenantRequests(data, DEMO_TENANT_ID);
  const saved = selectSavedProperties(data, DEMO_TENANT_ID);
  const upcoming = selectUpcomingVisits(data, DEMO_TENANT_ID, now);
  const openCount = requests.filter((r) => isOpenRequest(r.status)).length;
  const next = upcoming[0];
  const first = profile?.name?.trim().split(/\s+/)[0];

  if (requests.length === 0 && saved.length === 0) {
    return (
      <>
        <p className={styles.muted}>{first ? `Hi, ${first}` : "Welcome back"}</p>
        <EmptyState
          icon={<Compass size={26} />}
          title="Your journey starts here"
          description="Save homes you like and request visits. They will appear here."
          action={
            <Link to="/tenant/search" className={buttonClassName("primary")}>
              Find a Home
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <h2>{first ? `Hi, ${first}` : "Welcome back"}</h2>
      <div className={styles.stats}>
        <Link to="/tenant/dashboard/saved" className={styles.stat}>
          <span className={styles.statNum}>{saved.length}</span>
          <span className={styles.statLabel}>Saved homes</span>
        </Link>
        <Link to="/tenant/dashboard/requests" className={styles.stat}>
          <span className={styles.statNum}>{openCount}</span>
          <span className={styles.statLabel}>Open requests</span>
        </Link>
        <Link to="/tenant/dashboard/requests" className={styles.stat}>
          <span className={styles.statNum}>{upcoming.length}</span>
          <span className={styles.statLabel}>Upcoming visits</span>
        </Link>
      </div>

      <section className={styles.card} aria-labelledby="next-visit">
        <h2 id="next-visit">Next visit</h2>
        {next && next.scheduledFor ? (
          <p>
            <strong>{next.propertySnapshot.title}</strong> — {formatDate(next.scheduledFor.date)}, {SLOT_LABEL[next.scheduledFor.slot]}{" "}
            <span className={styles.muted}>({next.displayCode}, scheduled in this prototype)</span>
          </p>
        ) : (
          <p className={styles.muted}>No visit is scheduled yet. When an owner schedules one, it will appear here.</p>
        )}
      </section>

      <section aria-labelledby="recent">
        <div className={styles.head}>
          <h2 id="recent">Recent requests</h2>
          {requests.length > 0 && (
            <Link to="/tenant/dashboard/requests" className={buttonClassName("tertiary", "sm")}>
              View all
            </Link>
          )}
        </div>
        {requests.length === 0 ? (
          <p className={styles.muted}>You haven&apos;t requested a visit yet.</p>
        ) : (
          <div className={styles.list}>
            {requests.slice(0, 3).map((r) => (
              <RequestRow key={r.id} request={r} property={data.properties.find((p) => p.id === r.propertyId)} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
