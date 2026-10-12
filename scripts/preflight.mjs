#!/usr/bin/env node
/**
 * Pre-demo check for the presentation laptop:  npm run preflight
 * Run it on the machine and network you will present on. It changes nothing.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let fails = 0;
let warns = 0;
const out = (level, msg) => {
  if (level === "FAIL") fails++;
  if (level === "WARN") warns++;
  console.log(`${level.padEnd(4)}  ${msg}`);
};

const newest = (dir) => {
  let m = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    m = Math.max(m, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return m;
};

const major = Number(process.versions.node.split(".")[0]);
out(major >= 20 ? "PASS" : "FAIL", `Node ${process.versions.node} (20 or newer needed)`);

const demo = join(root, "dist-demo");
if (!existsSync(join(demo, "index.html"))) out("FAIL", "dist-demo/ is missing. Run: npm run build:demo");
else {
  out("PASS", "dist-demo/ exists (the demo build, with Presenter Mode)");
  const stale = newest(join(root, "src")) > statSync(join(demo, "index.html")).mtimeMs;
  out(stale ? "WARN" : "PASS", stale ? "dist-demo/ is OLDER than the source. Run: npm run build:demo" : "dist-demo/ is newer than the source");
  const hasPresenter = readdirSync(join(demo, "assets")).some((f) => /^PresenterUI.*\.js$/.test(f));
  out(hasPresenter ? "PASS" : "FAIL", hasPresenter ? "demo build contains Presenter Mode" : "demo build has no Presenter Mode chunk (wrong build?)");
}
const prod = join(root, "dist");
if (existsSync(join(prod, "assets"))) {
  const leaked = readdirSync(join(prod, "assets")).some((f) => /^PresenterUI.*\.js$/.test(f));
  out(leaked ? "FAIL" : "PASS", leaked ? "production build contains Presenter code" : "production build has no Presenter code");
}

const credits = JSON.parse(readFileSync(join(root, "src", "data", "images.credits.json"), "utf8"));
const n = Object.keys(credits).length;
out(n > 0 ? "PASS" : "WARN", n > 0 ? `${n} licensed image(s) installed with credits` : "No licensed images installed: listings show placeholders (see docs/DEMO_RUNBOOK.md)");

const probe = async (label, url, level) => {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "NIVORA-preflight/1.0" } });
    out(res.ok ? "PASS" : level, `${label}: HTTP ${res.status} in ${Date.now() - t0} ms`);
  } catch (e) {
    out(level, `${label}: unreachable (${e instanceof Error ? e.message : e}). The demo still works without it; see the backup plan.`);
  }
};
await probe("OpenStreetMap tiles (map background)", "https://tile.openstreetmap.org/11/1453/890.png", "WARN");
await probe("OpenStreetMap place search (optional)", "https://nominatim.openstreetmap.org/status.php?format=json", "WARN");

const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
  ["Firefox", "C:/Program Files/Mozilla Firefox/firefox.exe"],
];
for (const [name, path] of browsers) out(existsSync(path) ? "PASS" : "WARN", `${name} ${existsSync(path) ? "found" : "not found at the usual path (fine if you do not present in it)"}`);

console.log(`\n${fails ? "NOT READY" : "No blockers found"}: ${fails} failure(s), ${warns} warning(s). Then do the manual rehearsal checklist in docs/DEMO_RUNBOOK.md.`);
process.exit(fails ? 1 : 0);
