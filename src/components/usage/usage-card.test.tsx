import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UsageCard } from "./usage-card";

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("UsageCard", () => {
  it("shows loading state initially", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<UsageCard />);
    expect(screen.getByText("Loading usage...")).toBeInTheDocument();
  });

  it("shows usage data after loading", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: { totalCalls: 42, totalMinutes: 120 },
      }),
    });

    render(<UsageCard />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Usage This Month")).toBeInTheDocument();
  });

  it("shows error state on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network"));

    render(<UsageCard />);
    await waitFor(() => {
      expect(screen.getByText("Unable to load usage data")).toBeInTheDocument();
    });
  });

  it("shows error on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    });

    render(<UsageCard />);
    await waitFor(() => {
      expect(screen.getByText("Unable to load usage data")).toBeInTheDocument();
    });
  });

  it("shows zero state correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: { totalCalls: 0, totalMinutes: 0 },
      }),
    });

    render(<UsageCard />);
    await waitFor(() => {
      expect(screen.getAllByText("0")).toHaveLength(2);
    });
  });
});
