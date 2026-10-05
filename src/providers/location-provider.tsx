"use client";

import { createContext, useContext } from "react";

interface LocationContextValue {
  locationId: string;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({
  locationId,
  children,
}: {
  locationId: string;
  children: React.ReactNode;
}) {
  return (
    <LocationContext.Provider value={{ locationId }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx)
    throw new Error("useLocation must be used within a LocationProvider");
  return ctx;
}
