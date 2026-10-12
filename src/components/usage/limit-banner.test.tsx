import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { LimitBanner } from "./limit-banner";

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchEntitlements(data: Record<string, unknown> | null, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: () => Promise.resolve(data),
  } as Response);
}

describe("LimitBanner", () => {
  it("renders nothing when loading", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    const { container } = render(<LimitBanner />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when all features are ok", async () => {
    mockFetchEntitlements({
      "agents.create": { enabled: true, used: 2, limit: 10, status: "ok" },
      "calls.make": { enabled: true, used: 5, limit: 100, status: "ok" },
    });
    const { container } = render(<LimitBanner />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("shows yellow warning banner when status is warning", async () => {
    mockFetchEntitlements({
      "calls.minutes": { enabled: true, used: 85, limit: 100, status: "warning" },
    });
    render(<LimitBanner />);
    await waitFor(() => {
      expect(screen.getByText(/You have used 85 of 100 call minutes/)).toBeDefined();
    });
    const banner = screen.getByText(/You have used 85 of 100 call minutes/);
    expect(banner.className).toContain("yellow");
  });

  it("shows red blocked banner when status is blocked", async () => {
    mockFetchEntitlements({
      "agents.create": { enabled: false, used: 5, limit: 5, status: "blocked" },
    });
    render(<LimitBanner />);
    await waitFor(() => {
      expect(screen.getByText(/You have used 5 of 5 agents/)).toBeDefined();
    });
    const banner = screen.getByText(/You have used 5 of 5 agents/);
    expect(banner.className).toContain("red");
    expect(banner.textContent).toContain("Contact support");
  });

  it("renders nothing on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const { container } = render(<LimitBanner />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("renders nothing when fetch returns not-ok", async () => {
    mockFetchEntitlements(null, false);
    const { container } = render(<LimitBanner />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });

  it("shows multiple banners when multiple features are affected", async () => {
    mockFetchEntitlements({
      "agents.create": { enabled: false, used: 5, limit: 5, status: "blocked" },
      "calls.minutes": { enabled: true, used: 90, limit: 100, status: "warning" },
      "calls.make": { enabled: true, used: 10, limit: 100, status: "ok" },
    });
    render(<LimitBanner />);
    await waitFor(() => {
      expect(screen.getByText(/You have used 5 of 5 agents/)).toBeDefined();
      expect(screen.getByText(/You have used 90 of 100 call minutes/)).toBeDefined();
    });
  });

  it("does not show banner for features with null limit", async () => {
    mockFetchEntitlements({
      "agents.create": { enabled: true, used: 5, limit: null, status: "blocked" },
    });
    const { container } = render(<LimitBanner />);
    await waitFor(() => {
      expect(container.innerHTML).toBe("");
    });
  });
});
