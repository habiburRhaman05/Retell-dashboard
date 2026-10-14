"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Library, ScrollText, Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
  exact?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_LINKS: NavLink[] = [
  { label: "Sub-Accounts", href: "/admin", exact: true, icon: Users },
  { label: "Library", href: "/admin/library", icon: Library },
  { label: "Audit Log", href: "/admin/audit-log", icon: ScrollText },
];

// Mirrors the sub-account dashboard's TopNavbar (same pill-style links,
// sticky full-width header, mobile slide-over) so the admin panel and the
// tenant dashboard feel like the same product.
export function AdminNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (link: NavLink) =>
    link.exact ? pathname === link.href : pathname.startsWith(link.href);

  return (
    <>
      <header className="bg-white border-b border-gray-200/80 shrink-0 sticky top-0 z-30">
        <div className="max-w-none mx-auto px-4 lg:px-6">
          <div className="flex items-center h-14">
            <nav className="hidden md:flex items-center gap-1 flex-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "relative px-3.5 py-2 text-[13px] font-medium rounded-lg transition-all duration-150 flex items-center gap-2",
                      active
                        ? "text-white bg-brand-500 shadow-sm shadow-brand-500/25"
                        : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", active ? "text-white" : "text-gray-400")} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-3">
              <button
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileOpen(true)}
                aria-label="Open menu"
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
              <span className="text-sm font-semibold text-gray-900">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {NAV_LINKS.map((link) => {
                const active = isActive(link);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150",
                      active ? "text-white bg-brand-500" : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("w-4.5 h-4.5", active ? "text-white" : "text-gray-400")} />
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
