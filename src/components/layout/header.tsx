"use client";

import Link from "next/link";
import { useLocation } from "@/providers/location-provider";
import { Menu, X, Bot, Plus } from "lucide-react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Header() {
  const { locationId } = useLocation();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const breadcrumbs = getBreadcrumbs(pathname, locationId);

  return (
    <>
      <header className="h-16 border-b border-border bg-surface flex items-center px-4 lg:px-6 gap-4 shrink-0">
        <button
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-surface-hover transition-colors"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu className="w-5 h-5 text-text-secondary" />
        </button>

        <nav className="flex items-center gap-2 text-sm min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0">
              {i > 0 && (
                <span className="text-text-muted">/</span>
              )}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="text-text-secondary hover:text-text-primary transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-text-primary font-medium truncate">
                  {crumb.label}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-secondary text-xs font-mono text-text-muted border border-border">
            {locationId.slice(0, 12)}
            {locationId.length > 12 && "..."}
          </span>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[280px] bg-surface-secondary border-r border-border flex flex-col">
            <div className="flex items-center justify-between px-4 h-16 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  Retell AI
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-surface-hover"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              <Link
                href={`/retell/${locationId}/dashboard`}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  pathname.includes("/dashboard")
                    ? "bg-primary-light text-primary"
                    : "text-text-secondary hover:bg-surface-hover"
                )}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                Dashboard
              </Link>
              <Link
                href={`/retell/${locationId}/agents/new`}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-hover transition-colors mt-4"
              >
                <Plus className="w-5 h-5" />
                New Agent
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

function getBreadcrumbs(pathname: string, locationId: string) {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Dashboard", href: `/retell/${locationId}/dashboard` },
  ];

  if (pathname.includes("/agents/new")) {
    crumbs.push({ label: "New Agent" });
  } else if (pathname.match(/\/agents\/[^/]+\/edit/)) {
    crumbs.push({ label: "Agents", href: `/retell/${locationId}/dashboard` });
    crumbs.push({ label: "Edit Agent" });
  } else if (pathname.match(/\/agents\/[^/]+$/)) {
    crumbs.push({ label: "Agent Details" });
  }

  return crumbs;
}
