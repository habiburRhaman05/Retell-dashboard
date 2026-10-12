"use client";

import { useState, useEffect } from "react";

interface UsageData {
  totalCalls: number;
  totalMinutes: number;
}

export function UsageCard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/tenant/usage")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((d) => setData(d.summary))
      .catch(() => setError("Unable to load usage data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-gray-400">Loading usage...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-medium text-gray-900 mb-4">Usage This Month</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">Calls</p>
          <p className="text-2xl font-semibold text-gray-900">{data.totalCalls}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Minutes</p>
          <p className="text-2xl font-semibold text-gray-900">{data.totalMinutes}</p>
        </div>
      </div>
    </div>
  );
}
