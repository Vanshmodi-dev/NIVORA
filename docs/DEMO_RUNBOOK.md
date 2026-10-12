# NIVORA demo runbook

Companion to `docs/NIVORA_MASTER_PROTOTYPE_BLUEPRINT.md` (§20.10 has the go/no-go status). Use this on the presentation laptop.

## 0. Status in one line

**NO-GO for a competition demo until the blockers in §6 are cleared.** The software works. As of 2026-10-10 the 20 `demo-minimum` photos are installed (every tenant-visible card has a cover), but the build and tests have not been re-run since, the screens have not been looked at with the photos in place, and the VGU pin still needs a human comparison.

## 1. Set up the presentation laptop (once, about 10 minutes)

1. Install Node 20 or newer, then in the project folder: `npm install`.
2. `npm run build:demo` (the demo build, which includes Presenter Mode), then `npm run preview:demo`. Open **http://localhost:4174/** in Chrome or Edge.
3. In another terminal: `npm run preflight`. It checks the build is fresh, Presenter Mode is only in the demo build, whether licensed images are installed, and whether OpenStreetMap is reachable on **this** network. Fix any FAIL; read every WARN.
4. Connect the projector, set the browser zoom to 100–125 %, and put the browser in full screen (F11). Do not use the production build (`dist/`, port 4173) for the demo: it has no Presenter Mode.
5. Allow location when the browser asks only if you want to demonstrate "Near my current location"; otherwise choose **Not now**. Browser location needs `localhost` or HTTPS.

## 2. Two-minute script

Start from a fresh tab: open the Reset dialog (`http://localhost:4174/#/?reset=1`), press **Reset demo data**, and the intro replays.

| Time | Say / do |
|---|---|
| 0:00 | The black intro plays: gold particles form the NIVORA mark, then the tagline. *"This is NIVORA, the rental living ecosystem."* (Press **Skip intro** if you are short on time.) |
| 0:10 | Nivi flies in. Type a first name, **Continue**. *"Nivi guides one question at a time."* |
| 0:20 | Phone screen: press **Use a demo guest instead**. *"No number is sent or stored. Nothing is verified in this prototype."* |
| 0:25 | Location: press **Not now** (or **Yes**) and **Continue**. Choose **Near my college or office**, **Continue**. |
| 0:35 | Press **Vivekananda Global University (VGU)**. Point at the OpenStreetMap map. *"A test destination with an approximate position."* **Continue**. |
| 0:45 | Press **10 km**. Point at the circle. *"Straight-line distance, not travel time."* **Continue**. |
| 0:55 | Nivi reads the count (4 at 10 km). *"From the demo homes only. Their map positions are simulated."* |
| 1:05 | **Continue** through furnishing, budget, type, rooms (pick Apartment), then **Show me homes**. |
| 1:25 | Results: point at the distance notes and the "Verified (demo)" labels. Open one home, show **Trust** and **Request a Visit** (phone sharing is off by default). |
| 1:50 | Press **Explore on my own**, then the role switcher (Owner) to show Enquiries and Rent Tracking. |
| 2:00 | Close. *"Everything you saw is fictional demonstration data."* |

Presenter Mode (optional, demo build only): **About this prototype**, then **Presenter tools…**, to show a simulated verification outcome labelled "Simulated by presenter (demo)". Use **Undo all** afterwards.

## 3. What you must not say

- That any home, price, verification, rent payment or request is real.
- That distances are travel times, or that search covers every home in an area.
- That VGU's position is exact, or that NIVORA is affiliated with VGU.
- That photographs are of the specific property (they are illustrative stock images, labelled "Illustrative photo").

## 4. Backup plan

| If this happens | Do this |
|---|---|
| The map shows grey or a notice about tiles | The venue network blocks OpenStreetMap. Carry on: destination, radius, counts and results still work. Say so honestly. |
| No internet at all | The demo build runs from `localhost`. Only the map background and place search need the internet. |
| The browser asks for location and you do not want it | Press Block or **Not now**. Nothing else changes. |
| The intro stutters on the projector laptop | Press **Skip intro** (or Escape). Reduced-motion mode shows a calm static version. |
| The app looks stuck or a previous run left data behind | Open `http://localhost:4174/#/?reset=1`, confirm **Reset demo data**. This restores seed data and restarts the onboarding. |
| The dev server will not start | Serve the already-built `dist-demo/` folder with any static server, or run `npm run preview:demo` again. |
| Chrome misbehaves | Open the same URL in Edge. Both were tested. |
| Everything fails | Play the screen recording you made during rehearsal (make one: record the full two-minute run once). |

## 5. Final rehearsal checklist (tick every line on the presentation laptop)

- [ ] `npm run build:demo` done today; `npm run preflight` shows no FAIL.
- [ ] Photos reviewed on the projector; the four semi-furnished covers replaced, or the founder accepts them as they are (see §6.1).
- [ ] VGU pin compared with a second map and signed off (see §6.2).
- [ ] Ran the full two-minute script twice from **Reset demo data** with a stopwatch.
- [ ] Ran it once with Wi-Fi off, and once with the venue Wi-Fi if possible.
- [ ] Tried both answers to the location prompt (allow and block).
- [ ] Tried **Skip intro**, **Replay intro** (About), and **Explore on my own**.
- [ ] Checked text size and the **Continue** button are readable from the back of the room.
- [ ] Browser Back works through the onboarding steps.
- [ ] Presenter Mode entry, one simulated change, and **Undo all** work (demo build).
- [ ] A recording of a perfect run is saved on the laptop and a second device.
- [ ] Laptop charged, power cable, notifications off, sleep and screen saver off.

## 6. Remaining tasks before this can be called demo-ready

1. **Images (partly done).** The 20 `demo-minimum` photos are installed, credited and checked (exact Pexels bytes, all ≤150 KB). Still to do: replace the four semi-furnished covers (FX-01, FX-05, FX-08, FX-15), or decide to keep them. Step-by-step plan, search words and the safe install command (`npm run images:install`): `docs/IMAGE_REPLACEMENT_PLAN.md`. The 62 `full`-tier slots stay placeholders, which is acceptable for the demo.
2. **VGU pin (needs a human; evidence: `docs/GEO_VERIFICATION_2026-10-10.md`).** Bing Maps puts VGU 171 m from the pin, inside the same campus on satellite imagery. Compare 26.8117, 75.8899 with a second map (for example Google Maps) on the VGU campus. If it is within about 300 m, mark it signed off in the blueprint (§20.9). If not, send the corrected coordinate. The demo counts do not change for errors up to 250 m. Record the sign-off only after the founder has done or confirmed the comparison: write "VGU pin compared on <date> by <name>: <result>" in blueprint §20.10. This does not pass the overall location gate, which still needs four verified anchors (three colleges, two office areas), all eleven localities and gate step 6.
3. **Rehearse on the real presentation laptop and projector** (§5). The tests so far ran on a development machine (Windows 10, Chrome and Edge, headless).
4. **Browsers and devices not yet tested:** Firefox, Safari, a real phone and a tablet. On a phone, open `http://<laptop-ip>:4174/` (start with `npm run preview:demo -- --host`) on the same Wi-Fi.
5. **Screen reader:** not tested (see blueprint §20.10).
6. **Founder decisions:** the phone-number step and its demo-guest option stay for now (founder instruction, 2026-10-11; nothing uses the number); confirm that OpenStreetMap tiles are acceptable at the venue (their policy allows light use with attribution, with no guarantee); decide whether the light main app should stay as it is next to the black onboarding.
