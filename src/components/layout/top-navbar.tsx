"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import {
  Menu,
  X,
  LayoutDashboard,
  Bot,
  BookOpen,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: (loc: string) => string;
  match?: string;
  exactMatch?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_LINKS: NavLink[] = [
  {
    label: "Overview",
    href: (loc) => `/retell/${loc}/dashboard`,
    match: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Voice Agents",
    href: (loc) => `/retell/${loc}/agents`,
    exactMatch: true,
    icon: Bot,
  },
  {
    label: "Knowledge Base",
    href: (loc) => `/retell/${loc}/knowledge-base`,
    exactMatch: true,
    icon: BookOpen,
  },
  {
    label: "Analytics",
    href: (loc) => `/retell/${loc}/analytics`,
    exactMatch: true,
    icon: BarChart3,
  },
];

export function TopNavbar() {
  const { locationId } = useLocation();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200/80 shrink-0 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6">
          <div className="flex items-center h-14">
            <Link
              href={`/retell/${locationId}/dashboard`}
              className="flex items-center gap-2.5 mr-8 shrink-0"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm shadow-brand-500/20">
                <Bot className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="text-[15px] font-bold text-gray-900 hidden sm:inline tracking-tight">
                Bright AI
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 flex-1">
              {NAV_LINKS.map((link) => {
                const href = link.href(locationId);
                const isActive = link.exactMatch
                  ? pathname === href || pathname.startsWith(href + "/")
                  : pathname.includes(link.match!);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.label}
                    href={href}
                    className={cn(
                      "relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2",
                      isActive
                        ? "text-brand-600 bg-brand-50/60"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isActive ? "text-brand-500" : "text-gray-400")} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-gray-500">Connected</span>
              </div>
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-2xl flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-5 h-14 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold text-gray-900">Bright AI</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {NAV_LINKS.map((link) => {
                const href = link.href(locationId);
                const isActive = link.exactMatch
                  ? pathname === href || pathname.startsWith(href + "/")
                  : pathname.includes(link.match!);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
                      isActive
                        ? "text-brand-600 bg-brand-50/60"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("w-4.5 h-4.5", isActive ? "text-brand-500" : "text-gray-400")} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
