import { Link } from "react-router-dom";
import { Badge } from "../ui/Badge";
import { buttonClassName } from "../ui/Button";
import { AppImage } from "../ui/AppImage";
import { resolveImage } from "../../data/images";
import { formatRupees } from "../../domain/format";
import { AMENITY_LABEL, LOCALITY_LABEL, PROPERTY_TYPE_LABEL } from "../../domain/labels";
import { getAvailability, specsLine } from "../../domain/search";
import type { Property } from "../../domain/types";
import type { EffectiveVerification } from "../../domain/verification";
import { SaveIconButton } from "./SaveButton";
import { VerificationIndicator } from "./VerificationIndicator";
import styles from "./PropertyCard.module.css";

export interface PropertyCardProps {
  property: Property;
  effective: readonly EffectiveVerification[];
  now: Date;
  /** Results URL to return to from the details page ("Back to results"). */
  from?: string;
  /** Optional straight-line distance note, e.g. `≈ 1.9 km from VGU · simulated position`. */
  distanceNote?: string;
}

/**
 * Property card (§6.3.4) with the save control (Phase 3). The whole card is one stretched link; the
 * save button sits above it (z-index) so it never triggers navigation.
 */
export function PropertyCard({ property: p, effective, now, from, distanceNote }: PropertyCardProps) {
  const availability = getAvailability(p, now);
  const cover = p.photoIds[0] ? resolveImage(p.photoIds[0]) : null;
  const shown = p.amenities.slice(0, 3);
  const more = p.amenities.length - shown.length;
  const unavailable = availability.kind === "unavailable";

  return (
    <article className={`${styles.card} ${unavailable ? styles.muted : ""}`} data-testid="property-card" data-property-id={p.id}>
      <div className={styles.media}>
        <AppImage src={cover?.src} alt={cover?.alt ?? `${PROPERTY_TYPE_LABEL[p.type]} in ${LOCALITY_LABEL[p.locality]} (image unavailable)`} focus={cover?.focus} />
        <span className={styles.demo}>Demo</span>
        {cover && <span className={styles.illustrative}>Illustrative photo</span>}
        <SaveIconButton propertyId={p.id} title={p.title} />
      </div>
      <div className={styles.body}>
        <p className={styles.rent}>
          {formatRupees(p.rent)} <span>/ month</span>
        </p>
        <h3 className={styles.title}>
          <Link to={`/tenant/property/${p.id}`} state={from ? { from } : undefined} className={styles.stretch}>
            {p.title}
          </Link>
        </h3>
        <p className={styles.meta}>
          {PROPERTY_TYPE_LABEL[p.type]} · {LOCALITY_LABEL[p.locality]}
        </p>
        <p className={styles.specs}>{specsLine(p)}</p>
        {distanceNote && <p className={styles.specs} data-testid="distance-note">{distanceNote}</p>}
        {shown.length > 0 && (
          <ul className={styles.amenities} aria-label="Amenities">
            {shown.map((a) => (
              <li key={a}>{AMENITY_LABEL[a]}</li>
            ))}
            {more > 0 && <li>+{more}</li>}
          </ul>
        )}
        <div className={styles.badges}>
          <Badge tone={availability.tone}>{availability.label}</Badge>
        </div>
        <VerificationIndicator effective={effective} />
        <span className={`${buttonClassName("secondary", "sm")} ${styles.cta}`} aria-hidden="true">
          View details
        </span>
      </div>
    </article>
  );
}
