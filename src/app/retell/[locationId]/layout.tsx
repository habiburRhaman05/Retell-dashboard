import { LocationProvider } from "@/providers/location-provider";
import { ToastProvider } from "@/components/layout/toast";
import { TopNavbar } from "@/components/layout/top-navbar";

export default async function LocationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  return (
    <LocationProvider locationId={locationId}>
      <ToastProvider>
        <div className="h-full flex flex-col">
          <TopNavbar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </ToastProvider>
    </LocationProvider>
  );
}
