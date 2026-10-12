import { useEffect, useState } from "react";
import styles from "./AppImage.module.css";

export interface AppImageProps {
  /** Local asset URL. When absent or failing, the neutral SVG placeholder is shown (§14.12). */
  src?: string | null;
  alt: string;
  ratio?: "4/3" | "16/9";
  eager?: boolean;
  className?: string;
  /** CSS object-position for the crop (from the image's credit row). */
  focus?: string | null;
  /** Small "Illustrative" label for thumbnails, shown only when a real photo is displayed. */
  badge?: boolean;
  /** Small tiles and thumbnails: hide the "Image unavailable" caption (the icon stays). */
  compact?: boolean;
}

/** Image with skeleton while loading and a placeholder fallback — a broken-image icon never shows. */
export function AppImage({ src, alt, ratio = "4/3", eager = false, className, focus, badge = false, compact = false }: AppImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">(src ? "loading" : "error");

  useEffect(() => {
    setState(src ? "loading" : "error");
  }, [src]);

  const box = `${styles.box} ${className ?? ""}`;
  const style = { aspectRatio: ratio.replace("/", " / ") };

  if (state === "error" || !src) {
    return (
      <div className={box} style={style} {...(alt ? { role: "img", "aria-label": alt } : { "aria-hidden": true })} data-testid="image-placeholder">
        <svg className={styles.placeholder} viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M10 30 32 12l22 18v22H10z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M26 52V38h12v14" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        {!compact && <span className={styles.caption}>Image unavailable</span>}
      </div>
    );
  }

  return (
    <div className={`${box} ${state === "loading" ? styles.loading : ""}`} style={style}>
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={styles.img}
        style={focus ? { objectPosition: focus } : undefined}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
      {badge && state === "loaded" && <span className={styles.badge} aria-hidden="true">Illustrative</span>}
    </div>
  );
}
