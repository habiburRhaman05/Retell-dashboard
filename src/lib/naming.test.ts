import { describe, expect, it } from "vitest";
import { withLocationName } from "./naming";

describe("withLocationName", () => {
  it("appends ' - {location}' to a plain name", () => {
    expect(withLocationName("Reception", "Bright AI")).toEqual({
      full: "Reception - Bright AI",
      shortened: false,
    });
  });

  it("trims both parts before joining", () => {
    expect(withLocationName("  Reception  ", "  Bright AI ")).toEqual({
      full: "Reception - Bright AI",
      shortened: false,
    });
  });

  it("returns the bare name when there is no location name", () => {
    expect(withLocationName("Reception", null)).toEqual({ full: "Reception", shortened: false });
    expect(withLocationName("Reception", "   ")).toEqual({ full: "Reception", shortened: false });
  });

  it("returns empty for an empty base name", () => {
    expect(withLocationName("   ", "Somewhere")).toEqual({ full: "", shortened: false });
  });

  it("leaves an already-suffixed name alone, ignoring case", () => {
    expect(withLocationName("Reception - Bright AI", "bright ai")).toEqual({
      full: "Reception - Bright AI",
      shortened: false,
    });
    // does not mistake a longer location for a suffix
    expect(withLocationName("Reception - Bright", "Bright AI").full).toBe(
      "Reception - Bright - Bright AI"
    );
  });

  describe("with a max length (Retell's 40-char knowledge base limit)", () => {
    it("joins freely when everything fits", () => {
      expect(withLocationName("FAQ", "Spa", 39)).toEqual({
        full: "FAQ - Spa",
        shortened: false,
      });
    });

    it("truncates the base name to keep the full result within the limit", () => {
      const base = "A very long knowledge base name that will not fit";
      const result = withLocationName(base, "Spa", 39);
      expect(result.full.length).toBeLessThanOrEqual(39);
      expect(result.full.endsWith(" - Spa")).toBe(true);
      expect(result.shortened).toBe(true);
    });

    it("shortens an over-long location name with an ellipsis", () => {
      const location = "The Extremely Long Location Name That Cannot Fit At All";
      const result = withLocationName("FAQ", location, 39);
      expect(result.full.length).toBeLessThanOrEqual(39);
      expect(result.full).toContain("…");
      expect(result.shortened).toBe(true);
    });

    it("never produces a name longer than the limit, even in the worst case", () => {
      const worst = withLocationName("x".repeat(100), "y".repeat(100), 39);
      expect(worst.full.length).toBeLessThanOrEqual(39);
      expect(worst.shortened).toBe(true);
    });

    it("keeps at least one character of the base name when the suffix eats the budget", () => {
      const result = withLocationName("Q", "y".repeat(100), 10);
      expect(result.full.length).toBeLessThanOrEqual(10);
      expect(result.full.startsWith("Q")).toBe(true);
    });
  });
});
