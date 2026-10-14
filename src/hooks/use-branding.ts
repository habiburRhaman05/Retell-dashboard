"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { generateBrandScale, applyBrandScale, clearBrandScale } from "@/lib/brand-theme";

export interface BrandingResponse {
  brandPrimaryColor: string | null;
  brandSecondaryColor: string | null;
}

// How long a cached sub-account's colors are trusted before re-checking
// with the server. Branding changes rarely, so this avoids a DB round trip
// on every page load/navigation.
export const BRANDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedBranding {
  data: BrandingResponse;
  fetchedAt: number;
}

// Scoped per sub-account: an operator who switches between sub-accounts in
// the same browser must never see one tenant's stale colors on another's.
function cacheKey(locationId: string): string {
  return `branding:${locationId}`;
}

export function readBrandingCache(locationId: string): BrandingResponse | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(locationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBranding;
    if (typeof parsed?.fetchedAt !== "number") return null;
    if (Date.now() - parsed.fetchedAt > BRANDING_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeBrandingCache(locationId: string, data: BrandingResponse): void {
  try {
    const entry: CachedBranding = { data, fetchedAt: Date.now() };
    window.localStorage.setItem(cacheKey(locationId), JSON.stringify(entry));
  } catch {
    // Best effort - a blocked/full localStorage just means refetching next time.
  }
}

async function fetchBranding(): Promise<BrandingResponse> {
  const res = await fetch("/api/tenant/branding");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

/**
 * This sub-account's brand colors: served from a localStorage cache when
 * fresh (no network call), otherwise fetched and re-cached. Applying them
 * is just overriding the app's --color-brand-* CSS variables, so every
 * existing bg-brand-500/text-brand-600 class re-themes with no component
 * changes.
 */
export function useBranding(locationId: string) {
  const query = useQuery<BrandingResponse>({
    queryKey: ["branding", locationId],
    queryFn: async () => {
      const cached = readBrandingCache(locationId);
      if (cached) return cached;
      const data = await fetchBranding();
      writeBrandingCache(locationId, data);
      return data;
    },
    enabled: !!locationId,
  });

  useEffect(() => {
    if (!query.data) return;
    const { brandPrimaryColor, brandSecondaryColor } = query.data;
    if (!brandPrimaryColor) {
      clearBrandScale();
      return;
    }
    try {
      applyBrandScale(generateBrandScale(brandPrimaryColor, brandSecondaryColor));
    } catch {
      // A corrupt stored color should never break the whole dashboard.
      clearBrandScale();
    }
  }, [query.data]);

  return query;
}
