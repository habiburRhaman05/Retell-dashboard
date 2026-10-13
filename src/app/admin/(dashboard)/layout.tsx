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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-gray-900">Admin Panel</h1>
          <AdminNav />
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {session.role}
          </span>
          <span>{session.email}</span>
          <form action="/api/auth/admin/logout" method="POST">
            <button className="text-red-500 hover:text-red-700 text-sm">Sign out</button>
          </form>
        </div>
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
