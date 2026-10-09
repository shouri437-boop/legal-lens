// ABOUTME: GlassCard component with layered Liquid Glass effect.
// ABOUTME: Supports card, modal, nav, and subtle variants with hover animations.

"use client";

import { type ReactNode } from "react";
import { motion } from "motion/react";
import { scaleOnHover } from "@/lib/animations";

type GlassVariant = "card" | "modal" | "nav" | "subtle";

interface GlassCardProps {
  children: ReactNode;
  /** Classes for outer container (dimensions, positioning) */
  className?: string;
  /** Classes for content wrapper (padding, text alignment) */
  contentClassName?: string;
  /** Glass variant: card (default), modal, nav, or subtle */
  variant?: GlassVariant;
  /** Enable hover scale effect. Defaults to true for card/modal. */
  hover?: boolean;
  /** Enable will-change for animated panels */
  animated?: boolean;
}

/**
 * A card component with layered Liquid Glass effect.
 *
 * Uses Apple-inspired layered glass structure:
 * - Filter layer: backdrop blur with saturation
 * - Overlay layer: gradient tint
 * - Specular layer: edge highlights
 * - Content layer: children
 *
 * @example
 * ```tsx
 * <GlassCard variant="card">
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </GlassCard>
 * ```
 */
export function GlassCard({
  children,
  className = "",
  contentClassName = "p-6",
  variant = "card",
  hover = true,
  animated = false,
}: GlassCardProps) {
  const baseClass = `liquid-glass-${variant}`;
  const animatedClass = animated ? "liquid-glass-animated" : "";

  // Subtle variant doesn't use layered structure
  if (variant === "subtle") {
    return (
      <motion.div
        className={`${baseClass} ${contentClassName} ${className}`}
        whileHover={hover ? scaleOnHover : undefined}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`${baseClass} ${animatedClass} ${className}`}
      whileHover={hover ? scaleOnHover : undefined}
    >
      <div className="liquid-glass-filter" />
      <div className="liquid-glass-overlay" />
      <div className="liquid-glass-specular" />
      <div className={`liquid-glass-content ${contentClassName}`}>
        {children}
      </div>
    </motion.div>
  );
}
