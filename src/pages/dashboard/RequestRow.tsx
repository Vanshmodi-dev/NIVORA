import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge } from "../../components/ui/Badge";
import { AppImage } from "../../components/ui/AppImage";
import { resolveImage } from "../../data/images";
import { formatDate } from "../../domain/format";
import { LOCALITY_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, SLOT_LABEL } from "../../domain/labels";
import { hasUnseenUpdate } from "../../domain/mutations";
import { isTenantVisible } from "../../domain/search";
import type { Property, VisitRequest } from "../../domain/types";
import styles from "./dashboard.module.css";

/**
 * One visit request, read straight from the shared store: there is no second copy, so the status
 * shown here is always the latest one (AC-15).
 */
export function RequestRow({ request: r, property, actions }: { request: VisitRequest; property: Property | undefined; actions?: ReactNode }) {
  const photo = r.propertySnapshot.photoId ? resolveImage(r.propertySnapshot.photoId) : null;
  const linkable = property !== undefined && isTenantVisible(property);
  return (
    <article className={styles.row} data-testid="request-row" data-request-id={r.id} data-status={r.status}>
      <div className={styles.thumb}>
        <AppImage src={photo?.src} alt={photo?.alt ?? `${r.propertySnapshot.title} (image unavailable)`} focus={photo?.focus} badge />
      </div>
      <div className={styles.rowMain}>
        <p className={styles.code}>{r.displayCode}</p>
        <h3 className={styles.rowTitle}>{linkable ? <Link to={`/tenant/property/${r.propertyId}`}>{r.propertySnapshot.title}</Link> : r.propertySnapshot.title}</h3>
        <p className={styles.rowMeta}>
          {LOCALITY_LABEL[r.propertySnapshot.locality]} · Requested {formatDate(r.preferredDate)}, {SLOT_LABEL[r.preferredSlot]}
        </p>
        {r.scheduledFor && r.status === "scheduled" && (
          <p className={styles.rowMeta}>
            Visit scheduled for {formatDate(r.scheduledFor.date)}, {SLOT_LABEL[r.scheduledFor.slot]}
          </p>
        )}
        <div className={styles.rowBadges}>
          <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
          {hasUnseenUpdate(r) && <span className={styles.updated} data-testid="updated-dot">Updated</span>}
          <span className={styles.rowMeta}>Updated {formatDate(r.updatedAt)}</span>
        </div>
      </div>
      {actions && <div className={styles.rowActions}>{actions}</div>}
    </article>
  );
}
