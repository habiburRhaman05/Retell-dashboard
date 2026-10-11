"use client";

import { useEffect, useRef } from "react";
import { useLocation } from "@/providers/location-provider";
import { useLocationName, useSaveLocationName } from "@/hooks/use-location-name";

/**
 * Picks up the account name from the page link, for example
 * `/retell/{{location.id}}/agents?locationName={{location.name}}`, and keeps it
 * saved. Renders nothing.
 */
export function LocationNameSync() {
  const { locationId } = useLocation();
  const { data: saved, isSuccess } = useLocationName(locationId);
  const save = useSaveLocationName(locationId);
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (!isSuccess) return;
    const params = new URLSearchParams(window.location.search);
    const fromLink = (params.get("locationName") ?? params.get("location_name") ?? "").trim();
    if (!fromLink || fromLink === saved || attempted.current === fromLink) return;
    attempted.current = fromLink;
    save.mutate(fromLink);
  }, [isSuccess, saved, save]);

  return null;
}
