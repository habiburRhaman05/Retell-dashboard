"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: (loc: string) => string;
  match?: string;
  exactMatch?: boolean;
}

const NAV_LINKS: NavLink[] = [
  {
    label: "Overview",
    href: (loc) => `/retell/${loc}/dashboard`,
    match: "/dashboard",
  },
  {
    label: "Voice Agents",
    href: (loc) => `/retell/${loc}/agents`,
    exactMatch: true,
  },
  {
    label: "Knowledge Base",
    href: (loc) => `/retell/${loc}/knowledge-base`,
    exactMatch: true,
  },
];

export function TopNavbar() {
  const { locationId } = useLocation();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
          <div className="flex items-center h-[60px]">
            <nav className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map((link) => {
                const href = link.href(locationId);
                const isActive = link.exactMatch
                  ? pathname === href || pathname.startsWith(href + "/")
                  : pathname.includes(link.match!);
                return (
                  <Link
                    key={link.label}
                    href={href}
                    className={cn(
                      "px-4 py-2 text-[13px] font-medium rounded-md transition-colors",
                      isActive
                        ? "text-cyan-600"
                        : "text-gray-500 hover:text-gray-900"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
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
          <div className="absolute top-0 right-0 w-[280px] h-full bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-[60px] border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-900">Menu</span>
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
                return (
                  <Link
                    key={link.label}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive
                        ? "text-cyan-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
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
