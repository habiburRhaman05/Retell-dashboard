"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocation } from "@/providers/location-provider";
import {
  LayoutDashboard,
  Plus,
  Bot,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: (loc: string) => `/retell/${loc}/dashboard`,
  },
];

export function Sidebar() {
  const { locationId } = useLocation();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-surface-secondary transition-all duration-200",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-text-primary truncate">
              Retell AI
            </h1>
            <p className="text-xs text-text-muted truncate">Voice Dashboard</p>
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const href = item.href(locationId);
          const isActive = pathname.startsWith(href);
          return (
            <Link
              key={item.label}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-light text-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        <div className="pt-4">
          <Link
            href={`/retell/${locationId}/agents/new`}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
              "bg-primary text-white hover:bg-primary-hover transition-colors",
              collapsed && "justify-center"
            )}
          >
            <Plus className="w-5 h-5 shrink-0" />
            {!collapsed && <span>New Agent</span>}
          </Link>
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-surface-hover transition-colors w-full"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
