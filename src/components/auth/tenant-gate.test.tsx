import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TenantGate } from "./tenant-gate";

beforeEach(() => vi.restoreAllMocks());

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: response.ok,
    status: response.status,
    json: () => Promise.resolve(response.body),
  } as Response);
}

describe("TenantGate", () => {
  it("shows loading spinner initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard</div>
      </TenantGate>
    );
    expect(screen.getByText("Verifying access...")).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    mockFetch({ ok: true, status: 200, body: { ok: true, tenantName: "Acme" } });
    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard Content</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    });
  });

  it("shows not registered message for unregistered location", async () => {
    mockFetch({
      ok: false,
      status: 403,
      body: { code: "NOT_REGISTERED", error: "Account not registered" },
    });
    render(
      <TenantGate locationId="unknown">
        <div>Dashboard</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("Account Not Registered")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("shows suspended message for suspended account", async () => {
    mockFetch({
      ok: false,
      status: 403,
      body: { code: "ACCOUNT_SUSPENDED", error: "Account suspended" },
    });
    render(
      <TenantGate locationId="sus_loc">
        <div>Dashboard</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("Account Suspended")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("asks for the CRM link when there is no session and no token", async () => {
    mockFetch({ ok: false, status: 401, body: { code: "LINK_REQUIRED", error: "Open this app from your CRM link." } });
    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("Open From Your CRM")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("explains an invalid or expired link", async () => {
    mockFetch({ ok: false, status: 401, body: { code: "INVALID_LINK", error: "This link is not valid." } });
    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("This Link Is Not Valid")).toBeInTheDocument();
    });
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });

  it("sends the token from the URL and then removes it from the address bar", async () => {
    window.history.pushState({}, "", "/retell/loc_1/dashboard?token=signed.link.token&keep=1");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, tenantName: "Acme" }),
    } as Response);

    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard Content</div>
      </TenantGate>
    );

    await waitFor(() => expect(screen.getByText("Dashboard Content")).toBeInTheDocument());
    expect(JSON.parse(spy.mock.calls[0][1]!.body as string)).toEqual({
      locationId: "loc_1",
      token: "signed.link.token",
    });
    expect(window.location.search).toBe("?keep=1");
    window.history.pushState({}, "", "/");
  });

  it("keeps the token in the URL when authentication fails", async () => {
    window.history.pushState({}, "", "/retell/loc_1/dashboard?token=bad");
    mockFetch({ ok: false, status: 401, body: { code: "INVALID_LINK" } });

    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard</div>
      </TenantGate>
    );

    await waitFor(() => expect(screen.getByText("This Link Is Not Valid")).toBeInTheDocument());
    expect(window.location.search).toBe("?token=bad");
    window.history.pushState({}, "", "/");
  });

  it("shows error message on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    render(
      <TenantGate locationId="loc_1">
        <div>Dashboard</div>
      </TenantGate>
    );
    await waitFor(() => {
      expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
    });
  });

  it("sends locationId in the POST body", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, tenantName: "Test" }),
    } as Response);

    render(
      <TenantGate locationId="my_loc_id">
        <div>Content</div>
      </TenantGate>
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith("/api/auth/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: "my_loc_id" }),
      });
    });
  });
});
