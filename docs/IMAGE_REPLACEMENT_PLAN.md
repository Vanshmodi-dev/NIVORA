# Cover replacement plan: FX-01, FX-05, FX-08, FX-15

Scope: replace **only** these four cover photos. All other 16 installed photos and every workflow stay as they are. Until a replacement is installed, the current photo stays (it is licensed and credited; it just looks more furnished than the listing).

## Why

These four listings are **semi-furnished**, but their covers show fully furnished lounges (sofa sets, coffee tables, rugs). FX-08's photo also has a wood-burning fireplace, which looks wrong for a Jaipur flat. Every photo is labelled "Illustrative photo", so nothing is false, but a judge may notice.

## What each replacement should show

"Semi-furnished" in an Indian rental usually means fixed items only: wardrobes or built-in storage, ceiling fans, lights, curtains or blinds, sometimes a modular kitchen. Little or no loose furniture.

| Slot (file) | Listing | Look for | Avoid |
|---|---|---|---|
| `fx01-1` (`public/images/fx01-1.jpg`) | NIV-DEMO-P001 · Sunlit 2 BHK apartment, Malviya Nagar · ₹22,000 · 2 bed, 2 bath | A bright, mostly empty living room or bedroom with a built-in wardrobe, ceiling fan or light, curtains; tiled or marble floor | Sofa sets, dining sets, beds made up with cushions |
| `fx05-1` (`public/images/fx05-1.jpg`) | NIV-DEMO-P005 · Modern 1 BHK apartment, Mansarovar · ₹12,000 · 1 bed, 1 bath | A compact room with a modular wardrobe and a small balcony door; simple and modest | Luxury finishes, large lounges |
| `fx08-1` (`public/images/fx08-1.jpg`) | NIV-DEMO-P008 · Office-Ready 2 BHK apartment, Sitapura · ₹19,000 · has Wi-Fi and a work corner | A room with a built-in desk or study niche, a chair at most, wardrobe or shelving | Fireplaces, full lounges |
| `fx15-1` (`public/images/fx15-1.jpg`) | NIV-DEMO-P015 · Corner 2 BHK apartment, C-Scheme · ₹24,000 · currently let (shown greyed out) | A clean empty or lightly fitted room with wardrobes and a window | Anything with people, art or readable text |

For all four: no people or faces, no logos, brand names, house numbers, readable signs or recognisable landmarks through windows. An interior that could be in India (marble or vitrified tile floors, ceiling fans, split AC units, grilles on windows) is preferred.

Useful Pexels searches: "empty apartment India", "empty room ceiling fan", "bedroom wardrobe", "apartment interior tiles", "modular kitchen", "study room desk", "unfurnished flat".

## How to do it (about 30–45 minutes for all four)

These steps are for the founder, or for an agent that can open pexels.com pages in a normal browser. From this development machine, pexels.com pages are blocked (Cloudflare, HTTP 403), so they could not be done here.

1. **Choose by eye** on pexels.com. Open the photo's own page and check the licence says **Pexels License** (free to use).
2. **Read from that page:** the page URL (`https://www.pexels.com/photo/<title>-<id>/`), the photographer's name exactly as shown, and their profile URL (`https://www.pexels.com/@<handle>/`).
3. **Download Pexels' standard rendition**, so the file can be matched to the photo ID. Open this address in the browser (replace `<id>`) and save it:
   `https://images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg?auto=compress&cs=tinysrgb&w=1200`
   If the file is over 150,000 bytes, use `w=1000` instead. Never re-compress or edit it yourself.
4. **Write an alt text** that describes the scene generically, e.g. "Empty bedroom with a built-in wardrobe and a ceiling fan". Don't name a real place.
5. **Check first (dry run, changes nothing):**
   ```
   npm run images:install -- --slot fx01-1 --file "C:\Users\Modi\Downloads\pexels-photo-<id>.jpeg" --page https://www.pexels.com/photo/<title>-<id>/ --photographer "<Name>" --photographer-url https://www.pexels.com/@<handle>/ --alt "<alt text>" --rendition "1200 px wide" --dry-run
   ```
   It refuses: a non-Pexels page, a photo already used by another slot, a file that is really another installed photo, an incomplete JPEG, or a file over 150,000 bytes. It also tries to match the file byte-for-byte with Pexels' own file for that ID and says whether it matched. If a copy tool added a metadata block, it is removed automatically.
6. **Install:** run the same command without `--dry-run`. It writes the file, the credit row (`src/data/images.credits.json`), the plan entry (`scripts/image-plan.json`) and a row in the replacement register at the end of `docs/IMAGE_ACQUISITION_LOG.md`. The old file and credit row are kept in `scripts/replaced-images/`.
7. Repeat for `fx05-1`, `fx08-1`, `fx15-1`.
8. **Verify:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run build:demo`, `npm run check:bundles`, `npm run preflight`. Then open http://localhost:4174/#/tenant/search and the four details pages, and check each new cover in the card (4:3) and the details hero (16:9). Check the Credits page lists the new photographer.

**To undo a replacement:** copy the backup `scripts/replaced-images/<slot>-<time>.jpg` back to `public/images/<slot>.jpg` and its `.credit.json` contents back into `src/data/images.credits.json` under the same slot, then set that slot's `pexelsId` in `scripts/image-plan.json` back to the old ID (it is the number at the end of the old `sourceUrl`). Run `npm test`.

## Done when

- [ ] Four new photos installed, each with its own Pexels page, photographer and licence read from that page.
- [ ] Each file ≤ 150,000 bytes; ideally the dry run said "matches Pexels' own file".
- [ ] Each one looks semi-furnished and plausible for an Indian flat, at card and hero crops.
- [ ] Credits page shows the new rows; all seven checks pass.
- [ ] Or: the founder decides to keep the current photos (record that decision in blueprint §20.10).
