import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNav } from "./admin-nav";

let currentPath = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

describe("AdminNav", () => {
  it("renders Tenants and Audit Log links", () => {
    currentPath = "/admin";
    render(<AdminNav />);
    expect(screen.getByText("Tenants")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("highlights Tenants when on /admin", () => {
    currentPath = "/admin";
    render(<AdminNav />);
    const tenantsLink = screen.getByText("Tenants");
    expect(tenantsLink.className).toContain("text-blue-600");
  });

  it("highlights Audit Log when on /admin/audit-log", () => {
    currentPath = "/admin/audit-log";
    render(<AdminNav />);
    const auditLink = screen.getByText("Audit Log");
    expect(auditLink.className).toContain("text-blue-600");
    const tenantsLink = screen.getByText("Tenants");
    expect(tenantsLink.className).not.toContain("text-blue-600");
  });

  it("Tenants is not active on sub-paths like /admin/tenants/new", () => {
    currentPath = "/admin/tenants/new";
    render(<AdminNav />);
    const tenantsLink = screen.getByText("Tenants");
    expect(tenantsLink.className).not.toContain("text-blue-600");
  });
});
