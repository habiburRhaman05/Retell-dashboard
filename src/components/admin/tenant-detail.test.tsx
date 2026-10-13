import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TenantDetail } from "./tenant-detail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const baseTenant = {
  id: "t1",
  name: "Acme Corp",
  email: "acme@test.com",
  crmLocationId: "loc_abc",
  status: "active",
  createdAt: "2026-10-01T00:00:00Z",
  agents: [
    { id: "a1", retellAgentId: "ret_a1", name: "Bot - Acme Corp", createdAt: "2026-10-02T00:00:00Z", nameValid: true },
    { id: "a2", retellAgentId: "ret_a2", name: "OldBot", createdAt: "2026-10-03T00:00:00Z", nameValid: false },
  ],
  knowledgeBases: [
    { id: "kb1", retellKbId: "ret_kb1", name: "FAQ - Acme Corp", createdAt: "2026-10-02T00:00:00Z" },
  ],
  auditLogs: [
    { id: "log1", action: "tenant.create", actorType: "admin", actorId: "adm1", targetType: "tenant", before: null, after: { name: "Acme Corp" }, createdAt: "2026-10-01T00:00:00Z" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([]),
  });
});

describe("TenantDetail", () => {
  it("renders tenant header with name and status", () => {
    render(<TenantDetail tenant={baseTenant} />);
    // Name appears in header and in the info tab input, so use getAllByText
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("active")).toBeInTheDocument();
    // loc_abc appears in header and in the info tab CRM field
    expect(screen.getAllByText("loc_abc").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all tab buttons", () => {
    render(<TenantDetail tenant={baseTenant} />);
    expect(screen.getByText("Info")).toBeInTheDocument();
    expect(screen.getByText(/Agents/)).toBeInTheDocument();
    expect(screen.getByText(/Knowledge Bases/)).toBeInTheDocument();
    expect(screen.getByText("Access")).toBeInTheDocument();
    expect(screen.getByText(/Audit Log/)).toBeInTheDocument();
  });

  it("shows info tab by default with edit fields", () => {
    render(<TenantDetail tenant={baseTenant} />);
    const nameInput = screen.getByDisplayValue("Acme Corp");
    expect(nameInput).toBeInTheDocument();
    const emailInput = screen.getByDisplayValue("acme@test.com");
    expect(emailInput).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("switches to agents tab and shows agents", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText(/Agents/));
    expect(screen.getByText("Bot - Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("OldBot")).toBeInTheDocument();
    expect(screen.getByText("valid")).toBeInTheDocument();
    expect(screen.getByText("needs fix")).toBeInTheDocument();
  });

  it("switches to KB tab and shows knowledge bases", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText(/Knowledge Bases/));
    expect(screen.getByText("FAQ - Acme Corp")).toBeInTheDocument();
  });

  it("shows empty agents state", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={{ ...baseTenant, agents: [] }} />);
    await user.click(screen.getByText(/Agents/));
    expect(screen.getByText("No agents created yet.")).toBeInTheDocument();
  });

  it("shows empty KB state", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={{ ...baseTenant, knowledgeBases: [] }} />);
    await user.click(screen.getByText(/Knowledge Bases/));
    expect(screen.getByText("No knowledge bases created yet.")).toBeInTheDocument();
  });

  it("switches to access tab for active tenant", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText("Access"));
    expect(screen.getByText("This tenant can access the dashboard normally.")).toBeInTheDocument();
    expect(screen.getByText("Suspend Account")).toBeInTheDocument();
  });

  it("shows reactivate button for suspended tenant", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={{ ...baseTenant, status: "suspended" }} />);
    await user.click(screen.getByText("Access"));
    expect(screen.getByText("This tenant is suspended and cannot access the dashboard.")).toBeInTheDocument();
    expect(screen.getByText("Reactivate Account")).toBeInTheDocument();
  });

  describe("dashboard link", () => {
    const answer = (link: { ok: boolean; body: unknown }) =>
      vi.fn(async (url: string) =>
        String(url).endsWith("/link")
          ? { ok: link.ok, json: async () => link.body }
          : { ok: true, json: async () => [] }
      );

    it("creates a signed link on demand and shows it", async () => {
      const mock = answer({ ok: true, body: { url: "https://app.test/retell/loc_abc/dashboard?token=SIGNED", expiresAt: "2027-10-01T00:00:00Z" } });
      global.fetch = mock as never;
      const user = userEvent.setup();
      render(<TenantDetail tenant={baseTenant} />);
      await user.click(screen.getByText("Access"));

      expect(screen.queryByLabelText("Dashboard link")).not.toBeInTheDocument();
      await user.click(screen.getByText("Generate dashboard link"));

      expect(await screen.findByDisplayValue(/token=SIGNED/)).toBeInTheDocument();
      expect(mock).toHaveBeenCalledWith("/api/admin/tenants/t1/link", { method: "POST" });
      expect(screen.getByText(/Treat this link like a password/)).toBeInTheDocument();
      expect(screen.getByText("Create another link")).toBeInTheDocument();
    });

    it("does not call the API until the admin asks for a link", async () => {
      const mock = answer({ ok: true, body: { url: "x" } });
      global.fetch = mock as never;
      const user = userEvent.setup();
      render(<TenantDetail tenant={baseTenant} />);
      await user.click(screen.getByText("Access"));

      expect(mock.mock.calls.some(([u]) => String(u).endsWith("/link"))).toBe(false);
    });

    it("shows the server's error when the link cannot be created", async () => {
      global.fetch = answer({ ok: false, body: { error: "Owner access required" } }) as never;
      const user = userEvent.setup();
      render(<TenantDetail tenant={baseTenant} />);
      await user.click(screen.getByText("Access"));
      await user.click(screen.getByText("Generate dashboard link"));

      expect(await screen.findByText("Owner access required")).toBeInTheDocument();
      expect(screen.queryByLabelText("Dashboard link")).not.toBeInTheDocument();
    });

    it("shows a connection error when the request fails", async () => {
      global.fetch = vi.fn(async (url: string) => {
        if (String(url).endsWith("/link")) throw new Error("offline");
        return { ok: true, json: async () => [] };
      }) as never;
      const user = userEvent.setup();
      render(<TenantDetail tenant={baseTenant} />);
      await user.click(screen.getByText("Access"));
      await user.click(screen.getByText("Generate dashboard link"));

      expect(await screen.findByText("Connection error")).toBeInTheDocument();
    });

    it("copies the link to the clipboard", async () => {
      global.fetch = answer({ ok: true, body: { url: "https://app.test/retell/loc_abc/dashboard?token=SIGNED" } }) as never;
      const user = userEvent.setup();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      render(<TenantDetail tenant={baseTenant} />);
      await user.click(screen.getByText("Access"));
      await user.click(screen.getByText("Generate dashboard link"));
      await screen.findByDisplayValue(/token=SIGNED/);

      await user.click(screen.getByText("Copy"));

      expect(writeText).toHaveBeenCalledWith("https://app.test/retell/loc_abc/dashboard?token=SIGNED");
      expect(await screen.findByText("Copied")).toBeInTheDocument();
    });
  });

  it("switches to audit tab and shows log entries", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText(/Audit Log/));
    expect(screen.getByText("tenant.create")).toBeInTheDocument();
  });

  it("shows empty audit state", async () => {
    const user = userEvent.setup();
    render(<TenantDetail tenant={{ ...baseTenant, auditLogs: [] }} />);
    await user.click(screen.getByText(/Audit Log/));
    expect(screen.getByText("No audit entries yet.")).toBeInTheDocument();
  });

  it("shows tab counts in badge spans", () => {
    render(<TenantDetail tenant={baseTenant} />);
    // Agents tab shows count 2, KB tab shows 1, Audit tab shows 1
    expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("calls save API on Save Changes click", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ...baseTenant, name: "Updated" }),
    });
    global.fetch = mockFetch;

    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText("Save Changes"));
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/admin/tenants/${baseTenant.id}`,
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("shows error when save fails", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Name taken" }),
    });

    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Name taken")).toBeInTheDocument();
  });

  it("shows connection error", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network"));

    render(<TenantDetail tenant={baseTenant} />);
    await user.click(screen.getByText("Save Changes"));
    expect(await screen.findByText("Connection error")).toBeInTheDocument();
  });
});
