import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { getAdminSession } = vi.hoisted(() => ({ getAdminSession: vi.fn() }));
vi.mock("@/modules/auth/middleware", () => ({ getAdminSession }));

vi.mock("@/components/admin/admin-nav", () => ({
  AdminNav: () => <nav>nav</nav>,
}));

vi.mock("@/components/admin/admin-auto-login-gate", () => ({
  AdminAutoLoginGate: () => <div>auto-login-gate</div>,
}));

import AdminDashboardLayout from "./layout";

beforeEach(() => vi.clearAllMocks());

describe("AdminDashboardLayout", () => {
  it("renders the auto-login gate instead of redirecting when there is no session", async () => {
    getAdminSession.mockResolvedValue(null);
    const ui = await AdminDashboardLayout({ children: <div>Child content</div> });
    render(ui);
    expect(screen.getByText("auto-login-gate")).toBeInTheDocument();
    expect(screen.queryByText("Child content")).not.toBeInTheDocument();
  });

  it("renders the dashboard chrome and children for a valid session", async () => {
    getAdminSession.mockResolvedValue({ adminId: "a1", email: "admin@test.com", role: "owner" });
    const ui = await AdminDashboardLayout({ children: <div>Child content</div> });
    render(ui);
    expect(screen.getByText("Child content")).toBeInTheDocument();
    expect(screen.getByText("admin@test.com")).toBeInTheDocument();
    expect(screen.getByText("owner")).toBeInTheDocument();
  });
});
