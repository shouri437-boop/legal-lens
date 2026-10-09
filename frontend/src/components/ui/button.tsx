// ABOUTME: Simple button component with variants (default, outline, destructive).
// ABOUTME: Supports size variants (sm, default, lg) and disabled state.

import { forwardRef, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "destructive";
  size?: "sm" | "default" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          {
            // Variants
            "bg-primary-600 text-white hover:bg-primary-700":
              variant === "default",
            "border border-neutral-700 bg-transparent text-neutral-200 hover:bg-neutral-800":
              variant === "outline",
            "bg-red-600 text-white hover:bg-red-700": variant === "destructive",
            // Sizes
            "h-8 px-3 text-xs": size === "sm",
            "h-10 px-4 text-sm": size === "default",
            "h-12 px-6 text-base": size === "lg",
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
