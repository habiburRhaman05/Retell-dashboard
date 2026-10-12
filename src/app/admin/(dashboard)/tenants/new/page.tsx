"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterTenantPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [crmLocationId, setCrmLocationId] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ name: string; id: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email || undefined, crmLocationId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess({ name: data.name, id: data.id });
        return;
      }

      if (data.details) {
        setFieldErrors(data.details);
      } else {
        setError(data.error ?? "Registration failed");
      }
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Tenant Registered</h2>
          <p className="text-gray-500 mb-6">
            <span className="font-medium text-gray-900">{success.name}</span> has been registered successfully.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push(`/admin/tenants/${success.id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              View Tenant
            </button>
            <button
              onClick={() => {
                setSuccess(null);
                setName("");
                setEmail("");
                setCrmLocationId("");
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <button
          onClick={() => router.push("/admin")}
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to tenants
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Register New Tenant</h2>
        <p className="text-sm text-gray-500 mb-6">Create a sub-account for a new customer.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Tenant Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="e.g. Bright AI Solutions"
            />
            {fieldErrors.name && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.name[0]}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              This name will be appended to all agent names: &ldquo;Agent - {name || "Tenant Name"}&rdquo;
            </p>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="contact@example.com"
            />
            {fieldErrors.email && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.email[0]}</p>
            )}
          </div>

          <div>
            <label htmlFor="crmLocationId" className="block text-sm font-medium text-gray-700 mb-1">
              CRM Location ID <span className="text-red-500">*</span>
            </label>
            <input
              id="crmLocationId"
              type="text"
              value={crmLocationId}
              onChange={(e) => setCrmLocationId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              placeholder="e.g. tWh67iVHHkSDby7bGdvW"
            />
            {fieldErrors.crmLocationId && (
              <p className="text-xs text-red-600 mt-1">{fieldErrors.crmLocationId[0]}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">
              The location ID from the CRM. This cannot be changed later.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Registering..." : "Register Tenant"}
          </button>
        </form>
      </div>
    </div>
  );
}
