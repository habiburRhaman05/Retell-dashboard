"use client";

import Link from "next/link";
import { Bot, Plus, Download } from "lucide-react";

export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
        <Bot className="w-7 h-7 text-gray-400" />
      </div>
      <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">
        {title}
      </h3>
      <p className="text-[13px] text-gray-500 text-center max-w-sm mb-5">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-[13px] font-medium hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionHref && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-[13px] font-medium hover:bg-brand-600 transition-colors shadow-sm shadow-brand-500/20"
        >
          <Download className="w-3.5 h-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
