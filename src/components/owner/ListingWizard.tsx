import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Check, Plus, X } from "lucide-react";
import { AmenityChips } from "../search/choices";
import { AppImage } from "../ui/AppImage";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Combobox } from "../ui/Combobox";
import { Field } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { LOCALITIES } from "../../data/reference";
import { OWNER_IMAGE_POOL_IDS, resolveImage } from "../../data/images";
import { toISODate, addDays, startOfDay } from "../../domain/dates";
import { formatRupees } from "../../domain/format";
import { AMENITY_LABEL, FURNISHING_LABEL, LOCALITY_LABEL, PROPERTY_TYPE_LABEL } from "../../domain/labels";
import {
  EMPTY_LISTING,
  MAX_PHOTOS,
  WIZARD_STEPS,
  isSingleRoomType,
  propertyToForm,
  validateListing,
  validateListingStep,
  type ListingErrors,
  type ListingForm,
} from "../../domain/listing";
import { EDIT_STEPS } from "../../domain/ownerMutations";
import { FURNISHINGS, PROPERTY_TYPES } from "../../domain/search";
import { DEMO_OWNER_ID, type Furnishing, type LocalityId, type Property, type PropertyType } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import styles from "./ListingWizard.module.css";
import { useNow } from "../../store/useNow";

const EDIT_STEP_IDS: readonly number[] = [...EDIT_STEPS, 8];

/** Field → id used for focusing the first error. */
const FIELD_ORDER: (keyof ListingForm)[] = [
  "type", "title", "description", "locality", "addressArea", "landmark", "rent", "deposit", "maintenanceCharge", "availableFrom",
  "bedrooms", "bathrooms", "furnishing", "sizeSqft", "photoIds", "contactName", "contactPhone", "acknowledged",
];

export type WizardMode = { kind: "new" } | { kind: "edit"; property: Property };

/**
 * Add Property wizard (O-04) and Edit Listing (O-06), blueprint §7.4–7.5. Validation lives in the
 * shared `domain/listing` module; the store mutation validates again, so nothing invalid can be
 * published even if this UI is bypassed. Photos: only demo image slots (nothing is uploaded).
 */
export function ListingWizard({ mode }: { mode: WizardMode }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = mode.kind === "edit";
  const owner = useAppStore((s) => s.data.owners.find((o) => o.id === DEMO_OWNER_ID));
  const savedDraft = useAppStore((s) => s.ui.wizardDraft) as { step: number; form: ListingForm } | null;
  const now = useNow();
  const needContact = !isEdit && (!owner?.displayName || !owner?.phone);
  const ctx = useMemo(() => ({ today: now, needContact, keepAvailableFrom: isEdit ? mode.property.availableFrom : undefined }), [now, needContact, isEdit, mode]);

  const initial = useMemo<{ step: number; form: ListingForm }>(() => {
    if (isEdit) return { step: 1, form: propertyToForm(mode.property) };
    if (savedDraft && savedDraft.form) return { step: savedDraft.step, form: { ...EMPTY_LISTING, ...savedDraft.form } };
    return { step: 1, form: { ...EMPTY_LISTING, availableFrom: toISODate(startOfDay(now)) } };
    // Read the saved draft only once, when the wizard opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState<ListingForm>(initial.form);
  const [step, setStep] = useState(initial.step);
  const [maxStep, setMaxStep] = useState(initial.step);
  const [errors, setErrors] = useState<ListingErrors>({});
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const dirty = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const stepIds = isEdit ? EDIT_STEP_IDS : WIZARD_STEPS.map((s) => s.id);
  const stepLabel = (id: number) => (isEdit && id === 8 ? "Review & save" : (WIZARD_STEPS.find((s) => s.id === id)?.label ?? ""));
  const position = stepIds.indexOf(step) + 1;
  const isLast = step === 8;

  // Persist the working copy so a refresh does not lose it (new listings only).
  useEffect(() => {
    if (!isEdit) appStore.getState().setWizardDraft({ step, form });
  }, [form, step, isEdit]);

  const patch = (p: Partial<ListingForm>) => {
    dirty.current = true;
    setForm((f) => ({ ...f, ...p }));
    const touched = Object.keys(p) as (keyof ListingForm)[];
    if (touched.some((k) => errors[k])) setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !touched.includes(k as keyof ListingForm))) as ListingErrors);
  };

  const focusFirst = (errs: ListingErrors) => {
    const first = FIELD_ORDER.find((k) => errs[k]);
    if (!first) return;
    setTimeout(() => (document.getElementById(`lw-${first}`) ?? document.querySelector(`[data-field="${first}"]`))?.scrollIntoView?.({ block: "center" }), 0);
    setTimeout(() => ((document.getElementById(`lw-${first}`) ?? document.querySelector(`[data-field="${first}"] input`)) as HTMLElement | null)?.focus(), 30);
  };

  const goTo = (id: number) => {
    setStep(id);
    setMaxStep((m) => Math.max(m, id));
    setBanner(null);
    setTimeout(() => headingRef.current?.focus(), 0);
  };

  const next = () => {
    const e = validateListingStep(step, form, ctx);
    if (Object.keys(e).length > 0) {
      setErrors(e);
      setFailed((s) => new Set(s).add(step));
      focusFirst(e);
      return;
    }
    setErrors({});
    setFailed((s) => {
      const n = new Set(s);
      n.delete(step);
      return n;
    });
    const idx = stepIds.indexOf(step);
    goTo(stepIds[idx + 1] ?? step);
  };

  const back = () => {
    const idx = stepIds.indexOf(step);
    if (idx > 0) goTo(stepIds[idx - 1] ?? step);
  };

  const finish = () => {
    setBanner(null);
    const check = validateListing(form, ctx, isEdit ? EDIT_STEP_IDS.filter((s) => s !== 8) : stepIds);
    // The acknowledgement and contact fields live on step 8 in new mode
    const reviewErrors = isEdit ? {} : validateListingStep(8, form, ctx);
    const all = { ...check.errors, ...reviewErrors };
    if (Object.keys(all).length > 0) {
      setErrors(all);
      const bad = new Set<number>();
      for (const id of stepIds) if (Object.keys(id === 8 ? reviewErrors : validateListingStep(id, form, ctx)).length > 0) bad.add(id);
      setFailed(bad);
      const target = check.firstInvalidStep ?? 8;
      goTo(target);
      focusFirst(all);
      setBanner("Some details need attention before you can continue.");
      return;
    }
    if (isEdit) {
      const r = appStore.getState().updateProperty(mode.property.id, form);
      if (!r.ok) return fail(r);
      toast({ tone: "success", title: r.changed ? "Changes saved" : "No changes to save", description: r.changed ? "Tenants see the updated listing straight away (demo)." : undefined });
      dirty.current = false;
      navigate(`/owner/properties/${mode.property.id}`);
    } else {
      const r = appStore.getState().publishProperty(form);
      if (!r.ok) return fail(r);
      dirty.current = false;
      navigate(`/owner/properties/${r.property.id}`, { state: { published: true } });
    }
  };

  const fail = (r: { ok: false; code: string; message: string; errors?: ListingErrors; firstInvalidStep?: number }) => {
    if (r.code === "invalid" && r.errors && r.firstInvalidStep) {
      setErrors(r.errors);
      goTo(r.firstInvalidStep);
      focusFirst(r.errors);
      setBanner(r.message);
      return;
    }
    setBanner(r.message);
  };

  const cancel = () => {
    if (dirty.current) {
      setConfirmLeave(true);
      return;
    }
    leave();
  };
  const leave = () => {
    if (!isEdit) appStore.getState().setWizardDraft(null);
    navigate(isEdit ? `/owner/properties/${mode.property.id}` : "/owner/properties");
  };

  const err = (k: keyof ListingForm) => errors[k];

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 ref={headingRef} tabIndex={-1}>{isEdit ? `Edit listing` : "Add a demo property"}</h1>
        <p className={styles.sub}>{isEdit ? mode.property.title : "Everything you enter here is demonstration data. Nothing is verified or sent to anyone."}</p>
      </header>

      <nav aria-label="Listing steps" className={styles.stepper}>
        <p className={styles.mobileStep} aria-hidden="true">Step {position} of {stepIds.length} · {stepLabel(step)}</p>
        <ol>
          {stepIds.map((id, i) => {
            const state = id === step ? "current" : failed.has(id) ? "error" : id < step || id <= maxStep ? "done" : "todo";
            const reachable = id <= maxStep;
            return (
              <li key={id} className={`${styles.step} ${styles[state]}`}>
                <button type="button" disabled={!reachable} aria-current={id === step ? "step" : undefined} onClick={() => goTo(id)}>
                  <span className={styles.dot} aria-hidden="true">{state === "done" ? <Check size={14} /> : state === "error" ? "!" : i + 1}</span>
                  <span className={styles.stepLabel}>{stepLabel(id)}</span>
                  {state === "error" && <span className="visually-hidden"> (needs attention)</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {banner && (
        <div className={styles.banner} role="alert">
          {banner}
        </div>
      )}

      <form className={styles.body} noValidate onSubmit={(e) => { e.preventDefault(); if (isLast) finish(); else next(); }}>
        {step === 1 && (
          <section aria-labelledby="s1" className={styles.section}>
            <h2 id="s1">Basic information</h2>
            <Field id="lw-type" label="Property type" required error={err("type")}>
              {(a) => (
                <select {...a} value={form.type} onChange={(e) => {
                  const type = e.target.value as PropertyType | "";
                  patch({ type, ...(isSingleRoomType(type) ? { bedrooms: "1" } : {}) });
                }}>
                  <option value="">Choose a type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</option>)}
                </select>
              )}
            </Field>
            <Field id="lw-title" label="Title" required help="10–80 characters, for example “Sunny 2 BHK, Bani Park”." error={err("title")}>
              {(a) => <input {...a} value={form.title} maxLength={120} onChange={(e) => patch({ title: e.target.value })} />}
            </Field>
            <Field id="lw-description" label="Description" required help={`${form.description.trim().length}/1000 · Don't include phone numbers or emails.`} error={err("description")}>
              {(a) => <textarea {...a} rows={5} value={form.description} onChange={(e) => patch({ description: e.target.value })} />}
            </Field>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="s2" className={styles.section}>
            <h2 id="s2">Location</h2>
            <div data-field="locality">
              <Combobox label="Locality (required)" placeholder="Choose a locality" value={form.locality || null}
                options={LOCALITIES.map((l) => ({ value: l.id, label: l.name }))} error={err("locality")}
                onChange={(v) => patch({ locality: (v ?? "") as LocalityId | "" })} />
            </div>
            <Field id="lw-addressArea" label="Address area" required help="Don't enter a house number or exact address in the prototype." error={err("addressArea")}>
              {(a) => <input {...a} value={form.addressArea} onChange={(e) => patch({ addressArea: e.target.value })} />}
            </Field>
            <Field id="lw-landmark" label="Neighbourhood or landmark (optional)" error={err("landmark")}>
              {(a) => <input {...a} value={form.landmark} onChange={(e) => patch({ landmark: e.target.value })} />}
            </Field>
            <p className={styles.note}>Tenants see the locality and address area only. A position is assigned automatically and is always approximate; a map preview is not available yet.</p>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="s3" className={styles.section}>
            <h2 id="s3">Rental details</h2>
            <div className={styles.row}>
              <Field id="lw-rent" label="Monthly rent (₹)" required help="₹1,000 to ₹3,00,000." error={err("rent")}>
                {(a) => <input {...a} inputMode="numeric" value={form.rent} onChange={(e) => patch({ rent: e.target.value.replace(/\D/g, "") })} />}
              </Field>
              <Field id="lw-deposit" label="Deposit (₹)" required help="Up to 12 times the rent." error={err("deposit")}>
                {(a) => <input {...a} inputMode="numeric" value={form.deposit} onChange={(e) => patch({ deposit: e.target.value.replace(/\D/g, "") })} />}
              </Field>
            </div>
            {form.rent && !form.deposit && (
              <Button type="button" variant="tertiary" size="sm" onClick={() => patch({ deposit: String(parseInt(form.rent, 10) * 2) })}>
                Use 2× rent ({formatRupees(parseInt(form.rent, 10) * 2)})
              </Button>
            )}
            <label className={styles.check}>
              <input type="checkbox" checked={form.maintenanceIncluded} onChange={(e) => patch({ maintenanceIncluded: e.target.checked })} />
              <span>Maintenance is included in the rent</span>
            </label>
            {!form.maintenanceIncluded && (
              <Field id="lw-maintenanceCharge" label="Maintenance charge per month (₹, optional)" error={err("maintenanceCharge")}>
                {(a) => <input {...a} inputMode="numeric" value={form.maintenanceCharge} onChange={(e) => patch({ maintenanceCharge: e.target.value.replace(/\D/g, "") })} />}
              </Field>
            )}
            <Field id="lw-availableFrom" label="Available from" required help="Today up to 180 days ahead." error={err("availableFrom")}>
              {(a) => (
                <input {...a} type="date" min={toISODate(startOfDay(now))} max={toISODate(addDays(startOfDay(now), 180))}
                  value={form.availableFrom} onChange={(e) => patch({ availableFrom: e.target.value })} />
              )}
            </Field>
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="s4" className={styles.section}>
            <h2 id="s4">Property specifications</h2>
            <div className={styles.row}>
              <Field id="lw-bedrooms" label="Rooms / bedrooms" required help={isSingleRoomType(form.type) ? "Studios and single rooms are always one room." : undefined} error={err("bedrooms")}>
                {(a) => (
                  <select {...a} value={form.bedrooms} disabled={isSingleRoomType(form.type)} onChange={(e) => patch({ bedrooms: e.target.value })}>
                    <option value="">Choose</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </Field>
              <Field id="lw-bathrooms" label="Bathrooms" required error={err("bathrooms")}>
                {(a) => (
                  <select {...a} value={form.bathrooms} onChange={(e) => patch({ bathrooms: e.target.value })}>
                    <option value="">Choose</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <Field id="lw-furnishing" label="Furnishing" required error={err("furnishing")}>
              {(a) => (
                <select {...a} value={form.furnishing} onChange={(e) => patch({ furnishing: e.target.value as Furnishing | "" })}>
                  <option value="">Choose</option>
                  {FURNISHINGS.map((f) => <option key={f} value={f}>{FURNISHING_LABEL[f]}</option>)}
                </select>
              )}
            </Field>
            <Field id="lw-sizeSqft" label="Size in sq ft (optional)" error={err("sizeSqft")}>
              {(a) => <input {...a} inputMode="numeric" value={form.sizeSqft} onChange={(e) => patch({ sizeSqft: e.target.value.replace(/\D/g, "") })} />}
            </Field>
          </section>
        )}

        {step === 5 && (
          <section aria-labelledby="s5" className={styles.section}>
            <h2 id="s5">Amenities</h2>
            <p className={styles.note}>Optional. Tenants can filter on these.</p>
            <AmenityChips value={form.amenities} onChange={(amenities) => patch({ amenities })} />
          </section>
        )}

        {step === 6 && (
          <PhotoStep form={form} error={err("photoIds")} onChange={(photoIds) => patch({ photoIds })} />
        )}

        {step === 7 && (
          <section aria-labelledby="s7" className={styles.section}>
            <h2 id="s7">Verification information</h2>
            <p className={styles.demoBox}>Demonstration only. No documents are collected, uploaded or checked, and nothing here is verified by anyone.</p>
            <p>In a real product, each of these would need separate proof. In this prototype you can only mark a <strong>sample document (demo)</strong> as attached, which moves that check to <em>Pending review</em> — never to a verified status.</p>
            <ul className={styles.vlist}>
              <li>
                <div><strong>Owner identity</strong><span>A real product would need identity proof of the owner.</span></div>
                <label className={styles.check}><input type="checkbox" checked={form.sampleIdentity} onChange={(e) => patch({ sampleIdentity: e.target.checked })} /><span>Attach sample document (demo)</span></label>
                <span className={styles.result}>{form.sampleIdentity ? "Will show: Pending review" : "Will show: Not yet checked"}</span>
              </li>
              <li>
                <div><strong>Authority to list</strong><span>A real product would need proof of ownership or authorisation to rent.</span></div>
                <label className={styles.check}><input type="checkbox" checked={form.sampleAuthority} onChange={(e) => patch({ sampleAuthority: e.target.checked })} /><span>Attach sample document (demo)</span></label>
                <span className={styles.result}>{form.sampleAuthority ? "Will show: Pending review" : "Will show: Not yet checked"}</span>
              </li>
              <li>
                <div><strong>Listing accuracy</strong><span>Photos and details would be compared with the property.</span></div>
                <span className={styles.result}>Will show: Pending review</span>
              </li>
              <li>
                <div><strong>Availability freshness</strong><span>You confirm the home is available today.</span></div>
                <span className={styles.result}>Will show: Verified (demo), owner-confirmed today</span>
              </li>
            </ul>
          </section>
        )}

        {step === 8 && (
          <section aria-labelledby="s8" className={styles.section}>
            <h2 id="s8">{isEdit ? "Review and save" : "Review and publish"}</h2>
            {Object.keys(errors).length > 0 && (
              <div className={styles.banner} role="alert">
                <p>Please fix these before continuing:</p>
                <ul>
                  {Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}
                </ul>
              </div>
            )}
            <ReviewBlock title="Basic information" step={1} onEdit={goTo} rows={[["Type", form.type ? PROPERTY_TYPE_LABEL[form.type] : "—"], ["Title", form.title.trim() || "—"], ["Description", form.description.trim() || "—"]]} />
            <ReviewBlock title="Location" step={2} onEdit={goTo} rows={[["Locality", form.locality ? LOCALITY_LABEL[form.locality] : "—"], ["Address area", form.addressArea.trim() || "—"], ["Landmark", form.landmark.trim() || "—"]]} />
            <ReviewBlock title="Rental details" step={3} onEdit={goTo} rows={[["Monthly rent", form.rent ? formatRupees(parseInt(form.rent, 10)) : "—"], ["Deposit", form.deposit ? formatRupees(parseInt(form.deposit, 10)) : "—"], ["Maintenance", form.maintenanceIncluded || !form.maintenanceCharge ? "Included in rent" : `${formatRupees(parseInt(form.maintenanceCharge, 10))} / month`], ["Available from", form.availableFrom || "—"]]} />
            <ReviewBlock title="Specifications" step={4} onEdit={goTo} rows={[["Rooms", form.bedrooms || "—"], ["Bathrooms", form.bathrooms || "—"], ["Furnishing", form.furnishing ? FURNISHING_LABEL[form.furnishing] : "—"], ["Size", form.sizeSqft ? `${form.sizeSqft} sq ft` : "—"]]} />
            <ReviewBlock title="Amenities" step={5} onEdit={goTo} rows={[["Selected", form.amenities.length ? form.amenities.map((a) => AMENITY_LABEL[a]).join(", ") : "None"]]} />
            <ReviewBlock title="Photographs" step={6} onEdit={goTo} rows={[["Demo images", `${form.photoIds.length} selected (cover first)`]]} />
            {!isEdit && (
              <>
                <ReviewBlock title="Verification (demo)" step={7} onEdit={goTo} rows={[["Owner identity", form.sampleIdentity ? "Pending review" : "Not yet checked"], ["Authority to list", form.sampleAuthority ? "Pending review" : "Not yet checked"], ["Listing accuracy", "Pending review"], ["Availability", "Verified (demo), owner-confirmed today"]]} />
                {needContact && (
                  <div className={styles.contact}>
                    <h3>Your contact details (demo)</h3>
                    <p className={styles.note}>Asked once, only because you are publishing. Use sample details — owner contact details are never shown to tenants in this prototype.</p>
                    <div className={styles.row}>
                      <Field id="lw-contactName" label="Your name" required error={err("contactName")}>
                        {(a) => <input {...a} autoComplete="name" value={form.contactName} onChange={(e) => patch({ contactName: e.target.value })} />}
                      </Field>
                      <Field id="lw-contactPhone" label="Phone number" required help="10-digit mobile number. No OTP, no SMS." error={err("contactPhone")}>
                        {(a) => <input {...a} type="tel" inputMode="tel" autoComplete="tel" value={form.contactPhone} onChange={(e) => patch({ contactPhone: e.target.value })} />}
                      </Field>
                    </div>
                  </div>
                )}
                <div className={styles.ack}>
                  <label className={styles.check}>
                    <input id="lw-acknowledged" type="checkbox" checked={form.acknowledged} aria-invalid={err("acknowledged") ? true : undefined} onChange={(e) => patch({ acknowledged: e.target.checked })} />
                    <span>I understand this is a demo listing and no real verification will occur.</span>
                  </label>
                  {err("acknowledged") && <p role="alert" className={styles.err}>{err("acknowledged")}</p>}
                </div>
              </>
            )}
          </section>
        )}
      </form>

      <div className={styles.footer}>
        <Button type="button" variant="tertiary" onClick={cancel}>Cancel</Button>
        <div className={styles.footerRight}>
          <Button type="button" variant="secondary" onClick={back} disabled={position <= 1}>Back</Button>
          {isLast ? (
            <Button type="button" onClick={finish}>{isEdit ? "Save changes" : "Publish demo listing"}</Button>
          ) : (
            <Button type="button" onClick={next}>Next</Button>
          )}
          {isEdit && !isLast && <Button type="button" variant="secondary" onClick={finish}>Save changes</Button>}
        </div>
      </div>

      <ConfirmDialog open={confirmLeave} title="Leave without saving?" confirmLabel="Leave and discard" cancelLabel="Keep editing" destructive onCancel={() => setConfirmLeave(false)} onConfirm={() => { setConfirmLeave(false); leave(); }}>
        <p>{isEdit ? "Your edits to this listing will be lost." : "Your draft listing will be discarded. Nothing has been published."}</p>
      </ConfirmDialog>
      <p className="visually-hidden" aria-live="polite">Step {position} of {stepIds.length}: {stepLabel(step)}</p>
      <p className={styles.fine}><Link to="/trust">How trust works</Link></p>
    </div>
  );
}

function ReviewBlock({ title, step, rows, onEdit }: { title: string; step: number; rows: [string, string][]; onEdit: (s: number) => void }) {
  return (
    <div className={styles.review}>
      <div className={styles.reviewHead}>
        <h3>{title}</h3>
        <Button type="button" variant="tertiary" size="sm" onClick={() => onEdit(step)} aria-label={`Edit ${title}`}>Edit</Button>
      </div>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

function PhotoStep({ form, error, onChange }: { form: ListingForm; error?: string; onChange: (ids: string[]) => void }) {
  const anyReal = OWNER_IMAGE_POOL_IDS.some((id) => resolveImage(id));
  const allReal = OWNER_IMAGE_POOL_IDS.every((id) => resolveImage(id));
  const selected = form.photoIds;
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else if (selected.length < MAX_PHOTOS) onChange([...selected, id]);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= selected.length) return;
    const copy = [...selected];
    [copy[i], copy[j]] = [copy[j] as string, copy[i] as string];
    onChange(copy);
  };
  return (
    <section aria-labelledby="s6" className={styles.section}>
      <h2 id="s6">Photographs</h2>
      <p className={styles.note}>Demo images only. Nothing is uploaded. Choose 1 to {MAX_PHOTOS}; the first is the cover.</p>
      {!anyReal && (
        <p className={styles.demoBox}>The licensed demo images haven&apos;t been added to this build yet, so each slot shows a placeholder. Your choice is still saved and will show the real image once images are added.</p>
      )}
      {anyReal && !allReal && (
        <p className={styles.demoBox}>Only some licensed demo images have been added to this build so far; the other slots show a placeholder. Your choice is still saved and will show the real image once it is added.</p>
      )}
      <div id="lw-photoIds" tabIndex={-1} className={styles.pool} role="group" aria-label="Demo image slots">
        {OWNER_IMAGE_POOL_IDS.map((id, i) => {
          const on = selected.includes(id);
          const img = resolveImage(id);
          return (
            <button key={id} type="button" className={`${styles.tile} ${on ? styles.tileOn : ""}`} aria-pressed={on} onClick={() => toggle(id)} disabled={!on && selected.length >= MAX_PHOTOS}>
              <AppImage src={img?.src} alt="" focus={img?.focus} badge compact />
              <span className={styles.tileMark} aria-hidden="true">{on ? <Check size={14} /> : <Plus size={14} />}</span>
              <span className={styles.tileNum}><span className="visually-hidden">Demo image</span>{" "}{i + 1}</span>
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className={styles.err}>{error}</p>}
      <h3>Selected ({selected.length}/{MAX_PHOTOS})</h3>
      {selected.length === 0 ? (
        <p className={styles.note}>No images selected yet.</p>
      ) : (
        <ol className={styles.chosen}>
          {selected.map((id, i) => {
            const n = OWNER_IMAGE_POOL_IDS.indexOf(id) + 1;
            return (
              <li key={id}>
                <span>{i === 0 ? "Cover · " : ""}Demo image {n}</span>
                <span className={styles.chosenBtns}>
                  <Button type="button" variant="secondary" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move demo image ${n} up`}><ArrowUp size={16} aria-hidden="true" /></Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => move(i, 1)} disabled={i === selected.length - 1} aria-label={`Move demo image ${n} down`}><ArrowDown size={16} aria-hidden="true" /></Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => toggle(id)} aria-label={`Remove demo image ${n}`}><X size={16} aria-hidden="true" /></Button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
