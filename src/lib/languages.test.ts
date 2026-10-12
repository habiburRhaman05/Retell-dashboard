import { describe, expect, it } from "vitest";
import { LANGUAGES, languageFlag, languageLabel, languagesLabel } from "./languages";

describe("languageLabel", () => {
  it("adds the region for known locales", () => {
    expect(languageLabel("en-US")).toBe("English (US)");
    expect(languageLabel("es-419")).toBe("Spanish (Latin America)");
    expect(languageLabel("yue-CN")).toBe("Cantonese (China)");
  });

  it("returns the raw value for unknown locales instead of blank", () => {
    expect(languageLabel("xx-YY")).toBe("xx-YY");
  });

  it("labels every locale in the catalogue", () => {
    for (const l of LANGUAGES) {
      expect(languageLabel(l.value)).toContain(l.label);
      expect(languageLabel(l.value).length).toBeGreaterThan(0);
    }
  });
});

describe("languagesLabel", () => {
  it("defaults to English (US) for empty inputs", () => {
    expect(languagesLabel(null)).toBe("English (US)");
    expect(languagesLabel(undefined)).toBe("English (US)");
    expect(languagesLabel("")).toBe("English (US)");
    expect(languagesLabel([])).toBe("English (US)");
  });

  it("shows a single language in full", () => {
    expect(languagesLabel("fr-FR")).toBe("French (France)");
    expect(languagesLabel(["de-DE"])).toBe("German (Germany)");
  });

  it("summarises multiple languages as first + count", () => {
    expect(languagesLabel(["en-US", "es-ES", "ja-JP"])).toBe("English (US) +2");
    expect(languagesLabel(["en-US", "es-ES"])).toBe("English (US) +1");
  });
});

describe("languageFlag", () => {
  it("returns the ISO country code for known locales", () => {
    expect(languageFlag("en-US")).toBe("us");
    expect(languageFlag("en-GB")).toBe("gb");
    // Spanish Latin America shows the Mexican flag, not Spain's
    expect(languageFlag("es-419")).toBe("mx");
  });

  it("falls back to 'un' for unknown locales", () => {
    expect(languageFlag("xx-YY")).toBe("un");
  });

  it("has a flag for every catalogue entry", () => {
    for (const l of LANGUAGES) {
      expect(languageFlag(l.value)).toBe(l.flag);
      expect(l.flag).toMatch(/^[a-z]{2}$/);
    }
  });
});
