"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const links = [
  { href: "/admin", label: "Tenants", exact: true },
  { href: "/admin/audit-log", label: "Audit Log", exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-4">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`text-sm font-medium transition-colors ${
              active ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
