// ABOUTME: Alert component for displaying status messages with variants (default, destructive).
// ABOUTME: Includes AlertDescription subcomponent for message content.

import { HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive";
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={clsx(
          "relative w-full rounded-lg border p-4",
          {
            "border-neutral-700 bg-neutral-900 text-neutral-200":
              variant === "default",
            "border-red-800 bg-red-950 text-red-200": variant === "destructive",
          },
          className,
        )}
        {...props}
      />
    );
  },
);

Alert.displayName = "Alert";

export const AlertDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={clsx("text-sm leading-relaxed", className)}
      {...props}
    />
  );
});

AlertDescription.displayName = "AlertDescription";
