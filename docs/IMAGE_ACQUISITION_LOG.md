# Image acquisition log — demo-minimum set (2026-10-10)

Companion to `src/data/images.credits.json` (the registry the app reads) and `scripts/image-plan.json`. Blueprint §14.13, Annex A.

## How these were acquired

- **Source:** Pexels only (founder decision D1). No API key was requested, created or stored.
- **Selection:** photos were searched for and chosen by eye on pexels.com in a real browser (the Claude desktop app's browser pane on the founder's computer), against each slot's hint (type, furnishing, room). Results with no alt text (sponsored/third-party tiles) were skipped.
- **Evidence per photo:** each photo's own Pexels page (`https://www.pexels.com/photo/<id>/`) was opened and its canonical URL and its schema.org `ImageObject` record were read: `license`, `creator.name`, `creator.url`, `isAccessibleForFree`, original width × height. Every row below came from that page; nothing was typed in by hand.
- **File:** the Pexels-served rendition `images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1200` (w=1000 where the 1200 px file exceeded the 150 KB budget of §14.12) was downloaded once in that browser, transferred byte-for-byte (SHA-256 checked on both ends) and saved as `public/images/<slot>.jpg`. No crop, resize or re-encode by NIVORA; the app crops on screen with `object-fit: cover`.
- **Licence text read on 2026-10-10 at https://www.pexels.com/license/:** all photos free to use; attribution not required (credit given anyway on `/credits`); modification allowed; not allowed: showing identifiable people in a bad light, selling unaltered copies, implying endorsement by people or brands shown, redistributing on other stock/wallpaper platforms, using as a trademark. This is engineering guidance, not legal advice.
- **Visual screening:** every file was viewed at full size and as 4:3 card and 16:9 hero centre-crops. No people, faces, logos, watermarks, house numbers or readable signage were found. Notes on borderline items are in the review section below.

## Register (20 photos)

| Slot / file | Used by | Pexels ID | Pexels page | Photographer | Licence (from page) | Acquired | Rendition | Bytes | SHA-256 (first 16) |
|---|---|---|---|---|---|---|---|---|---|
| `public/images/fx01-1.jpg` | NIV-DEMO-P001 | 9494898 | https://www.pexels.com/photo/sofa-in-a-spacious-living-room-9494898/ | [I'm Zion](https://www.pexels.com/@zion/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 6699x4466) | 85,032 | `aa142517bea386f2` |
| `public/images/fx02-1.jpg` | NIV-DEMO-P002 | 7040700 | https://www.pexels.com/photo/new-spacious-room-in-contemporary-apartment-7040700/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7335x4895) | 123,415 | `3be844818896f38d` |
| `public/images/fx03-1.jpg` | NIV-DEMO-P003 | 3990590 | https://www.pexels.com/photo/brown-wooden-tv-hutch-with-black-flat-screen-tv-3990590/ | [Curtis Adams](https://www.pexels.com/@curtis-adams-1694007/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1000 px wide (original 5000x3333) | 123,081 | `072a9d55ecd088df` |
| `public/images/fx04-1.jpg` | NIV-DEMO-P004 | 3958953 | https://www.pexels.com/photo/white-wooden-door-closet-3958953/ | [Curtis Adams](https://www.pexels.com/@curtis-adams-1694007/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 5000x3333) | 144,582 | `8851030894842483` |
| `public/images/fx05-1.jpg` | NIV-DEMO-P005 | 16056400 | https://www.pexels.com/photo/apartment-living-room-16056400/ | [Erdem ÖZDEMİR](https://www.pexels.com/@erdemozdemir/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 6000x3376) | 92,123 | `770317363b36f5ef` |
| `public/images/fx06-1.jpg` | NIV-DEMO-P006 | 7031621 | https://www.pexels.com/photo/empty-room-with-balcony-and-parquet-floor-7031621/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7360x4912) | 69,976 | `1df233af53357468` |
| `public/images/fx07-1.jpg` | NIV-DEMO-P007 | 6920439 | https://www.pexels.com/photo/modern-living-room-design-with-corner-sofa-6920439/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7236x4802) | 104,003 | `92f6d0fb6d5e9829` |
| `public/images/fx08-1.jpg` | NIV-DEMO-P008 | 7546648 | https://www.pexels.com/photo/interior-design-of-room-7546648/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7342x4900) | 96,471 | `7482b4b1d6f29dfb` |
| `public/images/fx09-1.jpg` | NIV-DEMO-P009 | 6782426 | https://www.pexels.com/photo/modern-flat-with-cozy-bed-and-loft-style-lamp-6782426/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7360x4912) | 122,063 | `4adf2c56fb69e8a1` |
| `public/images/fx10-1.jpg` | NIV-DEMO-P010 | 7148779 | https://www.pexels.com/photo/white-and-red-sectional-couch-7148779/ | [Souranshi Fashion and Lifestyle Magazine](https://www.pexels.com/@souranshi-fashion-and-lifestyle-magazine-2959920/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 8256x5504) | 127,208 | `f24ea30ac72ce542` |
| `public/images/fx13-1.jpg` | NIV-DEMO-P013 | 7546557 | https://www.pexels.com/photo/contemporary-living-room-interior-design-7546557/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7342x4900) | 132,550 | `b4e80e46300b12f5` |
| `public/images/fx14-1.jpg` | NIV-DEMO-P014 | 26859478 | https://www.pexels.com/photo/a-room-with-a-large-window-and-white-cupboards-26859478/ | [Alexander F Ungerer](https://www.pexels.com/@alexander-f-ungerer-157458816/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 6000x4000) | 129,059 | `9649809baa075147` |
| `public/images/fx15-1.jpg` | NIV-DEMO-P015 | 6580396 | https://www.pexels.com/photo/modern-design-of-an-apartment-flat-6580396/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7340x4899) | 132,628 | `614233b3e02baa9c` |
| `public/images/fx16-1.jpg` | NIV-DEMO-P016 | 8146158 | https://www.pexels.com/photo/white-room-with-wooden-flooring-8146158/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 7360x4912) | 72,338 | `dab751eb5ce803d5` |
| `public/images/pool-01.jpg` | owner pool | 6180679 | https://www.pexels.com/photo/interior-of-cozy-bedroom-at-home-6180679/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 6113x4179) | 120,908 | `738b7226b52946ac` |
| `public/images/pool-02.jpg` | owner pool | 7303726 | https://www.pexels.com/photo/minimalist-kitchen-furniture-7303726/ | [Cup of Couple](https://www.pexels.com/@cup-of-couple/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 5932x3955) | 57,977 | `f03e8435473c99bb` |
| `public/images/pool-03.jpg` | owner pool | 6890406 | https://www.pexels.com/photo/toilet-and-sink-in-modern-light-bathroom-6890406/ | [Max Vakhtbovych](https://www.pexels.com/@artbovich/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 6147x4650) | 77,041 | `64054691201fdb72` |
| `public/images/pool-04.jpg` | owner pool | 17000987 | https://www.pexels.com/photo/railing-on-sunlit-balcony-17000987/ | [hi room](https://www.pexels.com/@hiroom/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1000 px wide (original 6016x4016) | 111,922 | `30f3b781212f3871` |
| `public/images/pool-05.jpg` | owner pool | 2111768 | https://www.pexels.com/photo/white-concrete-building-with-black-metal-railings-2111768/ | [Luis Quintero](https://www.pexels.com/@jibarofoto/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1000 px wide (original 6240x4160) | 118,172 | `964fa1b18e14585f` |
| `public/images/pool-06.jpg` | owner pool | 4119832 | https://www.pexels.com/photo/interior-design-of-a-simple-house-4119832/ | [Curtis Adams](https://www.pexels.com/@curtis-adams-1694007/) | Pexels License, https://www.pexels.com/license/ (free: true) | 2026-10-10 | 1200 px wide (original 5000x3333) | 131,328 | `d8f50c6290c7b9ff` |

Attribution required: **No** (Pexels License), shown anyway on the in-app Credits page. Modifications by NIVORA: **none**.

## Slots completed vs not done

- **Completed (20/20 demo-minimum):** fx01-1, fx02-1, fx03-1, fx04-1, fx05-1, fx06-1, fx07-1, fx08-1, fx09-1, fx10-1, fx13-1, fx14-1, fx15-1, fx16-1, pool-01 … pool-06.
- **Blocked:** none of the 20. One candidate (Pexels 6077368) was dropped after viewing because a distinctive tower was visible through the window; 6580396 replaced it for fx15-1.
- **Not started (62, tier `full`):** fx01-2…5, fx02-2…5, fx03-2…5, fx04-2…4, fx05-2…4, fx06-2…3, fx07-2…5, fx08-2…3, fx09-2…3, fx10-2…4, fx11-1…3, fx12-1, fx13-2…4, fx14-2…3, fx15-2…3, fx16-2…3, pool-07…24. Listings therefore show one photo each in the gallery.

## Visual review against the UI contexts (crop check at 4:3 card and 16:9 hero)

Not run in the live app (see the session report: no build could be run). Findings from the files and simulated crops:

1. **Furnishing mismatch (semi-furnished listings shown fully furnished):** fx01-1 (FX-01 semi), fx05-1 (FX-05 semi), fx08-1 (FX-08 semi), fx15-1 (FX-15 semi) show complete lounges. §14.13 only forbids a furnished lounge on an *unfurnished* listing, which is respected (fx04, fx06, fx14, fx16 are empty rooms), but a stricter reading would want sparser rooms for semi-furnished homes.
2. **Regional look:** most photos are European/North-American interiors (parquet, radiators, US-style carpet in fx03-1 and fx04-1). Only fx10-1 (photographed in a Mumbai home) looks Indian. Fine for illustrative stock, but a judge may notice. Replacing with Indian interiors is a founder choice.
3. **fx10-1 (FX-10, 'Spacious 4 BHK Villa', currently Unavailable):** luxurious, consistent with ₹75,000; card is greyed out by the app because the listing is unavailable.
4. **fx02-1 / fx09-1 studios:** both read clearly as studios (sofa + kitchen in one room; bed + dining in one room).
5. **fx03-1 (Independent House):** interior only; no exterior is shown, so 'house' is not visible from the cover. Acceptable for a living-area slot.
6. **pool-03 bathroom:** the 16:9 hero crop cuts the toilet bowl in half; fine at 4:3. Only matters if an owner picks it as a cover.
7. **pool-04 balcony:** distant generic apartment blocks and a few towers are visible; no recognisable named landmark identified. **pool-05 facade:** a generic colonial-style balcony facade with no signage or numbers; it is not identifiable to us, but it is a real building.
8. **fx15-1:** a magazine lies on the coffee table; at the delivered resolution no text or face on it is legible.
9. **Disclosure gap fixed in code:** property cards had no *Illustrative photo* chip (§14.12 makes it mandatory on card overlays); it is now shown on any card whose cover is a real photo. The owner wizard's "images haven't been added" notice would have disappeared with 6 of 24 pool images installed; it now says only some are installed. Owner-side small thumbnails (Properties list, Enquiries, Requests rows) still carry no chip.


## Integration check in the repository (Claude Code, 2026-10-10)

- **Files found:** all 20 files exist at `public/images/<slot>.jpg`, each matches its credit row, its plan `pexelsId` and its slot (`fxNN-1` is the first photo of fixture NN, credited to that fixture's display code; `pool-01…06` are owner-pool slots). A test now enforces this.
- **Provenance segment found and removed:** every installed file was exactly 5,771 bytes larger than logged and none matched its logged SHA-256. The difference was an extra APP11 (C2PA "content credentials") block added when the files were transferred by Claude (`com.anthropic.claude.provided`). With that block removed, all 20 files match the logged SHA-256 exactly, and they were also re-fetched from the Pexels CDN by ID and compared byte-for-byte: identical. The repository now holds the exact Pexels-served bytes (backups of the modified copies were kept outside the repo), so "no modification by NIVORA" is now literally true.
- **Budget:** with the block removed, every file is ≤ 144,582 bytes. `fx04-1.jpg` is 144,582 bytes (was 150,353), inside the 150 KB budget of §14.12 under either reading (150,000 or 153,600 bytes), with no re-encoding and no visible change. A test checks ≤ 150,000 bytes for every installed file.
- **pool-03 crop:** fixed on screen, not in the file. Credit rows may now carry an optional `focus` (CSS object-position); `pool-03` uses `50% 0%`, so a 16:9 hero shows the basin, mirror and towel rail instead of half a toilet. The file is untouched.
- **Thumbnail disclosure:** small owner/tenant thumbnails (My Properties, Enquiries, request rows, wizard photo tiles) now show a compact "Illustrative" label once a real photo has loaded. Wizard tiles also no longer overlap "Image unavailable" with the tile number.
- **Not done here (needs a browser that can open pexels.com pages):** replacing the four semi-furnished covers (fx01-1, fx05-1, fx08-1, fx15-1) and, optionally, choosing more Indian-looking interiors. From this machine, pexels.com pages return a Cloudflare challenge (HTTP 403) to both curl and headless Chrome, and the API needs a key, so new photographers and licences could not be read from Pexels. No workaround was attempted and no image was swapped without its own page record. Brief for whoever does it:
  - Same slots, same rules (Pexels only, one by one, read each photo's page, record the row, ≤150 KB, no people, logos, signage or house numbers).
  - **Semi-furnished** look: wardrobes or built-in storage, ceiling fan or lights, curtains, maybe a modular kitchen; little or no loose furniture (no sofa set, no full lounge).
  - fx01-1 (2 BHK apartment, Malviya Nagar, ₹22,000), fx05-1 (1 BHK apartment, Mansarovar, ₹12,000), fx08-1 (2 BHK apartment with a work corner, Sitapura, ₹19,000; the current photo also has a fireplace, which looks wrong for Jaipur), fx15-1 (2 BHK apartment, C-Scheme, currently let).
  - Good search words: "empty apartment wardrobe", "bedroom wardrobe ceiling fan", "apartment interior India", "modular kitchen India", "marble floor room".
  - Then update `scripts/image-plan.json`, `src/data/images.credits.json` and this log, and run `npm test`.

## Replacement register

Rows below are appended by `npm run images:install` when a cover is replaced. The previous file and credit row are kept in `scripts/replaced-images/`.

| Slot / file | Used by | Pexels ID | Pexels page | Photographer | Licence | Acquired | Rendition | Bytes | SHA-256 (first 16) |
|---|---|---|---|---|---|---|---|---|---|
