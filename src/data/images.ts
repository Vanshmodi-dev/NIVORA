/**
 * Licensed image registry (blueprint §14.13, founder decision D1).
 *
 * STATUS (2026-10-10): 20 of 82 slots installed — the `demo-minimum` tier (14 fixture covers + owner
 * pool 01–06). Each was chosen by eye on pexels.com in a browser, its page, photographer and licence
 * read from that photo's own Pexels page, and the Pexels-served rendition stored locally in
 * public/images/ (evidence: docs/IMAGE_ACQUISITION_LOG.md). The other 62 slots still resolve to
 * `null` and show the neutral placeholder. Approved source is Pexels (manually selected, locally
 * stored); Unsplash is not used; no AI-generated, scraped or hot-linked images.
 *
 * Adding an image requires a COMPLETE credit row (source URL, photographer where available,
 * acquisition date, licence name + URL) — see `isCompleteCredit`. Do not invent licence details.
 */
export interface ImageCredit {
  /** Local asset path, e.g. `/images/fx01-1.webp` (never a remote URL). */
  src: string;
  /** Generic scene description; never describes a specific real property. */
  alt: string;
  sourceUrl: string;
  /** Photographer / author, when the source provides one. */
  photographer: string | null;
  photographerUrl: string | null;
  acquiredOn: string;
  licence: { name: string; url: string };
  /** Modifications such as crop, resize, compress. */
  modifications: string;
  /** Fixture ids using it, or "owner pool". */
  usedBy: string[];
  /**
   * Optional on-screen focus point (CSS object-position, e.g. "50% 0%") used when the app crops the
   * picture to fit a frame. Display only: the file itself is never modified.
   */
  focus?: string;
}

import credits from "./images.credits.json";

/** Filled by `npm run images:fetch` from official Pexels records only. Empty until images are installed. */
export const IMAGE_REGISTRY: Readonly<Record<string, ImageCredit>> = credits as Record<string, ImageCredit>;

export const ILLUSTRATIVE_IMAGES_NOTICE = "Illustrative images — not photographs of this specific property.";

export function resolveImage(photoId: string, registry: Readonly<Record<string, ImageCredit>> = IMAGE_REGISTRY): ImageCredit | null {
  return registry[photoId] ?? null;
}

const isLocalPath = (src: string) => src.startsWith("/") && !src.startsWith("//");

/** A credit row is complete only when every required licensing field is present and the asset is local. */
export function isCompleteCredit(c: ImageCredit): boolean {
  return (
    isLocalPath(c.src) &&
    c.alt.trim().length > 0 &&
    /^https:\/\/www\.pexels\.com\//.test(c.sourceUrl) &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.acquiredOn) &&
    c.licence.name.trim().length > 0 &&
    /^https:\/\//.test(c.licence.url) &&
    c.usedBy.length > 0 &&
    (c.focus === undefined || /^\d{1,3}% \d{1,3}%$/.test(c.focus))
  );
}

/** Resolved images for a property, in order, skipping any id with no approved asset. */
export function resolvePhotos(photoIds: readonly string[], registry: Readonly<Record<string, ImageCredit>> = IMAGE_REGISTRY): ImageCredit[] {
  return photoIds.map((id) => resolveImage(id, registry)).filter((x): x is ImageCredit => x !== null);
}

/**
 * Owner-selectable demo image slots (wizard step 6). The licensed pool (DW-1) has not been
 * acquired, so these ids currently resolve to nothing and show the neutral placeholder. Selecting
 * one is a real choice stored on the listing; once approved assets are registered under the same
 * ids, the real images appear without any other change.
 */
export const OWNER_IMAGE_POOL_IDS: readonly string[] = Array.from({ length: 24 }, (_, i) => `pool-${String(i + 1).padStart(2, "0")}`);

/**
 * Registry-wide checks (AC-38): every row complete and local, no image file shared between two
 * slots, no Pexels photo used twice, and every fixture's cover (first photo) unique.
 */
export function validateImageRegistry(registry: Readonly<Record<string, ImageCredit>>, fixtureCovers: readonly string[]): string[] {
  const problems: string[] = [];
  const files = new Map<string, string>();
  const pages = new Map<string, string>();
  for (const [id, c] of Object.entries(registry)) {
    if (!isCompleteCredit(c)) problems.push(`${id}: incomplete credit row`);
    if (files.has(c.src)) problems.push(`${id}: file ${c.src} is also used by ${files.get(c.src)}`);
    files.set(c.src, id);
    if (pages.has(c.sourceUrl)) problems.push(`${id}: photo ${c.sourceUrl} is also used by ${pages.get(c.sourceUrl)}`);
    pages.set(c.sourceUrl, id);
  }
  const covers = fixtureCovers.filter((id) => registry[id]).map((id) => registry[id]!.src);
  if (new Set(covers).size !== covers.length) problems.push("two fixtures share a cover image");
  return problems;
}
