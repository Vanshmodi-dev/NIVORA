import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { PropertyCard } from "../../components/property/PropertyCard";
import { buttonClassName } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { selectSavedProperties } from "../../domain/mutations";
import { getAvailability } from "../../domain/search";
import { DEMO_TENANT_ID } from "../../domain/types";
import { getEffectiveVerification } from "../../domain/verification";
import { useAppStore } from "../../store/store";
import styles from "./dashboard.module.css";
import { useNow } from "../../store/useNow";

/** T-07 Saved Properties. Unavailable homes stay listed, clearly flagged, with a way to find similar ones. */
export function SavedPage() {
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const saved = selectSavedProperties(data, DEMO_TENANT_ID);

  if (saved.length === 0) {
    return (
      <EmptyState
        icon={<Heart size={26} />}
        title="No saved homes yet."
        description="Tap the heart on any home to keep it here."
        action={
          <Link to="/tenant/search" className={buttonClassName("primary")}>
            Find a Home
          </Link>
        }
      />
    );
  }

  return (
    <section aria-label="Saved homes">
      <h2 className="visually-hidden">Saved homes</h2>
      <p className={styles.muted} data-testid="saved-count">
        {saved.length} saved {saved.length === 1 ? "home" : "homes"}
      </p>
      <div className={styles.savedGrid}>
        {saved.map(({ property: p }) => {
          const unavailable = getAvailability(p, now).kind === "unavailable";
          const similar = new URLSearchParams({ locality: p.locality, type: p.type });
          return (
            <div key={p.id} className={styles.savedItem}>
              <PropertyCard property={p} effective={getEffectiveVerification(p, data.verificationItems, now)} now={now} from="/tenant/dashboard/saved" />
              {unavailable && (
                <p className={styles.savedNote}>
                  <span>No longer available — a visit can&apos;t be requested.</span>
                  <Link to={`/tenant/search?${similar.toString()}`}>Find similar homes</Link>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
