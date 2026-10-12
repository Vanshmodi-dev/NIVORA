import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/Button";
import { Combobox } from "../ui/Combobox";
import { Popover } from "../ui/Popover";
import { LOCALITIES } from "../../data/reference";
import { SORT_LABEL, isDefaultFilters, validateRent, type SearchFilters, type SortKey } from "../../domain/search";
import type { LocalityId } from "../../domain/types";
import { RoomsChips, TypeChips } from "./choices";
import { RentFields } from "./RentFields";
import { MoreFiltersDrawer } from "./MoreFiltersDrawer";
import type { DataState } from "../../domain/types";
import styles from "./FilterBar.module.css";

export interface FilterBarProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  onClear: () => void;
  data: Pick<DataState, "properties" | "verificationItems">;
  now: Date;
}

/** Quick filters apply immediately; the drawer applies on "Show n homes" (§6.2, §6.4). */
export function FilterBar({ filters, onChange, onClear, data, now }: FilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  // Rent draft: applied to the URL only while valid, so an invalid range never changes results.
  const [rentDraft, setRentDraft] = useState<{ min: number | null; max: number | null } | null>(null);
  const rent = rentDraft ?? { min: filters.min, max: filters.max };
  const rentError = validateRent(rent.min, rent.max);

  const drawerCount =
    (filters.furnishing.length ? 1 : 0) + (filters.amenities.length ? 1 : 0) + (filters.avail !== "now" ? 1 : 0) + (filters.verif !== "any" ? 1 : 0);

  return (
    <div className={styles.bar} role="search" aria-label="Filter homes">
      <div className={styles.location}>
        <Combobox
          label="Locality"
          hideLabel
          placeholder="All Jaipur"
          options={LOCALITIES.map((l) => ({ value: l.id, label: l.name }))}
          value={filters.locality}
          onChange={(v) => onChange({ ...filters, locality: v as LocalityId | null })}
        />
      </div>
      <Popover label="Rent" active={filters.min !== null || filters.max !== null}>
        <RentFields
          min={rent.min}
          max={rent.max}
          error={rentError}
          onChange={(min, max) => {
            setRentDraft({ min, max });
            if (!validateRent(min, max)) {
              onChange({ ...filters, min, max });
              setRentDraft(null);
            }
          }}
        />
      </Popover>
      <Popover label="Type" active={filters.types.length > 0}>
        <TypeChips value={filters.types} onChange={(types) => onChange({ ...filters, types })} />
      </Popover>
      <Popover label="Rooms" active={filters.rooms !== "any"}>
        <RoomsChips value={filters.rooms} onChange={(rooms) => onChange({ ...filters, rooms })} />
      </Popover>
      <Button variant="secondary" size="sm" onClick={() => setMoreOpen(true)} aria-haspopup="dialog">
        <SlidersHorizontal size={16} aria-hidden="true" />
        More filters{drawerCount > 0 ? ` (${drawerCount})` : ""}
      </Button>
      <Button variant="tertiary" size="sm" onClick={onClear} disabled={isDefaultFilters(filters)}>
        Clear all
      </Button>
      <div className={styles.sort}>
        <label htmlFor="sort-select">Sort by</label>
        <select id="sort-select" value={filters.sort} onChange={(e) => onChange({ ...filters, sort: e.target.value as SortKey })}>
          {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <MoreFiltersDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        filters={filters}
        data={data}
        now={now}
        onApply={(next) => {
          onChange(next);
          setMoreOpen(false);
        }}
      />
    </div>
  );
}
