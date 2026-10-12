import { describe, expect, it } from "vitest";
import { VERIFICATION_STATUS_LABEL } from "./labels";
import { TRUST_STATUS_INFO } from "./trustContent";

describe("canonical verification terminology (founder D5)", () => {
  it("has exactly four statuses, with 'Needs re-verification' as the only label for the fourth", () => {
    expect(Object.keys(VERIFICATION_STATUS_LABEL).sort()).toEqual(["needs_reverification", "not_checked", "pending_review", "verified_demo"]);
    expect(VERIFICATION_STATUS_LABEL.needs_reverification).toBe("Needs re-verification");
    expect(Object.keys(TRUST_STATUS_INFO).sort()).toEqual(Object.keys(VERIFICATION_STATUS_LABEL).sort());
  });

  it("never introduces 'Needs Re-review' (or a re_review value) anywhere in source", () => {
    const sources = import.meta.glob("../**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const files = Object.entries(sources).filter(([name]) => !/\.test\./.test(name));
    expect(files.length).toBeGreaterThan(10);
    for (const [name, text] of files) expect(text, name).not.toMatch(/re[-_ ]?review/i);
  });
});
