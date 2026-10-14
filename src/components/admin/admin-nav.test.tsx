import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminNav } from "./admin-nav";

let currentPath = "/admin";
vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

// Links render twice (desktop pill nav + mobile drawer), but the drawer is
// only in the DOM once opened, so getByText below finds the desktop link.
describe("AdminNav", () => {
  it("renders Sub-Accounts, Library and Audit Log links", () => {
    currentPath = "/admin";
    render(<AdminNav />);
    expect(screen.getByText("Sub-Accounts")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Audit Log")).toBeInTheDocument();
  });

  it("shows no email, role or sign-out chrome", () => {
    currentPath = "/admin";
    render(<AdminNav />);
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
    expect(screen.queryByText(/owner|support/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();
  });

  it("highlights Sub-Accounts when on /admin", () => {
    currentPath = "/admin";
    render(<AdminNav />);
    const link = screen.getByText("Sub-Accounts");
    expect(link.className).toContain("bg-brand-500");
  });

  it("highlights Audit Log when on /admin/audit-log", () => {
    currentPath = "/admin/audit-log";
    render(<AdminNav />);
    const auditLink = screen.getByText("Audit Log");
    expect(auditLink.className).toContain("bg-brand-500");
    const link = screen.getByText("Sub-Accounts");
    expect(link.className).not.toContain("bg-brand-500");
  });

  it("Sub-Accounts is not active on sub-paths like /admin/tenants/new", () => {
    currentPath = "/admin/tenants/new";
    render(<AdminNav />);
    const link = screen.getByText("Sub-Accounts");
    expect(link.className).not.toContain("bg-brand-500");
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    currentPath = "/admin";
    render(<AdminNav />);

    expect(screen.queryByText("Menu")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Open menu"));
    expect(screen.getByText("Menu")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Close menu"));
    expect(screen.queryByText("Menu")).not.toBeInTheDocument();
  });
});
