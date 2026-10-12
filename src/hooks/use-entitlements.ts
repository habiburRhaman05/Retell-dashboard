"use client";

import { useState, useEffect } from "react";

interface Entitlement {
  enabled: boolean;
  used: number;
  limit: number | null;
  status: "ok" | "warning" | "blocked";
  reason?: string;
}

export type Entitlements = Record<string, Entitlement>;

export function useEntitlements() {
  const [data, setData] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/entitlements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}

export function isBlocked(entitlements: Entitlements | null, featureKey: string): boolean {
  if (!entitlements) return false;
  const e = entitlements[featureKey];
  return e ? e.status === "blocked" : false;
}

export function getBlockReason(entitlements: Entitlements | null, featureKey: string): string | null {
  if (!entitlements) return null;
  const e = entitlements[featureKey];
  if (!e || e.status !== "blocked") return null;
  if (e.limit !== null) {
    return `You have used ${e.used} of ${e.limit}. Contact support to raise your limit.`;
  }
  return e.reason ?? "This feature is currently unavailable.";
}
