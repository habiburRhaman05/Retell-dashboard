import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterTenantPage from "./page";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("RegisterTenantPage", () => {
  it("renders form with all fields", () => {
    render(<RegisterTenantPage />);
    expect(screen.getByText("Register New Sub-Account")).toBeInTheDocument();
    expect(screen.getByLabelText(/Sub-Account Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    expect(screen.getByLabelText(/CRM Location ID/)).toBeInTheDocument();
    expect(screen.getByText("Register Sub-Account")).toBeInTheDocument();
  });

  it("shows agent name preview with typed name", async () => {
    const user = userEvent.setup();
    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Acme");
    expect(screen.getByText(/Agent - Acme/)).toBeInTheDocument();
  });

  it("submits form and shows success state", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "t1", name: "Acme Corp" }),
    });

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Acme Corp");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_1");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("Sub-Account Registered")).toBeInTheDocument();
    });
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("View Sub-Account")).toBeInTheDocument();
    expect(screen.getByText("Register Another")).toBeInTheDocument();
  });

  it("shows error message on failure", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Registration failed" }),
    });

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Bad");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_2");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("Registration failed")).toBeInTheDocument();
    });
  });

  it("shows field-level validation errors", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: "Validation failed",
        details: { name: ["Name is required"] },
      }),
    });

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "x");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_3");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
  });

  it("shows connection error on network failure", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValue(new Error("Network"));

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Test");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_4");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("Unable to connect. Please try again.")).toBeInTheDocument();
    });
  });

  it("navigates to the sub-account on View Sub-Account click", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "t1", name: "Acme" }),
    });

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Acme");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_5");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("View Sub-Account")).toBeInTheDocument();
    });
    await user.click(screen.getByText("View Sub-Account"));
    expect(mockPush).toHaveBeenCalledWith("/admin/tenants/t1");
  });

  it("resets form on Register Another click", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "t2", name: "Beta" }),
    });

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Beta");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_6");
    await user.click(screen.getByText("Register Sub-Account"));

    await waitFor(() => {
      expect(screen.getByText("Register Another")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Register Another"));
    expect(screen.getByText("Register New Sub-Account")).toBeInTheDocument();
    expect(screen.getByLabelText(/Sub-Account Name/)).toHaveValue("");
  });

  it("shows loading state during submission", async () => {
    const user = userEvent.setup();
    let resolvePromise!: (value: unknown) => void;
    global.fetch = vi.fn().mockReturnValue(
      new Promise((resolve) => { resolvePromise = resolve; })
    );

    render(<RegisterTenantPage />);
    await user.type(screen.getByLabelText(/Sub-Account Name/), "Test");
    await user.type(screen.getByLabelText(/CRM Location ID/), "loc_7");
    await user.click(screen.getByText("Register Sub-Account"));

    expect(screen.getByText("Registering...")).toBeInTheDocument();
    resolvePromise({ ok: true, json: async () => ({ id: "t3", name: "Test" }) });
  });
});
