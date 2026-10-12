import {useState} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Inbox } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { AppImage } from "../../components/ui/AppImage";
import { Button } from "../../components/ui/Button";
import { Chip, ChipGroup } from "../../components/ui/Chip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { TIME_SLOTS } from "../../data/reference";
import { resolveImage } from "../../data/images";
import { addDays, startOfDay, toISODate } from "../../domain/dates";
import { formatDate, formatPhone, formatRupees } from "../../domain/format";
import { LOCALITY_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, SLOT_LABEL } from "../../domain/labels";
import { getOwnerVisiblePhone } from "../../domain/mutations";
import { selectOwnerProperties, selectOwnerRequests } from "../../domain/ownerMutations";
import { allowedTransitions } from "../../domain/requests";
import { DEMO_OWNER_ID, type RequestStatus, type TimeSlot, type VisitRequest } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import styles from "./enquiries.module.css";
import { useNow } from "../../store/useNow";

type StatusFilter = "all" | RequestStatus;
const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: REQUEST_STATUS_LABEL.pending },
  { id: "contacted", label: REQUEST_STATUS_LABEL.contacted },
  { id: "scheduled", label: REQUEST_STATUS_LABEL.scheduled },
  { id: "completed", label: REQUEST_STATUS_LABEL.completed },
  { id: "cancelled", label: REQUEST_STATUS_LABEL.cancelled },
];
type SortKey = "newest" | "visit";
const REASON_MAX = 120;
const PROTOTYPE_ONLY = "prototype only — no message sent";

function when(ts: string): string {
  const d = new Date(ts);
  return `${formatDate(ts)}, ${d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })}`;
}

/**
 * O-07 Enquiries & Visits. Reads and writes the SAME visit-request records the Tenant sees, so a
 * status change here is the Tenant's status too. Actions are offered only when the transition is
 * valid for the stored status; nothing is ever sent to the Tenant (TP-5).
 */
export function EnquiriesPage() {
  const data = useAppStore((s) => s.data);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const propertyFilter = params.get("property") ?? "";
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sched, setSched] = useState<{ date: string; slot: TimeSlot; error: string | null }>({ date: "", slot: "morning", error: null });
  const now = useNow();
  const minDate = toISODate(startOfDay(now));
  const maxDate = toISODate(addDays(startOfDay(now), 60));

  const all = selectOwnerRequests(data, DEMO_OWNER_ID);
  const props = selectOwnerProperties(data, DEMO_OWNER_ID);
  const list = all
    .filter((r) => (status === "all" ? true : r.status === status))
    .filter((r) => !propertyFilter || r.propertyId === propertyFilter)
    .filter((r) => !q.trim() || `${r.displayCode} ${r.tenantNameEntered}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (sort === "visit" ? (a.scheduledFor?.date ?? a.preferredDate).localeCompare(b.scheduledFor?.date ?? b.preferredDate) : b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)));

  const detail = detailId ? (all.find((r) => r.id === detailId) ?? null) : null;
  const scheduling = scheduleId ? (all.find((r) => r.id === scheduleId) ?? null) : null;
  const cancelling = cancelId ? (all.find((r) => r.id === cancelId) ?? null) : null;

  const report = (r: VisitRequest, result: { ok: true } | { ok: false; message: string }, label: string) => {
    if (result.ok) {
      toast({ tone: "success", title: `${r.displayCode}: status updated to ${label}`, description: `Recorded in this ${PROTOTYPE_ONLY}.` });
      return true;
    }
    // The list reads from the store, so it is already showing the latest state.
    toast({ tone: "error", title: "That change couldn't be made", description: result.message });
    return false;
  };

  const act = (r: VisitRequest, to: RequestStatus) => report(r, appStore.getState().ownerTransitionRequest(r.id, to), REQUEST_STATUS_LABEL[to]);

  const openSchedule = (r: VisitRequest) => {
    setSched({ date: r.preferredDate < minDate ? minDate : r.preferredDate, slot: r.preferredSlot, error: null });
    setScheduleId(r.id);
  };
  const saveSchedule = () => {
    if (!scheduling) return;
    if (!sched.date || sched.date < minDate || sched.date > maxDate) {
      setSched((s) => ({ ...s, error: "Choose a visit date within the next 60 days." }));
      return;
    }
    report(scheduling, appStore.getState().ownerTransitionRequest(scheduling.id, "scheduled", { scheduledFor: { date: sched.date, slot: sched.slot } }), REQUEST_STATUS_LABEL.scheduled);
    setScheduleId(null);
  };
  const doCancel = () => {
    if (!cancelling) return;
    report(cancelling, appStore.getState().ownerTransitionRequest(cancelling.id, "cancelled", { note: reason }), REQUEST_STATUS_LABEL.cancelled);
    setCancelId(null);
    setReason("");
  };

  if (all.length === 0) {
    return (
      <div className={styles.page}>
        <h1>Enquiries &amp; Visits</h1>
        <EmptyState
          icon={<Inbox size={26} />}
          title="No visit requests yet."
          description="When a Tenant requests a visit, it appears here."
          action={<Button onClick={() => { appStore.getState().setPersona("tenant"); navigate("/tenant"); }}>Preview as Tenant</Button>}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1>Enquiries &amp; Visits</h1>
      <p className={styles.muted}>These are the same requests the Tenant sees. Status changes are recorded in this prototype only — nothing is sent to the Tenant.</p>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span className="visually-hidden">Search by request ID or tenant name</span>
          <input type="search" placeholder="Search request ID or tenant name" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className={styles.sel}>
          Property
          <select value={propertyFilter} onChange={(e) => setParams(e.target.value ? { property: e.target.value } : {}, { replace: true })}>
            <option value="">All properties</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </label>
        <label className={styles.sel}>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Newest</option>
            <option value="visit">Visit date</option>
          </select>
        </label>
      </div>
      <ChipGroup label="Filter by status">
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.id} selected={status === f.id} onClick={() => setStatus(f.id)}>
            {f.label} ({f.id === "all" ? all.filter((r) => !propertyFilter || r.propertyId === propertyFilter).length : all.filter((r) => r.status === f.id && (!propertyFilter || r.propertyId === propertyFilter)).length})
          </Chip>
        ))}
      </ChipGroup>
      <p className={styles.muted} aria-live="polite" data-testid="enquiry-count">{list.length} {list.length === 1 ? "request" : "requests"}</p>

      {list.length === 0 ? (
        <div className={styles.empty}>
          <p>No requests match these filters.</p>
          <Button size="sm" variant="secondary" onClick={() => { setStatus("all"); setQ(""); setParams({}, { replace: true }); }}>Clear filters</Button>
        </div>
      ) : (
        <ul className={styles.list}>
          {list.map((r) => {
            const next = allowedTransitions(r.status, "owner");
            const photo = r.propertySnapshot.photoId ? resolveImage(r.propertySnapshot.photoId) : null;
            const long = (r.message ?? "").length > 90;
            const open = expanded.has(r.id);
            return (
              <li key={r.id} className={styles.row} data-testid="enquiry-row" data-request-id={r.id} data-status={r.status}>
                <div className={styles.thumb}><AppImage src={photo?.src} alt="" focus={photo?.focus} badge compact /></div>
                <div className={styles.main}>
                  <p className={styles.code}>{r.displayCode} · received {formatDate(r.createdAt)}</p>
                  <h2><Link to={`/owner/properties/${r.propertyId}`}>{r.propertySnapshot.title}</Link></h2>
                  <p className={styles.muted}>{LOCALITY_LABEL[r.propertySnapshot.locality]} · Tenant: <strong>{r.tenantNameEntered}</strong></p>
                  <p className={styles.muted}>Preferred: {formatDate(r.preferredDate)}, {SLOT_LABEL[r.preferredSlot]}{r.scheduledFor && r.status === "scheduled" ? ` · Scheduled: ${formatDate(r.scheduledFor.date)}, ${SLOT_LABEL[r.scheduledFor.slot]}` : ""}</p>
                  {r.message && (
                    <p className={styles.msg}>
                      “{long && !open ? `${r.message.slice(0, 90)}…` : r.message}”
                      {long && <button type="button" className={styles.link} onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}>{open ? "Show less" : "Show more"}</button>}
                    </p>
                  )}
                  <div className={styles.badges}><Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge></div>
                </div>
                <div className={styles.actions}>
                  {next.includes("contacted") && <Button size="sm" onClick={() => act(r, "contacted")} aria-label={`Mark contacted for ${r.displayCode}`}>Mark contacted</Button>}
                  {next.includes("scheduled") && <Button size="sm" variant="secondary" onClick={() => openSchedule(r)} aria-label={`Schedule visit for ${r.displayCode}`}>Schedule visit</Button>}
                  {next.includes("completed") && <Button size="sm" variant="secondary" onClick={() => act(r, "completed")} aria-label={`Mark completed for ${r.displayCode}`}>Mark completed</Button>}
                  {next.includes("cancelled") && <Button size="sm" variant="destructive" onClick={() => setCancelId(r.id)} aria-label={`Cancel ${r.displayCode}`}>Cancel</Button>}
                  <Button size="sm" variant="tertiary" onClick={() => setDetailId(r.id)} aria-label={`View details for ${r.displayCode}`}>View details</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={scheduling !== null} onClose={() => setScheduleId(null)} title="Schedule visit"
        footer={<><Button variant="secondary" onClick={() => setScheduleId(null)}>Cancel</Button><Button onClick={saveSchedule}>Save schedule</Button></>}>
        {scheduling && (
          <div className={styles.form}>
            <p>{scheduling.displayCode} — {scheduling.propertySnapshot.title} for {scheduling.tenantNameEntered}</p>
            <div className={styles.field}>
              <label htmlFor="sched-date">Visit date</label>
              <input id="sched-date" type="date" min={minDate} max={maxDate} value={sched.date} aria-invalid={sched.error ? true : undefined} onChange={(e) => setSched((s) => ({ ...s, date: e.target.value, error: null }))} />
              {sched.error && <p role="alert" className={styles.err}>{sched.error}</p>}
            </div>
            <fieldset className={styles.slots}>
              <legend>Time slot</legend>
              {TIME_SLOTS.map((s) => (
                <label key={s} className={styles.radio}><input type="radio" name="sched-slot" checked={sched.slot === s} onChange={() => setSched((x) => ({ ...x, slot: s }))} /><span>{SLOT_LABEL[s]}</span></label>
              ))}
            </fieldset>
            <p className={styles.muted}>This only records the schedule in the prototype. No message is sent to the tenant.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={cancelling !== null} title="Cancel this request?" confirmLabel="Cancel request" cancelLabel="Keep request" destructive onCancel={() => { setCancelId(null); setReason(""); }} onConfirm={doCancel}>
        <p>{cancelling ? `${cancelling.displayCode} — ${cancelling.propertySnapshot.title}. ` : ""}It will be marked Cancelled for you and for the tenant in this prototype. No message is sent.</p>
        <div className={styles.field} style={{ marginTop: 12 }}>
          <label htmlFor="owner-cancel-reason">Reason (optional)</label>
          <input id="owner-cancel-reason" value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} />
          <p className={styles.muted}>{reason.length}/{REASON_MAX}</p>
        </div>
      </ConfirmDialog>

      <Modal open={detail !== null} onClose={() => setDetailId(null)} title={detail ? `Request ${detail.displayCode}` : "Request"} variant="drawer" side="right">
        {detail && (() => {
          const phone = getOwnerVisiblePhone(detail);
          return (
            <>
              <dl className={styles.dl}>
                <div><dt>Status</dt><dd><Badge tone={REQUEST_STATUS_TONE[detail.status]}>{REQUEST_STATUS_LABEL[detail.status]}</Badge></dd></div>
                <div><dt>Property</dt><dd>{detail.propertySnapshot.title} · {formatRupees(detail.propertySnapshot.rent)} when requested</dd></div>
                <div><dt>Tenant (as entered)</dt><dd>{detail.tenantNameEntered}</dd></div>
                <div><dt>Phone</dt><dd data-testid="tenant-phone">{phone ? formatPhone(phone) : "Not shared — the tenant did not choose to share it"}</dd></div>
                <div><dt>Preferred visit</dt><dd>{formatDate(detail.preferredDate)}, {SLOT_LABEL[detail.preferredSlot]}</dd></div>
                {detail.scheduledFor && <div><dt>Scheduled</dt><dd>{formatDate(detail.scheduledFor.date)}, {SLOT_LABEL[detail.scheduledFor.slot]}</dd></div>}
                <div><dt>Message</dt><dd>{detail.message ?? "—"}</dd></div>
                {detail.status === "cancelled" && <div><dt>Cancelled by</dt><dd>{detail.cancelledBy === "tenant" ? "The tenant" : "You"}{detail.cancelReason ? ` — ${detail.cancelReason}` : ""}</dd></div>}
              </dl>
              <h3>Status history</h3>
              <ol className={styles.timeline} aria-label="Status history">
                {detail.statusHistory.map((h, i) => (
                  <li key={`${h.status}-${i}`}><strong>{REQUEST_STATUS_LABEL[h.status]}</strong><span className={styles.when}>{when(h.at)} · {h.by === "tenant" ? "by the tenant" : h.by === "owner" ? "by you" : "by the system"}</span></li>
                ))}
              </ol>
              <p className={styles.muted}>Status changes are recorded in this prototype only. No SMS, WhatsApp or email is sent.</p>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}
