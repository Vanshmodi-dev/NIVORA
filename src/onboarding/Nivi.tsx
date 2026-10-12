import { GUIDE_NAME } from "./config";
import styles from "./Nivi.module.css";

export type NiviMood = "happy" | "wow" | "think";

/**
 * Nivi: a tiny house-shaped spirit. Warm gold body, a lime sprout on the roof, two glossy eyes and
 * small arms. Original artwork (single inline SVG, no assets). Subtle motion only:
 * a gentle float, an occasional blink, a hop when an answer is chosen and a flight in on entry.
 * All motion stops under prefers-reduced-motion.
 */
export function Nivi({ mood = "happy", entered = true, reactKey = 0, size = 112 }: { mood?: NiviMood; entered?: boolean; reactKey?: number; size?: number }) {
  return (
    <div className={`${styles.wrap} ${entered ? styles.enter : styles.away}`} style={{ width: `min(${size}px, 26vw)`, height: `min(${size}px, 26vw)` }} data-testid="nivi" data-mood={mood} data-entered={entered}>
      <div key={reactKey} className={reactKey > 0 ? styles.hop : undefined}>
        <svg className={styles.body} viewBox="0 0 96 96" width="100%" height="100%" role="img" aria-label={`${GUIDE_NAME}, your guide`}>
          <defs>
            <linearGradient id="nv-body" x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#f6dc97" />
              <stop offset="1" stopColor="#d9a441" />
            </linearGradient>
          </defs>
          {/* sprout */}
          <path d="M48 20c0-6 2-9 6-11 0 5-1 9-6 11Z" fill="#b9f26b" />
          <path d="M48 20c0-5-2-8-6-9 0 4 1 7 6 9Z" fill="#8fd14a" />
          <rect x="47" y="18" width="2" height="7" rx="1" fill="#8fd14a" />
          {/* arms */}
          <g className={styles.armL}>
            <rect x="9" y="56" width="12" height="7" rx="3.5" fill="#d9a441" />
          </g>
          <g className={styles.armR}>
            <rect x="75" y="56" width="12" height="7" rx="3.5" fill="#d9a441" />
          </g>
          {/* body: rounded house */}
          <path d="M48 22 82 50c2 1.6 3 3.5 3 6v22c0 5-4 9-9 9H20c-5 0-9-4-9-9V56c0-2.5 1-4.4 3-6L48 22Z" fill="url(#nv-body)" />
          {/* face */}
          <g className={styles.eyes}>
            {mood === "think" ? (
              <>
                <circle cx="37" cy="55" r="5" fill="#141210" />
                <circle cx="59" cy="55" r="5" fill="#141210" />
                <circle cx="39" cy="53" r="1.7" fill="#fff" />
                <circle cx="61" cy="53" r="1.7" fill="#fff" />
              </>
            ) : (
              <>
                <ellipse className={styles.eye} cx="37" cy="57" rx="5" ry={mood === "wow" ? 6.4 : 5.6} fill="#141210" />
                <ellipse className={styles.eye} cx="59" cy="57" rx="5" ry={mood === "wow" ? 6.4 : 5.6} fill="#141210" />
                <circle cx="38.6" cy="54.8" r="1.7" fill="#fff" />
                <circle cx="60.6" cy="54.8" r="1.7" fill="#fff" />
              </>
            )}
          </g>
          <ellipse cx="29" cy="66" rx="4.2" ry="2.6" fill="#b9f26b" opacity="0.55" />
          <ellipse cx="67" cy="66" rx="4.2" ry="2.6" fill="#b9f26b" opacity="0.55" />
          {mood === "wow" ? (
            <ellipse cx="48" cy="70" rx="4.4" ry="5" fill="#141210" />
          ) : mood === "think" ? (
            <path d="M42 70h12" stroke="#141210" strokeWidth="3" strokeLinecap="round" fill="none" />
          ) : (
            <path d="M40 68c4.5 5.2 11.5 5.2 16 0" stroke="#141210" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
        </svg>
      </div>
      <span className={styles.shadow} aria-hidden="true" />
    </div>
  );
}
