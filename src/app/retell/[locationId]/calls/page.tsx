"use client";

import { PageHeader } from "@/components/ui/page-header";
import { CallHistory } from "@/components/calls/call-history";

export default function CallsPage() {
  return (
    <div className="max-w-none mx-auto px-4 lg:px-6 py-8 animate-fade-in space-y-6">
      <PageHeader
        title="Call History"
        description="Every call your agents have taken, with transcripts, recordings and AI analysis"
      />
      <CallHistory />
    </div>
  );
}
