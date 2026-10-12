"use client";

import { useState, useEffect } from "react";

interface Entitlement {
  enabled: boolean;
  used: number;
  limit: number | null;
  status: "ok" | "warning" | "blocked";
  reason?: string;
}

export function LimitBanner() {
  const [entitlements, setEntitlements] = useState<Record<string, Entitlement> | null>(null);

  useEffect(() => {
    fetch("/api/tenant/entitlements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setEntitlements(d))
      .catch(() => {});
  }, []);

  if (!entitlements) return null;

  const warnings: string[] = [];
  const blocks: string[] = [];

  for (const [key, e] of Object.entries(entitlements)) {
    const label = formatFeature(key);
    if (e.status === "warning" && e.limit !== null) {
      warnings.push(`You have used ${e.used} of ${e.limit} ${label}.`);
    }
    if (e.status === "blocked" && e.limit !== null) {
      if (e.reason && e.reason !== "LIMIT_REACHED") {
        // Disabled from the admin Features tab: deleting usage will not lift it.
        blocks.push(`${label} are disabled (${e.reason}). Contact support to enable them.`);
      } else {
        blocks.push(`You have used ${e.used} of ${e.limit} ${label}. Contact support to raise your limit.`);
      }
    }
  }

  if (blocks.length === 0 && warnings.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {blocks.map((msg, i) => (
        <div key={`b${i}`} className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      ))}
      {warnings.map((msg, i) => (
        <div key={`w${i}`} className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg text-sm">
          {msg}
        </div>
      ))}
    </div>
  );
}

function formatFeature(key: string): string {
  const names: Record<string, string> = {
    "agents.create": "agents",
    "knowledge_bases.create": "knowledge bases",
    "calls.make": "calls",
    "calls.minutes": "call minutes",
  };
  return names[key] ?? key;
}
