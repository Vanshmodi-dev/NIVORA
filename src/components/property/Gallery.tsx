import { useState } from "react";
import { AppImage } from "../ui/AppImage";
import { ILLUSTRATIVE_IMAGES_NOTICE, IMAGE_REGISTRY, resolvePhotos, type ImageCredit } from "../../data/images";
import styles from "./Gallery.module.css";

/**
 * Hero + thumbnails from the licensed local image set. With no approved images the neutral
 * placeholder is shown. The illustrative-images disclosure is shown whenever real images appear
 * (founder decision D1): they are never photographs of this specific property.
 */
export function Gallery({ photoIds, fallbackAlt, registry = IMAGE_REGISTRY }: { photoIds: readonly string[]; fallbackAlt: string; registry?: Readonly<Record<string, ImageCredit>> }) {
  const photos = resolvePhotos(photoIds, registry);
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, Math.max(0, photos.length - 1))];

  return (
    <figure className={styles.gallery} aria-label="Photos">
      <div className={styles.hero}>
        <AppImage src={current?.src} alt={current?.alt ?? fallbackAlt} ratio="16/9" eager focus={current?.focus} />
        {current && <span className={styles.chip}>Illustrative photo</span>}
      </div>
      {photos.length > 1 && (
        <ul className={styles.thumbs}>
          {photos.slice(0, 5).map((ph, i) => (
            <li key={ph.src}>
              <button type="button" className={`${styles.thumb} ${i === index ? styles.on : ""}`} aria-label={`Show photo ${i + 1} of ${photos.length}`} aria-pressed={i === index} onClick={() => setIndex(i)}>
                <AppImage src={ph.src} alt="" focus={ph.focus} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 && <figcaption className={styles.notice}>{ILLUSTRATIVE_IMAGES_NOTICE}</figcaption>}
    </figure>
  );
}
