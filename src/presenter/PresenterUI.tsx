import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { ResetDemoDialog } from "../app/AboutDialog";
import { formatDate } from "../domain/format";
import {
  LISTING_STATUS_LABEL,
  VERIFICATION_CATEGORY_LABEL,
  VERIFICATION_STATUS_LABEL,
  VERIFICATION_STATUS_TONE,
} from "../domain/labels";
import { toISODate } from "../domain/dates";
import { getEffectiveVerification } from "../domain/verification";
import { useAppStore } from "../store/store";
import { useNow } from "../store/useNow";
import { commitSimulated, enterPresenterMode, exitPresenterMode, setSimulatedDate } from "./session";
import { SIM_STATUSES, ageAvailability, completeReview, restoreSeededVerification, simulateVerification, undoAll, type SimResult } from "./simulate";
import styles from "./presenter.module.css";

/** Slim banner shown in every shell while Presenter Mode is active (PM-4). */
export function PresenterBanner() {
  const active = useAppStore((s) => s.ui.presenterMode);
  const override = useAppStore((s) => s.ui.presenterNowOverride);
  if (!active) return null;
  return (
    <div className={styles.banner} role="region" aria-label="Presenter Mode">
      <strong>PRESENTER MODE</strong> · Simulated tools active
      {override && <span> · Simulated date: {formatDate(override)}</span>}
      <span className={styles.bannerActions}>
        <Link to="/presenter">Open panel</Link>
        <button type="button" onClick={exitPresenterMode}>Exit</button>
      </span>
    </div>
  );
}

/** About-dialog entry: a low-emphasis link, then a deliberate confirmation with an acknowledgement (PM-3). */
export function PresenterEntry({ onEntered }: { onEntered: () => void }) {
  const active = useAppStore((s) => s.ui.presenterMode);
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  if (active) return <p className={styles.fine}>Presenter Mode is active. Use the banner to open the panel or exit.</p>;
  return (
    <>
      <button type="button" className={styles.entryLink} onClick={() => { setAck(false); setOpen(true); }}>
        Presenter tools…
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Enter Presenter Mode?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!ack} onClick={() => { enterPresenterMode(); setOpen(false); onEntered(); }}>Enter Presenter Mode</Button>
          </>
        }
      >
        <p>
          Presenter Mode lets you simulate verification review outcomes for this demo. Nothing is actually verified. Statuses changed here are
          labelled &lsquo;Simulated by presenter (demo)&rsquo; wherever they appear.
        </p>
        <label className={styles.check}>
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span>I understand these are simulated</span>
        </label>
      </Modal>
    </>
  );
}

type Pending = null | "undo" | "restore" | "reset";

/** S-04 Presenter Panel. Reachable only while Presenter Mode is active; otherwise redirects home. */
export function PresenterPanel() {
  const active = useAppStore((s) => s.ui.presenterMode);
  const data = useAppStore((s) => s.data);
  const override = useAppStore((s) => s.ui.presenterNowOverride);
  const now = useNow();
  const { toast } = useToast();
  const [propertyId, setPropertyId] = useState(data.properties[0]?.id ?? "");
  const [pending, setPending] = useState<Pending>(null);
  const [dateInput, setDateInput] = useState(override ? toISODate(new Date(override)) : "");
  const [choice, setChoice] = useState<Record<string, string>>({});

  if (!active) return <Navigate to="/" replace />;
  const property = data.properties.find((p) => p.id === propertyId) ?? data.properties[0];
  const eff = property ? getEffectiveVerification(property, data.verificationItems, now) : [];
  const log = data.presenter.simulationLog;

  const run = (r: SimResult, okTitle: string) => {
    if (!r.ok) return toast({ tone: "error", title: "Couldn't apply that", description: r.message });
    const c = commitSimulated(r.data);
    if (c.ok) toast({ tone: "success", title: okTitle, description: "Simulated only — nothing was verified." });
    else toast({ tone: "error", title: "Couldn't apply that", description: c.message });
  };

  const confirm = () => {
    if (pending === "undo") {
      const c = commitSimulated(undoAll(data));
      toast(c.ok ? { tone: "success", title: "All simulated changes undone" } : { tone: "error", title: "Couldn't undo", description: c.message });
    } else if (pending === "restore") {
      const c = commitSimulated(restoreSeededVerification(data, now));
      toast(c.ok ? { tone: "success", title: "Seeded verification state restored" } : { tone: "error", title: "Couldn't restore", description: c.message });
    }
    setPending(null);
  };

  return (
    <div className={`container ${styles.page}`}>
      <h1>Presenter Panel</h1>
      <p className={styles.warn}>
        Simulation tools for demonstrations. <strong>Nothing here is real verification</strong>: no document is read, and no person or property is checked.
        This is a local demo feature, not an administrative system, and hiding it is not a security boundary.
      </p>

      <section className={styles.card} aria-labelledby="pp-sim">
        <h2 id="pp-sim">Simulate a verification outcome</h2>
        <label className={styles.sel}>
          Property
          <select value={property?.id ?? ""} onChange={(e) => setPropertyId(e.target.value)}>
            {data.properties.map((p) => (
              <option key={p.id} value={p.id}>{p.title} — {LISTING_STATUS_LABEL[p.listingStatus]}</option>
            ))}
          </select>
        </label>
        <ul className={styles.rows}>
          {eff.map((e) => {
            const sel = choice[e.item.id] ?? SIM_STATUSES.find((s) => s !== e.item.status) ?? "pending_review";
            return (
              <li key={e.category} data-category={e.category} data-status={e.status}>
                <div className={styles.rowHead}>
                  <strong>{VERIFICATION_CATEGORY_LABEL[e.category]}</strong>
                  <Badge tone={VERIFICATION_STATUS_TONE[e.status]}>{VERIFICATION_STATUS_LABEL[e.status]}</Badge>
                  {e.item.source === "simulated_review" && <span className={styles.simTag}>Simulated</span>}
                </div>
                <div className={styles.controls}>
                  <label className={styles.sel}>
                    <span className="visually-hidden">New status for {VERIFICATION_CATEGORY_LABEL[e.category]}</span>
                    <select value={sel} onChange={(ev) => setChoice((c) => ({ ...c, [e.item.id]: ev.target.value }))}>
                      {SIM_STATUSES.map((s) => <option key={s} value={s}>{VERIFICATION_STATUS_LABEL[s]}</option>)}
                    </select>
                  </label>
                  <Button size="sm" variant="secondary" onClick={() => run(simulateVerification(data, e.item.id, sel as never, now), `${VERIFICATION_CATEGORY_LABEL[e.category]} set to ${VERIFICATION_STATUS_LABEL[sel as never]}`)}
                    aria-label={`Apply simulated status to ${VERIFICATION_CATEGORY_LABEL[e.category]}`}>
                    Apply
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
        {property && (
          <div className={styles.controls}>
            <span className={styles.lbl}>Age the availability confirmation:</span>
            {[7, 15, 20].map((d) => (
              <Button key={d} size="sm" variant="secondary" onClick={() => run(ageAvailability(data, property.id, d, now), `Availability confirmation set to ${d} days ago`)}>{d} days ago</Button>
            ))}
            {property.listingStatus === "pending_review" && (
              <Button size="sm" onClick={() => run(completeReview(data, property.id, now), "Review completed (simulated); the listing is now published")}>Simulate review completed</Button>
            )}
          </div>
        )}
      </section>

      <section className={styles.card} aria-labelledby="pp-log">
        <h2 id="pp-log">Simulation log</h2>
        {log.length === 0 ? <p className={styles.fine}>No simulated changes yet.</p> : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th scope="col">Time</th><th scope="col">Target</th><th scope="col">Field</th><th scope="col">From → to</th></tr></thead>
              <tbody>
                {log.map((e) => {
                  const p = data.properties.find((x) => x.id === e.target || data.verificationItems.find((i) => i.id === e.target)?.propertyId === x.id);
                  const item = data.verificationItems.find((i) => i.id === e.target);
                  return (
                    <tr key={e.id}>
                      <td>{formatDate(e.at)}</td>
                      <td>{p?.title ?? e.target}{item ? ` · ${VERIFICATION_CATEGORY_LABEL[item.category]}` : ""}</td>
                      <td>{e.field}</td>
                      <td>{e.field === "status" ? `${VERIFICATION_STATUS_LABEL[e.from as never] ?? e.from} → ${VERIFICATION_STATUS_LABEL[e.to as never] ?? e.to}` : `${e.from ?? "—"} → ${e.to ?? "—"}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.controls}>
          <Button variant="secondary" size="sm" onClick={() => setPending("undo")} disabled={log.length === 0}>Undo all simulated changes</Button>
          <Button variant="secondary" size="sm" onClick={() => setPending("restore")}>Restore seeded verification state</Button>
          <Button variant="destructive" size="sm" onClick={() => setPending("reset")}>Reset demo data</Button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="pp-date">
        <h2 id="pp-date">Simulated date (rehearsal)</h2>
        <p className={styles.fine}>Shows how the demo behaves on another day (for example, availability going stale). It changes only what this app displays — never your computer&apos;s clock — and is cleared when you exit or reset.</p>
        <div className={styles.controls}>
          <label className={styles.sel}>Date<input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} /></label>
          <Button size="sm" variant="secondary" disabled={!dateInput} onClick={() => { setSimulatedDate(dateInput); toast({ tone: "info", title: `Simulated date set to ${formatDate(dateInput)}` }); }}>Use simulated date</Button>
          <Button size="sm" variant="tertiary" disabled={!override} onClick={() => { setSimulatedDate(null); setDateInput(""); toast({ tone: "info", title: "Back to the real date" }); }}>Use real date</Button>
        </div>
      </section>

      <div>
        <Button variant="secondary" onClick={() => { exitPresenterMode(); toast({ tone: "info", title: "Presenter Mode exited", description: "Simulated statuses stay visible until you undo them or reset the demo." }); }}>Exit Presenter Mode</Button>
      </div>

      <ConfirmDialog open={pending === "undo" || pending === "restore"} title={pending === "undo" ? "Undo all simulated changes?" : "Restore seeded verification state?"}
        confirmLabel={pending === "undo" ? "Undo all simulated changes" : "Restore seeded state"} destructive onCancel={() => setPending(null)} onConfirm={confirm}>
        {pending === "undo" ? (
          <p>Every change in the simulation log is reverted to its previous value. Listings, requests, saved homes and profiles you created are not touched.</p>
        ) : (
          <p>Every sample listing&apos;s four verification checks and availability date return to their starting values, and your own listings&apos; checks return to what they were when you published. Real changes you made to those checks (such as re-confirming availability) are overwritten.</p>
        )}
      </ConfirmDialog>
      <ResetDemoDialog open={pending === "reset"} onClose={() => setPending(null)} />
    </div>
  );
}

