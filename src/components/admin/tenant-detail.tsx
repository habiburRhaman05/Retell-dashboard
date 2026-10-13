"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface AgentRow {
  id: string;
  retellAgentId: string;
  name: string;
  createdAt: string;
  nameValid: boolean;
}

interface KbRow {
  id: string;
  retellKbId: string;
  name: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  actorType: string;
  actorId: string;
  targetType: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

interface TenantData {
  id: string;
  name: string;
  email: string | null;
  crmLocationId: string;
  status: string;
  createdAt: string;
  agents: AgentRow[];
  knowledgeBases: KbRow[];
  auditLogs: AuditRow[];
}

interface UsageSummary {
  totalCalls: number;
  totalMinutes: number;
  totalCostCents: number;
  byDay: { date: string; calls: number; minutes: number }[];
  byAgent: { agentId: string; calls: number; minutes: number }[];
}

interface LimitPolicy {
  id: string;
  metric: string;
  limitValue: number;
  period: string;
  warnAtPct: number;
  mode: string;
  currentUsage: number;
}

interface FeatureRow {
  id: string;
  featureKey: string;
  enabled: boolean;
  reason: string | null;
  changedAt: string;
}

type Tab = "info" | "agents" | "kb" | "access" | "usage" | "audit";

export function TenantDetail({ tenant }: { tenant: TenantData }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("info");
  const [editName, setEditName] = useState(tenant.name);
  const [editEmail, setEditEmail] = useState(tenant.email ?? "");
  const [saving, setSaving] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const [message, setMessage] = useState("");
  const [usageState, setUsageState] = useState<{
    data: UsageSummary | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: false, error: "" });
  const [limits, setLimits] = useState<LimitPolicy[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [features, setFeatures] = useState<FeatureRow[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [disableTarget, setDisableTarget] = useState<{ key: string; label: string } | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [disableConfirmText, setDisableConfirmText] = useState("");
  const [disableSaving, setDisableSaving] = useState(false);
  const [limitForm, setLimitForm] = useState({
    metric: "AGENTS",
    limitValue: "",
    period: "monthly",
    warnAtPct: "80",
    mode: "hard",
  });
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitMsg, setLimitMsg] = useState("");
  const [linkState, setLinkState] = useState<{
    url: string;
    loading: boolean;
    error: string;
    copied: boolean;
  }>({ url: "", loading: false, error: "", copied: false });
  const accessFetched = useRef(false);
  const usageFetched = useRef(false);

  const fetchLimitsAndFeatures = useCallback(() => {
    if (accessFetched.current) return;
    accessFetched.current = true;
    setLimitsLoading(true);
    setFeaturesLoading(true);
    fetch(`/api/admin/tenants/${tenant.id}/limits`)
      .then((r) => r.json())
      .then((d) => setLimits(d))
      .catch(() => {})
      .finally(() => setLimitsLoading(false));
    fetch(`/api/admin/tenants/${tenant.id}/features`)
      .then((r) => r.json())
      .then((d) => setFeatures(d))
      .catch(() => {})
      .finally(() => setFeaturesLoading(false));
  }, [tenant.id]);

  const fetchUsage = useCallback(() => {
    if (usageFetched.current) return;
    usageFetched.current = true;
    setUsageState({ data: null, loading: true, error: "" });
    fetch(`/api/admin/tenants/${tenant.id}/usage`)
      .then((r) => r.json())
      .then((d) => setUsageState({ data: d.summary, loading: false, error: "" }))
      .catch(() => setUsageState({ data: null, loading: false, error: "Failed to load usage data" }));
  }, [tenant.id]);

  useEffect(() => {
    if (tab === "access") fetchLimitsAndFeatures();
    if (tab === "usage") fetchUsage();
  }, [tab, fetchLimitsAndFeatures, fetchUsage]);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "info", label: "Info" },
    { key: "agents", label: "Agents", count: tenant.agents.length },
    { key: "kb", label: "Knowledge Bases", count: tenant.knowledgeBases.length },
    { key: "access", label: "Access" },
    { key: "usage", label: "Usage" },
    { key: "audit", label: "Audit Log", count: tenant.auditLogs.length },
  ];

  async function saveInfo() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail || undefined }),
      });
      if (res.ok) {
        setMessage("Saved");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error ?? "Save failed");
      }
    } catch {
      setMessage("Connection error");
    } finally {
      setSaving(false);
    }
  }

  async function generateLink() {
    setLinkState({ url: "", loading: true, error: "", copied: false });
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/link`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        setLinkState({ url: data.url, loading: false, error: "", copied: false });
      } else {
        setLinkState({ url: "", loading: false, error: data.error ?? "Could not create the link", copied: false });
      }
    } catch {
      setLinkState({ url: "", loading: false, error: "Connection error", copied: false });
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(linkState.url);
      setLinkState((prev) => ({ ...prev, copied: true }));
    } catch {
      setLinkState((prev) => ({ ...prev, error: "Copy failed. Select the link and copy it by hand." }));
    }
  }

  async function setFeature(featureKey: string, enabled: boolean, reason: string | null) {
    await fetch(`/api/admin/tenants/${tenant.id}/features`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureKey, enabled, reason }),
    });
    accessFetched.current = false;
    fetchLimitsAndFeatures();
  }

  async function confirmDisable() {
    if (!disableTarget) return;
    setDisableSaving(true);
    try {
      await setFeature(disableTarget.key, false, disableReason || null);
      setDisableTarget(null);
      setDisableReason("");
      setDisableConfirmText("");
    } finally {
      setDisableSaving(false);
    }
  }

  async function toggleSuspend() {
    setSuspending(true);
    setMessage("");
    const isSuspended = tenant.status === "suspended";
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/suspend`, {
        method: isSuspended ? "DELETE" : "POST",
      });
      if (res.ok) {
        setMessage(isSuspended ? "Reactivated" : "Suspended");
        router.refresh();
      } else {
        const data = await res.json();
        setMessage(data.error ?? "Action failed");
      }
    } catch {
      setMessage("Connection error");
    } finally {
      setSuspending(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to tenants
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-gray-900">{tenant.name}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            tenant.status === "active"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}>
            {tenant.status}
          </span>
        </div>
        <p className="text-sm text-gray-400 font-mono mt-1">{tenant.crmLocationId}</p>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className={`mb-4 text-sm p-3 rounded-lg ${
          message === "Saved" || message === "Reactivated" || message === "Suspended"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-600"
        }`}>
          {message}
        </div>
      )}

      {tab === "info" && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name</label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CRM Location ID</label>
            <p className="text-sm text-gray-500 font-mono bg-gray-50 px-3 py-2 rounded-lg">{tenant.crmLocationId}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
            <p className="text-sm text-gray-500">{new Date(tenant.createdAt).toLocaleString()}</p>
          </div>
          <button
            onClick={saveInfo}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {tab === "agents" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tenant.agents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No agents created yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Retell ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Naming</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenant.agents.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{a.retellAgentId}</td>
                    <td className="px-4 py-3">
                      {a.nameValid ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">valid</span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">needs fix</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "kb" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tenant.knowledgeBases.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No knowledge bases created yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Retell ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenant.knowledgeBases.map((kb) => (
                  <tr key={kb.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{kb.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono">{kb.retellKbId}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(kb.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "access" && (
        <div className="space-y-6">
          {/* Limits Management */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Usage Limits</h3>
            {limitsLoading ? (
              <p className="text-sm text-gray-500">Loading limits...</p>
            ) : (
              <>
                {limits.length > 0 && (
                  <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Metric</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Limit</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Used</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Period</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Mode</th>
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Warn At</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {limits.map((lp) => (
                          <tr key={lp.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">{formatMetricLabel(lp.metric)}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{lp.limitValue}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={lp.currentUsage >= lp.limitValue ? "text-red-600 font-medium" : "text-gray-700"}>
                                {lp.currentUsage}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{lp.period}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                lp.mode === "hard" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"
                              }`}>
                                {lp.mode}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-500">{lp.warnAtPct}%</td>
                            <td className="px-4 py-2 text-right">
                              <button
                                onClick={async () => {
                                  if (!confirm(`Delete ${formatMetricLabel(lp.metric)} limit?`)) return;
                                  await fetch(`/api/admin/tenants/${tenant.id}/limits?metric=${lp.metric}`, { method: "DELETE" });
                                  accessFetched.current = false;
                                  fetchLimitsAndFeatures();
                                }}
                                className="text-xs text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {limits.length === 0 && (
                  <p className="text-sm text-gray-400 mb-4">No limits set. This tenant has unlimited access.</p>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-xs font-medium text-gray-700 mb-3 uppercase">Add / Update Limit</h4>
                  {limitMsg && (
                    <p className={`text-xs mb-3 p-2 rounded ${
                      limitMsg.startsWith("Saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                    }`}>
                      {limitMsg}
                    </p>
                  )}
                  <div className="grid grid-cols-5 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Metric</label>
                      <select
                        value={limitForm.metric}
                        onChange={(e) => setLimitForm({ ...limitForm, metric: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="AGENTS">Agents</option>
                        <option value="KNOWLEDGE_BASES">Knowledge Bases</option>
                        <option value="CALLS">Calls</option>
                        <option value="CALL_MINUTES">Call Minutes</option>
                        <option value="CONCURRENT_CALLS">Concurrent Calls</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Limit</label>
                      <input
                        type="number"
                        min="0"
                        value={limitForm.limitValue}
                        onChange={(e) => setLimitForm({ ...limitForm, limitValue: e.target.value })}
                        placeholder="e.g. 10"
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Period</label>
                      <select
                        value={limitForm.period}
                        onChange={(e) => setLimitForm({ ...limitForm, period: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="lifetime">Lifetime</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Mode</label>
                      <select
                        value={limitForm.mode}
                        onChange={(e) => setLimitForm({ ...limitForm, mode: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      >
                        <option value="hard">Hard (block)</option>
                        <option value="soft">Soft (warn only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Warn %</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={limitForm.warnAtPct}
                        onChange={(e) => setLimitForm({ ...limitForm, warnAtPct: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                  <button
                    disabled={limitSaving || !limitForm.limitValue}
                    onClick={async () => {
                      setLimitSaving(true);
                      setLimitMsg("");
                      try {
                        const res = await fetch(`/api/admin/tenants/${tenant.id}/limits`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            metric: limitForm.metric,
                            limitValue: parseInt(limitForm.limitValue),
                            period: limitForm.period,
                            warnAtPct: parseInt(limitForm.warnAtPct),
                            mode: limitForm.mode,
                          }),
                        });
                        if (res.ok) {
                          setLimitMsg("Saved successfully");
                          setLimitForm({ ...limitForm, limitValue: "" });
                          accessFetched.current = false;
                          fetchLimitsAndFeatures();
                        } else {
                          const d = await res.json();
                          setLimitMsg(d.error ?? "Failed to save");
                        }
                      } catch {
                        setLimitMsg("Connection error");
                      } finally {
                        setLimitSaving(false);
                      }
                    }}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {limitSaving ? "Saving..." : "Set Limit"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Feature Toggles */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Feature Switches</h3>
            {featuresLoading ? (
              <p className="text-sm text-gray-500">Loading features...</p>
            ) : (
              <>
                <p className="text-sm text-gray-400 mb-4">
                  Toggle individual features on or off for this tenant. Disabled features show a message to the tenant.
                </p>
                <div className="space-y-3">
                  {[
                    { key: "agents.create", label: "Create Agents" },
                    { key: "knowledge_bases.create", label: "Create Knowledge Bases" },
                    { key: "calls.make", label: "Make Calls" },
                    { key: "calls.minutes", label: "Use Call Minutes" },
                  ].map((feat) => {
                    const existing = features.find((f) => f.featureKey === feat.key);
                    const isEnabled = existing ? existing.enabled : true;
                    return (
                      <div key={feat.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{feat.label}</span>
                          {existing?.reason && (
                            <p className="text-xs text-gray-400 mt-0.5">{existing.reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium ${isEnabled ? "text-green-700" : "text-red-700"}`}>
                            {isEnabled ? "Enabled" : "Disabled"}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            aria-label={`${isEnabled ? "Disable" : "Enable"} ${feat.label}`}
                            onClick={() => {
                              if (isEnabled) {
                                setDisableTarget({ key: feat.key, label: feat.label });
                                setDisableReason("");
                                setDisableConfirmText("");
                              } else {
                                setFeature(feat.key, true, null);
                              }
                            }}
                            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                              isEnabled ? "bg-green-500" : "bg-gray-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                isEnabled ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Account Status */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Account Status</h3>
            <p className="text-sm text-gray-500 mb-3">
              {tenant.status === "active"
                ? "This tenant can access the dashboard normally."
                : "This tenant is suspended and cannot access the dashboard."}
            </p>
            <button
              onClick={toggleSuspend}
              disabled={suspending}
              className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                tenant.status === "active"
                  ? "bg-red-50 text-red-700 hover:bg-red-100"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              {suspending
                ? "Processing..."
                : tenant.status === "active"
                  ? "Suspend Account"
                  : "Reactivate Account"}
            </button>
          </div>

          {/* Dashboard Link */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Dashboard Access</h3>
            <p className="text-sm text-gray-500 mb-3">
              Tenants open their dashboard only through a signed link. Create one and paste it into this
              tenant&apos;s CRM custom menu. The link opens this tenant&apos;s dashboard and nothing else.
            </p>
            <button
              onClick={generateLink}
              disabled={linkState.loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {linkState.loading ? "Creating..." : linkState.url ? "Create another link" : "Generate dashboard link"}
            </button>
            {linkState.error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg">{linkState.error}</p>
            )}
            {linkState.url && (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    readOnly
                    aria-label="Dashboard link"
                    value={linkState.url}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono bg-gray-50"
                  />
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    {linkState.copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Treat this link like a password: anyone who has it can open this dashboard. It is valid for one
                  year. To cut access sooner, suspend the account.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "usage" && (
        <div className="space-y-6">
          {usageState.loading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
              Loading usage data...
            </div>
          )}
          {usageState.error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">{usageState.error}</div>
          )}
          {usageState.data && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase font-medium">Calls This Month</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{usageState.data.totalCalls}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase font-medium">Minutes This Month</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{usageState.data.totalMinutes}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs text-gray-500 uppercase font-medium">Cost This Month</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    ${(usageState.data.totalCostCents / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              {usageState.data.byDay.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <h3 className="px-4 py-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                    Daily Breakdown
                  </h3>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Calls</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Minutes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usageState.data.byDay.map((d) => (
                        <tr key={d.date} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{d.date}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{d.calls}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{d.minutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {usageState.data.byAgent.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <h3 className="px-4 py-3 text-sm font-medium text-gray-900 border-b border-gray-200">
                    Per-Agent Breakdown
                  </h3>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Agent ID</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Calls</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Minutes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {usageState.data.byAgent.map((a) => (
                        <tr key={a.agentId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono">{a.agentId}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{a.calls}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{a.minutes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {usageState.data.totalCalls === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                  No usage data for this month yet.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {tenant.auditLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No audit entries yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Changes</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenant.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.actorType}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-xs truncate">
                      {log.after ? JSON.stringify(log.after) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {disableTarget && (
        <DisableFeatureModal
          label={disableTarget.label}
          reason={disableReason}
          onReasonChange={setDisableReason}
          confirmText={disableConfirmText}
          onConfirmTextChange={setDisableConfirmText}
          saving={disableSaving}
          onCancel={() => setDisableTarget(null)}
          onConfirm={confirmDisable}
        />
      )}
    </div>
  );
}

function DisableFeatureModal({
  label,
  reason,
  onReasonChange,
  confirmText,
  onConfirmTextChange,
  saving,
  onCancel,
  onConfirm,
}: {
  label: string;
  reason: string;
  onReasonChange: (v: string) => void;
  confirmText: string;
  onConfirmTextChange: (v: string) => void;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmed = confirmText.trim().toLowerCase() === "delete";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Disable &quot;{label}&quot;?</h3>
        <p className="text-sm text-gray-500 mb-4">
          The tenant will immediately lose access to this feature. They will see a message explaining why.
        </p>

        <label className="block text-xs font-medium text-gray-700 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Shown to the tenant, e.g. billing issue"
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
        />

        <label className="block text-xs font-medium text-gray-700 mb-1">
          Type <span className="font-mono font-semibold text-red-600">delete</span> to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder="delete"
          autoComplete="off"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-5 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 font-mono"
        />

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed || saving}
            className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Disabling..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    AGENTS: "Agents",
    KNOWLEDGE_BASES: "Knowledge Bases",
    CALLS: "Calls",
    CALL_MINUTES: "Call Minutes",
    CONCURRENT_CALLS: "Concurrent Calls",
  };
  return labels[metric] ?? metric;
}
