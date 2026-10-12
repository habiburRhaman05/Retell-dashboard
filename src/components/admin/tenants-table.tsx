"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface TenantRow {
  id: string;
  name: string;
  email: string | null;
  crmLocationId: string;
  status: string;
  createdAt: string;
  agentCount: number;
  kbCount: number;
  hasLocks: boolean;
}

type SortKey = "name" | "status" | "agentCount" | "createdAt";

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: "asc" | "desc" }) {
  if (sortKey !== col) return <span className="text-gray-300 ml-1">&#8597;</span>;
  return <span className="ml-1">{sortDir === "asc" ? "&#9650;" : "&#9660;"}</span>;
}

export function TenantsTable({ tenants }: { tenants: TenantRow[] }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let list = tenants;
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.email?.toLowerCase().includes(q) ?? false) ||
          t.crmLocationId.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "status") cmp = a.status.localeCompare(b.status);
      else if (sortKey === "agentCount") cmp = a.agentCount - b.agentCount;
      else cmp = a.createdAt.localeCompare(b.createdAt);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [tenants, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tenants</h2>
          <p className="text-sm text-gray-500 mt-0.5">{tenants.length} registered</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Register Tenant
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or location ID..."
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {tenants.length === 0 ? (
            <>
              <p className="text-gray-500">No tenants registered yet.</p>
              <p className="text-sm text-gray-400 mt-1">Click the button above to add your first sub-account.</p>
            </>
          ) : (
            <p className="text-gray-500">No tenants match your search.</p>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort("name")}
                >
                  Name <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort("agentCount")}
                >
                  Agents <SortIcon col="agentCount" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">KBs</th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort("status")}
                >
                  Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase cursor-pointer select-none hover:text-gray-700"
                  onClick={() => toggleSort("createdAt")}
                >
                  Created <SortIcon col="createdAt" sortKey={sortKey} sortDir={sortDir} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${t.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">
                      {t.name}
                    </Link>
                    {t.hasLocks && (
                      <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">
                        locked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{t.agentCount}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.kbCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.status === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
