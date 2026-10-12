import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Building2, ClipboardList, House, Search, ShieldCheck } from "lucide-react";
import { BrandMark } from "../components/ui/BrandMark";
import { BRAND } from "../domain/copy";
import type { Persona } from "../domain/types";
import { appStore } from "../store/store";
import { Nivi } from "../onboarding/Nivi";
import { ResetDemoDialog } from "../app/AboutDialog";
import styles from "./Welcome.module.css";

interface JourneyCardProps {
  persona: Persona;
  to: string;
  title: string;
  text: string;
  action: string;
  icon: React.ReactNode;
  tone: "violet" | "navy";
}

/** The whole card is one link: Enter activates it, focus ring is visible, no nested controls (§5.3). */
function JourneyCard({ persona, to, title, text, action, icon, tone }: JourneyCardProps) {
  return (
    <Link to={to} className={styles.card} onClick={() => appStore.getState().setPersona(persona)}>
      <span className={styles.cardIcon} aria-hidden="true">{icon}</span>
      <h2 className={styles.cardTitle}>{title}</h2>
      <p className={styles.cardText}>{text}</p>
      <span className={`${styles.cta} ${tone === "violet" ? styles.ctaViolet : styles.ctaNavy}`}>{action}</span>
    </Link>
  );
}

const PILLARS = [
  { icon: <Search size={20} aria-hidden="true" />, name: "Discover", line: "Search by locality or around your college or office." },
  { icon: <ShieldCheck size={20} aria-hidden="true" />, name: "Trust", line: "See what has been checked — and what hasn't." },
  { icon: <ClipboardList size={20} aria-hidden="true" />, name: "Manage", line: "Visits, rent and upkeep in one place.", note: "Rent and upkeep are previews in this prototype." },
];

/** S-00 Welcome. No login, no forms, no external images (§5). */
export function Welcome() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [resetOpen, setResetOpen] = useState(false);

  // `/#/?reset=1` — pre-demo shortcut. Always confirms before acting (§9.4).
  useEffect(() => {
    if (params.get("reset") === "1") setResetOpen(true);
  }, [params]);

  const closeReset = () => {
    setResetOpen(false);
    if (params.get("reset") === "1") navigate("/", { replace: true });
  };

  return (
    <div className={styles.page}>
      <section className={`container ${styles.hero}`} aria-labelledby="welcome-title">
        <Nivi size={92} />
        <BrandMark size={44} />
        <p className={styles.brandName}>{BRAND.name}</p>
        <p className="overline">{BRAND.descriptor}</p>
        <h1 id="welcome-title" className={styles.headline}>{BRAND.welcomeHeadline}</h1>
        <p className={styles.supporting}>{BRAND.welcomeSupporting}</p>
        <div className={styles.ctas}>
          <Link to="/tenant/discover" className={styles.ctaPrimary} onClick={() => appStore.getState().setPersona("tenant")}>
            Find my home <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <Link to="/tenant" className={styles.ctaSecondary} onClick={() => appStore.getState().setPersona("tenant")}>
            Explore on my own
          </Link>
        </div>
      </section>

      <section className={`container ${styles.cards}`} aria-label="Choose your journey">
        <JourneyCard
          persona="tenant"
          to="/tenant"
          title="I'm a Tenant"
          text="Find a place to call home."
          action="Find a Home"
          icon={<House size={26} />}
          tone="violet"
        />
        <JourneyCard
          persona="owner"
          to="/owner"
          title="I'm a Property Owner"
          text="List and manage your rental."
          action="Manage Properties"
          icon={<Building2 size={26} />}
          tone="navy"
        />
      </section>

      <section className={`container ${styles.pillars}`} aria-label="What NIVORA is about">
        {PILLARS.map((p) => (
          <div key={p.name} className={styles.pillar}>
            <span className={styles.pillarIcon}>{p.icon}</span>
            <h2 className={styles.pillarName}>{p.name}</h2>
            <p>{p.line}</p>
            {p.note && <p className={styles.pillarNote}>{p.note}</p>}
          </div>
        ))}
      </section>

      <p className={`container ${styles.footerLine}`}>
        <span className={styles.tagline}>{BRAND.tagline}</span>
        <span>{BRAND.welcomeFooterLine}</span>
      </p>

      <ResetDemoDialog open={resetOpen} onClose={closeReset} />
    </div>
  );
}
