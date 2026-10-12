import type { AmenityId, LocalityId, TimeSlot } from "../domain/types";

/**
 * Location reference data and the verification gate (blueprint §13.6, D-12, D-28; founder D2).
 *
 * STATUS: the mandatory verification gate (§13.6.2) is NOT satisfied. Evidence gathered on
 * 2026-10-10 is recorded below; every entry keeps `verification.status = "unverified"` unless it
 * passed all gate steps. No map or distance feature may depend on this data until
 * `evaluateMapGate().satisfied` is true, and the founder has signed off (step 7).
 *
 * Lookups were one-off manual requests to Nominatim / Overpass / the Wikipedia API (low volume,
 * identifying User-Agent). OpenStreetMap data © OpenStreetMap contributors (ODbL).
 */

export type LocationVerificationStatus = "unverified" | "verified" | "rejected";

export interface LocationVerification {
  status: LocationVerificationStatus;
  /** Source URLs recorded during verification. */
  sources: string[];
  checkedOn: string | null;
  checkedBy: string | null;
  /** What was found and why the status is what it is. */
  notes: string | null;
}

const CHECKED_ON = "2026-10-10";
const CHECKED_BY = "Claude Code (automated lookups; not a human verification)";
const NOMINATIM = "https://nominatim.openstreetmap.org/";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const WIKI_API = "https://en.wikipedia.org/w/api.php";
/** Second-pass evidence (2026-10-10, browser): Bing Maps entity points and Esri World Imagery. */
const BING = (q: string) => `https://www.bing.com/maps?q=${encodeURIComponent(q)}`;
const ESRI_IMAGERY = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer";
const SECOND_PASS = "Second pass 2026-10-10 (docs/GEO_VERIFICATION_2026-10-10.md):";

const EMPTY: LocationVerification = { status: "unverified", sources: [], checkedOn: null, checkedBy: null, notes: null };

/** Evidence checked, gate not passed. */
const checked = (sources: string[], notes: string): LocationVerification => ({
  status: "unverified",
  sources,
  checkedOn: CHECKED_ON,
  checkedBy: CHECKED_BY,
  notes,
});

export interface Locality {
  id: LocalityId;
  name: string;
  lat: number;
  lng: number;
  precision: "approximate";
  coordinateBasis: "osm_place_node" | "prior_estimate";
  verification: LocationVerification;
}

type LocalitySeed = Omit<Locality, "precision">;

const SINGLE_SOURCE =
  "OSM place node found; no independent second source with coordinates was available, so the §13.6.2 cross-check (step 3) could not be completed.";
const NO_NODE =
  "No OSM place node with this name was found; coordinate is the earlier estimate and has not been checked against any source.";

const LOCALITY_SEEDS: LocalitySeed[] = [
  { id: "malviya_nagar", name: "Malviya Nagar", lat: 26.8545, lng: 75.8115, coordinateBasis: "prior_estimate", verification: checked([BING("Malviya Nagar Jaipur"), NOMINATIM], `${NO_NODE} ${SECOND_PASS} Bing Maps locality point 26.8554, 75.8204 is 886 m from this estimate.`) },
  { id: "c_scheme", name: "C-Scheme", lat: 26.9065, lng: 75.8, coordinateBasis: "prior_estimate", verification: checked([BING("C Scheme, Jaipur, Rajasthan"), NOMINATIM], `${NO_NODE} ${SECOND_PASS} Bing Maps returned businesses, not a locality point; no second coordinate.`) },
  { id: "vaishali_nagar", name: "Vaishali Nagar", lat: 26.9096, lng: 75.7392, coordinateBasis: "osm_place_node", verification: checked([BING("Vaishali Nagar Jaipur"), OVERPASS, NOMINATIM], `OSM node 8067954684 (place=suburb). ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps locality point 26.9060, 75.7407 is 427 m from the OSM node (outside the 300 m tolerance).`) },
  { id: "mansarovar", name: "Mansarovar", lat: 26.85, lng: 75.764, coordinateBasis: "prior_estimate", verification: checked([BING("Mansarovar Jaipur"), NOMINATIM, WIKI_API], `No OSM place node named Mansarovar (only sector-level neighbourhood nodes ~2 km away from the Wikipedia point 26.8633, 75.7664). The area is large and the sources disagree; coordinate is the earlier estimate. ${SECOND_PASS} Bing Maps locality point 26.8625, 75.7624 is 1.4 km from this estimate.`) },
  { id: "raja_park", name: "Raja Park", lat: 26.901, lng: 75.826, coordinateBasis: "prior_estimate", verification: checked([BING("Raja Park Jaipur"), NOMINATIM], `Only an OSM bus stop named Raja Park (26.8966, 75.8271) was found, not a place node; coordinate is the earlier estimate. ${SECOND_PASS} Bing Maps locality point 26.8945, 75.8344 is 1.1 km from this estimate.`) },
  { id: "bani_park", name: "Bani Park", lat: 26.9317, lng: 75.7958, coordinateBasis: "osm_place_node", verification: checked([BING("Bani Park, Jaipur, Rajasthan"), OVERPASS, NOMINATIM], `OSM node 245754854 (place=suburb). Replaces an earlier estimate that was ~1.0 km away. ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps returned a hotel, not a locality point; no second coordinate.`) },
  { id: "jagatpura", name: "Jagatpura", lat: 26.8336, lng: 75.8273, coordinateBasis: "osm_place_node", verification: checked([BING("Jagatpura, Jaipur"), OVERPASS, NOMINATIM], `OSM node 5333822176 (place=suburb). Replaces an earlier estimate that was ~3.7 km away. ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps locality point 26.8009, 75.8582 is 4.8 km from the OSM node; the two sources disagree about where Jagatpura is centred.`) },
  { id: "sitapura", name: "Sitapura", lat: 26.7827, lng: 75.8379, coordinateBasis: "osm_place_node", verification: checked([BING("Sitapura, Jaipur"), OVERPASS, NOMINATIM], `OSM node 8044543699 (place=suburb). Replaces an earlier estimate that was ~0.9 km away. ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps point ("Sitapur") 26.7766, 75.8421 is 799 m from the OSM node.`) },
  { id: "jawahar_nagar", name: "Jawahar Nagar", lat: 26.893, lng: 75.8362, coordinateBasis: "osm_place_node", verification: checked([BING("Jawahar Nagar, Jaipur"), OVERPASS, NOMINATIM], `OSM node 3828782164 (place=neighbourhood). Replaces an earlier estimate that was ~1.8 km away. ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps locality point 26.8943, 75.8351 is 186 m from the OSM node: within tolerance, but founder sign-off (step 7) is still missing.`) },
  { id: "sodala", name: "Sodala", lat: 26.902, lng: 75.7736, coordinateBasis: "osm_place_node", verification: checked([BING("Sodala, Jaipur"), OVERPASS, NOMINATIM], `OSM node 8083219844 (place=suburb). ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps locality point 26.9057, 75.7710 is 482 m from the OSM node.`) },
  { id: "gopalpura", name: "Gopalpura (Tonk Road)", lat: 26.8738, lng: 75.778, coordinateBasis: "osm_place_node", verification: checked([BING("Gopalpura, Jaipur"), OVERPASS, NOMINATIM], `OSM node 2694200913 (place=suburb). The Wikipedia article "Gopalpura" points to a different place (26.55, 75.73) and was not used. ${SINGLE_SOURCE} ${SECOND_PASS} Bing Maps resolved "Gopalpura" to a different village (Phagi tehsil); no usable second coordinate.`) },
];

export const LOCALITIES: readonly Locality[] = LOCALITY_SEEDS.map((l) => ({ ...l, precision: "approximate" as const }));

export type AnchorCategory = "college" | "office_area";

export interface SearchAnchor {
  id: string;
  name: string;
  /** Official name — to be confirmed from the institution/operator's own website (gate step 1). */
  officialName: string | null;
  category: AnchorCategory;
  localityContext: string;
  /** Best available point, or `null` when no source gave one. Never shown as exact. */
  lat: number | null;
  lng: number | null;
  precision: "approximate";
  coordinateBasis: "osm_feature" | "prior_estimate" | "official_site_map" | "none";
  verification: LocationVerification;
  note?: string;
}

type AnchorSeed = Omit<SearchAnchor, "precision">;

/**
 * CANDIDATE real Jaipur search anchors (§13.6.1). Manipal University Jaipur and Mahindra World
 * City are excluded from the initial set by founder decision D2. Nothing here is used by any
 * feature until the gate passes. Distances between the two sources were computed on 2026-10-10.
 */
const ANCHOR_SEEDS: AnchorSeed[] = [
  {
    id: "anchor_mnit", name: "MNIT Jaipur", officialName: "Malaviya National Institute of Technology Jaipur", category: "college", localityContext: "Malviya Nagar / JLN Marg",
    lat: 26.8618, lng: 75.8099, coordinateBasis: "osm_feature",
    verification: checked(
      [NOMINATIM, OVERPASS, `${WIKI_API}?titles=Malaviya_National_Institute_of_Technology,_Jaipur&prop=coordinates`, "https://mnit.ac.in/", "https://www.mnit.ac.in/ (title 'Malaviya National Institute of Technology Jaipur', read 2026-10-10)", "https://nominatim.openstreetmap.org/lookup?osm_ids=N8068694596", BING("MNIT Jaipur")],
      `Name and existence confirmed (institute website mnit.ac.in; address JLN Marg, Malaviya Nagar, Jaipur 302017). First pass: OSM node 8068694596 (26.8655, 75.8075) and Wikipedia 26.8622, 75.8156 were 884 m apart. ${SECOND_PASS} a Nominatim lookup shows node 8068694596 is a BUS STOP named "MNIT Jaipur" (highway=bus_stop), not the campus, so the coordinate was replaced by OSM node 3476221911 "Malviya National Institute of Technology" (building=college, 26.8618, 75.8099), which is a single building node, not a campus centroid. Bing Maps' entity "Malaviya National Institute of Technology Jaipur (MNIT)" (JLN Marg, 302017) is at 26.8640, 75.8108: 251 m from the new point, inside the 300 m tolerance (the old bus-stop point was 367 m away). OSM and Bing are separate data providers; no shared origin was found, but Bing's provenance is not published. Still unverified: founder sign-off (step 7) and the step-6 fixture distance spot-check are outstanding, and the OSM point is a building, not the campus centre.`,
    ),
  },
  {
    id: "anchor_uniraj", name: "University of Rajasthan", officialName: "University of Rajasthan", category: "college", localityContext: "JLN Marg, Jawahar Nagar area",
    lat: 26.8867, lng: 75.8194, coordinateBasis: "osm_feature",
    verification: checked(
      [NOMINATIM, OVERPASS, `${WIKI_API}?titles=University_of_Rajasthan&prop=coordinates`, "https://www.uniraj.ac.in/ (title 'University of Rajasthan - Main Website', read 2026-10-10)", BING("University of Rajasthan Jaipur")],
      `OSM way 1554719758 (centroid 26.8867, 75.8194, wikidata Q7896201); Wikipedia gives 26.8886, 75.8140: 571 m apart (large campus). 300 m tolerance not met. ${SECOND_PASS} official name confirmed from uniraj.ac.in (step 1). Nominatim now returns the same way at 26.8861, 75.8193 (63 m from the stored point). OSM also has a separate node "Rajasthan University" (amenity=university, 26.8878, 75.8138), 575 m from the way centroid. Bing Maps resolved the query to "University Rajasthan College" (a constituent college, 26.8797, 75.8127), 978 m away, so Bing gave no comparable campus point. Not passable without a founder decision on which point represents the campus.`,
    ),
  },
  {
    id: "anchor_iis", name: "IIS University", officialName: "IIS (Deemed to be University)", category: "college", localityContext: "Mansarovar area",
    lat: null, lng: null, coordinateBasis: "none",
    verification: checked([NOMINATIM, OVERPASS, "https://www.iisuniv.ac.in/ (title 'IIS (Deemed to be University), Jaipur', read 2026-10-10)", BING("IIS University Jaipur")], `No matching OSM feature and no Wikipedia coordinates were found. ${SECOND_PASS} official name confirmed from iisuniv.ac.in. Nominatim still finds no OSM feature. Bing Maps lists "IIS (Deemed to be University)" at 26.8373, 75.7703 (address "6-69, Swati Mehrotra Road, Jaipur 302020"), but that is a single source, so no coordinate is recorded.`),
  },
  {
    id: "anchor_sms_medical", name: "SMS Medical College", officialName: null, category: "college", localityContext: "Central Jaipur (JLN Marg / Motidungri Marg)",
    lat: 26.9059, lng: 75.8161, coordinateBasis: "osm_feature",
    verification: checked(
      [NOMINATIM, `${WIKI_API}?titles=Sawai_Man_Singh_Medical_College&prop=coordinates`, BING("SMS Medical College Jaipur")],
      `No OSM feature for the college itself; the only point is the blood bank inside SMS Hospital (26.9059, 75.8161). Wikipedia 'Sawai Man Singh Medical College' gives 26.9058, 75.8191: 301 m apart, and the OSM point is a sub-feature, not the college. Not accepted. ${SECOND_PASS} Nominatim still has no college feature (only SMS Hospital node 4793756922 at 26.9060, 75.8161). Bing Maps' "Sms medical College jaipur" (JLN Marg) is at 26.9060, 75.8183, 219 m from the hospital node, but comparing a hospital point with a college point does not satisfy step 3. Official site not confirmed in this pass (Bing links medicaleducation.rajasthan.gov.in/smsjaipur).`,
    ),
  },
  {
    id: "anchor_wtp", name: "World Trade Park, Malviya Nagar", officialName: null, category: "office_area", localityContext: "Malviya Nagar",
    lat: 26.854, lng: 75.8052, coordinateBasis: "osm_feature",
    verification: checked(
      [NOMINATIM, OVERPASS, `${WIKI_API}?titles=World_Trade_Park,_Jaipur&prop=coordinates`, BING("World Trade Park Malviya Nagar Jaipur")],
      "Second pass 2026-10-10: Bing Maps' 'World Trade Park' (shopping center, website listed as wtpjaipur.com) is at 26.8530, 75.8049, 117 m from the OSM way, so step 3 agreement holds on a second provider. Opening wtpjaipur.com in the browser failed, so the operator's own website is still unconfirmed (step 1). First pass: OSM way 864605441 (centroid 26.8540, 75.8052) and Wikipedia (26.8534, 75.8051) agree within 65 m, so coordinates look consistent. NOT passed: gate step 1 needs the operator's own official website, and sources disagree on whether one exists (Wikipedia lists wtpjaipur.com; another listing says none is public). It is also a shopping mall rather than an office area, which should be a founder decision.",
    ),
  },
  {
    id: "anchor_jecc", name: "JECC / Sitapura Industrial Area", officialName: null, category: "office_area", localityContext: "Sitapura",
    lat: 26.7828, lng: 75.827, coordinateBasis: "osm_feature",
    verification: checked(
      [NOMINATIM, OVERPASS, BING("Jaipur Exhibition and Convention Centre Sitapura")],
      `OSM way 754510581 'Jaipur Exhibition and Convention Centre' (centroid 26.7828, 75.8270) found. ${SECOND_PASS} Bing Maps' "JECC (Jaipur Exhibition & Convention Centre)" (Road No. 5, Sector D, Sitapura Industrial Area) is at 26.7849, 75.8263, 238 m from the OSM centroid: inside the 300 m tolerance. Still unverified: no official operator website was found or checked (step 1), it is an exhibition centre rather than an office area (founder decision), and founder sign-off is outstanding.`,
    ),
  },
  {
    id: "anchor_cscheme_business", name: "C-Scheme business district (Ashok Marg area)", officialName: null, category: "office_area", localityContext: "C-Scheme",
    lat: null, lng: null, coordinateBasis: "none",
    verification: checked([NOMINATIM], "An area description, not a single mappable feature; Ashok Marg is a long road and no defined point exists. Needs a founder decision on a specific landmark."),
  },
  {
    id: "anchor_vgu", name: "Vivekananda Global University (VGU)", officialName: "Vivekananda Global University", category: "college", localityContext: "Sisyawas, NRI Road (Jagatpura side)",
    lat: 26.8117, lng: 75.8899, coordinateBasis: "official_site_map",
    verification: {
      status: "verified",
      sources: [
        "https://vgu.ac.in/ (official website: name 'Vivekananda Global University (VGU)'; address 'Sector-36, Sisyawas, NRI Road, VIT Campus, Karolan Ka Barh, Jaipur, Rajasthan 303012'; its Google Maps place link is centred 26.8113487, 75.8899177 with place point !3d26.8116773)",
        "https://vgu.ac.in/contact/ (official contact page, embedded map centred 26.811677, 75.887768)",
        "https://www.wikidata.org/wiki/Special:EntityData/Q19899106.json (Wikidata Q19899106 'Vivekananda Global University': coordinate 26.81168, 75.88989; official website vgu.ac.in)",
        "https://en.wikipedia.org/wiki/Vivekananda_Global_University (existence and place: private university in Jaipur, Rajasthan)",
        NOMINATIM,
        OVERPASS,
        BING("Vivekananda Global University Jaipur"),
        `${ESRI_IMAGERY}/export?bbox=75.882,26.805,75.898,26.818&bboxSR=4326&imageSR=4326 (Esri World Imagery, visual check)`,
        "https://www.openstreetmap.org/query?lat=26.81168&lon=75.88989",
      ],
      checkedOn: CHECKED_ON,
      checkedBy: CHECKED_BY,
      notes:
        "VERIFIED AS A FOUNDER-DESIGNATED TEST DESTINATION ONLY. Gate step 1 (name): official website. Step 2 (existence/place): official address plus Wikipedia/Wikidata. Step 3 (coordinates): OpenStreetMap has NO feature for this university (Nominatim and an Overpass name search over Jaipur found none), so the usual OSM-derived coordinate could not be used and no OSM-to-second-map cross-check was possible. Instead two sources were compared: the official site's map link (26.8117, 75.8899) and Wikidata P625 (26.8117, 75.8899) agree within about 10 m; the contact page's embed centre is 26.8117, 75.8878, about 210 m west, still inside the 300 m tolerance. These sources may share an origin (Google Maps data), so they are corroborating rather than fully independent; the point is approximate and shown only as an approximate campus reference. Step 7 (sign-off): the founder instructed on 2026-10-10 that VGU be available as a test destination if verified correctly; that instruction is recorded here as sign-off for this one anchor only. The full gate (4 anchors incl. 3 colleges and 2 office areas, and every locality) is NOT satisfied, so anchor search (AC-37) stays off. SECOND PASS 2026-10-10 (docs/GEO_VERIFICATION_2026-10-10.md; coordinate and status deliberately NOT changed): (a) correction: the '@26.8113487,75.8899177' in the official site's link is the camera position of a Street View photo, and the embed's 26.811677, 75.887768 is a map-view centre; the only place point in the official links is Google's 26.81168, 75.88989, which is 2 m from the app pin. (b) Wikidata's 26.81168, 75.88989 is identical to Google's place point to 5 decimals and has no reference, so it is treated as copied, not independent. (c) Independent provider: Bing Maps' entity 'Vivekananda Global University' (website vgu.ac.in) is at 26.8120, 75.8916, 171 m from the app pin. (d) Esri World Imagery shows a large institutional compound (multi-storey blocks and a sports ground) between two east-west roads with the app pin inside it and the Bing point about 170 m east-north-east in the same compound; imagery confirms a campus exists there, not its name. (e) OSM still has no VGU feature (Nominatim search: none; OSM query at the pin: no nearby features). The pin therefore represents an approximate campus point (Google's place pin), not a specific entrance or gate; no source identifies an entrance. A human comparison on a second map (gate step 6 / runbook 6.2) and founder sign-off of that comparison are still pending.",
    },
    note: "Test destination requested by the founder; not part of the 4-anchor gate set.",
  },
  {
    id: "anchor_manipal", name: "Manipal University Jaipur", officialName: null, category: "college", localityContext: "Outer Jaipur (Dehmi Kalan)",
    lat: null, lng: null, coordinateBasis: "none",
    verification: { ...EMPTY, status: "rejected", notes: "Excluded from the initial anchor set by founder decision D2 (2026-10-10)." },
  },
  {
    id: "anchor_mwc", name: "Mahindra World City Jaipur", officialName: null, category: "office_area", localityContext: "Outer Jaipur",
    lat: null, lng: null, coordinateBasis: "none",
    verification: { ...EMPTY, status: "rejected", notes: "Excluded from the initial anchor set by founder decision D2 (2026-10-10)." },
  },
];

export const SEARCH_ANCHOR_CANDIDATES: readonly SearchAnchor[] = ANCHOR_SEEDS.map((a) => ({ ...a, precision: "approximate" as const }));

export interface MapGateResult {
  satisfied: boolean;
  /** Human-readable reasons the gate is not satisfied (empty when satisfied). */
  reasons: string[];
}

export const MIN_VERIFIED_ANCHORS = 4;
export const MIN_VERIFIED_COLLEGES = 3;
export const MIN_VERIFIED_OFFICE_AREAS = 2;

/**
 * The §13.6.2 gate as code: every locality verified, and 4–8 verified anchors including at least
 * 3 colleges and 2 office-area landmarks. A "verified" status must only ever be written after all
 * gate steps, including founder sign-off, have been completed.
 */
export function evaluateMapGate(
  localities: readonly Locality[] = LOCALITIES,
  anchors: readonly SearchAnchor[] = SEARCH_ANCHOR_CANDIDATES,
): MapGateResult {
  const reasons: string[] = [];
  const unverifiedLocalities = localities.filter((l) => l.verification.status !== "verified");
  if (unverifiedLocalities.length > 0) {
    reasons.push(`${unverifiedLocalities.length} of ${localities.length} locality positions are unverified.`);
  }
  const verified = anchors.filter((a) => a.verification.status === "verified" && a.lat !== null && a.lng !== null);
  const colleges = verified.filter((a) => a.category === "college").length;
  const offices = verified.filter((a) => a.category === "office_area").length;
  if (verified.length < MIN_VERIFIED_ANCHORS) {
    reasons.push(`Only ${verified.length} search anchors are verified (at least ${MIN_VERIFIED_ANCHORS} are needed).`);
  }
  if (colleges < MIN_VERIFIED_COLLEGES) reasons.push(`Only ${colleges} verified colleges (at least ${MIN_VERIFIED_COLLEGES} needed).`);
  if (offices < MIN_VERIFIED_OFFICE_AREAS) reasons.push(`Only ${offices} verified office-area landmarks (at least ${MIN_VERIFIED_OFFICE_AREAS} needed).`);
  return { satisfied: reasons.length === 0, reasons };
}

/** True only when the whole gate is satisfied. */
export function isLocationDataVerified(): boolean {
  return evaluateMapGate().satisfied;
}

/** Anchors that may be offered to users: verified, with coordinates. Empty until the gate passes. */
export function getUsableAnchors(): SearchAnchor[] {
  if (!evaluateMapGate().satisfied) return [];
  return SEARCH_ANCHOR_CANDIDATES.filter((a) => a.verification.status === "verified" && a.lat !== null && a.lng !== null);
}

export const AMENITY_IDS: readonly AmenityId[] = [
  "parking",
  "wifi",
  "lift",
  "power_backup",
  "water_24h",
  "modular_kitchen",
  "security",
  "air_conditioning",
  "balcony",
  "gym_access",
  "pet_friendly",
  "gated_society",
];

export const TIME_SLOTS: readonly TimeSlot[] = ["morning", "afternoon", "evening"];

export function getLocality(id: LocalityId): Locality {
  const l = LOCALITIES.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown locality: ${id}`);
  return l;
}

/**
 * Individually verified destinations that may be offered as TEST destinations even though the full
 * 4-anchor gate is not satisfied (founder instruction, 2026-10-10). This never makes
 * `evaluateMapGate()` pass and never enables anchor search by itself.
 */
export function getTestDestinations(): SearchAnchor[] {
  return SEARCH_ANCHOR_CANDIDATES.filter((a) => a.verification.status === "verified" && a.lat !== null && a.lng !== null);
}
