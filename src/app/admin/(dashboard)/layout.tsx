import { Suspense } from "react";
import { getAdminSession } from "@/modules/auth/middleware";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminAutoLoginGate } from "@/components/admin/admin-auto-login-gate";

function AutoLoginSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();
  if (!session) {
    // No valid session: this could be a plain logged-out visit (send to the
    // login form) or an admin auto-login link, app.com/admin?companyId={id}
    // (exchange it for a session). Either way is decided client-side, since
    // layouts do not receive the request's search params.
    return (
      <Suspense fallback={<AutoLoginSpinner />}>
        <AdminAutoLoginGate />
      </Suspense>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <AdminNav />
      <main className="flex-1 overflow-auto">
        <div className="max-w-none mx-auto px-4 lg:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
