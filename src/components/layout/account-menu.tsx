"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation } from "@/providers/location-provider";
import { useToast } from "@/components/layout/toast";
import { useRetellStatus } from "@/hooks/use-retell-status";

export function AccountMenu() {
  const { locationId } = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: status } = useRetellStatus(open);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const initial = (locationId || "A").charAt(0).toUpperCase();
  const itemClass =
    "w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-gray-700 hover:bg-gray-50 transition-colors text-left";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={cn(
          "w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white text-sm font-semibold flex items-center justify-center shadow-sm transition-all hover:shadow-md",
          open && "ring-2 ring-brand-500/30"
        )}
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden animate-fade-in"
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white font-semibold flex items-center justify-center shrink-0">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">Your account</p>
                <p className="text-[11px] text-gray-500 font-mono truncate" title={locationId}>
                  {locationId}
                </p>
              </div>
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  !status ? "bg-gray-300 animate-pulse" : status.connected ? "bg-emerald-500" : "bg-red-500"
                )}
              />
              {!status
                ? "Checking Retell connection..."
                : status.connected
                ? "Retell connected"
                : "Retell not connected"}
            </div>
          </div>

          <div className="py-1">
            <Link
              href={`/retell/${locationId}/settings`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={itemClass}
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Account settings
            </Link>
            <button role="menuitem" onClick={copyId} className={itemClass}>
              {copied ? (
                <Check className="w-4 h-4 text-emerald-500" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
              Copy account ID
            </button>
            <a
              href="https://dashboard.retellai.com"
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={itemClass}
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
              Open Retell dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
