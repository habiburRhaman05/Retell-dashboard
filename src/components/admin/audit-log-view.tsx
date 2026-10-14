"use client";

import { useState, useMemo } from "react";

interface AuditRow {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  targetType: string;
  targetId: string | null;
  tenantId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export function AuditLogView({
  logs,
  tenants,
}: {
  logs: AuditRow[];
  tenants: { id: string; name: string }[];
}) {
  const [filterTenant, setFilterTenant] = useState("");
  const [filterAction, setFilterAction] = useState("");

  const actions = useMemo(
    () => [...new Set(logs.map((l) => l.action))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filterTenant && log.tenantId !== filterTenant) return false;
      if (filterAction && log.action !== filterAction) return false;
      return true;
    });
  }, [logs, filterTenant, filterAction]);

  const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Audit Log</h2>

      <div className="flex gap-3 mb-4">
        <select
          value={filterTenant}
          onChange={(e) => setFilterTenant(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All tenants</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No audit entries match the filters.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sub-Account</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{log.actorType}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {log.tenantId ? tenantMap.get(log.tenantId) ?? log.tenantId : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate">
                    {log.after ? JSON.stringify(log.after) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
