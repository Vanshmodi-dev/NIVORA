import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { useToast } from "../../components/ui/Toast";
import { validateProfile } from "../../domain/validators";
import { DEMO_TENANT_ID } from "../../domain/types";
import { appStore, useAppStore } from "../../store/store";
import styles from "./dashboard.module.css";

/** T-09 Profile — the details used to prefill visit requests. Both fields stay empty until needed. */
export function ProfilePage() {
  const profile = useAppStore((s) => s.data.tenants.find((t) => t.id === DEMO_TENANT_ID) ?? null);
  const { toast } = useToast();
  const [name, setName] = useState(profile?.name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [confirmClear, setConfirmClear] = useState(false);

  // Follow store changes (reset, other tab) without clobbering edits in progress when values match.
  useEffect(() => {
    setName(profile?.name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile?.name, profile?.phone]);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateProfile({ name, phone });
    if (!check.ok) {
      setErrors(check.errors);
      document.getElementById(check.errors.name ? "profile-name" : "profile-phone")?.focus();
      return;
    }
    setErrors({});
    const r = appStore.getState().saveTenantProfile({ name, phone });
    if (r.ok) toast({ tone: "success", title: "Profile saved in this browser" });
    else toast({ tone: "error", title: "Couldn't save your profile", description: "message" in r ? r.message : undefined });
  };

  const clear = () => {
    setConfirmClear(false);
    const r = appStore.getState().clearTenantProfile();
    if (r.ok) toast({ tone: "success", title: "Your details were cleared" });
    else toast({ tone: "error", title: "Couldn't clear your details", description: r.message });
  };

  return (
    <section aria-labelledby="profile-title">
      <h2 id="profile-title">Your details</h2>
      <p className={styles.muted} style={{ margin: "8px 0 20px", maxWidth: "60ch" }}>
        Stored only in this browser for the demo. They are used to fill in visit requests. Sharing your phone number with an owner is always your choice, request by request.
      </p>
      <form className={styles.form} onSubmit={save} noValidate>
        <div className={styles.field}>
          <label htmlFor="profile-name">Full name</label>
          <input id="profile-name" autoComplete="name" value={name} aria-invalid={errors.name ? true : undefined} aria-describedby={errors.name ? "profile-name-err" : undefined} onChange={(e) => setName(e.target.value)} />
          {errors.name && (
            <p id="profile-name-err" role="alert" className={styles.error}>
              {errors.name}
            </p>
          )}
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-phone">Phone number</label>
          <input id="profile-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} aria-invalid={errors.phone ? true : undefined} aria-describedby={errors.phone ? "profile-phone-err" : "profile-phone-help"} onChange={(e) => setPhone(e.target.value)} />
          <p id="profile-phone-help" className={styles.help}>
            Use sample details — this is a demo. No SMS will be sent.
          </p>
          {errors.phone && (
            <p id="profile-phone-err" role="alert" className={styles.error}>
              {errors.phone}
            </p>
          )}
        </div>
        <div className={styles.actions}>
          <Button type="submit">Save details</Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmClear(true)} disabled={!profile?.name && !profile?.phone}>
            Clear my details
          </Button>
        </div>
      </form>
      <ConfirmDialog open={confirmClear} title="Clear your details?" confirmLabel="Clear my details" destructive onCancel={() => setConfirmClear(false)} onConfirm={clear}>
        <p>Your saved name and phone number will be removed from this browser. Existing visit requests keep what you entered when you made them.</p>
      </ConfirmDialog>
    </section>
  );
}
