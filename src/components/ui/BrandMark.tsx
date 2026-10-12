import styles from "./BrandMark.module.css";

/** Canonical NIVORA mark geometry (32×32 viewBox). The brand intro redraws exactly these paths. */
export const BRAND_MARK_PATHS = {
  house: "M4 15 16 5l12 10v13H4z",
  keyhole: { cx: 16, cy: 16.5, r: 2.6 },
  key: "M16 19.1V24m0-2h2.2",
} as const;

/** House outline whose doorway forms a key (single-colour SVG, decorative). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className={styles.mark}>
      <path d={BRAND_MARK_PATHS.house} stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx={BRAND_MARK_PATHS.keyhole.cx} cy={BRAND_MARK_PATHS.keyhole.cy} r={BRAND_MARK_PATHS.keyhole.r} stroke="currentColor" strokeWidth="2" />
      <path d={BRAND_MARK_PATHS.key} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ descriptor = false }: { descriptor?: boolean }) {
  return (
    <span className={styles.wordmark}>
      <BrandMark />
      <span className={styles.text}>
        <span className={styles.name}>NIVORA</span>
        {descriptor && <span className={styles.descriptor}>THE RENTAL LIVING ECOSYSTEM</span>}
      </span>
    </span>
  );
}
