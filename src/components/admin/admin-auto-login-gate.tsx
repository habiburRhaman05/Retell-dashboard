"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Rendered by the (dashboard) layout instead of its normal redirect-to-login
// when there is no admin session. If the URL carries ?companyId=, this is an
// admin auto-login link (app.com/admin?companyId={id}): exchange it for a
// real session in the background and show a spinner while that happens.
// Otherwise it is a plain logged-out visit, so send the visitor to the
// regular login form exactly as the old redirect did.
export function AdminAutoLoginGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!companyId) {
      router.replace("/admin/login");
      return;
    }

    let cancelled = false;
    fetch("/api/auth/admin/company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId }),
    })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          // Clean the secret out of the URL/history and re-render the
          // dashboard now that the cookie is set.
          router.replace("/admin");
        } else {
          setFailed(true);
          router.replace("/admin/login?error=invalid_link");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        router.replace("/admin/login?error=invalid_link");
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, router]);

  if (!companyId || failed) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div
        role="status"
        aria-label="Signing in"
        className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"
      />
    </div>
  );
}
