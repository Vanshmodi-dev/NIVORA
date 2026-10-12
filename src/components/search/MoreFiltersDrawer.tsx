import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { AVAIL_LABEL, VERIF_LABEL, selectSearchResults, type SearchFilters } from "../../domain/search";
import type { DataState } from "../../domain/types";
import { AMENITY_IDS } from "../../data/reference";
import { AVAILABILITY_OPTIONS, AmenityChips, FurnishingChips, RadioList, VERIFICATION_OPTIONS } from "./choices";
import styles from "./MoreFiltersDrawer.module.css";

export interface MoreFiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  filters: SearchFilters;
  onApply: (next: SearchFilters) => void;
  data: Pick<DataState, "properties" | "verificationItems">;
  now: Date;
}

/**
 * Remaining filters, applied together on "Show n homes". The count is live: it is computed with
 * the same selector the results page uses, so it always matches what will be shown.
 */
export function MoreFiltersDrawer({ open, onClose, filters, onApply, data, now }: MoreFiltersDrawerProps) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const count = selectSearchResults(data, draft, now).length;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="More filters"
      variant="drawer"
      side="right"
      footer={
        <>
          <Button
            variant="tertiary"
            onClick={() => setDraft({ ...draft, furnishing: [], amenities: [], avail: "now", verif: "any" })}
          >
            Reset
          </Button>
          <Button onClick={() => onApply(draft)}>
            Show {count} {count === 1 ? "home" : "homes"}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        <section className={styles.group}>
          <h3>Furnishing</h3>
          <FurnishingChips value={draft.furnishing} onChange={(furnishing) => setDraft({ ...draft, furnishing })} />
        </section>
        <section className={styles.group}>
          <h3>Amenities</h3>
          <p className={styles.hint}>Homes must have all selected amenities.</p>
          <AmenityChips ids={AMENITY_IDS} value={draft.amenities} onChange={(amenities) => setDraft({ ...draft, amenities })} />
        </section>
        <section className={styles.group}>
          <RadioList legend="Availability" name="avail" value={draft.avail} options={AVAILABILITY_OPTIONS} labels={AVAIL_LABEL} onChange={(avail) => setDraft({ ...draft, avail })} />
        </section>
        <section className={styles.group}>
          <RadioList legend="Verification (demo data)" name="verif" value={draft.verif} options={VERIFICATION_OPTIONS} labels={VERIF_LABEL} onChange={(verif) => setDraft({ ...draft, verif })} />
        </section>
      </div>
    </Modal>
  );
}
