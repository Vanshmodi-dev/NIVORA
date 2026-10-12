# NIVORA release candidate — 2026-10-11

**Status: release candidate, NOT yet demo-ready.** The software passes every automated check. It cannot be called ready until the founder's manual items below are done and a physical rehearsal on the presentation laptop and projector has passed.

## What this candidate is

- Demo build: `npm run build:demo`, served with `npm run preview:demo` at http://localhost:4174/ (includes Presenter Mode). Production build: `npm run build` (port 4173, no Presenter Mode).
- Entry: gold brand intro, then Nivi's one-question-per-screen onboarding (name, phone or demo guest, location, origin, place, radius, count, preferences, results), then the existing Tenant and Owner apps.
- Images: 20 licensed Pexels photos (covers of the 14 tenant-visible listings and owner-pool images 1–6), each the exact file Pexels serves, each ≤150 KB, credited on `/credits` and labelled "Illustrative photo".
- Location: VGU is a founder-designated **test destination** only, at an approximate campus point. The overall location gate is **not** passed. Listing positions on the map are **simulated** and labelled so. Distances are straight-line, never travel time.

## Automated checks on this candidate (run 2026-10-11)

| Check | Result |
|---|---|
| `npm test` | 520 passed, 20 files |
| `npm run typecheck` | passed (exit 0) |
| `npm run lint` | passed (exit 0) |
| `npm run build` | built |
| `npm run build:demo` | built |
| `npm run check:bundles` | 4 of 4 pass (no Presenter code or Move prices in production) |
| `npm run preflight` | 0 failures, 1 warning (Firefox not installed on this machine) |

Most recent real-browser runs (Chrome, development machine, 2026-10-10, on the same code apart from documentation and the new install script): onboarding flow passed, E2E-01 passed 3 of 3, Presenter checks passed, axe-core 0 violations, 150 overflow checks clean, map-blocked fallback passed. Edge passed the onboarding flow on 2026-10-10.

## What remains before the physical rehearsal

1. **Four cover photos (your choice).** FX-01, FX-05, FX-08 and FX-15 are semi-furnished but their photos show fully furnished lounges (FX-08 also has a fireplace). Either replace them by following `docs/IMAGE_REPLACEMENT_PLAN.md` (about 30–45 minutes; needs a normal browser on pexels.com), or decide to keep them and record that in blueprint §20.10. Not done here: pexels.com pages are blocked from this development machine (HTTP 403), and no image was invented or swapped without its own Pexels page record.
2. **VGU pin check (you).** Compare 26.8117, 75.8899 with Google Maps or Bing on the VGU campus. If it is within about 300 m, write the sign-off line in blueprint §20.10 ("VGU pin compared on <date> by <name> …"); if not, send the corrected coordinate. Nobody has recorded this sign-off yet, and it will not be recorded until you confirm it. It confirms the test destination only, not the overall gate.
3. **Presentation laptop setup (you).** Copy the project to the laptop, run `npm install`, `npm run build:demo`, `npm run preflight` (fix any FAIL), then `npm run preview:demo`.

## What the physical rehearsal must cover (you, on the laptop and projector)

Use the checklist in `docs/DEMO_RUNBOOK.md` §5. In short:

- [ ] Two timed runs of the two-minute script from **Reset demo data**.
- [ ] One run with Wi-Fi off, one on the venue network if possible (map tiles need OpenStreetMap).
- [ ] Location prompt allowed once and blocked once; **Skip intro**, **Replay intro**, **Explore on my own**, browser Back.
- [ ] Presenter Mode: enter, one simulated change, **Undo all**.
- [ ] Readable from the back of the room; photos look right on the projector.
- [ ] Save a screen recording of a perfect run on the laptop and a second device.
- [ ] Laptop charged, notifications and sleep off, Edge available as a backup browser.

## Not tested (accept or arrange)

Firefox, Safari, a real phone or tablet, and any screen reader (NVDA, JAWS, VoiceOver, TalkBack). Only axe-core and keyboard checks have been done for accessibility.

## Decisions still with the founder

- Keep the four current photos, or replace them (item 1).
- OpenStreetMap tiles at the venue: allowed for light use with attribution, but with no service guarantee.
- The main app stays light with violet accents next to the black onboarding.
- Location gate questions for the future (not needed for this demo): campus and suburb tolerance, whether a mall or exhibition centre counts as an office area, which University of Rajasthan point, a C-Scheme landmark, the Jagatpura disagreement. See `docs/GEO_VERIFICATION_2026-10-10.md`.
- Kept as instructed: the phone-number step with its demo-guest option, the simulated-position and "Verified (demo)" disclosures.

## Go / no-go

| Question | Answer |
|---|---|
| Is the software complete and passing its checks? | Yes |
| Can it be rehearsed now? | Yes, after laptop setup (item 3); items 1 and 2 can be done before or after the first rehearsal |
| Is it ready for the competition demo? | **No, not yet.** It needs the VGU check (item 2), a decision on the four photos (item 1), and a passed physical rehearsal |
