import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 shadow-sm shadow-brand-500/20 disabled:bg-brand-300",
  secondary:
    "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 disabled:text-gray-400",
  ghost:
    "text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:text-gray-400",
  danger:
    "text-red-600 hover:bg-red-50 disabled:text-red-300",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2.5 text-[13px] gap-1.5",
  lg: "px-5 py-3 text-sm gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading,
      icon: Icon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-70",
          "active:scale-[0.98]",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : Icon ? (
          <Icon className="w-3.5 h-3.5" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
