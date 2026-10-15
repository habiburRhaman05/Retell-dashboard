"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useAgentLibrary,
  useKbLibrary,
  useAssignAgents,
  useUnassignAgents,
  useMakeAgentsPrivate,
  useMakeAgentsPublic,
  useAssignKbs,
  useUnassignKbs,
  useMakeKbsPrivate,
  useMakeKbsPublic,
  type AgentLibraryItem,
  type KbLibraryItem,
} from "@/hooks/use-admin-library";

type Tab = "agents" | "kbs";
type StatusFilter = "all" | "assigned" | "unassigned" | "private";

interface TenantOption {
  id: string;
  name: string;
  crmLocationId: string;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    assigned: "bg-green-50 text-green-700 border-green-200",
    unassigned: "bg-gray-50 text-gray-600 border-gray-200",
    private: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border capitalize ${styles[status] ?? styles.unassigned}`}>
      {status}
    </span>
  );
}

function AssignModal({
  tenants,
  selectedCount,
  onAssign,
  onClose,
  loading,
}: {
  tenants: TenantOption[];
  selectedCount: number;
  onAssign: (locationId: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selectedTenant, setSelectedTenant] = useState("");
  const [search, setSearch] = useState("");
  const filtered = useMemo(
    () =>
      tenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.crmLocationId.toLowerCase().includes(search.toLowerCase())
      ),
    [tenants, search]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Assign to Sub-Account</h3>
        <p className="text-xs text-gray-500 mb-4">
          {selectedCount} item{selectedCount !== 1 ? "s" : ""} will be assigned to the selected sub-account
        </p>

        <input
          type="text"
          placeholder="Search sub-accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg mb-3 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />

        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg mb-4">
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 p-3 text-center">No sub-accounts found</p>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTenant(t.crmLocationId)}
              className={`w-full text-left px-3 py-2.5 text-sm border-b last:border-b-0 transition-colors ${
                selectedTenant === t.crmLocationId
                  ? "bg-blue-50 text-blue-700"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{t.crmLocationId}</div>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedTenant && onAssign(selectedTenant)}
            disabled={!selectedTenant || loading}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Assigning..." : "Assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLibrary() {
  const [tab, setTab] = useState<Tab>("agents");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantMap, setTenantMap] = useState<Map<string, string>>(new Map());
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const agents = useAgentLibrary();
  const kbs = useKbLibrary();

  const assignAgents = useAssignAgents();
  const unassignAgents = useUnassignAgents();
  const makeAgentsPrivate = useMakeAgentsPrivate();
  const makeAgentsPublic = useMakeAgentsPublic();
  const assignKbsMut = useAssignKbs();
  const unassignKbs = useUnassignKbs();
  const makeKbsPrivate = useMakeKbsPrivate();
  const makeKbsPublic = useMakeKbsPublic();

  // Load tenants list for the assign modal
  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((r) => r.json())
      .then((data: TenantOption[]) => {
        setTenants(data);
        const map = new Map<string, string>();
        for (const t of data) map.set(t.crmLocationId, t.name);
        setTenantMap(map);
      })
      .catch(() => {});
  }, []);

  const changeTab = (t: Tab) => { setTab(t); setSelectedIds(new Set()); };
  const changeFilter = (f: StatusFilter) => { setFilter(f); setSelectedIds(new Set()); };

  // Auto-hide messages
  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const filteredAgents = useMemo(() => {
    if (!agents.data) return [];
    return agents.data.filter((a) => {
      if (filter !== "all" && a.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (a.agentName ?? "").toLowerCase().includes(q) ||
          a.agentId.toLowerCase().includes(q) ||
          (a.locationId && tenantMap.get(a.locationId)?.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [agents.data, filter, search, tenantMap]);

  const filteredKbs = useMemo(() => {
    if (!kbs.data) return [];
    return kbs.data.filter((kb) => {
      if (filter !== "all" && kb.status !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (kb.knowledgeBaseName ?? "").toLowerCase().includes(q) ||
          kb.knowledgeBaseId.toLowerCase().includes(q) ||
          (kb.locationId && tenantMap.get(kb.locationId)?.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [kbs.data, filter, search, tenantMap]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (tab === "agents") {
      if (selectedIds.size === filteredAgents.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredAgents.map((a) => a.agentId)));
    } else {
      if (selectedIds.size === filteredKbs.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(filteredKbs.map((k) => k.knowledgeBaseId)));
    }
  };

  const handleAction = async (action: "assign" | "unassign" | "private" | "unprivate", locationId?: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    try {
      if (tab === "agents") {
        if (action === "assign" && locationId) {
          await assignAgents.mutateAsync({ retellIds: ids, locationId });
          setMessage({ text: `Assigned ${ids.length} agent(s) to ${tenantMap.get(locationId) ?? locationId}`, type: "success" });
        } else if (action === "unassign") {
          await unassignAgents.mutateAsync({ retellIds: ids });
          setMessage({ text: `Unassigned ${ids.length} agent(s)`, type: "success" });
        } else if (action === "private") {
          await makeAgentsPrivate.mutateAsync({ retellIds: ids });
          setMessage({ text: `Marked ${ids.length} agent(s) as private`, type: "success" });
        } else if (action === "unprivate") {
          await makeAgentsPublic.mutateAsync({ retellIds: ids });
          setMessage({ text: `Made ${ids.length} agent(s) public`, type: "success" });
        }
      } else {
        if (action === "assign" && locationId) {
          await assignKbsMut.mutateAsync({ retellIds: ids, locationId });
          setMessage({ text: `Assigned ${ids.length} KB(s) to ${tenantMap.get(locationId) ?? locationId}`, type: "success" });
        } else if (action === "unassign") {
          await unassignKbs.mutateAsync({ retellIds: ids });
          setMessage({ text: `Unassigned ${ids.length} KB(s)`, type: "success" });
        } else if (action === "private") {
          await makeKbsPrivate.mutateAsync({ retellIds: ids });
          setMessage({ text: `Marked ${ids.length} KB(s) as private`, type: "success" });
        } else if (action === "unprivate") {
          await makeKbsPublic.mutateAsync({ retellIds: ids });
          setMessage({ text: `Made ${ids.length} KB(s) public`, type: "success" });
        }
      }
      setSelectedIds(new Set());
      setShowAssignModal(false);
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Action failed", type: "error" });
    }
  };

  const isLoading = tab === "agents" ? agents.isLoading : kbs.isLoading;
  const error = tab === "agents" ? agents.error : kbs.error;
  const itemCount = tab === "agents" ? filteredAgents.length : filteredKbs.length;
  const totalCount = tab === "agents" ? (agents.data?.length ?? 0) : (kbs.data?.length ?? 0);

  const counts = useMemo(() => {
    const data = tab === "agents" ? agents.data ?? [] : kbs.data ?? [];
    return {
      all: data.length,
      assigned: data.filter((d) => d.status === "assigned").length,
      unassigned: data.filter((d) => d.status === "unassigned").length,
      private: data.filter((d) => d.status === "private").length,
    };
  }, [tab, agents.data, kbs.data]);

  const anyMutating =
    assignAgents.isPending || unassignAgents.isPending || makeAgentsPrivate.isPending || makeAgentsPublic.isPending ||
    assignKbsMut.isPending || unassignKbs.isPending || makeKbsPrivate.isPending || makeKbsPublic.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Library</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage agent and knowledge base assignments across sub-accounts
          </p>
        </div>
      </div>

      {/* Toast */}
      {message && (
        <div className={`px-4 py-2.5 rounded-lg text-sm font-medium ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => changeTab("agents")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "agents" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Agents ({agents.data?.length ?? "..."})
        </button>
        <button
          onClick={() => changeTab("kbs")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            tab === "kbs" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Knowledge Bases ({kbs.data?.length ?? "..."})
        </button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-1.5">
          {(["all", "assigned", "unassigned", "private"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => changeFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === f
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-gray-500 hover:bg-gray-100 border border-transparent"
              }`}
            >
              {f === "all" ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${counts[f]})`}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder={`Search ${tab === "agents" ? "agents" : "knowledge bases"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 max-w-sm px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        />
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-700 font-medium mr-2">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setShowAssignModal(true)}
            disabled={anyMutating}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Assign
          </button>
          <button
            onClick={() => handleAction("unassign")}
            disabled={anyMutating}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Unassign
          </button>
          <button
            onClick={() => handleAction("private")}
            disabled={anyMutating}
            className="px-3 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Make Private
          </button>
          <button
            onClick={() => handleAction("unprivate")}
            disabled={anyMutating}
            className="px-3 py-1 text-xs font-medium text-green-600 bg-white border border-green-200 rounded-md hover:bg-green-50 disabled:opacity-50"
          >
            Make Public
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <p className="text-sm text-red-600 font-medium">Failed to load</p>
            <p className="text-xs text-gray-500 mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        )}

        {!isLoading && !error && itemCount === 0 && (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500">
              {search || filter !== "all" ? "No items match the current filter" : `No ${tab === "agents" ? "agents" : "knowledge bases"} in the Retell account`}
            </p>
          </div>
        )}

        {!isLoading && !error && itemCount > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === itemCount && itemCount > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                {tab === "agents" && (
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Channel</th>
                )}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Sub-Account</th>
                {tab === "agents" && (
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">Phone Number</th>
                )}
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase w-10">ID</th>
              </tr>
            </thead>
            <tbody>
              {tab === "agents" &&
                filteredAgents.map((agent) => (
                  <AgentRow
                    key={agent.agentId}
                    agent={agent}
                    selected={selectedIds.has(agent.agentId)}
                    onToggle={() => toggleSelect(agent.agentId)}
                    tenantName={agent.locationId ? tenantMap.get(agent.locationId) ?? null : null}
                  />
                ))}
              {tab === "kbs" &&
                filteredKbs.map((kb) => (
                  <KbRow
                    key={kb.knowledgeBaseId}
                    kb={kb}
                    selected={selectedIds.has(kb.knowledgeBaseId)}
                    onToggle={() => toggleSelect(kb.knowledgeBaseId)}
                    tenantName={kb.locationId ? tenantMap.get(kb.locationId) ?? null : null}
                  />
                ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {totalCount > 0 && (
        <p className="text-xs text-gray-400 text-center">
          Showing {itemCount} of {totalCount} {tab === "agents" ? "agents" : "knowledge bases"}
        </p>
      )}

      {/* Assign modal */}
      {showAssignModal && (
        <AssignModal
          tenants={tenants}
          selectedCount={selectedIds.size}
          onAssign={(locationId) => handleAction("assign", locationId)}
          onClose={() => setShowAssignModal(false)}
          loading={anyMutating}
        />
      )}
    </div>
  );
}

function AgentRow({
  agent,
  selected,
  onToggle,
  tenantName,
}: {
  agent: AgentLibraryItem;
  selected: boolean;
  onToggle: () => void;
  tenantName: string | null;
}) {
  return (
    <tr className={`border-b border-gray-50 transition-colors ${selected ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
          {agent.agentName || "Unnamed Agent"}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-500 capitalize">{agent.channel}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={agent.status} />
      </td>
      <td className="px-4 py-3">
        {tenantName ? (
          <span className="text-xs text-gray-700">{tenantName}</span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-gray-600">
          {agent.connectedPhoneNumbers === null
            ? "Unavailable"
            : agent.connectedPhoneNumbers?.length
              ? agent.connectedPhoneNumbers.join(", ")
              : "Not connected"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-[10px] text-gray-400 font-mono">{agent.agentId.slice(0, 12)}...</span>
      </td>
    </tr>
  );
}

function KbRow({
  kb,
  selected,
  onToggle,
  tenantName,
}: {
  kb: KbLibraryItem;
  selected: boolean;
  onToggle: () => void;
  tenantName: string | null;
}) {
  return (
    <tr className={`border-b border-gray-50 transition-colors ${selected ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}>
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="rounded border-gray-300"
        />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]">
          {kb.knowledgeBaseName || "Unnamed KB"}
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={kb.status} />
      </td>
      <td className="px-4 py-3">
        {tenantName ? (
          <span className="text-xs text-gray-700">{tenantName}</span>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-[10px] text-gray-400 font-mono">{kb.knowledgeBaseId.slice(0, 12)}...</span>
      </td>
    </tr>
  );
}
