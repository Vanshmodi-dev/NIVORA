import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button, buttonClassName } from "../../components/ui/Button";
import { Chip, ChipGroup } from "../../components/ui/Chip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { formatDate, formatRupees } from "../../domain/format";
import { LOCALITY_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, SLOT_LABEL } from "../../domain/labels";
import { filterRequests, selectTenantRequests, type RequestFilter } from "../../domain/mutations";
import { isOpenRequest } from "../../domain/requests";
import { isTenantVisible } from "../../domain/search";
import { DEMO_TENANT_ID, type VisitRequest } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import { RequestRow } from "./RequestRow";
import styles from "./dashboard.module.css";

const FILTERS: { id: RequestFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "scheduled", label: "Scheduled" },
  { id: "closed", label: "Closed" },
];

const REASON_MAX = 120;

function when(ts: string): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${formatDate(ts)}, ${time}`;
}

/** T-08 Visit requests: live view of the shared records, with details, timeline and cancel. */
export function RequestsPage() {
  const data = useAppStore((s) => s.data);
  const { toast } = useToast();
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const all = selectTenantRequests(data, DEMO_TENANT_ID);
  const shown = filterRequests(all, filter);
  const detail = detailId ? (all.find((r) => r.id === detailId) ?? null) : null;
  const cancelling = cancelId ? (all.find((r) => r.id === cancelId) ?? null) : null;
  const propertyOf = (r: VisitRequest) => data.properties.find((p) => p.id === r.propertyId);

  const doCancel = () => {
    if (!cancelling) return;
    const result = appStore.getState().cancelVisitRequest(cancelling.id, reason);
    setCancelId(null);
    setReason("");
    if (result.ok) {
      toast({ tone: "success", title: `${cancelling.displayCode} cancelled`, description: "Recorded in this prototype only — no message was sent to anyone." });
    } else {
      toast({ tone: "error", title: "Couldn't cancel the request", description: result.message });
    }
  };

  if (all.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList size={26} />}
        title="No visit requests yet."
        description="When you request a visit to a home, you can follow its status here."
        action={
          <Link to="/tenant/search" className={buttonClassName("primary")}>
            Find a Home
          </Link>
        }
      />
    );
  }

  return (
    <>
      <ChipGroup label="Filter requests">
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} ({filterRequests(all, f.id).length})
          </Chip>
        ))}
      </ChipGroup>

      {shown.length === 0 ? (
        <p className={styles.muted}>No requests match this filter.</p>
      ) : (
        <div className={styles.list}>
          <h2 className="visually-hidden">Your visit requests</h2>
          {shown.map((r) => (
            <RequestRow
              key={r.id}
              request={r}
              property={propertyOf(r)}
              actions={
                <>
                  <Button variant="secondary" size="sm" onClick={() => {
                      setDetailId(r.id);
                      appStore.getState().markRequestSeen(r.id);
                    }} aria-label={`View details for ${r.displayCode}`}>
                    View details
                  </Button>
                  {isOpenRequest(r.status) && (
                    <Button variant="destructive" size="sm" onClick={() => setCancelId(r.id)} aria-label={`Cancel request ${r.displayCode}`}>
                      Cancel request
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}

      <Modal open={detail !== null} onClose={() => setDetailId(null)} title={detail ? `Request ${detail.displayCode}` : "Request"} variant="drawer" side="right">
        {detail && (
          <>
            <dl className={styles.dl}>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={REQUEST_STATUS_TONE[detail.status]}>{REQUEST_STATUS_LABEL[detail.status]}</Badge>
                </dd>
              </div>
              <div>
                <dt>Home</dt>
                <dd>
                  {(() => {
                    const p = propertyOf(detail);
                    return p && isTenantVisible(p) ? <Link to={`/tenant/property/${detail.propertyId}`}>{detail.propertySnapshot.title}</Link> : detail.propertySnapshot.title;
                  })()}
                </dd>
              </div>
              <div>
                <dt>Locality</dt>
                <dd>{LOCALITY_LABEL[detail.propertySnapshot.locality]}</dd>
              </div>
              <div>
                <dt>Rent when requested</dt>
                <dd>{formatRupees(detail.propertySnapshot.rent)} / month</dd>
              </div>
              <div>
                <dt>Preferred visit</dt>
                <dd>
                  {formatDate(detail.preferredDate)}, {SLOT_LABEL[detail.preferredSlot]}
                </dd>
              </div>
              {detail.scheduledFor && (
                <div>
                  <dt>Scheduled visit</dt>
                  <dd>
                    {formatDate(detail.scheduledFor.date)}, {SLOT_LABEL[detail.scheduledFor.slot]}
                  </dd>
                </div>
              )}
              <div>
                <dt>Your message</dt>
                <dd>{detail.message ?? "—"}</dd>
              </div>
              <div>
                <dt>Phone shared with owner</dt>
                <dd>{detail.sharePhoneWithOwner ? "Yes — you agreed to share it" : "No"}</dd>
              </div>
              {detail.status === "cancelled" && (
                <div>
                  <dt>Cancelled by</dt>
                  <dd>
                    {detail.cancelledBy === "owner" ? "The owner" : "You"}
                    {detail.cancelReason ? ` — ${detail.cancelReason}` : ""}
                  </dd>
                </div>
              )}
            </dl>
            <h3>Status history</h3>
            <ol className={styles.timeline} aria-label="Status history">
              {detail.statusHistory.map((h, i) => (
                <li key={`${h.status}-${i}`}>
                  <strong>{REQUEST_STATUS_LABEL[h.status]}</strong>
                  <span className={styles.when}>
                    {when(h.at)} · {h.by === "tenant" ? "by you" : h.by === "owner" ? "by the owner" : "by the system"}
                  </span>
                </li>
              ))}
            </ol>
            <p className={styles.muted}>Status changes are recorded in this prototype only. No notification is sent.</p>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={cancelling !== null}
        title="Cancel this request?"
        confirmLabel="Cancel request"
        cancelLabel="Keep request"
        destructive
        onCancel={() => {
          setCancelId(null);
          setReason("");
        }}
        onConfirm={doCancel}
      >
        <p>
          {cancelling ? `${cancelling.displayCode} — ${cancelling.propertySnapshot.title}. ` : ""}It will be marked Cancelled in this prototype. No message is sent.
        </p>
        <div className={styles.field} style={{ marginTop: 12 }}>
          <label htmlFor="cancel-reason">Reason (optional)</label>
          <input id="cancel-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} />
          <p className={styles.help}>
            {reason.length}/{REASON_MAX}
          </p>
        </div>
      </ConfirmDialog>
    </>
  );
}
