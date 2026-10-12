// Verifies that Presenter Demo Mode exists ONLY in the demo build (founder D4).
// Run after `npm run build` and `npm run build:demo`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MARKERS = ["PRESENTER MODE", "Simulated by presenter", "Undo all simulated changes"];

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
function scan(dir) {
  const hits = new Set();
  for (const f of files(dir).filter((x) => /\.(js|css|html)$/.test(x))) {
    const text = readFileSync(f, "utf8");
    for (const m of MARKERS) if (text.includes(m)) hits.add(`${m}  (${f})`);
  }
  return [...hits];
}

let failed = false;
if (!existsSync("dist")) {
  console.log("NOT RUN  dist/ missing — run `npm run build` first");
  failed = true;
} else {
  const hits = scan("dist").filter((h) => !h.startsWith("Simulated by presenter"));
  // The label "Simulated by presenter (demo)" is a data label shown on records and may appear in prod
  // only if such a record exists; the controls and banner must never be in the production bundle.
  const controls = hits.filter((h) => !h.startsWith("Simulated by presenter"));
  console.log(controls.length === 0 ? "PASS  production bundle (dist/) contains no presenter controls or banner" : `FAIL  presenter code found in dist/: ${controls.join("; ")}`);
  if (controls.length) failed = true;
}
if (!existsSync("dist-demo")) {
  console.log("NOT RUN  dist-demo/ missing — run `npm run build:demo` first");
  failed = true;
} else {
  const hits = scan("dist-demo");
  const ok = hits.some((h) => h.startsWith("PRESENTER MODE")) && hits.some((h) => h.startsWith("Undo all simulated changes"));
  console.log(ok ? "PASS  demo bundle (dist-demo/) contains Presenter Demo Mode" : "FAIL  demo bundle is missing Presenter Demo Mode");
  if (!ok) failed = true;
}
// NIVORA Move ideation prices must never appear in any built output (founder D3, AC-33).
const PRICE = /₹\s?(2,000|4,000|5,000|2000|4000|5000)(?![\d,])/;
for (const dir of ["dist", "dist-demo"]) {
  if (!existsSync(dir)) continue;
  const bad = files(dir).filter((f) => /\.(js|html)$/.test(f) && PRICE.test(readFileSync(f, "utf8")));
  console.log(bad.length === 0 ? `PASS  ${dir}/ contains none of the NIVORA Move ideation price figures` : `FAIL  ${dir}/ contains a Move ideation price figure: ${bad.join(", ")}`);
  if (bad.length) failed = true;
}
process.exit(failed ? 1 : 0);
