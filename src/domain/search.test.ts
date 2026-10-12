import { describe, expect, it } from "vitest";
import { buildSeed } from "../data/seed";
import { addDays, toISODate } from "./dates";
import {
  DEFAULT_FILTERS,
  MAX_RENT,
  activeFilterChips,
  countActiveFilters,
  getAvailability,
  getTenantProperty,
  isDefaultFilters,
  parseFilters,
  parseRentInput,
  removeFilter,
  selectFeatured,
  selectSearchResults,
  serializeFilters,
  specsLine,
  suggestRelaxations,
  validateRent,
  type SearchFilters,
} from "./search";
import { getEffectiveVerification, verifiedCount } from "./verification";

const NOW = new Date(2026, 9, 10, 12, 0, 0);
const data = buildSeed(NOW);
const f = (over: Partial<SearchFilters>): SearchFilters => ({ ...DEFAULT_FILTERS, ...over });
const ids = (list: { id: string }[]) => list.map((p) => p.id.replace("prop_fx_", "")).sort();
const run = (over: Partial<SearchFilters>) => ids(selectSearchResults(data, f(over), NOW));

describe("selectSearchResults — empty search and defaults (AC-05)", () => {
  it("returns exactly the 11 available published fixtures with no filters", () => {
    expect(run({})).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "13", "14"]);
  });

  it("never returns draft or pending-review listings, even when availability is widened", () => {
    const all = run({ avail: "any" });
    expect(all).not.toContain("11");
    expect(all).not.toContain("12");
    expect(all).toEqual(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "13", "14", "15", "16"]);
  });
});

describe("selectSearchResults — each filter changes the result set (AC-06)", () => {
  it("locality", () => expect(run({ locality: "malviya_nagar" })).toEqual(["01", "13"]));
  it("maximum rent is inclusive", () => {
    expect(run({ max: 15000 })).toEqual(["02", "04", "05", "09", "14"]);
    expect(run({ max: 14500 })).toContain("02");
    expect(run({ max: 14499 })).not.toContain("02");
  });
  it("minimum rent is inclusive and ranges combine", () => {
    expect(run({ min: 20000 })).toEqual(["01", "03", "07", "13"]);
    expect(run({ min: 10000, max: 20000 })).toEqual(["02", "05", "06", "08", "09"]);
  });
  it("property type is OR within the group", () => {
    expect(run({ types: ["studio"] })).toEqual(["02", "09"]);
    expect(run({ types: ["studio", "single_room"] })).toEqual(["02", "04", "09", "14"]);
  });
  it("rooms: 1, 2 and 3+", () => {
    expect(run({ rooms: "2" })).toEqual(["01", "06", "08", "13"]);
    expect(run({ rooms: "3+" })).toEqual(["03", "07"]);
    expect(run({ rooms: "1" })).toEqual(["02", "04", "05", "09", "14"]); // includes studios and single rooms
  });
  it("furnishing is OR within the group", () => {
    expect(run({ furnishing: ["fully_furnished"] })).toEqual(["02", "07", "09", "13"]);
    expect(run({ furnishing: ["fully_furnished", "unfurnished"] })).toEqual(["02", "04", "06", "07", "09", "13", "14"]);
  });
  it("amenities must ALL be present", () => {
    expect(run({ amenities: ["lift"] })).toEqual(["01", "05", "07"]);
    expect(run({ amenities: ["parking", "wifi"] })).toEqual(["01", "08", "13"]);
  });
  it("availability: unavailable listings appear only when widened", () => {
    expect(run({ avail: "now" })).not.toContain("10");
    expect(run({ avail: "any" })).toEqual(expect.arrayContaining(["10", "15", "16"]));
  });
  it("availability: 'within 30 days' includes homes available soon but 'now' does not", () => {
    const soon = { ...data.properties[0]!, id: "prop_u_001", availableFrom: toISODate(addDays(NOW, 10)), listingStatus: "published" as const };
    const withSoon = { ...data, properties: [...data.properties, soon] };
    const now = selectSearchResults(withSoon, f({ avail: "now" }), NOW).map((p) => p.id);
    const in30 = selectSearchResults(withSoon, f({ avail: "within_30" }), NOW).map((p) => p.id);
    expect(now).not.toContain("prop_u_001");
    expect(in30).toContain("prop_u_001");
    const far = { ...soon, id: "prop_u_002", availableFrom: toISODate(addDays(NOW, 45)) };
    expect(selectSearchResults({ ...data, properties: [...data.properties, far] }, f({ avail: "within_30" }), NOW).map((p) => p.id)).not.toContain("prop_u_002");
  });
  it("verification: identity verified and all four verified use EFFECTIVE (freshness-aware) statuses", () => {
    expect(run({ verif: "identity" })).toEqual(["01", "02", "03", "05", "06", "07", "09", "13", "14"]);
    expect(run({ verif: "all4" })).toEqual(["01", "06", "07"]);
    expect(run({ verif: "all4", avail: "any" })).toEqual(["01", "06", "07", "10", "15"]);
    // FX-05's stored availability is verified but stale, so it can never pass "all 4".
    expect(run({ verif: "all4" })).not.toContain("05");
  });
  it("keyword matches title, locality and landmark, case-insensitively", () => {
    expect(run({ q: "malviya" })).toEqual(["01", "13"]);
    expect(run({ q: "PARK" })).toEqual(["01", "04", "07"]); // locality Raja/Bani Park + a landmark
    expect(run({ q: "no such place" })).toEqual([]);
  });
  it("combines categories with AND", () => {
    expect(run({ locality: "malviya_nagar", max: 25000, amenities: ["lift"] })).toEqual(["01"]);
    expect(run({ locality: "malviya_nagar", max: 15000 })).toEqual([]);
  });
  it("sorts by newest, rent ascending and rent descending", () => {
    expect(selectSearchResults(data, f({ sort: "rent_asc" }), NOW)[0]?.id).toBe("prop_fx_04");
    expect(selectSearchResults(data, f({ sort: "rent_desc" }), NOW)[0]?.id).toBe("prop_fx_07");
    expect(selectSearchResults(data, f({ sort: "newest" }), NOW)[0]?.id).toBe("prop_fx_07"); // published 3 days ago
    const asc = selectSearchResults(data, f({ sort: "rent_asc" }), NOW).map((p) => p.rent);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
  });
});

describe("featured homes", () => {
  it("is deterministic, available, and spread across the trust range (not a ranking)", () => {
    const a = selectFeatured(data, NOW);
    expect(selectFeatured(data, NOW).map((p) => p.id)).toEqual(a.map((p) => p.id));
    expect(a).toHaveLength(4);
    const all = new Set(run({}));
    for (const p of a) expect(all.has(p.id.replace("prop_fx_", ""))).toBe(true);
    const counts = a.map((p) => verifiedCount(getEffectiveVerification(p, data.verificationItems, NOW)));
    expect(Math.max(...counts)).toBe(4);
    expect(Math.min(...counts)).toBeLessThanOrEqual(1);
  });
});

describe("URL state codec", () => {
  it("round-trips filters and omits defaults", () => {
    const filters = f({ q: "balcony", locality: "sodala", min: 10000, max: 30000, types: ["apartment", "studio"], rooms: "2", furnishing: ["semi_furnished"], amenities: ["parking", "lift"], avail: "any", verif: "all4", sort: "rent_desc" });
    expect(parseFilters(serializeFilters(filters))).toEqual(filters);
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("ignores invalid and unknown values, falling back to defaults", () => {
    const p = new URLSearchParams("locality=atlantis&type=castle,studio&beds=9&avail=never&verif=maybe&sort=random&min=abc&max=-5&amen=teleporter,lift&furn=none");
    expect(parseFilters(p)).toEqual(f({ types: ["studio"], amenities: ["lift"] }));
  });

  it("ignores the blocked anchor-mode parameters entirely", () => {
    expect(parseFilters(new URLSearchParams("mode=anchor&anchor=anchor_mnit&radius=5"))).toEqual(DEFAULT_FILTERS);
  });

  it("drops a contradictory rent range and clamps huge values", () => {
    expect(parseFilters(new URLSearchParams("min=30000&max=10000"))).toMatchObject({ min: null, max: null });
    expect(parseFilters(new URLSearchParams("max=99999999")).max).toBe(MAX_RENT);
  });
});

describe("rent input validation", () => {
  it("strips non-digits, clamps, and reports min > max", () => {
    expect(parseRentInput("₹ 12,500")).toBe(12500);
    expect(parseRentInput("abc")).toBeNull();
    expect(parseRentInput("-5")).toBe(5);
    expect(parseRentInput("9999999")).toBe(MAX_RENT);
    expect(validateRent(20000, 10000)).toBe("Maximum rent must be at least the minimum.");
    expect(validateRent(10000, 10000)).toBeNull();
    expect(validateRent(null, 5)).toBeNull();
  });
});

describe("active filters, clear-all semantics and zero-result suggestions", () => {
  it("counts active filters and treats sort as not a filter", () => {
    expect(isDefaultFilters(f({ sort: "rent_asc" }))).toBe(true);
    expect(countActiveFilters(f({ locality: "sodala", min: 1, max: 2, amenities: ["lift"] }))).toBe(4);
    expect(activeFilterChips(f({ locality: "sodala", max: 15000 })).map((c) => c.key)).toEqual(["locality", "max"]);
  });

  it("removeFilter resets exactly one group", () => {
    const x = f({ locality: "sodala", max: 15000, types: ["studio"] });
    expect(removeFilter(x, "max")).toEqual({ ...x, max: null });
    expect(removeFilter(removeFilter(removeFilter(x, "max"), "locality"), "types")).toEqual(DEFAULT_FILTERS);
  });

  it("offers only relaxations that would return homes, with correct counts, best first", () => {
    const filters = f({ locality: "malviya_nagar", max: 15000 });
    expect(selectSearchResults(data, filters, NOW)).toHaveLength(0);
    const sugg = suggestRelaxations(data, filters, NOW);
    expect(sugg.length).toBeGreaterThan(0);
    expect(sugg.length).toBeLessThanOrEqual(3);
    for (const s of sugg) {
      expect(s.count).toBeGreaterThan(0);
      expect(selectSearchResults(data, s.filters, NOW)).toHaveLength(s.count);
      expect(s.label).toMatch(new RegExp(`\\(${s.count} homes?\\)$`));
    }
    expect(sugg.map((s) => s.count)).toEqual([...sugg.map((s) => s.count)].sort((a, b) => b - a));
    expect(sugg.map((s) => s.key)).toEqual(expect.arrayContaining(["max", "locality"]));
  });

  it("offers no suggestion that would still return nothing", () => {
    expect(suggestRelaxations(data, f({ q: "zzzz-no-match" }), NOW).every((s) => s.count > 0)).toBe(true);
    expect(suggestRelaxations(data, f({ q: "zzzz-no-match", locality: "sodala" }), NOW)).toEqual([]);
  });
});

describe("availability labels and tenant visibility", () => {
  it("labels available, future and unavailable listings", () => {
    expect(getAvailability({ listingStatus: "published", availableFrom: toISODate(addDays(NOW, -2)) }, NOW).label).toBe("Available now");
    expect(getAvailability({ listingStatus: "published", availableFrom: "2026-10-20" }, NOW).label).toBe("Available from 20 Oct");
    expect(getAvailability({ listingStatus: "unavailable", availableFrom: "2026-01-01" }, NOW)).toMatchObject({ kind: "unavailable", label: "No longer available" });
  });

  it("tenants can open published and unavailable listings but never draft, pending or unknown ones", () => {
    expect(getTenantProperty(data, "prop_fx_01")?.id).toBe("prop_fx_01");
    expect(getTenantProperty(data, "prop_fx_10")?.listingStatus).toBe("unavailable");
    expect(getTenantProperty(data, "prop_fx_11")).toBeNull();
    expect(getTenantProperty(data, "prop_fx_12")).toBeNull();
    expect(getTenantProperty(data, "nope")).toBeNull();
  });

  it("formats the specs line for each property shape", () => {
    expect(specsLine({ type: "apartment", bedrooms: 2, bathrooms: 2, furnishing: "semi_furnished" })).toBe("2 BHK · 2 bath · Semi-furnished");
    expect(specsLine({ type: "studio", bedrooms: 1, bathrooms: 1, furnishing: "fully_furnished" })).toBe("Studio · 1 bath · Fully furnished");
    expect(specsLine({ type: "single_room", bedrooms: 1, bathrooms: 1, furnishing: "unfurnished" })).toBe("Single room · 1 bath · Unfurnished");
  });
});
