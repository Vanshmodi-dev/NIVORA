import { useMemo, useState } from "react";
import { Banknote, Wrench } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Chip, ChipGroup } from "../../components/ui/Chip";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { formatDate, formatRupees } from "../../domain/format";
import {
  MAINTENANCE_CATEGORY_LABEL,
  MAINTENANCE_PRIORITY_LABEL,
  MAINTENANCE_STATUS_LABEL,
  RENT_STATUS_LABEL,
} from "../../domain/labels";
import {
  allowedMaintenanceMoves,
  defaultRentMonth,
  selectMaintenanceForOwner,
  selectRentRows,
  summariseRent,
} from "../../domain/lifecycle";
import { selectOwnerProperties } from "../../domain/ownerMutations";
import { DEMO_OWNER_ID, type MaintenanceRequest, type MaintenanceStatus, type RentStatus } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import { useNow } from "../../store/useNow";
import styles from "./lifecycle.module.css";

export const rentTone = (s: RentStatus) => (s === "paid" ? "positive" : s === "overdue" ? "error" : "pending") as "positive" | "error" | "pending";
export const maintTone = (s: MaintenanceStatus) => (s === "resolved" ? "positive" : s === "in_progress" ? "pending" : "warning") as "positive" | "pending" | "warning";

/* ------------------------------------------------------------------ O-08 Rent Tracking */

export function RentTracking() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const { toast } = useToast();
  const rows = selectRentRows(data, DEMO_OWNER_ID, now);
  const [monthSel, setMonthSel] = useState<string | null>(null);
  const [status, setStatus] = useState<"all" | RentStatus>("all");
  const [property, setProperty] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const months = [...new Set(rows.map((r) => r.record.month))].sort().reverse();
  const month = monthSel ?? defaultRentMonth(rows, now);
  const inMonth = rows.filter((r) => r.record.month === month);
  const summary = summariseRent(inMonth);
  const shown = rows
    .filter((r) => (month ? r.record.month === month : true))
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => !property || r.tenancy.propertyId === property);
  const properties = selectOwnerProperties(data, DEMO_OWNER_ID).filter((p) => rows.some((r) => r.tenancy.propertyId === p.id));
  const confirming = confirmId ? rows.find((r) => r.record.id === confirmId) : null;

  const record = () => {
    if (!confirming) return;
    const r = appStore.getState().recordRentPaid(confirming.record.id);
    setConfirmId(null);
    if (r.ok) toast({ tone: "success", title: "Recorded as paid (demo)", description: "A demo status only — no payment was made or checked." });
    else toast({ tone: "error", title: "Couldn't record that", description: r.message });
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Rent Tracking</h1>
        <span className={styles.tag}>Preview · demo data</span>
      </div>
      <p className={styles.banner}>Demo rent records. Nothing here moves real money, and no payment is ever made or checked.</p>

      {rows.length === 0 ? (
        <EmptyState icon={<Banknote size={26} />} title="No rent records yet." description="Rent records appear here for homes that are let." />
      ) : (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}><span className={styles.num}>{formatRupees(summary.expected)}</span><span className={styles.lbl}>Expected</span></div>
            <div className={styles.tile}><span className={styles.num}>{formatRupees(summary.paid)}</span><span className={styles.lbl}>Recorded as paid (demo)</span></div>
            <div className={styles.tile}><span className={styles.num}>{formatRupees(summary.outstanding)}</span><span className={styles.lbl}>Outstanding</span></div>
            <div className={styles.tile}><span className={styles.num}>{summary.overdueCount}</span><span className={styles.lbl}>Overdue</span></div>
          </div>
          <div className={styles.toolbar}>
            <label className={styles.sel}>Month
              <select value={month ?? ""} onChange={(e) => setMonthSel(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className={styles.sel}>Property
              <select value={property} onChange={(e) => setProperty(e.target.value)}>
                <option value="">All properties</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </label>
          </div>
          <ChipGroup label="Filter by rent status">
            {([["all", "All"], ["paid", "Paid"], ["due", "Due"], ["overdue", "Overdue"]] as const).map(([id, label]) => (
              <Chip key={id} selected={status === id} onClick={() => setStatus(id)}>{label}</Chip>
            ))}
          </ChipGroup>
          <p className={styles.muted} aria-live="polite" data-testid="rent-count">{shown.length} {shown.length === 1 ? "record" : "records"}</p>
          {shown.length === 0 ? <p className={styles.muted}>No records match these filters.</p> : (
            <ul className={styles.list}>
              {shown.map((r) => (
                <li key={r.record.id} className={styles.row} data-testid="rent-row" data-rent-id={r.record.id} data-status={r.status}>
                  <div className={styles.main}>
                    <h2>{r.propertyTitle}</h2>
                    <p className={styles.muted}>Tenant: {r.tenantName} · {r.record.month} · Due {formatDate(r.record.dueDate)}</p>
                    <div className={styles.badges}>
                      <Badge tone={rentTone(r.status)}>{RENT_STATUS_LABEL[r.status]}</Badge>
                      {r.record.paidAt && <span className={styles.muted}>Recorded {formatDate(r.record.paidAt)}</span>}
                    </div>
                  </div>
                  <div className={styles.amount}>{formatRupees(r.record.amount)}</div>
                  <div className={styles.actions}>
                    {r.status !== "paid" && <Button size="sm" variant="secondary" onClick={() => setConfirmId(r.record.id)} aria-label={`Record as paid (demo): ${r.record.month} rent for ${r.propertyTitle}`}>Record as paid (demo)</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <ConfirmDialog open={confirming !== null} title="Record this rent as paid?" confirmLabel="Record as paid (demo)" onCancel={() => setConfirmId(null)} onConfirm={record}>
        <p>This records a paid status in the prototype only. No payment is made or checked, and no real money is involved.</p>
        {confirming && <p>{confirming.propertyTitle} · {confirming.record.month} · {formatRupees(confirming.record.amount)}</p>}
      </ConfirmDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ O-09 Maintenance */

export function MaintenanceManagement() {
  const data = useAppStore((s) => s.data);
  const { toast } = useToast();
  const list = selectMaintenanceForOwner(data, DEMO_OWNER_ID);
  const [filter, setFilter] = useState<"all" | MaintenanceStatus>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [to, setTo] = useState<MaintenanceStatus | "">("");
  const [note, setNote] = useState("");
  const editing = editId ? list.find((m) => m.id === editId) : null;
  const shown = list.filter((m) => filter === "all" || m.status === filter);
  const propertyTitle = (m: MaintenanceRequest) => data.properties.find((p) => p.id === m.propertyId)?.title ?? "Property";

  const open = (m: MaintenanceRequest) => {
    setEditId(m.id);
    setTo(allowedMaintenanceMoves(m.status)[0] ?? "");
    setNote("");
  };
  const save = () => {
    if (!editing || !to) return;
    const r = appStore.getState().updateMaintenanceStatus(editing.id, to, note);
    if (r.ok) {
      toast({ tone: "success", title: `${editing.displayCode} is now ${MAINTENANCE_STATUS_LABEL[to]}`, description: "Recorded in this prototype only — no technician was dispatched and no message was sent." });
      setEditId(null);
    } else toast({ tone: "error", title: "Couldn't update the request", description: r.message });
  };

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1>Maintenance</h1>
        <span className={styles.tag}>Preview · demo data</span>
      </div>
      <p className={styles.banner}>These are the same requests the Tenant sees. No technician is dispatched, no vendor is booked, and no message is sent.</p>
      {list.length === 0 ? (
        <EmptyState icon={<Wrench size={26} />} title="No maintenance requests." description="When a tenant raises a request it appears here." />
      ) : (
        <>
          <ChipGroup label="Filter by maintenance status">
            {([["all", "All"], ["open", "Open"], ["in_progress", "In Progress"], ["resolved", "Resolved"]] as const).map(([id, label]) => (
              <Chip key={id} selected={filter === id} onClick={() => setFilter(id)}>{label} ({id === "all" ? list.length : list.filter((m) => m.status === id).length})</Chip>
            ))}
          </ChipGroup>
          <ul className={styles.list}>
            {shown.map((m) => (
              <li key={m.id} className={styles.row} data-testid="maintenance-row" data-request-id={m.id} data-status={m.status}>
                <div className={styles.main}>
                  <p className={styles.code}>{m.displayCode} · raised {formatDate(m.createdAt)}</p>
                  <h2>{MAINTENANCE_CATEGORY_LABEL[m.category]} — {propertyTitle(m)}</h2>
                  <p>{m.description}</p>
                  <div className={styles.badges}>
                    <Badge tone={maintTone(m.status)}>{MAINTENANCE_STATUS_LABEL[m.status]}</Badge>
                    <span className={styles.muted}>Priority: {MAINTENANCE_PRIORITY_LABEL[m.priority]}</span>
                  </div>
                  {m.updates.length > 0 && (
                    <ul className={styles.updates} aria-label={`Updates for ${m.displayCode}`}>
                      {m.updates.map((u, i) => <li key={i}>{MAINTENANCE_STATUS_LABEL[u.status]} · {formatDate(u.at)}{u.note ? ` — ${u.note}` : ""}</li>)}
                    </ul>
                  )}
                </div>
                <div className={styles.actions}>
                  {allowedMaintenanceMoves(m.status).length > 0 && <Button size="sm" variant="secondary" onClick={() => open(m)} aria-label={`Update status for ${m.displayCode}`}>Update status</Button>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      <Modal open={editing !== null && editing !== undefined} onClose={() => setEditId(null)} title={editing ? `Update ${editing.displayCode}` : "Update"} variant="drawer" side="right"
        footer={<><Button variant="secondary" onClick={() => setEditId(null)}>Cancel</Button><Button onClick={save} disabled={!to}>Save update</Button></>}>
        {editing && (
          <div className={styles.form}>
            <Field label="New status" id="maint-status">
              {(a) => (
                <select {...a} value={to} onChange={(e) => setTo(e.target.value as MaintenanceStatus)}>
                  {allowedMaintenanceMoves(editing.status).map((s) => <option key={s} value={s}>{MAINTENANCE_STATUS_LABEL[s]}</option>)}
                </select>
              )}
            </Field>
            <Field label="Note (optional)" id="maint-note" help={`${note.length}/200 · visible to the tenant`}>
              {(a) => <textarea {...a} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <p className={styles.muted}>This only records an update in the prototype. No technician is dispatched.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

/** Memoised helper kept for tests. */
export const useOwnerRentRows = () => {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  return useMemo(() => selectRentRows(data, DEMO_OWNER_ID, now), [data, now]);
};
