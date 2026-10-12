#!/usr/bin/env node
/**
 * Installs the licensed demo images chosen in scripts/image-plan.json.
 *
 * Source: Pexels only (founder decision D1). Each photo is looked up BY ID through the official
 * Pexels API, so the photographer, page URL and licence come from Pexels itself, and is downloaded
 * once, unmodified, into public/images/. Nothing is scraped, hot-linked or bulk-copied, and nothing
 * is invented: a slot with `pexelsId: null` keeps the neutral placeholder.
 *
 *   PEXELS_API_KEY=<free key from https://www.pexels.com/api/> npm run images:fetch
 *   npm run images:fetch -- --tier demo-minimum      (only the minimum set)
 *   npm run images:fetch -- --dry-run                (validate the plan, change nothing)
 *
 * Writes src/data/images.credits.json (read by the app and the Image credits page).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const planPath = join(root, "scripts", "image-plan.json");
const creditsPath = join(root, "src", "data", "images.credits.json");
const outDir = join(root, "public", "images");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const tier = args.includes("--tier") ? args[args.indexOf("--tier") + 1] : null;
const key = process.env.PEXELS_API_KEY;

const plan = JSON.parse(readFileSync(planPath, "utf8")).slots;
const credits = existsSync(creditsPath) ? JSON.parse(readFileSync(creditsPath, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);

const chosen = Object.entries(plan).filter(([, s]) => s.pexelsId !== null && (!tier || s.tier === tier));
const problems = [];
const seen = new Map();
for (const [slot, s] of chosen) {
  if (!Number.isInteger(s.pexelsId) || s.pexelsId <= 0) problems.push(`${slot}: pexelsId must be a positive integer (the number in the photo URL)`);
  if (seen.has(s.pexelsId)) problems.push(`${slot}: Pexels photo ${s.pexelsId} is already used for ${seen.get(s.pexelsId)} (every slot needs a different photo)`);
  seen.set(s.pexelsId, slot);
  if (!s.alt || !s.alt.trim()) problems.push(`${slot}: missing alt text`);
}
if (problems.length) {
  console.error("Plan problems:\n - " + problems.join("\n - "));
  process.exit(1);
}
console.log(`${chosen.length} of ${Object.keys(plan).length} slots have a Pexels photo chosen${tier ? ` (tier ${tier})` : ""}.`);
if (chosen.length === 0) {
  console.log("Nothing to do: choose photos by filling pexelsId in scripts/image-plan.json.");
  process.exit(0);
}
if (dryRun) {
  console.log("Dry run: plan is valid. No network calls were made.");
  process.exit(0);
}
if (!key) {
  console.error("Set PEXELS_API_KEY (a free key from https://www.pexels.com/api/) and run again.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
let installed = 0;
for (const [slot, s] of chosen) {
  const res = await fetch(`https://api.pexels.com/v1/photos/${s.pexelsId}`, { headers: { Authorization: key } });
  if (!res.ok) {
    console.error(`${slot}: Pexels photo ${s.pexelsId} lookup failed (HTTP ${res.status}); skipped.`);
    continue;
  }
  const photo = await res.json();
  if (!/^https:\/\/www\.pexels\.com\//.test(photo.url ?? "") || !photo.photographer || !photo.src?.large) {
    console.error(`${slot}: Pexels returned an incomplete record; skipped (no credit row is ever invented).`);
    continue;
  }
  const img = await fetch(photo.src.large);
  if (!img.ok) {
    console.error(`${slot}: image download failed (HTTP ${img.status}); skipped.`);
    continue;
  }
  const file = `${slot}.jpg`;
  writeFileSync(join(outDir, file), Buffer.from(await img.arrayBuffer()));
  credits[slot] = {
    src: `/images/${file}`,
    alt: s.alt,
    sourceUrl: photo.url,
    photographer: photo.photographer,
    photographerUrl: photo.photographer_url ?? null,
    acquiredOn: today,
    licence: { name: "Pexels License", url: "https://www.pexels.com/license/" },
    modifications: "None (Pexels 'large' rendition, unmodified)",
    usedBy: s.usedBy,
  };
  installed++;
  console.log(`${slot}: installed (${photo.photographer})`);
  await new Promise((r) => setTimeout(r, 400));
}
writeFileSync(creditsPath, JSON.stringify(credits, null, 2) + "\n");
console.log(`Done: ${installed} image(s) installed; ${Object.keys(credits).length} credit row(s) in total. Now run: npm test && npm run build`);
