import { describe, it, expect } from "vitest";
import {
  isValidHexColor,
  generateBrandScale,
  applyBrandScale,
  clearBrandScale,
} from "./brand-theme";

describe("isValidHexColor", () => {
  it("accepts a strict 6-digit hex color", () => {
    expect(isValidHexColor("#1d6bf3")).toBe(true);
    expect(isValidHexColor("#FFFFFF")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isValidHexColor("1d6bf3")).toBe(false);
    expect(isValidHexColor("#fff")).toBe(false);
    expect(isValidHexColor("#gggggg")).toBe(false);
    expect(isValidHexColor("red")).toBe(false);
    expect(isValidHexColor("")).toBe(false);
  });
});

describe("generateBrandScale", () => {
  it("throws for an invalid primary color", () => {
    expect(() => generateBrandScale("not-a-color")).toThrow();
  });

  it("throws for an invalid secondary color", () => {
    expect(() => generateBrandScale("#1d6bf3", "nope")).toThrow();
  });

  it("uses the primary color verbatim (lowercased) as shade 500", () => {
    const scale = generateBrandScale("#1D6BF3");
    expect(scale["500"]).toBe("#1d6bf3");
  });

  it("derives shade 600 when no secondary is given", () => {
    const scale = generateBrandScale("#1d6bf3");
    expect(scale["600"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(scale["600"]).not.toBe(scale["500"]);
  });

  it("uses the secondary color verbatim (lowercased) as shade 600 when given", () => {
    const scale = generateBrandScale("#1d6bf3", "#AA2200");
    expect(scale["600"]).toBe("#aa2200");
  });

  it("produces all 10 shades as valid hex colors", () => {
    const scale = generateBrandScale("#3a7a3a", "#2e622e");
    for (const shade of ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as const) {
      expect(isValidHexColor(scale[shade])).toBe(true);
    }
  });

  it("produces a lighter 50 than 900 for a mid-tone primary", () => {
    const scale = generateBrandScale("#1d6bf3");
    const lightness = (hex: string) => {
      const int = parseInt(hex.slice(1), 16);
      const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
      return (r + g + b) / 3;
    };
    expect(lightness(scale["50"])).toBeGreaterThan(lightness(scale["900"]));
  });
});

// A minimal style-bearing stand-in, so this stays a plain node-environment
// unit test rather than needing jsdom just to touch a .style object.
function fakeElement(): HTMLElement {
  const props = new Map<string, string>();
  return {
    style: {
      setProperty: (k: string, v: string) => props.set(k, v),
      removeProperty: (k: string) => props.delete(k),
      getPropertyValue: (k: string) => props.get(k) ?? "",
    },
  } as unknown as HTMLElement;
}

describe("applyBrandScale / clearBrandScale", () => {
  it("sets and clears the CSS custom properties on the given root", () => {
    const root = fakeElement();
    const scale = generateBrandScale("#1d6bf3", "#1558d6");

    applyBrandScale(scale, root);
    expect(root.style.getPropertyValue("--color-brand-500")).toBe("#1d6bf3");
    expect(root.style.getPropertyValue("--color-brand-600")).toBe("#1558d6");

    clearBrandScale(root);
    expect(root.style.getPropertyValue("--color-brand-500")).toBe("");
    expect(root.style.getPropertyValue("--color-brand-600")).toBe("");
  });
});
