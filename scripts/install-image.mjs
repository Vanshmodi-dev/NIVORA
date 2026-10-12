#!/usr/bin/env node
/**
 * Installs ONE manually chosen Pexels photo into an existing image slot, safely.
 * For replacing a cover (e.g. FX-01, FX-05, FX-08, FX-15) after picking a photo by eye on pexels.com.
 *
 *   npm run images:install -- --slot fx01-1 --file C:\Downloads\pexels-photo-123.jpeg \
 *     --page https://www.pexels.com/photo/some-title-123/ \
 *     --photographer "Name As Shown" --photographer-url https://www.pexels.com/@handle/ \
 *     --alt "Empty bedroom with a built-in wardrobe and a ceiling fan" --rendition "1200 px wide" [--dry-run]
 *
 * Every value must be read from the photo's own Pexels page; nothing here is invented or looked up.
 * Checks: the slot exists; the page is a pexels.com/photo URL; the photo is not used by another slot;
 * the file is a complete JPEG within 150,000 bytes. Transfer metadata blocks (APP11, e.g. C2PA
 * "content credentials" added by a download or copy tool) are removed so the stored bytes are the
 * image Pexels served. The previous file and credit row are kept in scripts/replaced-images/.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET = 150_000;
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = args.includes("--dry-run");
const fail = (msg) => {
  console.error(`NOT INSTALLED: ${msg}`);
  process.exit(1);
};

const slot = opt("slot");
const file = opt("file");
const page = opt("page");
const photographer = opt("photographer");
const photographerUrl = opt("photographer-url");
const alt = opt("alt");
const rendition = opt("rendition") ?? "rendition not recorded";
const acquiredOn = opt("acquired") ?? new Date().toISOString().slice(0, 10);

for (const [k, v] of Object.entries({ slot, file, page, photographer, "photographer-url": photographerUrl, alt })) if (!v || !String(v).trim()) fail(`--${k} is required`);

const planPath = join(root, "scripts", "image-plan.json");
const creditsPath = join(root, "src", "data", "images.credits.json");
const planDoc = JSON.parse(readFileSync(planPath, "utf8"));
const credits = JSON.parse(readFileSync(creditsPath, "utf8"));
const planSlot = planDoc.slots[slot];
if (!planSlot) fail(`unknown slot "${slot}" (see scripts/image-plan.json)`);

const m = /^https:\/\/www\.pexels\.com\/photo\/(?:[a-z0-9-]+-)?(\d+)\/?$/.exec(page);
if (!m) fail("--page must be the photo's own page, like https://www.pexels.com/photo/title-123456/");
const pexelsId = Number(m[1]);
if (!/^https:\/\/www\.pexels\.com\/@[^/\s]+\/?$/.test(photographerUrl)) fail("--photographer-url must be the photographer's Pexels profile, like https://www.pexels.com/@handle/");
if (!/^\d{4}-\d{2}-\d{2}$/.test(acquiredOn)) fail("--acquired must be YYYY-MM-DD");
for (const [other, s] of Object.entries(planDoc.slots)) if (other !== slot && s.pexelsId === pexelsId) fail(`Pexels photo ${pexelsId} is already used by ${other}; every slot needs a different photo`);
for (const [other, c] of Object.entries(credits)) if (other !== slot && new RegExp(`-${pexelsId}/?$`).test(c.sourceUrl)) fail(`Pexels photo ${pexelsId} is already credited to ${other}`);

if (!existsSync(file)) fail(`file not found: ${file}`);
const original = readFileSync(file);
if (original[0] !== 0xff || original[1] !== 0xd8 || original[original.length - 2] !== 0xff || original[original.length - 1] !== 0xd9) fail("the file is not a complete JPEG (download the .jpeg from Pexels again)");

// Remove APP11 segments (transfer metadata such as C2PA), keep everything else byte-for-byte.
const out = [original.subarray(0, 2)];
let removed = 0;
let width = 0;
let height = 0;
for (let i = 2; i < original.length; ) {
  if (original[i] !== 0xff) fail("unexpected JPEG structure; not installed");
  const marker = original[i + 1];
  if (marker === 0xda) {
    out.push(original.subarray(i));
    break;
  }
  const len = original.readUInt16BE(i + 2);
  if (marker === 0xc0 || marker === 0xc2) {
    height = original.readUInt16BE(i + 5);
    width = original.readUInt16BE(i + 7);
  }
  if (marker === 0xeb) removed += len + 2;
  else out.push(original.subarray(i, i + 2 + len));
  i += 2 + len;
}
const bytes = Buffer.concat(out);
if (bytes.length > BUDGET) fail(`${bytes.length} bytes is over the ${BUDGET}-byte budget; download a smaller Pexels rendition (e.g. w=1000) instead of re-compressing`);
const sha = createHash("sha256").update(bytes).digest("hex");
for (const [other, c] of Object.entries(credits)) {
  const f = join(root, "public", c.src);
  if (other !== slot && existsSync(f) && createHash("sha256").update(readFileSync(f)).digest("hex") === sha) fail(`this file is the photo already installed for ${other}; pick the file you downloaded for this slot`);
}

const row = {
  src: `/images/${slot}.jpg`,
  alt: alt.trim(),
  sourceUrl: page.endsWith("/") ? page : `${page}/`,
  photographer: photographer.trim(),
  photographerUrl: photographerUrl.endsWith("/") ? photographerUrl : `${photographerUrl}/`,
  acquiredOn,
  licence: { name: "Pexels License", url: "https://www.pexels.com/license/" },
  modifications: `None by NIVORA (Pexels-served ${rendition}, downloaded unmodified${removed ? "; a transfer metadata block was removed" : ""})`,
  usedBy: planSlot.usedBy,
};
if (credits[slot]?.focus) console.log(`Note: the old row had focus "${credits[slot].focus}"; it is not carried over (it belonged to the old photo).`);

// Best-effort provenance check: compare with Pexels' standard rendition of this photo ID at the same width.
let cdn = "not checked";
try {
  const res = await fetch(`https://images.pexels.com/photos/${pexelsId}/pexels-photo-${pexelsId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`, { signal: AbortSignal.timeout(15000) });
  if (res.ok) cdn = Buffer.from(await res.arrayBuffer()).equals(bytes) ? "matches Pexels' own file for this photo ID byte-for-byte" : "could not be matched byte-for-byte (normal for other download sizes; make sure the file really is this photo)";
  else cdn = `Pexels CDN answered HTTP ${res.status}; the photo ID may be wrong`;
} catch {
  cdn = "not checked (offline)";
}
console.log(`Provenance: ${cdn}`);
console.log(`${slot}: Pexels ${pexelsId} by ${row.photographer}, ${width}x${height}, ${bytes.length} bytes${removed ? ` (${removed} bytes of transfer metadata removed)` : ""}, sha256 ${sha.slice(0, 16)}`);
if (width && width < 800) console.log("Warning: under 800 px wide; it may look soft on the projector.");
if (dryRun) {
  console.log("Dry run: all checks passed. Nothing was written.");
} else {

const backupDir = join(root, "scripts", "replaced-images");
mkdirSync(backupDir, { recursive: true });
const target = join(root, "public", "images", `${slot}.jpg`);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
if (existsSync(target)) writeFileSync(join(backupDir, `${slot}-${stamp}.jpg`), readFileSync(target));
if (credits[slot]) writeFileSync(join(backupDir, `${slot}-${stamp}.credit.json`), JSON.stringify(credits[slot], null, 2) + "\n");

writeFileSync(target, bytes);
credits[slot] = row;
writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n");
planSlot.pexelsId = pexelsId;
writeFileSync(planPath, JSON.stringify(planDoc, null, 2) + "\n");
appendFileSync(
  join(root, "docs", "IMAGE_ACQUISITION_LOG.md"),
  `| \`public/images/${slot}.jpg\` (replacement, ${acquiredOn}) | ${row.usedBy.join(", ")} | ${pexelsId} | ${row.sourceUrl} | [${row.photographer}](${row.photographerUrl}) | Pexels License, https://www.pexels.com/license/ | ${acquiredOn} | ${rendition} (${width}x${height}) | ${bytes.length.toLocaleString("en-US")} | \`${sha.slice(0, 16)}\` |\n`,
);
console.log(`Installed. Previous file and credit kept in scripts/replaced-images/. Now run: npm test && npm run build:demo && npm run preflight, then look at the card.`);
}
