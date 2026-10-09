"use client";

import { useRouter } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import { CreateAgentModal } from "@/components/agents/create-agent-modal";

// Links to /agents/new (sidebar, overview, header) open the same Create Agent
// modal. Closing it returns to the agents list.
export default function NewAgentPage() {
  const { locationId } = useLocation();
  const router = useRouter();

  return (
    <CreateAgentModal
      locationId={locationId}
      onClose={() => router.push(`/retell/${locationId}/agents`)}
    />
  );
}
