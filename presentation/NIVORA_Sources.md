# NIVORA pitch deck: source register

Accessed: 12 October 2026. This file lists every external factual claim in `NIVORA_Pitch_Deck.pptx`, plus the project files used for claims about the prototype.

## 1. External factual claims

| # | Claim as shown | Slide(s) | Source title | Publisher | URL | Published | Notes and scope |
|---|---|---|---|---|---|---|---|
| E1 | About **2.17 crore** (21.72 million) urban households lived in rented homes | 2, 8 | *Institutionalising the Rental Housing Market in India* | Knight Frank (India) with Khaitan & Co. | https://content.knightfrank.com/research/1004/documents/en/india-topical-reports-institutionalising-the-rental-housing-market-in-india-2019-6718.pdf | 2019 | The report gives "21.72 million urban rented households" out of 27.37 million rented households, citing **Census 2011**. This is a national figure from 2011, not Jaipur-specific and not current. It is a secondary citation of the Census, and the primary Census table was not opened. |
| E2 | **71%** of renting households had no written rental agreement | 2 | Same report as E1 | Knight Frank (India) with Khaitan & Co. | Same as E1 | 2019 | The report attributes it to the National Sample Survey Office: "71% of the households living in rented accommodations do not have any written contract." The exact NSS round wasn't confirmed from a primary NSSO table (it is likely the 69th round, 2012), so the slide says only "NSSO data". The figure is about written contracts, not fraud. It is national. |
| E3 | **4.33 crore** students enrolled in higher education | 8 | Coverage of the *All India Survey on Higher Education (AISHE) 2021-22* release | Ministry of Education (via PTI / The Week) | https://www.theweek.in/wire-updates/national/2024/01/25/del154-moe-survey.html | 25 Jan 2024 | "Nearly 4.33 crore" in 2021-22. National, all higher education. The primary AISHE 2021-22 report (education.gov.in) was located but not opened: https://education.gov.in/sites/upload_files/mhrd/files/statistics-new/AISHE%20Book_2021-22_4.pdf |
| E4 | The Model Tenancy Act, 2021 is a model law that states may adopt (speaker context only, not on a slide) | Notes context | "Introduction of the Model Tenancy Act, 2021" | Mondaq | https://www.mondaq.com/Article/1080104 | 2021 | Approved by the Union Cabinet on 2 June 2021 "for circulation to all States and Union Territories for adaptation". Use it only to explain why legal validation is part of Stage 2, not as a claim that NIVORA complies with any law. |

**What was deliberately left out:** there are no TAM, SAM or SOM figures, no Jaipur market size, no competitor comparisons, no scam or broker-fee statistics, and no growth rates. No trustworthy Jaipur-specific rental figure was found in the time available. Slide 8 explains how Jaipur will be sized during the pilot instead.

## 2. Claims about the NIVORA prototype (from the project)

| Claim | Slide(s) | Project source |
|---|---|---|
| Brand name, descriptor and tagline | 1, 10 | `docs/NIVORA_MASTER_PROTOTYPE_BLUEPRINT.md` §2.1; `src/components/ui/BrandMark.tsx` (the logo geometry was redrawn exactly from `BRAND_MARK_PATHS`, in gold) |
| Guided onboarding with Nivi, choosing a place, a 2–10 km radius, preferences, and results | 4, 5, 9 | Blueprint §20.8–20.9; `docs/DEMO_RUNBOOK.md` |
| VGU is a founder-designated **test destination** only, and the wider location gate hasn't passed | 5, 6 | Blueprint §20.9–20.11; `docs/GEO_VERIFICATION_2026-10-10.md` |
| Listings are fictional, positions are simulated, distances are straight-line | 5 | Blueprint §2.3 (TP-1, TP-9, TP-11); on-screen labels |
| Four trust checks, labelled (demo), with no real verification | 4, 6 | `src/domain/trustContent.ts`; blueprint §8 |
| Tenant and owner views share visit requests (local demo records) | 4, 6, 9 | Blueprint §3.4, §9 |
| Rent and maintenance tracking exist only as local demo records | 7 (notes) | Blueprint §3.4 (P1) |
| Agreements, Move, Protect and property-management expansion are future concepts | 4, 7 | `src/pages/Roadmap.tsx`; blueprint §10 |
| 520 automated tests passing (11 Oct 2026). The prototype is a release candidate, not yet signed off as demo-ready | 9 | `docs/RELEASE_CANDIDATE_REPORT.md` |

## 3. Screenshots

All screenshots are of the real NIVORA prototype. Nothing was edited apart from cropping and rounded corners.

| File in deck | Slide | Origin |
|---|---|---|
| Welcome screen | 4 | Captured on 12 Oct 2026 from the project's `dist-demo` build (headless Chromium, 1440×900 @2x) |
| Name step (Nivi) | 5 | Captured on 12 Oct 2026 from `dist-demo` |
| Radius step, with OpenStreetMap tiles and attribution visible | 5 | `docs/evidence/onboarding/o09-radius.png` (project evidence, 10 Oct 2026) |
| Furnishing step | 5 | `docs/evidence/onboarding/o11-furnish.png` (project evidence, 10 Oct 2026) |
| Results cards | 5 | Captured on 12 Oct 2026 from `dist-demo`, VGU at 10 km with no filters. Map tiles couldn't load in the capture environment, so the image is cropped to the listing cards and the on-screen disclaimer line. |
| Verification details | 6 | Captured on 12 Oct 2026 from `dist-demo`, property `prop_fx_06` (Builder Floor 2 BHK, Jagatpura) |

Map data in the radius screenshot: © OpenStreetMap contributors, via Leaflet.

## 4. Photographs

All photos are already in the project (`public/images/`) under the **Pexels License** (https://www.pexels.com/license/), as recorded in `src/data/images.credits.json` and `docs/IMAGE_ACQUISITION_LOG.md`. They are illustrative stock images. They are not NIVORA properties, users or listings. For the deck they were cropped only, and on slides 1 and 10 a dark overlay was placed over them.

| Slide | Project file | Pexels page | Photographer |
|---|---|---|---|
| 1 (cover) | `fx14-1.jpg` | https://www.pexels.com/photo/a-room-with-a-large-window-and-white-cupboards-26859478/ | Alexander F Ungerer |
| 3 (Students) | `fx09-1.jpg` | https://www.pexels.com/photo/modern-flat-with-cozy-bed-and-loft-style-lamp-6782426/ | Max Vakhtbovych |
| 3 (Working professionals) | `fx02-1.jpg` | https://www.pexels.com/photo/new-spacious-room-in-contemporary-apartment-7040700/ | Max Vakhtbovych |
| 5 (inside the results screenshot) | `fx06-1.jpg`, `fx08-1.jpg`, `fx01-1.jpg` | See `docs/IMAGE_ACQUISITION_LOG.md` | Max Vakhtbovych; I'm Zion |
| 10 (closing) | `fx06-1.jpg` | https://www.pexels.com/photo/empty-room-with-balcony-and-parquet-floor-7031621/ | Max Vakhtbovych |

**Photography limitation:** the brief asked for human-centred photos of young Indian renters. No new external images could be downloaded from this working environment, because image hosts were blocked. The deck therefore uses only the project's existing licensed interior photos, and none of them show people. If you want people on slides 2 and 3, source properly licensed images (for example from Pexels, with the photographer credited) and replace them in PowerPoint.

Icons are from Lucide, via react-icons (ISC licence). This matches the icon family the prototype uses.
