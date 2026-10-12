"use client";

import { useEffect, useState } from "react";

type GateState =
  | { status: "loading" }
  | { status: "authenticated"; tenantName: string }
  | { status: "not_registered" }
  | { status: "suspended" }
  | { status: "error"; message: string };

export function TenantGate({
  locationId,
  children,
}: {
  locationId: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<GateState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function authenticate() {
      try {
        const res = await fetch("/api/auth/tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId }),
        });
        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          setState({ status: "authenticated", tenantName: data.tenantName });
          return;
        }

        const data = await res.json().catch(() => ({ code: "UNKNOWN" }));
        if (data.code === "NOT_REGISTERED") {
          setState({ status: "not_registered" });
        } else if (data.code === "ACCOUNT_SUSPENDED") {
          setState({ status: "suspended" });
        } else {
          setState({ status: "error", message: data.error ?? "Authentication failed" });
        }
      } catch {
        if (!cancelled) {
          setState({ status: "error", message: "Unable to connect. Please try again." });
        }
      }
    }
    authenticate();
    return () => { cancelled = true; };
  }, [locationId]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 text-sm">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (state.status === "not_registered") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Not Registered</h1>
          <p className="text-gray-500">This account has not been set up yet. Please contact support to get started.</p>
        </div>
      </div>
    );
  }

  if (state.status === "suspended") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Account Suspended</h1>
          <p className="text-gray-500">This account is currently suspended. Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something Went Wrong</h1>
          <p className="text-gray-500">{state.message}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
