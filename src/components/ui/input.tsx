"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ComponentType<{ className?: string }>;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon: Icon, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          )}
          <input
            ref={ref}
            className={cn(
              "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900",
              "placeholder:text-gray-400",
              "transition-all duration-150",
              "focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400",
              "hover:border-gray-300",
              "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
              error
                ? "border-red-300 focus:ring-red-500/20 focus:border-red-400"
                : "border-gray-200",
              Icon && "pl-10",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export function SearchInput({
  className,
  ...props
}: Omit<InputProps, "icon">) {
  return <Input icon={Search} className={cn("bg-gray-50/80", className)} {...props} />;
}
