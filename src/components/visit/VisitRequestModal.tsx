import {useEffect, useRef, useState} from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Modal } from "../ui/Modal";
import { addDays, startOfDay, toISODate } from "../../domain/dates";
import { formatDate, formatPhone, formatRupees } from "../../domain/format";
import { LOCALITY_LABEL, REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE, SLOT_LABEL } from "../../domain/labels";
import { DEMO_TENANT_ID, type Property, type TimeSlot } from "../../domain/types";
import { VISIT_FIELD_ORDER, validateVisitForm, type FieldErrors, type VisitFieldKey, type VisitFormValues } from "../../domain/validators";
import { TIME_SLOTS } from "../../data/reference";
import { appStore, useAppStore } from "../../store/store";
import styles from "./VisitRequestModal.module.css";
import { useNow } from "../../store/useNow";

type View = "form" | "review" | "success";

const MESSAGE_MAX = 300;

export interface VisitRequestModalProps {
  open: boolean;
  onClose: () => void;
  property: Property;
}

interface Values extends VisitFormValues {
  share: boolean;
}

const EMPTY: Values = { name: "", phone: "", date: "", slot: "", message: "", share: false };

/**
 * T-04 / T-05 — Request a Visit. One modal, three views: Form → Review → Success (§6.6).
 * Success is rendered only after the request exists in the shared store AND was written; every
 * refusal (invalid, unavailable, duplicate, storage failure) shows an error and creates nothing.
 * No OTP, no SMS, no notification — this is a prototype record.
 */
export function VisitRequestModal({ open, onClose, property }: VisitRequestModalProps) {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.data.tenants.find((t) => t.id === DEMO_TENANT_ID) ?? null);
  const now = useNow();
  const minDate = toISODate(startOfDay(now));
  const maxDate = toISODate(addDays(startOfDay(now), 30));

  const [view, setView] = useState<View>("form");
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<VisitFieldKey, boolean>>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [blocking, setBlocking] = useState<{ message: string; existing: boolean } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initial = useRef<Values>(EMPTY);

  // Fresh form each time the modal opens, prefilled from the saved profile. The consent box is
  // always unchecked on open (founder decision D7).
  useEffect(() => {
    if (!open) return;
    const start: Values = { ...EMPTY, name: profile?.name ?? "", phone: profile?.phone ?? "" };
    initial.current = start;
    setValues(start);
    setTouched({});
    setErrors({});
    setBlocking(null);
    setCreatedId(null);
    setView("form");
    setConfirmDiscard(false);
    // Only on open: later profile changes must not overwrite what the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const created = useAppStore((s) => (createdId ? (s.data.visitRequests.find((r) => r.id === createdId) ?? null) : null));
  const dirty = (Object.keys(values) as (keyof Values)[]).some((k) => values[k] !== initial.current[k]);

  const validate = (v: Values) => validateVisitForm(v, now);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (key !== "share" && touched[key as VisitFieldKey]) {
      const r = validate(next);
      setErrors(r.ok ? {} : r.errors);
    }
  };
  const blur = (key: VisitFieldKey) => {
    setTouched((t) => ({ ...t, [key]: true }));
    const r = validate(values);
    setErrors(r.ok ? {} : r.errors);
  };
  const fieldId = (k: VisitFieldKey) => (k === "slot" ? "visit-slot-morning" : `visit-${k}`);
  const focusFirst = (errs: FieldErrors) => {
    const first = VISIT_FIELD_ORDER.find((k) => errs[k]);
    if (first) document.getElementById(fieldId(first))?.focus();
  };

  const requestClose = () => {
    if (view !== "success" && dirty) setConfirmDiscard(true);
    else onClose();
  };

  const toReview = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true, date: true, slot: true, message: true });
    const r = validate(values);
    if (!r.ok) {
      setErrors(r.errors);
      focusFirst(r.errors);
      return;
    }
    setErrors({});
    setBlocking(null);
    setView("review");
  };

  const submit = () => {
    setBlocking(null);
    const r = appStore.getState().createVisitRequest({
      propertyId: property.id,
      name: values.name,
      phone: values.phone,
      date: values.date,
      slot: values.slot,
      message: values.message,
      sharePhoneWithOwner: values.share,
    });
    if (r.ok) {
      setCreatedId(r.request.id);
      setView("success");
      return;
    }
    if (r.code === "invalid") {
      setErrors(r.errors);
      setView("form");
      setTimeout(() => focusFirst(r.errors), 0);
      return;
    }
    setBlocking({ message: r.message, existing: r.code === "duplicate" });
  };

  const err = (k: VisitFieldKey) => (touched[k] ? errors[k] : undefined);
  const describe = (k: VisitFieldKey, extra?: string) => [err(k) ? `visit-${k}-err` : null, extra ?? null].filter(Boolean).join(" ") || undefined;

  const slotLabel = values.slot ? SLOT_LABEL[values.slot as TimeSlot] : "";
  const checked = validate(values);

  return (
    <>
      <Modal
        open={open}
        onClose={requestClose}
        title={view === "success" ? "Request created" : view === "review" ? "Review your request" : "Request a visit"}
        footer={
          view === "form" ? (
            <>
              <Button variant="secondary" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="submit" form="visit-form">
                Review request
              </Button>
            </>
          ) : view === "review" ? (
            <>
              <Button variant="secondary" onClick={() => setView("form")}>
                Edit
              </Button>
              <Button onClick={submit} disabled={blocking !== null && !blocking.existing}>
                Submit request
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="tertiary"
                onClick={() => {
                  onClose();
                  navigate("/tenant/search");
                }}
              >
                Keep searching
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Back to property
              </Button>
              <Button
                onClick={() => {
                  onClose();
                  navigate("/tenant/dashboard/requests");
                }}
              >
                View my visit requests
              </Button>
            </>
          )
        }
      >
        <div className={styles.summary}>
          <div>
            <p className={styles.sumTitle}>{property.title}</p>
            <p className={styles.sumMeta}>
              {LOCALITY_LABEL[property.locality]} · {formatRupees(property.rent)} / month
            </p>
          </div>
          <span className={styles.demo}>Demo</span>
        </div>

        {view === "form" && (
          <form id="visit-form" className={styles.form} onSubmit={toReview} noValidate>
            <p className={styles.demoNote}>Use sample details — this is a demo. Nothing is sent to a real landlord.</p>

            <div className={styles.field}>
              <label htmlFor="visit-name">
                Full name <span aria-hidden="true">*</span>
              </label>
              <input
                id="visit-name"
                autoComplete="name"
                value={values.name}
                aria-required="true"
                aria-invalid={err("name") ? true : undefined}
                aria-describedby={describe("name")}
                onChange={(e) => set("name", e.target.value)}
                onBlur={() => blur("name")}
              />
              {err("name") && (
                <p id="visit-name-err" role="alert" className={styles.error}>
                  {err("name")}
                </p>
              )}
            </div>

            <div className={styles.field}>
              <label htmlFor="visit-phone">
                Phone number <span aria-hidden="true">*</span>
              </label>
              <input
                id="visit-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile number"
                value={values.phone}
                aria-required="true"
                aria-invalid={err("phone") ? true : undefined}
                aria-describedby={describe("phone", "visit-phone-help")}
                onChange={(e) => set("phone", e.target.value)}
                onBlur={() => blur("phone")}
              />
              <p id="visit-phone-help" className={styles.help}>
                Used only inside this prototype. No SMS will be sent and no code is needed.
              </p>
              {err("phone") && (
                <p id="visit-phone-err" role="alert" className={styles.error}>
                  {err("phone")}
                </p>
              )}
            </div>

            <div className={styles.consent}>
              <label className={styles.check}>
                <input type="checkbox" id="visit-share" checked={values.share} onChange={(e) => set("share", e.target.checked)} />
                <span>Share my phone number with the owner (optional)</span>
              </label>
              <p className={styles.help}>Unchecked by default. If you leave it unchecked, the owner will not see your number.</p>
            </div>

            <div className={styles.field}>
              <label htmlFor="visit-date">
                Preferred date <span aria-hidden="true">*</span>
              </label>
              <input
                id="visit-date"
                type="date"
                min={minDate}
                max={maxDate}
                value={values.date}
                aria-required="true"
                aria-invalid={err("date") ? true : undefined}
                aria-describedby={describe("date")}
                onChange={(e) => set("date", e.target.value)}
                onBlur={() => blur("date")}
              />
              {err("date") && (
                <p id="visit-date-err" role="alert" className={styles.error}>
                  {err("date")}
                </p>
              )}
            </div>

            <fieldset className={styles.slots} aria-describedby={err("slot") ? "visit-slot-err" : undefined}>
              <legend>
                Preferred time slot <span aria-hidden="true">*</span>
              </legend>
              {TIME_SLOTS.map((s) => (
                <label key={s} className={styles.radio}>
                  <input type="radio" name="visit-slot" id={`visit-slot-${s}`} checked={values.slot === s} onChange={() => set("slot", s)} onBlur={() => blur("slot")} />
                  <span>{SLOT_LABEL[s]}</span>
                </label>
              ))}
              {err("slot") && (
                <p id="visit-slot-err" role="alert" className={styles.error}>
                  {err("slot")}
                </p>
              )}
            </fieldset>

            <div className={styles.field}>
              <label htmlFor="visit-message">Message to the owner (optional)</label>
              <textarea
                id="visit-message"
                rows={3}
                value={values.message}
                aria-invalid={err("message") ? true : undefined}
                aria-describedby={describe("message", "visit-message-count")}
                onChange={(e) => set("message", e.target.value)}
                onBlur={() => blur("message")}
              />
              <p id="visit-message-count" className={styles.help}>
                {values.message.length}/{MESSAGE_MAX}
              </p>
              {err("message") && (
                <p id="visit-message-err" role="alert" className={styles.error}>
                  {err("message")}
                </p>
              )}
            </div>
          </form>
        )}

        {view === "review" && (
          <div className={styles.review}>
            {blocking && (
              <div className={styles.blocking} role="alert">
                <p>{blocking.message}</p>
                {blocking.existing && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onClose();
                      navigate("/tenant/dashboard/requests");
                    }}
                  >
                    View request
                  </Button>
                )}
              </div>
            )}
            <dl className={styles.dl}>
              <div>
                <dt>Preferred visit</dt>
                <dd>
                  {values.date ? formatDate(values.date) : ""}, {slotLabel}
                </dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>{values.name.trim()}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{checked.ok ? formatPhone(checked.value.phone) : values.phone}</dd>
              </div>
              <div>
                <dt>Share phone with owner</dt>
                <dd>{values.share ? "Yes — you agreed to share it" : "No — the owner will not see it"}</dd>
              </div>
              <div>
                <dt>Message</dt>
                <dd>{values.message.trim() || "—"}</dd>
              </div>
            </dl>
            <p className={styles.protoNote}>Prototype request — no real visit is booked with a real landlord.</p>
          </div>
        )}

        {view === "success" && created && (
          <div className={styles.success}>
            <p className={styles.ok}>
              <CircleCheck size={22} aria-hidden="true" /> Request created
            </p>
            <p className={styles.id}>
              Request ID <strong data-testid="request-id">{created.displayCode}</strong>
            </p>
            <dl className={styles.dl}>
              <div>
                <dt>Preferred visit</dt>
                <dd>
                  {formatDate(created.preferredDate)}, {SLOT_LABEL[created.preferredSlot]}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <Badge tone={REQUEST_STATUS_TONE[created.status]}>{REQUEST_STATUS_LABEL[created.status]}</Badge>
                </dd>
              </div>
            </dl>
            <p className={styles.protoNote}>
              This is a prototype request. It is now visible in your Tenant Dashboard and in the Owner&apos;s dashboard in this demo. No real
              visit has been booked and no notification was sent.
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this request?"
        confirmLabel="Discard request"
        destructive
        cancelLabel="Keep editing"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      >
        <p>What you entered will be lost and no request will be created.</p>
      </ConfirmDialog>
    </>
  );
}
