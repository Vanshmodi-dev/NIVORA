import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Button } from "../ui/Button";
import { Chip, ChipGroup } from "../ui/Chip";
import { Combobox } from "../ui/Combobox";
import { LOCALITIES, evaluateMapGate } from "../../data/reference";
import { DEFAULT_FILTERS, KEYWORD_MAX, serializeFilters, validateRent } from "../../domain/search";
import type { AmenityId, LocalityId, PropertyType } from "../../domain/types";
import type { RoomsFilter } from "../../domain/search";
import { AmenityChips, RoomsChips, TypeChips } from "./choices";
import { RentFields } from "./RentFields";
import styles from "./SearchPanel.module.css";

const SHORTCUT_AMENITIES: AmenityId[] = ["parking", "wifi", "lift", "power_backup"];
const PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under ₹10k", min: null, max: 10000 },
  { label: "₹10–20k", min: 10000, max: 20000 },
  { label: "₹20–40k", min: 20000, max: 40000 },
  { label: "₹40k+", min: 40000, max: null },
];

/**
 * T-01 search panel. Locality search only: "near a college or office" is shown as DISABLED with an
 * explanation because the location-verification gate (§13.6.2, founder decision D2) has not passed.
 */
export function SearchPanel() {
  const navigate = useNavigate();
  const uid = useId();
  const [q, setQ] = useState("");
  const [locality, setLocality] = useState<LocalityId | null>(null);
  const [min, setMin] = useState<number | null>(null);
  const [max, setMax] = useState<number | null>(null);
  const [types, setTypes] = useState<PropertyType[]>([]);
  const [rooms, setRooms] = useState<RoomsFilter>("any");
  const [amenities, setAmenities] = useState<AmenityId[]>([]);
  const [rentError, setRentError] = useState<string | null>(null);
  const gate = evaluateMapGate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateRent(min, max);
    setRentError(err);
    if (err) return;
    const params = serializeFilters({ ...DEFAULT_FILTERS, q: q.trim(), locality, min, max, types, rooms, amenities });
    navigate(`/tenant/search${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <form className={styles.panel} onSubmit={submit} aria-label="Search homes" noValidate>
      <div className={styles.modes} role="radiogroup" aria-label="Search mode">
        <button type="button" role="radio" aria-checked="true" className={`${styles.mode} ${styles.modeOn}`}>
          Locality
        </button>
        <button type="button" role="radio" aria-checked="false" aria-disabled="true" aria-describedby={`${uid}-anchor-note`} className={`${styles.mode} ${styles.modeOff}`}>
          Near a college or office
        </button>
      </div>
      {!gate.satisfied && (
        <p id={`${uid}-anchor-note`} className={styles.note}>
          Searching near a college or office isn&apos;t available on this form yet: the full set of verified places isn&apos;t ready. The guided search above offers a map and radius for a test destination.
        </p>
      )}

      <div className={styles.grid}>
        <div className={styles.field}>
          <label htmlFor={`${uid}-q`}>Search</label>
          <input
            id={`${uid}-q`}
            className={styles.input}
            type="search"
            placeholder="Title, locality or landmark"
            maxLength={KEYWORD_MAX}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Combobox
          label="Locality"
          placeholder="All Jaipur"
          options={LOCALITIES.map((l) => ({ value: l.id, label: l.name }))}
          value={locality}
          onChange={(v) => setLocality(v as LocalityId | null)}
        />
      </div>

      <div className={styles.section}>
        <RentFields
          min={min}
          max={max}
          error={rentError}
          onChange={(a, b) => {
            setMin(a);
            setMax(b);
            if (rentError) setRentError(validateRent(a, b));
          }}
        />
        <ChipGroup label="Rent presets">
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              selected={min === p.min && max === p.max}
              onClick={() => {
                setMin(p.min);
                setMax(p.max);
                setRentError(null);
              }}
            >
              {p.label}
            </Chip>
          ))}
        </ChipGroup>
      </div>

      <div className={styles.section}>
        <span className={styles.groupLabel}>Property type</span>
        <TypeChips value={types} onChange={setTypes} />
      </div>
      <div className={styles.section}>
        <span className={styles.groupLabel}>Bedrooms / rooms</span>
        <RoomsChips value={rooms} onChange={setRooms} />
      </div>
      <div className={styles.section}>
        <span className={styles.groupLabel}>Must have</span>
        <AmenityChips ids={SHORTCUT_AMENITIES} value={amenities} onChange={setAmenities} />
      </div>

      <Button type="submit" className={styles.submit}>
        <Search size={18} aria-hidden="true" />
        Search homes
      </Button>
    </form>
  );
}
