import { LocationProvider } from "@/providers/location-provider";
import { BrandingEffect } from "@/providers/branding-effect";
import { ToastProvider } from "@/components/layout/toast";
import { TopNavbar } from "@/components/layout/top-navbar";
import { TenantGate } from "@/components/auth/tenant-gate";
import { LimitBanner } from "@/components/usage/limit-banner";

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  return (
    <TenantGate locationId={locationId}>
      <LocationProvider locationId={locationId}>
        <ToastProvider>
          <BrandingEffect locationId={locationId} />
          <div className="h-full flex flex-col">
            <TopNavbar />
            <main className="flex-1 overflow-auto">
              <div className="px-4 lg:px-6 pt-4">
                <LimitBanner />
              </div>
              {children}
            </main>
          </div>
        </ToastProvider>
      </LocationProvider>
    </TenantGate>
  );
}
