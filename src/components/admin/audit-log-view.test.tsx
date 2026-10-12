import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuditLogView } from "./audit-log-view";

const tenants = [
  { id: "t1", name: "Acme Corp" },
  { id: "t2", name: "Beta Inc" },
];

const logs = [
  {
    id: "l1", action: "tenant.create", actorType: "admin", actorId: "a1",
    targetType: "tenant", targetId: "t1", tenantId: "t1",
    before: null, after: { name: "Acme Corp" }, createdAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "l2", action: "tenant.suspend", actorType: "admin", actorId: "a1",
    targetType: "tenant", targetId: "t2", tenantId: "t2",
    before: { status: "active" }, after: { status: "suspended" }, createdAt: "2026-10-05T00:00:00Z",
  },
  {
    id: "l3", action: "tenant.update", actorType: "admin", actorId: "a1",
    targetType: "tenant", targetId: "t1", tenantId: "t1",
    before: { name: "Old" }, after: { name: "New" }, createdAt: "2026-10-06T00:00:00Z",
  },
];

describe("AuditLogView", () => {
  it("renders all audit entries", () => {
    render(<AuditLogView logs={logs} tenants={tenants} />);
    const rows = screen.getAllByRole("row");
    // header + 3 data rows
    expect(rows).toHaveLength(4);
  });

  it("renders tenant names from map", () => {
    render(<AuditLogView logs={logs} tenants={tenants} />);
    // Acme Corp appears in the select AND in two table rows
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(2);
    // Beta Inc appears in the select AND in one table row
    expect(screen.getAllByText("Beta Inc").length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when no entries", () => {
    render(<AuditLogView logs={[]} tenants={tenants} />);
    expect(screen.getByText("No audit entries match the filters.")).toBeInTheDocument();
  });

  it("filters by tenant", async () => {
    const user = userEvent.setup();
    render(<AuditLogView logs={logs} tenants={tenants} />);
    const tenantSelect = screen.getByDisplayValue("All tenants");
    await user.selectOptions(tenantSelect, "t2");
    const rows = screen.getAllByRole("row");
    // header + 1 data row (only tenant.suspend for t2)
    expect(rows).toHaveLength(2);
  });

  it("filters by action type", async () => {
    const user = userEvent.setup();
    render(<AuditLogView logs={logs} tenants={tenants} />);
    const actionSelect = screen.getByDisplayValue("All actions");
    await user.selectOptions(actionSelect, "tenant.suspend");
    const rows = screen.getAllByRole("row");
    // header + 1 data row
    expect(rows).toHaveLength(2);
  });

  it("shows empty state after filtering removes all results", async () => {
    const singleLog = [logs[0]]; // only tenant.create for t1
    const user = userEvent.setup();
    render(<AuditLogView logs={singleLog} tenants={tenants} />);
    const tenantSelect = screen.getByDisplayValue("All tenants");
    await user.selectOptions(tenantSelect, "t2");
    expect(screen.getByText("No audit entries match the filters.")).toBeInTheDocument();
  });

  it("shows dash for entries without tenantId", () => {
    const noTenantLog = [{
      ...logs[0], id: "l_no_tenant", tenantId: null,
    }];
    render(<AuditLogView logs={noTenantLog} tenants={tenants} />);
    const cells = screen.getAllByRole("cell");
    const tenantCell = cells.find(c => c.textContent === "—");
    expect(tenantCell).toBeTruthy();
  });
});
