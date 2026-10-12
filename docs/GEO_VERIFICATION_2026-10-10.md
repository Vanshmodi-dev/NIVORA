# Geographic reference verification — second pass (2026-10-10)

Companion to `src/data/reference.ts` and blueprint §13.6.2 (the mandatory gate). Lookups were done one at a time in a real browser (Claude desktop app browser pane): Nominatim (OpenStreetMap), Bing Maps place pages, Esri World Imagery, and the institutions' own websites. Distances are great-circle (haversine) metres.

**Verdict: the §13.6.2 gate is NOT passed.** No status was changed to `verified`. The VGU coordinate was **not** changed.

## What the gate requires (from §13.6.2 and `evaluateMapGate()`)

For every anchor **and** every one of the 11 locality centroids: (1) official name from the operator's own website; (2) existence and place in Jaipur; (3) centre coordinate from **OpenStreetMap**, rounded to 4 dp, cross-checked against a **second independent map**, agreeing within ~300 m; (4) OSM attribution; (5) a full record; (6) fixture sanity check: spot-check ≥3 property–anchor distances against a map ruler (±10 %); (7) founder sign-off. The code additionally needs ≥4 verified anchors including ≥3 colleges and ≥2 office areas (in practice ≥5), and all 11 localities verified.

## Source independence

| Source | What it is | Independent of the others? |
|---|---|---|
| Google Maps place point (via VGU's official links) | Google's POI database | Base source for VGU |
| Wikidata Q19899106 P625 | 26.81168, 75.88989, no reference | **No** — identical to Google's place point to 5 decimals; treated as copied |
| VGU contact-page embed `!2d75.887768!3d26.811677` | Centre of an embedded map view | **No** — a viewport centre from the same Google place, not a pin |
| VGU site link `@26.8113487,75.8899177` | Camera position of a Street View photo sphere | **No** — not a place coordinate at all (the previous pass treated it as one) |
| OpenStreetMap / Nominatim | Volunteer map data (ODbL) | Yes. Has no VGU feature |
| Bing Maps entity points | Microsoft's POI data | Treated as independent of Google and OSM (separate provider; provenance not published, so not provable) |
| Esri World Imagery | Satellite/aerial imagery, no labels used | Yes for "is there a campus here"; cannot confirm a name |

## Verification table

| Candidate | Proposed coordinate (in `reference.ts`) | Source URL | What the source confirms | Independence | Remaining uncertainty |
|---|---|---|---|---|---|
| **VGU** (test destination) | 26.8117, 75.8899 — unchanged | https://vgu.ac.in/ ; https://vgu.ac.in/contact/ | Official name; address "Sector-36, Sisyawas, NRI Road, VIT Campus, Karolan Ka Barh, Jaipur 303012" / contact page "NRI Road, Jagatpura, Jaipur – 303012"; links to Google place point 26.81168, 75.88989 (**2 m** from app pin) | Google-derived | Which point on the campus; Google's own basis |
| | | https://www.bing.com/maps?q=Vivekananda+Global+University+Jaipur | Entity "Vivekananda Global University", vgu.ac.in, at 26.81203, 75.89158 → **171 m** from app pin | Independent provider | Bing provenance unknown |
| | | https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer (export, bbox 75.882,26.805,75.898,26.818) — `docs/evidence/geo/vgu-esri-imagery-2026-10-10.png` | A large institutional compound (multi-storey blocks, sports ground) lies between two east–west roads; the app pin and the Bing point both fall inside it, ~170 m apart | Independent imagery | Imagery does not show a name |
| | | https://nominatim.openstreetmap.org/ (search "Vivekananda Global University", "Vivekananda Institute of Technology, Jaipur", "Sisyawas") ; https://www.openstreetmap.org/query?lat=26.81168&lon=75.88989 | OSM has **no** VGU feature and no named feature at the pin | — | Gate step 3 as written (OSM-derived centre) cannot be met for VGU |
| **MNIT** | **26.8618, 75.8099** (was 26.8655, 75.8075) | https://www.mnit.ac.in/ | Official name "Malaviya National Institute of Technology Jaipur" | — | — |
| | | https://nominatim.openstreetmap.org/lookup?osm_ids=N8068694596 | The previously stored point is OSM node 8068694596 = **a bus stop** named "MNIT Jaipur", not the campus | — | Corrected |
| | | Nominatim search "institute" in the MNIT area | OSM node 3476221911 "Malviya National Institute of Technology", building=college, 26.86184, 75.80994 | OSM | A single building node, not the campus centroid |
| | | https://www.bing.com/maps?q=MNIT+Jaipur | Entity "Malaviya National Institute of Technology Jaipur (MNIT)", JLN Marg 302017, 26.86397, 75.81078 → **251 m** from new point (old bus-stop point: 367 m) | Independent | Founder sign-off; step 6 |
| **University of Rajasthan** | 26.8867, 75.8194 — unchanged | https://www.uniraj.ac.in/ | Official name "University of Rajasthan" | — | — |
| | | Nominatim way 1554719758 | landuse=education, centroid now 26.88614, 75.81930 (63 m from stored) | OSM | OSM node "Rajasthan University" (amenity=university) is 575 m away: OSM itself has two candidate points |
| | | https://www.bing.com/maps?q=University+of+Rajasthan+Jaipur | Returned "University Rajasthan College" (a constituent college) at 26.87965, 75.81265 → **978 m** | Independent but a **different entity** | No comparable second point; fails |
| **IIS University** | none (unchanged) | https://www.iisuniv.ac.in/ | Official name "IIS (Deemed to be University)" | — | — |
| | | Nominatim | No OSM feature | — | — |
| | | https://www.bing.com/maps?q=IIS+University+Jaipur | 26.83733, 75.77029, "6-69, Swati Mehrotra Road, Jaipur 302020" | Single source | Fails step 3 (no OSM) |
| **SMS Medical College** | 26.9059, 75.8161 — unchanged | Nominatim | No college feature; SMS Hospital node 4793756922 at 26.90602, 75.81610 | OSM (hospital, not college) | — |
| | | https://www.bing.com/maps?q=SMS+Medical+College+Jaipur | "Sms medical College jaipur", JLN Marg, 26.90595, 75.81831 → 219 m from the hospital node | Independent | Compares a hospital with a college; official site not confirmed (Bing links medicaleducation.rajasthan.gov.in/smsjaipur) |
| **World Trade Park** (office area?) | 26.854, 75.8052 — unchanged | Nominatim way 864605441 | building, 26.85398, 75.80527 | OSM | — |
| | | https://www.bing.com/maps?q=World+Trade+Park+Malviya+Nagar+Jaipur | "World Trade Park", shopping center, website wtpjaipur.com, 26.85299, 75.80488 → **117 m** | Independent | Opening wtpjaipur.com failed in the browser → step 1 open; it is a mall, not an office area (founder decision) |
| **JECC / Sitapura** (office area?) | 26.7828, 75.827 — unchanged | Nominatim way 754510581 | amenity=convention_centre, 26.78283, 75.82701 | OSM | — |
| | | https://www.bing.com/maps?q=Jaipur+Exhibition+and+Convention+Centre+Sitapura | "JECC", Road No. 5, Sector D, Sitapura Industrial Area, 26.78487, 75.82627 → **238 m** | Independent | No official website found (step 1); exhibition centre vs office area (founder decision) |
| **C-Scheme business district** | none | — | An area, not a point | — | Needs a founder-chosen landmark |
| Manipal University Jaipur, Mahindra World City | — | — | **Not researched** (excluded by founder decision D2) | — | Only with explicit founder approval |

### Localities (OSM / stored point vs Bing locality point)

| Locality | Stored point | Bing Maps point | Distance | Within 300 m? |
|---|---|---|---|---|
| Malviya Nagar | 26.8545, 75.8115 (estimate) | 26.85545, 75.82037 | 886 m | No |
| C-Scheme | 26.9065, 75.8000 (estimate) | businesses only, no locality point | — | No data |
| Vaishali Nagar | 26.9096, 75.7392 (OSM node) | 26.90601, 75.74074 | 427 m | No |
| Mansarovar | 26.8500, 75.7640 (estimate) | 26.86247, 75.76241 | 1,396 m | No |
| Raja Park | 26.9010, 75.8260 (estimate) | 26.89448, 75.83441 | 1,105 m | No |
| Bani Park | 26.9317, 75.7958 (OSM node) | returned a hotel, no locality point | — | No data |
| Jagatpura | 26.8336, 75.8273 (OSM node) | 26.80094, 75.85822 | **4,754 m** | No — sources disagree on where Jagatpura is |
| Sitapura | 26.7827, 75.8379 (OSM node) | 26.77660, 75.84215 ("Sitapur") | 799 m | No |
| Jawahar Nagar | 26.8930, 75.8362 (OSM node) | 26.89433, 75.83506 | 186 m | Yes (still needs sign-off) |
| Sodala | 26.9020, 75.7736 (OSM node) | 26.90566, 75.77100 | 482 m | No |
| Gopalpura (Tonk Road) | 26.8738, 75.7780 (OSM node) | resolved to a different village (Phagi) | — | No data |

Locality "centres" are area labels placed differently by each provider; a 300 m tolerance is probably unrealistic for whole suburbs (see decisions below).

## Is the VGU pin the campus, an approximate point, or an entrance?

It is **Google's place pin for the university**, reproduced to 2 m. It is an approximate campus point: imagery puts it inside the built-up core of the compound. No source marks it as a gate or entrance, and no source gives an entrance coordinate. Bing places the university ~170 m further east-north-east inside the same compound. The demo counts do not change for pin errors up to 250 m (blueprint §20.10).

## What remains for a human

1. **VGU:** open Google Maps (or Bing) on your phone, search VGU, and confirm the main campus is at the app's point (26.8117, 75.8899) — the satellite view should show the same compound as `docs/evidence/geo/vgu-esri-imagery-2026-10-10.png`. If you agree, record "VGU pin compared on <date> by <name>" in blueprint §20.10.
2. **Gate step 6** (spot-check ≥3 property–anchor distances with a map ruler) has not been done for any anchor.
3. **Founder decisions** listed in the session handoff (tolerance for campuses and suburbs, mall/exhibition centre as "office areas", which UniRaj point, C-Scheme landmark, Jagatpura conflict).
