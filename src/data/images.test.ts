import { describe, expect, it } from "vitest";
import { IMAGE_REGISTRY, OWNER_IMAGE_POOL_IDS, isCompleteCredit, resolveImage, resolvePhotos, validateImageRegistry, type ImageCredit } from "./images";
import { buildSeed } from "./seed";

const valid: ImageCredit = {
  src: "/images/fx01-1.webp",
  alt: "Living room with sofa and window",
  sourceUrl: "https://www.pexels.com/photo/example-123/",
  photographer: "A. Photographer",
  photographerUrl: "https://www.pexels.com/@example",
  acquiredOn: "2026-10-12",
  licence: { name: "Pexels License", url: "https://www.pexels.com/license/" },
  modifications: "crop 4:3, resize 1280 px",
  usedBy: ["FX-01"],
};

describe("image registry and licensing policy (D1, AC-38)", () => {
  it("contains only rows that came from the credits file; unknown ids resolve to nothing, so no licence data is invented", () => {
    expect(resolveImage("not-a-real-slot")).toBeNull();
    expect(resolvePhotos(["not-a-real-slot"])).toEqual([]);
    for (const id of Object.keys(IMAGE_REGISTRY)) expect(resolveImage(id)).toBe(IMAGE_REGISTRY[id]);
  });

  it("the installed registry passes the AC-38 checks (complete rows, no shared files or photos, unique covers)", () => {
    const covers = buildSeed(new Date(2026, 9, 10)).properties.map((p) => p.photoIds[0]!);
    expect(validateImageRegistry(IMAGE_REGISTRY, covers)).toEqual([]);
  });

  it("validateImageRegistry catches shared files, shared photos, incomplete rows and shared covers", () => {
    const a = { ...valid };
    const b = { ...valid, sourceUrl: "https://www.pexels.com/photo/other-9/" };
    expect(validateImageRegistry({ x: a, y: b }, ["x", "y"]).join(" ")).toMatch(/file .* also used/);
    expect(validateImageRegistry({ x: a, y: { ...b, src: "/images/y.jpg", sourceUrl: a.sourceUrl } }, []).join(" ")).toMatch(/photo .* also used/);
    expect(validateImageRegistry({ x: { ...a, alt: "" } }, []).join(" ")).toMatch(/incomplete/);
    expect(validateImageRegistry({ x: a, y: { ...b, src: "/images/y.jpg" } }, ["x", "y"])).toEqual([]);
  });

  it("scripts/image-plan.json covers every fixture photo id and the owner pool, with unique Pexels ids", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(p: string, e: string): string };
    const plan = JSON.parse(fs.readFileSync("scripts/image-plan.json", "utf8")).slots as Record<string, { pexelsId: number | null; tier: string }>;
    const expected = [...buildSeed(new Date(2026, 9, 10)).properties.flatMap((p) => p.photoIds), ...OWNER_IMAGE_POOL_IDS];
    expect(Object.keys(plan).sort()).toEqual([...expected].sort());
    const ids = Object.values(plan).map((s) => s.pexelsId).filter((x) => x !== null);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.values(plan).filter((s) => s.tier === "demo-minimum").length).toBeGreaterThan(0);
  });

  it("every registered credit (none today) must be complete, local and Pexels-sourced", () => {
    for (const c of Object.values(IMAGE_REGISTRY)) expect(isCompleteCredit(c)).toBe(true);
    expect(isCompleteCredit(valid)).toBe(true);
  });

  it.each([
    ["a remote (hot-linked) image URL", { src: "https://images.pexels.com/photos/1/x.jpeg" }],
    ["a protocol-relative URL", { src: "//cdn.example.com/x.jpg" }],
    ["a non-Pexels source (e.g. Unsplash)", { sourceUrl: "https://unsplash.com/photos/abc" }],
    ["a missing licence name", { licence: { name: "", url: "https://www.pexels.com/license/" } }],
    ["a non-https licence URL", { licence: { name: "Pexels License", url: "http://x" } }],
    ["an invalid acquisition date", { acquiredOn: "yesterday" }],
    ["missing alt text", { alt: "  " }],
    ["no listing using it", { usedBy: [] }],
    ["a malformed focus point", { focus: "top" }],
  ])("rejects a credit row with %s", (_label, patch) => {
    expect(isCompleteCredit({ ...valid, ...patch })).toBe(false);
  });

  it("resolves only ids that exist in the supplied registry, in order", () => {
    const reg = { a: valid, b: { ...valid, src: "/images/b.webp" } };
    expect(resolvePhotos(["a", "zzz", "b"], reg).map((c) => c.src)).toEqual(["/images/fx01-1.webp", "/images/b.webp"]);
  });

  it("every installed photo is attached to the slot it is credited for (right listing, or the owner pool)", () => {
    const seed = buildSeed(new Date(2026, 9, 10));
    for (const [slot, c] of Object.entries(IMAGE_REGISTRY)) {
      expect(c.src, slot).toBe(`/images/${slot}.jpg`);
      if (OWNER_IMAGE_POOL_IDS.includes(slot)) {
        expect(c.usedBy, slot).toEqual(["owner pool"]);
      } else {
        const owner = seed.properties.find((p) => p.photoIds.includes(slot));
        expect(owner, `${slot} is not a photo id of any listing`).toBeDefined();
        expect(c.usedBy, slot).toEqual([owner!.displayCode]);
      }
    }
  });

  it("every installed file is a complete JPEG within the 150,000-byte budget (blueprint §14.12)", async () => {
    const fs = (await import("node:" + "fs")) as { readFileSync(p: string): Uint8Array };
    for (const c of Object.values(IMAGE_REGISTRY)) {
      const bytes = fs.readFileSync(`public${c.src}`);
      expect(bytes.length, c.src).toBeLessThanOrEqual(150_000);
      expect([bytes[0], bytes[1]], c.src).toEqual([0xff, 0xd8]);
      expect([bytes[bytes.length - 2], bytes[bytes.length - 1]], c.src).toEqual([0xff, 0xd9]);
    }
  });

  it("fixtures reference distinct image ids per listing (no sharing between listings)", () => {
    const ids = buildSeed(new Date(2026, 9, 10)).properties.flatMap((p) => p.photoIds);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every image file in public/ has a credit row, and the source references no remote image hosts", () => {
    const sources = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const files = Object.entries(sources).filter(([name]) => !/\.test\./.test(name));
    expect(files.length).toBeGreaterThan(10);
    for (const [name, text] of files) {
      expect(text, name).not.toMatch(/https?:\/\/(images|www)\.pexels\.com\/photos|unsplash\.com|pixabay\.com/i);
    }
    const assets = Object.keys(import.meta.glob("/public/**/*.{jpg,jpeg,png,webp,avif,gif}"));
    const credited = new Set(Object.values(IMAGE_REGISTRY).map((c) => `/public${c.src}`));
    for (const a of assets) expect(credited.has(a), `${a} has no credit row`).toBe(true);
    for (const c of credited) expect(assets, `${c} is credited but missing`).toContain(c);
  });
});
