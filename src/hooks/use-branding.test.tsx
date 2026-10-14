import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useBranding,
  readBrandingCache,
  BRANDING_CACHE_TTL_MS,
  type BrandingResponse,
} from "./use-branding";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function Harness({ locationId }: { locationId: string }) {
  const { data, isLoading } = useBranding(locationId);
  return (
    <div>
      <span>loading: {String(isLoading)}</span>
      <span>primary: {data?.brandPrimaryColor ?? "none"}</span>
    </div>
  );
}

function renderWithClient(locationId: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Harness locationId={locationId} />
    </QueryClientProvider>
  );
}

function setCssVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

beforeEach(() => {
  fetchMock.mockReset();
  window.localStorage.clear();
  [
    "--color-brand-50", "--color-brand-100", "--color-brand-200", "--color-brand-300",
    "--color-brand-400", "--color-brand-500", "--color-brand-600", "--color-brand-700",
    "--color-brand-800", "--color-brand-900",
  ].forEach((v) => document.documentElement.style.removeProperty(v));
});

describe("useBranding", () => {
  it("fetches and applies colors when there is no cache", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async (): Promise<BrandingResponse> => ({
        brandPrimaryColor: "#1d6bf3",
        brandSecondaryColor: "#1558d6",
      }),
    });

    const { getByText } = renderWithClient("loc_1");

    await waitFor(() => expect(getByText("primary: #1d6bf3")).toBeInTheDocument());
    expect(setCssVar("--color-brand-500")).toBe("#1d6bf3");
    expect(setCssVar("--color-brand-600")).toBe("#1558d6");
    expect(fetchMock).toHaveBeenCalledWith("/api/tenant/branding");
  });

  it("caches the result in localStorage, scoped to the sub-account", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async (): Promise<BrandingResponse> => ({
        brandPrimaryColor: "#3a7a3a",
        brandSecondaryColor: null,
      }),
    });

    renderWithClient("loc_2");
    await waitFor(() => expect(readBrandingCache("loc_2")).not.toBeNull());
    expect(readBrandingCache("loc_2")?.brandPrimaryColor).toBe("#3a7a3a");
    expect(readBrandingCache("loc_other")).toBeNull();
  });

  it("serves from cache without calling fetch when still fresh", async () => {
    window.localStorage.setItem(
      "branding:loc_3",
      JSON.stringify({
        data: { brandPrimaryColor: "#8B1A1A", brandSecondaryColor: null },
        fetchedAt: Date.now(),
      })
    );

    const { getByText } = renderWithClient("loc_3");

    await waitFor(() => expect(getByText("primary: #8B1A1A")).toBeInTheDocument());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores an expired cache entry and refetches", async () => {
    window.localStorage.setItem(
      "branding:loc_4",
      JSON.stringify({
        data: { brandPrimaryColor: "#old", brandSecondaryColor: null },
        fetchedAt: Date.now() - BRANDING_CACHE_TTL_MS - 1000,
      })
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async (): Promise<BrandingResponse> => ({
        brandPrimaryColor: "#1d6bf3",
        brandSecondaryColor: null,
      }),
    });

    const { getByText } = renderWithClient("loc_4");

    await waitFor(() => expect(getByText("primary: #1d6bf3")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalled();
  });

  it("clears overrides back to the default scale when the tenant has no custom branding", async () => {
    document.documentElement.style.setProperty("--color-brand-500", "#aabbcc");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async (): Promise<BrandingResponse> => ({
        brandPrimaryColor: null,
        brandSecondaryColor: null,
      }),
    });

    const { getByText } = renderWithClient("loc_5");

    await waitFor(() => expect(getByText("primary: none")).toBeInTheDocument());
    await waitFor(() => expect(setCssVar("--color-brand-500")).toBe(""));
  });
});
