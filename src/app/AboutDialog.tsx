import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Info } from "lucide-react";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../components/ui/Toast";
import { evaluateMapGate } from "../data/reference";
import { ANCHOR_NOTE, PERSISTENCE_STATEMENT } from "../domain/copy";
import { appStore, useAppStore } from "../store/store";
import { INTRO_ENABLED, replayIntro } from "../intro/introStore";
import { resetOnboardingSession } from "../onboarding/session";
import { PresenterEntrySlot } from "./presenterSlots";
import styles from "./AboutDialog.module.css";

/**
 * Reset flow shared by the About dialog and the `/#/?reset=1` shortcut (§9.4).
 * Confirms first; cancelling changes nothing; success is reported only after the reset ran.
 */
export function ResetDemoDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone?: () => void }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  return (
    <ConfirmDialog
      open={open}
      title="Reset demo data?"
      confirmLabel="Reset demo data"
      destructive
      onCancel={onClose}
      onConfirm={() => {
        appStore.getState().resetDemo();
        // Rehearsal reset: forget the onboarding session and play the intro again so the next run starts from the top.
        resetOnboardingSession();
        onClose();
        onDone?.();
        navigate("/");
        if (INTRO_ENABLED) replayIntro();
        toast({ tone: "success", title: "Demo data reset.", description: "The prototype is back to its starting state." });
      }}
    >
      <p>
        This removes everything you added in this browser (listings, requests, saved homes, profile) and restores the starting
        demo data.
      </p>
    </ConfirmDialog>
  );
}

function Count({ label, fixture, user }: { label: string; fixture: number; user: number }) {
  return (
    <li>
      <span>{label}</span>
      <strong>
        {fixture} sample · {user} added by you
      </strong>
    </li>
  );
}

/** S-03 About this prototype (P0). Presenter tools and Image credits arrive in later phases. */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [resetOpen, setResetOpen] = useState(false);
  const properties = useAppStore((s) => s.data.properties);
  const requests = useAppStore((s) => s.data.visitRequests);
  const gate = evaluateMapGate();

  const countBy = (list: { source: "fixture" | "user" }[]) => ({
    fixture: list.filter((i) => i.source === "fixture").length,
    user: list.filter((i) => i.source === "user").length,
  });
  const p = countBy(properties);
  const r = countBy(requests);

  return (
    <>
      <Modal open={open} onClose={onClose} title="About this prototype" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <div className={styles.content}>
          <p>
            NIVORA is an interactive competition prototype. Everything you see is <strong>fictional demonstration data</strong>.
          </p>

          <section aria-labelledby="about-real">
            <h3 id="about-real">What is real, what is simulated</h3>
            <ul className={styles.list}>
              <li><strong>Real:</strong> the records you create here are genuinely stored in this browser and shared by the Tenant and Owner views.</li>
              <li><strong>Fictional:</strong> every property, person, price, request and metric.</li>
              <li><strong>Simulated:</strong> verification statuses are demo data. No real property, owner or document has been verified.</li>
              <li><strong>Not implemented:</strong> sign-in or OTP, payments, SMS/WhatsApp/email notifications, legal agreements, insurance and moving services.</li>
            </ul>
          </section>

          <section aria-labelledby="about-store">
            <h3 id="about-store">Where data lives</h3>
            <p>{PERSISTENCE_STATEMENT}</p>
          </section>

          <section aria-labelledby="about-location">
            <h3 id="about-location">Search anchors and locations</h3>
            <p>{ANCHOR_NOTE}</p>
            <p className={styles.status} data-testid="location-verification-status">
              {gate.satisfied
                ? "Locality and anchor positions have passed the verification step (approximate)."
                : "The full set of verified places is not ready, so “near a college or office” search is off on the main search form. The guided search offers a map and radius for one verified test destination (Vivekananda Global University, approximate position) and for points you choose yourself. Homes on the map are simulated positions of fictional listings."}
            </p>
          </section>

          <section aria-labelledby="about-counts">
            <h3 id="about-counts">Current data</h3>
            <ul className={styles.counts}>
              <Count label="Properties" fixture={p.fixture} user={p.user} />
              <Count label="Visit requests" fixture={r.fixture} user={r.user} />
            </ul>
          </section>

          <section aria-labelledby="about-roadmap">
            <h3 id="about-roadmap">What comes next</h3>
            <p>Agreements, moving help and insurance are future concepts only — none of them is available here.</p>
            <Link to="/roadmap" onClick={onClose}>Read the future roadmap</Link>
          </section>

          <section aria-labelledby="about-credits">
            <h3 id="about-credits">Credits</h3>
            <p>Photo, map and data credits.</p>
            <Link to="/credits" onClick={onClose}>Image and map credits</Link>
          </section>

          <section aria-labelledby="about-intro">
            <h3 id="about-intro">Brand intro</h3>
            <p>Watch the NIVORA opening sequence again. It plays once per browser session.</p>
            <Button variant="secondary" size="sm" onClick={() => { onClose(); replayIntro(); }}>
              Replay intro
            </Button>
          </section>

          <section aria-labelledby="about-reset">
            <h3 id="about-reset">Start over</h3>
            <p>Restore the starting demo data so the demonstration can be repeated.</p>
            <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
              Reset demo data
            </Button>
          </section>
          <PresenterEntrySlot onEntered={onClose} />
        </div>
      </Modal>
      <ResetDemoDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onDone={onClose}
      />
    </>
  );
}

/** Header button + dialog. Available from every shell. */
export function AboutMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="tertiary" size="sm" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="About this prototype">
        <Info size={16} aria-hidden="true" />
        <span className={styles.aboutLabel}>About this prototype</span>
      </Button>
      <AboutDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
