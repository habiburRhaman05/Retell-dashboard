"use client";

import { useBranding } from "@/hooks/use-branding";

/**
 * Mounted once near the root of the tenant dashboard. Renders nothing -
 * useBranding's own effect overrides the app's --color-brand-* CSS
 * variables as soon as this sub-account's colors are available (from
 * localStorage cache or a fetch), which is all that's needed for every
 * existing bg-brand-500/text-brand-600 class to re-theme itself.
 */
export function BrandingEffect({ locationId }: { locationId: string }) {
  useBranding(locationId);
  return null;
}
