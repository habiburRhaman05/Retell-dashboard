// Turns one or two admin-picked hex colors into the full 50-900 scale that
// src/app/globals.css's `--color-brand-*` tokens expect, so every existing
// bg-brand-500/text-brand-600/ring-brand-500/20 class across the app can be
// re-themed at runtime just by overriding those CSS custom properties -
// no component changes needed.

export type BrandShade = "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
export type BrandScale = Record<BrandShade, string>;

const HEX_RE = /^#([0-9a-f]{6})$/i;

/** True for a strict 6-digit "#rrggbb" hex color. */
export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value);
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

interface Hsl {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

function hexToHsl(hex: string): Hsl {
  const match = HEX_RE.exec(hex);
  if (!match) throw new Error(`Invalid hex color: ${hex}`);
  const int = parseInt(match[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
    case g: h = ((b - r) / d + 2) * 60; break;
    default: h = ((r - g) / d + 4) * 60;
  }
  return { h, s, l };
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToHex(h: number, s: number, l: number): string {
  const L = clamp01(l);
  const S = clamp01(s);
  if (S === 0) {
    const v = Math.round(L * 255);
    const hex = v.toString(16).padStart(2, "0");
    return `#${hex}${hex}${hex}`;
  }
  const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
  const p = 2 * L - q;
  const hNorm = ((h % 360) + 360) % 360 / 360;
  const r = Math.round(hueToRgb(p, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, hNorm) * 255);
  const b = Math.round(hueToRgb(p, q, hNorm - 1 / 3) * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The full 50-900 scale from one primary color, with an optional secondary
 * color overriding only the "600" shade (the hover/active-state shade -
 * mirrors how the GHL white-label script uses accent + accentHover).
 */
export function generateBrandScale(primaryHex: string, secondaryHex?: string | null): BrandScale {
  if (!isValidHexColor(primaryHex)) {
    throw new Error(`Invalid primary color: ${primaryHex}`);
  }
  if (secondaryHex != null && !isValidHexColor(secondaryHex)) {
    throw new Error(`Invalid secondary color: ${secondaryHex}`);
  }

  const { h, s, l } = hexToHsl(primaryHex);
  const pastelS = Math.min(s, 0.6);
  const darken = (amount: number) => hslToHex(h, s, clamp01(l - amount));
  const lighten = (amount: number) => hslToHex(h, s, clamp01(l + amount));

  return {
    "50": hslToHex(h, pastelS, 0.97),
    "100": hslToHex(h, pastelS, 0.93),
    "200": hslToHex(h, pastelS, 0.86),
    "300": lighten(0.22),
    "400": lighten(0.1),
    "500": primaryHex.toLowerCase(),
    "600": secondaryHex ? secondaryHex.toLowerCase() : darken(0.1),
    "700": darken(0.2),
    "800": darken(0.28),
    "900": darken(0.35),
  };
}

/** Overrides the app-wide --color-brand-* custom properties on the given root. */
export function applyBrandScale(scale: BrandScale, root: HTMLElement = document.documentElement): void {
  for (const shade of Object.keys(scale) as BrandShade[]) {
    root.style.setProperty(`--color-brand-${shade}`, scale[shade]);
  }
}

/** Removes any runtime overrides, restoring the CSS file's default scale. */
export function clearBrandScale(root: HTMLElement = document.documentElement): void {
  (["50", "100", "200", "300", "400", "500", "600", "700", "800", "900"] as BrandShade[]).forEach((shade) => {
    root.style.removeProperty(`--color-brand-${shade}`);
  });
}
