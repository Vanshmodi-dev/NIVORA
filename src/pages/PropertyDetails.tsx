import {useState} from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Info } from "lucide-react";
import { Gallery } from "../components/property/Gallery";
import { SaveTextButton } from "../components/property/SaveButton";
import { TrustBreakdown } from "../components/property/TrustBreakdown";
import { VisitRequestModal } from "../components/visit/VisitRequestModal";
import { TrustCenterContent } from "../components/trust/TrustCenterContent";
import { Badge } from "../components/ui/Badge";
import { Breadcrumbs } from "../components/ui/Breadcrumbs";
import { Button, buttonClassName } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { formatDate, formatRupees } from "../domain/format";
import { AMENITY_LABEL, FURNISHING_LABEL, LOCALITY_LABEL, PROPERTY_TYPE_LABEL } from "../domain/labels";
import { findOpenRequest } from "../domain/mutations";
import { getAvailability, getTenantProperty } from "../domain/search";
import { DEMO_TENANT_ID } from "../domain/types";
import { getEffectiveVerification } from "../domain/verification";
import { useAppStore } from "../store/store";
import { NotFound } from "./Placeholders";
import styles from "./PropertyDetails.module.css";
import { useNow } from "../store/useNow";

/**
 * T-03 Property Details (without the visit modal, which belongs to Phase 3). Draft and
 * pending-review listings, and unknown ids, are Not Found for tenants (§6.5.2).
 */
export function PropertyDetails() {
  const { propertyId = "" } = useParams();
  const location = useLocation();
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const [trustOpen, setTrustOpen] = useState(false);
  const [visitOpen, setVisitOpen] = useState(false);

  const property = getTenantProperty(data, propertyId);
  if (!property) return <NotFound persona="tenant" />;

  const p = property;
  const from = (location.state as { from?: string } | null)?.from ?? "/tenant/search";
  const availability = getAvailability(p, now);
  const unavailable = availability.kind === "unavailable";
  const effective = getEffectiveVerification(p, data.verificationItems, now);
  const owner = data.owners.find((o) => o.id === p.ownerId);
  const ownerName = owner?.displayName ?? "Demo Owner";
  const rooms = p.type === "studio" ? "Studio" : p.type === "single_room" ? "Single room" : `${p.bedrooms} bedroom${p.bedrooms === 1 ? "" : "s"}`;
  const similar = new URLSearchParams({ locality: p.locality, type: p.type });
  const openRequest = findOpenRequest(data, DEMO_TENANT_ID, p.id);
  const canRequest = p.listingStatus === "published";

  return (
    <div className={`container ${styles.page}`}>
      <Breadcrumbs items={[{ label: "Find a Home", to: "/tenant" }, { label: "Results", to: from }, { label: p.title }]} />

      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <h1>{p.title}</h1>
          <p className={styles.sub}>
            {PROPERTY_TYPE_LABEL[p.type]} · {LOCALITY_LABEL[p.locality]}
          </p>
        </div>
        <div className={styles.pills}>
          <span className={styles.demo}>Demo listing</span>
          <Badge tone={availability.tone}>{availability.label}</Badge>
        </div>
      </header>

      {unavailable && (
        <div className={styles.banner} role="status" data-testid="unavailable-banner">
          <Info size={18} aria-hidden="true" />
          <div>
            <strong>This home is no longer available.</strong>
            <p>It&apos;s kept visible so existing links still make sense. A visit can&apos;t be requested for it.</p>
            <Link to={`/tenant/search?${similar.toString()}`} className={styles.bannerLink}>
              Find similar homes
            </Link>
          </div>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <Gallery photoIds={p.photoIds} fallbackAlt={`${PROPERTY_TYPE_LABEL[p.type]} in ${LOCALITY_LABEL[p.locality]} (image unavailable)`} />

          <section aria-labelledby="overview-title" className={styles.section}>
            <h2 id="overview-title">Overview</h2>
            <dl className={styles.facts}>
              <div><dt>Monthly rent</dt><dd>{formatRupees(p.rent)}</dd></div>
              <div><dt>Deposit</dt><dd>{formatRupees(p.deposit)}</dd></div>
              <div><dt>Maintenance</dt><dd>{p.maintenanceIncluded || p.maintenanceCharge === null ? "Included in rent" : `${formatRupees(p.maintenanceCharge)} / month`}</dd></div>
              <div><dt>Available from</dt><dd>{formatDate(p.availableFrom)}</dd></div>
              <div><dt>Type</dt><dd>{PROPERTY_TYPE_LABEL[p.type]}</dd></div>
              <div><dt>Rooms</dt><dd>{rooms}</dd></div>
              <div><dt>Bathrooms</dt><dd>{p.bathrooms}</dd></div>
              <div><dt>Furnishing</dt><dd>{FURNISHING_LABEL[p.furnishing]}</dd></div>
              {p.sizeSqft && <div><dt>Size</dt><dd>{p.sizeSqft} sq ft</dd></div>}
            </dl>
          </section>

          <section aria-labelledby="desc-title" className={styles.section}>
            <h2 id="desc-title">Description</h2>
            <p>{p.description}</p>
          </section>

          {p.amenities.length > 0 && (
            <section aria-labelledby="amen-title" className={styles.section}>
              <h2 id="amen-title">Amenities</h2>
              <ul className={styles.amenities}>
                {p.amenities.map((a) => (
                  <li key={a}>{AMENITY_LABEL[a]}</li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="loc-title" className={styles.section}>
            <h2 id="loc-title">Location</h2>
            <p>
              {LOCALITY_LABEL[p.locality]}, Jaipur{p.addressArea ? ` — ${p.addressArea}` : ""}.{p.landmark ? ` ${p.landmark}.` : ""}
            </p>
            <p className={styles.note}>The exact address is not shown. Positions in this prototype are approximate.</p>
          </section>

          <TrustBreakdown effective={effective} onOpenTrustCenter={() => setTrustOpen(true)} />

          <section aria-labelledby="owner-title" className={styles.section}>
            <h2 id="owner-title">Listed by</h2>
            <p>
              {ownerName} <Badge tone="neutral">Demo owner</Badge>
            </p>
            <p className={styles.note}>Owner contact details are not shown in this prototype.</p>
          </section>

          <p className={styles.demoNotice}>This is a demo listing. Nothing here has been verified in the real world.</p>
        </div>

        <aside className={styles.aside} aria-label="Rent and actions">
          <div className={styles.action}>
            <p className={styles.rent}>
              {formatRupees(p.rent)} <span>/ month</span>
            </p>
            <p className={styles.note}>Deposit {formatRupees(p.deposit)} · Available from {formatDate(p.availableFrom)}</p>
            <Button disabled={!canRequest} aria-describedby="visit-note" onClick={() => setVisitOpen(true)}>
              Request a Visit
            </Button>
            <p id="visit-note" className={styles.note}>
              {!canRequest
                ? "This home is no longer available, so a visit can't be requested."
                : "Visit requests in this prototype are not sent to a real landlord."}
            </p>
            {openRequest && (
              <p className={styles.note} data-testid="open-request-note">
                You already have an open request (<Link to="/tenant/dashboard/requests">{openRequest.displayCode}</Link>) for this home.
              </p>
            )}
            <SaveTextButton propertyId={p.id} />
            <Link to={from} className={buttonClassName("tertiary", "sm")}>
              Back to results
            </Link>
          </div>
        </aside>
      </div>

      <VisitRequestModal open={visitOpen} onClose={() => setVisitOpen(false)} property={p} />

      <Modal open={trustOpen} onClose={() => setTrustOpen(false)} title="How trust works on NIVORA" variant="drawer" side="right">
        <TrustCenterContent data={data} now={now} compact />
        <p className={styles.drawerLink}>
          <Link to="/trust" onClick={() => setTrustOpen(false)}>
            Open the full Trust Center
          </Link>
        </p>
      </Modal>
    </div>
  );
}
