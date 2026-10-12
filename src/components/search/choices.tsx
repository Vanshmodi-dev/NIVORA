import { Chip, ChipGroup } from "../ui/Chip";
import { AMENITY_IDS } from "../../data/reference";
import { AMENITY_LABEL, FURNISHING_LABEL, PROPERTY_TYPE_LABEL } from "../../domain/labels";
import { AVAIL_LABEL, FURNISHINGS, PROPERTY_TYPES, ROOMS_LABEL, VERIF_LABEL, type AvailabilityFilter, type RoomsFilter, type VerificationFilter } from "../../domain/search";
import type { AmenityId, Furnishing, PropertyType } from "../../domain/types";
import styles from "./choices.module.css";

const toggle = <T,>(list: readonly T[], item: T): T[] => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

export function TypeChips({ value, onChange }: { value: PropertyType[]; onChange: (v: PropertyType[]) => void }) {
  return (
    <ChipGroup label="Property type">
      {PROPERTY_TYPES.map((t) => (
        <Chip key={t} selected={value.includes(t)} onClick={() => onChange(toggle(value, t))}>
          {PROPERTY_TYPE_LABEL[t]}
        </Chip>
      ))}
    </ChipGroup>
  );
}

export function RoomsChips({ value, onChange }: { value: RoomsFilter; onChange: (v: RoomsFilter) => void }) {
  return (
    <ChipGroup label="Bedrooms or rooms">
      {(["any", "1", "2", "3+"] as const).map((r) => (
        <Chip key={r} selected={value === r} onClick={() => onChange(r)}>
          {ROOMS_LABEL[r]}
        </Chip>
      ))}
    </ChipGroup>
  );
}

export function FurnishingChips({ value, onChange }: { value: Furnishing[]; onChange: (v: Furnishing[]) => void }) {
  return (
    <ChipGroup label="Furnishing">
      {FURNISHINGS.map((f) => (
        <Chip key={f} selected={value.includes(f)} onClick={() => onChange(toggle(value, f))}>
          {FURNISHING_LABEL[f]}
        </Chip>
      ))}
    </ChipGroup>
  );
}

export function AmenityChips({ value, onChange, ids = AMENITY_IDS }: { value: AmenityId[]; onChange: (v: AmenityId[]) => void; ids?: readonly AmenityId[] }) {
  return (
    <ChipGroup label="Amenities">
      {ids.map((a) => (
        <Chip key={a} selected={value.includes(a)} onClick={() => onChange(toggle(value, a))}>
          {AMENITY_LABEL[a]}
        </Chip>
      ))}
    </ChipGroup>
  );
}

export function RadioList<T extends string>({ legend, name, value, options, labels, onChange }: { legend: string; name: string; value: T; options: readonly T[]; labels: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <fieldset className={styles.fieldset}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o} className={styles.radio}>
          <input type="radio" name={name} checked={value === o} onChange={() => onChange(o)} />
          <span>{labels[o]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export const AVAILABILITY_OPTIONS: readonly AvailabilityFilter[] = ["now", "within_30", "any"];
export const VERIFICATION_OPTIONS: readonly VerificationFilter[] = ["any", "identity", "all4"];
export { AVAIL_LABEL, VERIF_LABEL };
