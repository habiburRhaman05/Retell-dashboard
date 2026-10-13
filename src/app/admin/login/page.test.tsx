import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminLoginPage from "./page";

const push = vi.fn();
let searchParamsValue = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => searchParamsValue,
}));

beforeEach(() => {
  vi.clearAllMocks();
  searchParamsValue = new URLSearchParams();
  global.fetch = vi.fn();
});

describe("AdminLoginPage", () => {
  it("renders the login form", () => {
    render(<AdminLoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByText("Sign in")).toBeInTheDocument();
  });

  it("shows no banner when there is no error param", () => {
    render(<AdminLoginPage />);
    expect(screen.queryByText(/sign-in link is invalid/)).not.toBeInTheDocument();
  });

  it("shows an invalid-link banner when redirected with ?error=invalid_link", () => {
    searchParamsValue = new URLSearchParams("error=invalid_link");
    render(<AdminLoginPage />);
    expect(screen.getByText(/sign-in link is invalid or has expired/)).toBeInTheDocument();
  });

  it("shows a credential error on failed login", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Invalid credentials" }),
    });

    render(<AdminLoginPage />);
    await user.type(screen.getByLabelText("Email"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("navigates to /admin on successful login", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });

    render(<AdminLoginPage />);
    await user.type(screen.getByLabelText("Email"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByText("Sign in"));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin"));
  });

  it("shows a connection error on network failure", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockRejectedValue(new Error("down"));

    render(<AdminLoginPage />);
    await user.type(screen.getByLabelText("Email"), "admin@test.com");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByText("Sign in"));

    await waitFor(() => {
      expect(screen.getByText("Unable to connect. Please try again.")).toBeInTheDocument();
    });
  });
});
