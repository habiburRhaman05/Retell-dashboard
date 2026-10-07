"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <textarea
          ref={ref}
          className={cn(
            "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900",
            "placeholder:text-gray-400 resize-none leading-relaxed",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400",
            "hover:border-gray-300",
            "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
            error
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-400"
              : "border-gray-200",
            className
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
