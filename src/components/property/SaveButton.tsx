import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { appStore, useAppStore } from "../../store/store";
import { DEMO_TENANT_ID } from "../../domain/types";
import styles from "./SaveButton.module.css";

/**
 * Save / unsave a home (§6.8). The change is written to the shared store; the toast only appears
 * after the write succeeded, and a failed write reports an error instead.
 */
export function useSaveToggle(propertyId: string) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const saved = useAppStore((s) => s.data.savedProperties.some((x) => x.tenantId === DEMO_TENANT_ID && x.propertyId === propertyId));
  const toggle = () => {
    const r = appStore.getState().toggleSaved(propertyId);
    if (!r.ok) {
      toast({ tone: "error", title: "Couldn't update your saved homes", description: r.message });
      return;
    }
    if (r.saved) {
      toast({ tone: "success", title: "Saved to your homes", action: { label: "View", onClick: () => navigate("/tenant/dashboard/saved") } });
    } else {
      toast({ tone: "success", title: "Removed from your saved homes" });
    }
  };
  return { saved, toggle };
}

/** Round heart-style control for cards (44 px target, `aria-pressed`, labelled with the home's title). */
export function SaveIconButton({ propertyId, title }: { propertyId: string; title: string }) {
  const { saved, toggle } = useSaveToggle(propertyId);
  return (
    <button
      type="button"
      className={`${styles.icon} ${saved ? styles.on : ""}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved homes` : `Save ${title}`}
      onClick={toggle}
    >
      <Heart size={20} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

/** Labelled secondary button for the details page action card. */
export function SaveTextButton({ propertyId }: { propertyId: string }) {
  const { saved, toggle } = useSaveToggle(propertyId);
  return (
    <Button variant="secondary" aria-pressed={saved} onClick={toggle}>
      <Heart size={18} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
      {saved ? "Saved" : "Save this home"}
    </Button>
  );
}
