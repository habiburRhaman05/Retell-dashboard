import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LocationLayout from "./layout";

vi.mock("@/components/auth/tenant-gate", () => ({
  TenantGate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/providers/location-provider", () => ({
  LocationProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/toast", () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/layout/top-navbar", () => ({
  TopNavbar: () => <nav>top-navbar</nav>,
}));
vi.mock("@/components/usage/limit-banner", () => ({
  LimitBanner: () => <div>limit-banner</div>,
}));

const brandingEffectProps = vi.fn();
vi.mock("@/providers/branding-effect", () => ({
  BrandingEffect: (props: { locationId: string }) => {
    brandingEffectProps(props);
    return null;
  },
}));

describe("LocationLayout", () => {
  it("mounts BrandingEffect with the current locationId and renders children", async () => {
    const ui = await LocationLayout({
      children: <div>Page content</div>,
      params: Promise.resolve({ locationId: "loc_123" }),
    });
    render(ui);

    expect(brandingEffectProps).toHaveBeenCalledWith({ locationId: "loc_123" });
    expect(screen.getByText("Page content")).toBeInTheDocument();
    expect(screen.getByText("top-navbar")).toBeInTheDocument();
  });
});
