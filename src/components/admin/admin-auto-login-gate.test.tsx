import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { AdminAutoLoginGate } from "./admin-auto-login-gate";

const replace = vi.fn();
let companyId: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: (key: string) => (key === "companyId" ? companyId : null) }),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  replace.mockClear();
  fetchMock.mockReset();
  companyId = null;
});

describe("AdminAutoLoginGate", () => {
  it("redirects straight to login when there is no companyId", async () => {
    companyId = null;
    render(<AdminAutoLoginGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a spinner while exchanging a companyId", () => {
    companyId = "tok_abc";
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves during this assertion
    const { getByRole } = render(<AdminAutoLoginGate />);
    expect(getByRole("status")).toBeInTheDocument();
  });

  it("exchanges the companyId and lands back on /admin without it on success", async () => {
    companyId = "tok_abc";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, role: "owner" }) });
    render(<AdminAutoLoginGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/admin/company",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ companyId: "tok_abc" }),
      })
    );
  });

  it("sends the visitor to login with an error when the companyId is invalid", async () => {
    companyId = "bad";
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Invalid or unknown link" }) });
    render(<AdminAutoLoginGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?error=invalid_link"));
  });

  it("sends the visitor to login with an error on a network failure", async () => {
    companyId = "tok_abc";
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<AdminAutoLoginGate />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/login?error=invalid_link"));
  });
});
