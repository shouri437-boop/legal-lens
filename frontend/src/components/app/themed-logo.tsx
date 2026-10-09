// ABOUTME: Legal Lens logo mark: a magnifying glass drawn in the current text color.

import { clsx } from "clsx";

interface ThemedLogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
  priority?: boolean;
}

export function ThemedLogo({
  width = 32,
  height = 32,
  className = "",
  alt = "Legal Lens",
}: ThemedLogoProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      role="img"
      aria-label={alt}
      className={clsx(className)}
    >
      <circle cx="14" cy="14" r="8" />
      <path d="M20 20l7 7" />
      <path d="M10.5 14.5l2.5 2.5 4.5-5" />
    </svg>
  );
}
