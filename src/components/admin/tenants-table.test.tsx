import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TenantsTable } from "./tenants-table";

const tenants = [
  {
    id: "t1", name: "Acme Corp", email: "acme@test.com",
    crmLocationId: "loc_1", status: "active", createdAt: "2026-10-01T00:00:00Z",
    agentCount: 5, kbCount: 2, hasLocks: false,
  },
  {
    id: "t2", name: "Beta Inc", email: "beta@test.com",
    crmLocationId: "loc_2", status: "suspended", createdAt: "2026-10-05T00:00:00Z",
    agentCount: 3, kbCount: 0, hasLocks: true,
  },
];

describe("TenantsTable", () => {
  it("renders all tenants", () => {
    render(<TenantsTable tenants={tenants} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.getByText("2 registered")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(<TenantsTable tenants={tenants} />);
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("suspended")).toBeInTheDocument();
  });

  it("shows locked badge for tenants with locks", () => {
    render(<TenantsTable tenants={tenants} />);
    expect(screen.getByText("locked")).toBeInTheDocument();
  });

  it("shows empty state when no tenants", () => {
    render(<TenantsTable tenants={[]} />);
    expect(screen.getByText("No tenants registered yet.")).toBeInTheDocument();
  });

  it("filters by search text", async () => {
    const user = userEvent.setup();
    render(<TenantsTable tenants={tenants} />);
    const search = screen.getByPlaceholderText(/Search/);
    await user.type(search, "Acme");
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText("Beta Inc")).not.toBeInTheDocument();
  });

  it("filters by email", async () => {
    const user = userEvent.setup();
    render(<TenantsTable tenants={tenants} />);
    const search = screen.getByPlaceholderText(/Search/);
    await user.type(search, "beta@test");
    expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("shows no-match message when search has no results", async () => {
    const user = userEvent.setup();
    render(<TenantsTable tenants={tenants} />);
    const search = screen.getByPlaceholderText(/Search/);
    await user.type(search, "zzzzzzz");
    expect(screen.getByText("No tenants match your search.")).toBeInTheDocument();
  });

  it("shows agent and KB counts", () => {
    render(<TenantsTable tenants={tenants} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
