"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertCircle,
  Bot,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useLocation } from "@/providers/location-provider";
import { useToast } from "@/components/layout/toast";
import { useAgents } from "@/hooks/use-agents";
import { useKnowledgeBases } from "@/hooks/use-knowledge-bases";
import { useRetellStatus } from "@/hooks/use-retell-status";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function SectionCard({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
        <div>
          <h2 className="text-[14px] font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-[12px] text-gray-500 mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function AccountSettingsPage() {
  const { locationId } = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const status = useRetellStatus();
  const agents = useAgents(locationId);
  const kbs = useKnowledgeBases(locationId);

  const voiceCount = agents.data?.filter((a) => a.channel !== "chat").length;
  const textCount = agents.data?.filter((a) => a.channel === "chat").length;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(locationId);
      setCopied(true);
      toast("Account ID copied", "info");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast("Could not copy. Select the ID and copy it manually.", "error");
    }
  };

  const checking = status.isLoading || status.isFetching;

  const stats = [
    {
      label: "Voice agents",
      value: voiceCount,
      icon: Bot,
      href: `/retell/${locationId}/agents`,
      loading: agents.isLoading,
      error: !!agents.error,
    },
    {
      label: "Text agents",
      value: textCount,
      icon: MessageSquare,
      href: `/retell/${locationId}/agents`,
      loading: agents.isLoading,
      error: !!agents.error,
    },
    {
      label: "Knowledge bases",
      value: kbs.data?.length,
      icon: BookOpen,
      href: `/retell/${locationId}/knowledge-base`,
      loading: kbs.isLoading,
      error: !!kbs.error,
    },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-8 animate-fade-in space-y-5">
      <PageHeader
        title="Account settings"
        description="Your workspace details and the connection to Retell"
      />

      <SectionCard
        title="Account"
        description="This ID links your agents and knowledge bases to this workspace."
      >
        <p className="text-[12px] font-medium text-gray-700 mb-1.5">Account ID</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-700 font-mono select-all">
            {locationId}
          </code>
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={copyId}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Retell connection"
        description="The app talks to Retell with the API key configured on the server."
        actions={
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={checking}
            disabled={checking}
            onClick={() => status.refetch()}
          >
            Test connection
          </Button>
        }
      >
        {checking && !status.data ? (
          <p className="flex items-center gap-2 text-[13px] text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-brand-500" />
            Checking the connection...
          </p>
        ) : status.error ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-red-700">Could not run the check</p>
              <p className="text-[12px] text-red-600 mt-0.5">
                {status.error instanceof Error ? status.error.message : "Please try again"}
              </p>
            </div>
          </div>
        ) : status.data?.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[13px] font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
              Connected to Retell
            </span>
            {status.data.latencyMs !== undefined && (
              <Badge variant="neutral">{status.data.latencyMs} ms</Badge>
            )}
            <a
              href="https://dashboard.retellai.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-brand-600 hover:underline"
            >
              Open Retell dashboard
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-medium text-red-700">Not connected to Retell</p>
              <p className="text-[12px] text-red-600 mt-0.5">
                {status.data?.error ?? "The connection check failed."}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Workspace" description="What is linked to this account right now.">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.label}
                href={s.href}
                className="rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <span className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </span>
                <p className="text-2xl font-semibold text-gray-900 leading-none">
                  {s.loading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                  ) : s.error ? (
                    "-"
                  ) : (
                    s.value ?? 0
                  )}
                </p>
                <p className="text-[12px] text-gray-500 mt-1.5">{s.label}</p>
              </Link>
            );
          })}
        </div>
        {(agents.error || kbs.error) && (
          <p className="text-[12px] text-red-600 mt-3">
            Some counts could not be loaded. They will show again once Retell is reachable.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
