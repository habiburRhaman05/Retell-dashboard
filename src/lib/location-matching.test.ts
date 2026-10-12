import { describe, expect, it } from "vitest";
import {
  findDuplicateLocationNames,
  matchAgentToLocation,
  normalizeName,
  type MatchLocation,
} from "./location-matching";

const locations: MatchLocation[] = [
  { locationId: "loc_bright", name: "Bright AI Solutions" },
  { locationId: "loc_cafe", name: "Café Uno" },
  { locationId: "loc_spa", name: "Spa" },
  { locationId: "loc_sparkle", name: "Sparkle Cleaning" },
];

describe("normalizeName", () => {
  it("folds capitals, punctuation, accents and &", () => {
    expect(normalizeName("  Bright & Co.  ")).toBe("bright and co");
    expect(normalizeName("Café")).toBe("cafe");
    expect(normalizeName("O'Brien's")).toBe("obriens");
  });
});

describe("matchAgentToLocation", () => {
  it("matches a location name in brackets", () => {
    const result = matchAgentToLocation(
      "HVAC - Inbound-(Bright AI Solutions)-HVAC Calendar",
      locations
    );
    expect(result).toMatchObject({ kind: "match", locationId: "loc_bright" });
  });

  it("returns none when the agent has no name", () => {
    expect(matchAgentToLocation(null, locations).kind).toBe("none");
    expect(matchAgentToLocation("   ", locations).kind).toBe("none");
  });

  it("returns none when no location appears in the agent name", () => {
    const result = matchAgentToLocation("Reception - General", locations);
    expect(result.kind).toBe("none");
  });

  it("never matches whole words partially (Spa vs Spanish)", () => {
    const result = matchAgentToLocation("Spanish Lessons Booking", locations);
    expect(result.kind).toBe("none");
  });

  it("matches accents and plurals regardless of how the names are written", () => {
    const result = matchAgentToLocation("Cafe Uno - Inbound", locations);
    expect(result).toMatchObject({ kind: "match", locationId: "loc_cafe" });
  });

  it("prefers the longest matching location name", () => {
    const result = matchAgentToLocation(
      "Inbound-(Bright AI Solutions)-Outbound",
      [
        { locationId: "loc_bright", name: "Bright AI Solutions" },
        { locationId: "loc_bright_ai", name: "Bright AI" },
      ]
    );
    expect(result).toMatchObject({ kind: "match", locationId: "loc_bright" });
  });

  it("flags a true tie as ambiguous instead of guessing", () => {
    const result = matchAgentToLocation(
      "HVAC-(Bright Sparkle)-(Sparkle Bright)-HVAC",
      [
        { locationId: "a", name: "Bright Sparkle" },
        { locationId: "b", name: "Sparkle Bright" },
      ]
    );
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.candidates.sort()).toEqual(["a", "b"]);
    }
  });

  it("skips locations whose names are too short to trust", () => {
    expect(matchAgentToLocation("Spa Day Booking", locations).kind).toBe("none");
  });
});

describe("findDuplicateLocationNames", () => {
  it("groups locations whose names normalise to the same words", () => {
    const dupes = findDuplicateLocationNames([
      { locationId: "1", name: "Cafe Uno" },
      { locationId: "2", name: "café  uno!" },
      { locationId: "3", name: "Sparkle Cleaning" },
    ]);
    expect(dupes).toEqual([["1", "2"]]);
  });

  it("returns nothing when all names differ", () => {
    expect(
      findDuplicateLocationNames([
        { locationId: "1", name: "Cafe Uno" },
        { locationId: "2", name: "Spa" },
      ])
    ).toEqual([]);
  });

  it("ignores locations without a usable name", () => {
    expect(
      findDuplicateLocationNames([
        { locationId: "1", name: null },
        { locationId: "2", name: "   " },
      ])
    ).toEqual([]);
  });
});
