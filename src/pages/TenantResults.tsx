import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { SearchX, X } from "lucide-react";
import { PropertyCard } from "../components/property/PropertyCard";
import { FilterBar } from "../components/search/FilterBar";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import {
  activeFilterChips,
  parseFilters,
  removeFilter,
  selectSearchResults,
  serializeFilters,
  suggestRelaxations,
  type SearchFilters,
} from "../domain/search";
import { getEffectiveVerification } from "../domain/verification";
import { useAppStore } from "../store/store";
import styles from "./TenantResults.module.css";
import { useNow } from "../store/useNow";

/**
 * T-02 Search results. Filter state lives in the URL (refresh-safe, shareable). The count, the
 * list and the zero-result suggestions all come from the same selector.
 *
 * The map / list view is NOT part of this build: it is blocked by the location-verification gate
 * (blueprint §13.6.2, founder decision D2), so results are shown as a list only.
 */
export function TenantResults() {
  const [params, setParams] = useSearchParams();
  const { toast } = useToast();
  const data = useAppStore((s) => s.data);
  const now = useNow();
  const filters = useMemo(() => parseFilters(params), [params]);
  const results = useMemo(() => selectSearchResults(data, filters, now), [data, filters, now]);
  const chips = activeFilterChips(filters);
  const from = `/tenant/search${params.toString() ? `?${params.toString()}` : ""}`;

  const apply = (next: SearchFilters) => setParams(serializeFilters(next), { replace: true });
  const clearAll = () => {
    setParams(new URLSearchParams(), { replace: true });
    toast({ tone: "success", title: "Filters cleared" });
  };

  const suggestions = results.length === 0 ? suggestRelaxations(data, filters, now) : [];

  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.head}>
        <h1>Homes in Jaipur</h1>
        <p className={styles.sub}>Demonstration listings only — none of these homes is real.</p>
      </header>

      <FilterBar filters={filters} onChange={apply} onClear={clearAll} data={data} now={now} />

      {chips.length > 0 && (
        <ul className={styles.chips} aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.key}>
              <button type="button" className={styles.chip} onClick={() => apply(removeFilter(filters, c.key))} aria-label={`Remove filter: ${c.label}`}>
                {c.label}
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className={styles.count} aria-live="polite" data-testid="result-count">
        {results.length} {results.length === 1 ? "home" : "homes"}
      </p>

      {results.length > 0 ? (
        <div className={styles.grid} data-testid="result-list">
          <h2 className="visually-hidden">Search results</h2>
          {results.map((p) => (
            <PropertyCard key={p.id} property={p} effective={getEffectiveVerification(p, data.verificationItems, now)} now={now} from={from} />
          ))}
        </div>
      ) : (
        <div className={styles.zero}>
          <EmptyState
            icon={<SearchX size={26} />}
            title="No homes match these filters."
            description="Try removing a filter, or clear them all to see every available demo home."
            action={<Button onClick={clearAll}>Clear all filters</Button>}
          />
          {suggestions.length > 0 && (
            <div className={styles.suggest}>
              <h2>Try one of these</h2>
              <ul>
                {suggestions.map((s) => (
                  <li key={s.key}>
                    <Button variant="secondary" size="sm" onClick={() => apply(s.filters)}>
                      {s.label}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
