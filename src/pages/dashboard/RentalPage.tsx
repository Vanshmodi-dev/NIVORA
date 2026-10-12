import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { buttonClassName } from "../../components/ui/Button";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Field } from "../../components/ui/Field";
import { useToast } from "../../components/ui/Toast";
import { formatDate, formatRupees } from "../../domain/format";
import { MAINTENANCE_CATEGORY_LABEL, MAINTENANCE_PRIORITY_LABEL, MAINTENANCE_STATUS_LABEL, RENT_STATUS_LABEL } from "../../domain/labels";
import {
  CATEGORY_ERROR,
  DESCRIPTION_ERROR,
  MAINTENANCE_CATEGORIES,
  MAINTENANCE_PRIORITIES,
  PRIORITY_ERROR,
  renewalInfo,
  selectMaintenanceForTenant,
  selectTenantTenancy,
  type MaintenanceFieldErrors,
} from "../../domain/lifecycle";
import { deriveRentStatus } from "../../domain/rent";
import { DEMO_TENANT_ID } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import { useNow } from "../../store/useNow";
import { maintTone, rentTone } from "../owner/LifecyclePages";
import styles from "../owner/lifecycle.module.css";

const MOVE_IN_ITEMS = ["Collect the keys", "Walk through the home and note any damage", "Note the meter readings", "Save the owner's emergency contact (demo)"];

/**
 * T-10 My Rental (P1 preview): everything is demo data and everything except the move-in checklist
 * reads the same records the Owner sees. No agreement is generated, no payment is taken.
 */
export function RentalPage() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const { toast } = useToast();
  const tenancy = selectTenantTenancy(data, DEMO_TENANT_ID);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [errors, setErrors] = useState<MaintenanceFieldErrors>({});

  if (!tenancy) {
    return (
      <EmptyState icon={<KeyRound size={26} />} title="No rental to show" description="When you rent a home, its agreement summary, rent status and upkeep requests appear here."
        action={<Link to="/tenant/search" className={buttonClassName("primary")}>Find a Home</Link>} />
    );
  }

  const property = data.properties.find((p) => p.id === tenancy.propertyId);
  const rent = data.rentRecords.filter((r) => r.tenancyId === tenancy.id).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  const maintenance = selectMaintenanceForTenant(data, DEMO_TENANT_ID);
  const renewal = renewalInfo(tenancy, now);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = appStore.getState().createMaintenanceRequest({ category, description, priority });
    if (r.ok && "request" in r) {
      toast({ tone: "success", title: `Request ${r.request.displayCode} raised`, description: "Recorded in this prototype only — the owner sees it in their list; no technician was booked." });
      setCategory("");
      setDescription("");
      setPriority("medium");
      setErrors({});
    } else if (!r.ok && "errors" in r) {
      setErrors(r.errors);
    } else if (!r.ok) {
      toast({ tone: "error", title: "Couldn't raise the request", description: r.message });
    }
  };

  return (
    <div className={styles.page} style={{ padding: 0 }}>
      <div className={styles.head}>
        <h2>My Rental</h2>
        <span className={styles.tag}>Preview · demo data</span>
      </div>
      <p className={styles.banner}>A preview of the post-move-in experience. Agreements, payments and repairs are not real services in this prototype.</p>

      <section className={styles.card} aria-labelledby="rent-agr">
        <h2 id="rent-agr">Agreement overview</h2>
        <dl className={styles.dl}>
          <div><dt>Home</dt><dd>{property?.title ?? "—"}</dd></div>
          <div><dt>Monthly rent</dt><dd>{formatRupees(tenancy.monthlyRent)}</dd></div>
          <div><dt>Deposit</dt><dd>{formatRupees(tenancy.deposit)}</dd></div>
          <div><dt>Term</dt><dd>{formatDate(tenancy.startDate)} – {formatDate(tenancy.endDate)}</dd></div>
          <div><dt>Rent due on day</dt><dd>{tenancy.dueDay} of each month</dd></div>
          <div><dt>Notice period</dt><dd>{tenancy.noticeDays} days</dd></div>
        </dl>
        <p className={styles.muted}>Summary of sample terms. NIVORA does not generate or store legal agreements in this prototype.</p>
      </section>

      <section className={styles.card} aria-labelledby="rent-move">
        <h2 id="rent-move">Move-in information</h2>
        <ul className={styles.checklist}>
          {MOVE_IN_ITEMS.map((item) => (
            <li key={item}>
              <label className={styles.check}>
                <input type="checkbox" checked={done.has(item)} onChange={() => setDone((s) => { const n = new Set(s); if (n.has(item)) n.delete(item); else n.add(item); return n; })} />
                <span>{item}</span>
              </label>
            </li>
          ))}
        </ul>
        <p className={styles.muted}>This checklist is for this visit only and is not saved.</p>
      </section>

      <section className={styles.card} aria-labelledby="rent-status">
        <h2 id="rent-status">Rent status</h2>
        <ul className={styles.list}>
          {rent.map((r) => {
            const s = deriveRentStatus(r, now);
            return (
              <li key={r.id} className={styles.row} data-testid="tenant-rent-row" data-status={s}>
                <div className={styles.main}>
                  <strong>{r.month}</strong>
                  <span className={styles.muted}>Due {formatDate(r.dueDate)}{r.paidAt ? ` · recorded ${formatDate(r.paidAt)}` : ""}</span>
                </div>
                <div className={styles.amount}>{formatRupees(r.amount)}</div>
                <Badge tone={rentTone(s)}>{RENT_STATUS_LABEL[s]}</Badge>
              </li>
            );
          })}
        </ul>
        <p className={styles.muted}>Statuses are recorded by the owner in this prototype. There is no Pay button and no payment is taken.</p>
      </section>

      <section className={styles.card} aria-labelledby="rent-maint">
        <h2 id="rent-maint">Maintenance requests</h2>
        {maintenance.length === 0 ? <p className={styles.muted}>No requests yet.</p> : (
          <ul className={styles.list}>
            {maintenance.map((m) => (
              <li key={m.id} className={styles.row} data-testid="tenant-maintenance-row" data-status={m.status}>
                <div className={styles.main}>
                  <p className={styles.code}>{m.displayCode} · {formatDate(m.createdAt)}</p>
                  <strong>{MAINTENANCE_CATEGORY_LABEL[m.category]}</strong>
                  <span>{m.description}</span>
                  <span className={styles.muted}>Priority: {MAINTENANCE_PRIORITY_LABEL[m.priority]}</span>
                  {m.updates.length > 0 && <ul className={styles.updates}>{m.updates.map((u, i) => <li key={i}>{MAINTENANCE_STATUS_LABEL[u.status]} · {formatDate(u.at)}{u.note ? ` — ${u.note}` : ""}</li>)}</ul>}
                </div>
                <div />
                <Badge tone={maintTone(m.status)}>{MAINTENANCE_STATUS_LABEL[m.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
        <form className={styles.fields} onSubmit={submit} noValidate aria-label="Raise a maintenance request">
          <h3>Raise a request</h3>
          <Field label="Category" required id="mr-category" error={errors.category ? CATEGORY_ERROR : undefined}>
            {(a) => (
              <select {...a} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose a category</option>
                {MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{MAINTENANCE_CATEGORY_LABEL[c]}</option>)}
              </select>
            )}
          </Field>
          <Field label="Describe the problem" required id="mr-description" help={`${description.trim().length}/300`} error={errors.description ? DESCRIPTION_ERROR : undefined}>
            {(a) => <textarea {...a} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field label="Priority" required id="mr-priority" error={errors.priority ? PRIORITY_ERROR : undefined}>
            {(a) => (
              <select {...a} value={priority} onChange={(e) => setPriority(e.target.value)}>
                {MAINTENANCE_PRIORITIES.map((p) => <option key={p} value={p}>{MAINTENANCE_PRIORITY_LABEL[p]}</option>)}
              </select>
            )}
          </Field>
          <div><Button type="submit">Raise request</Button></div>
          <p className={styles.muted}>No technician is booked and nothing is sent. The owner sees this request in their list.</p>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="rent-renew">
        <h2 id="rent-renew">Renewal</h2>
        <p className={styles.renew} data-testid="renewal-banner">
          {renewal.daysLeft >= 0
            ? `Your tenancy ends in ${renewal.daysLeft} days. Renewal reminders would appear here.`
            : `Your tenancy ended ${-renewal.daysLeft} days ago.`}
        </p>
        <p className={styles.muted}>Future concept: reminders and renewals are not available in this prototype.</p>
      </section>
    </div>
  );
}
