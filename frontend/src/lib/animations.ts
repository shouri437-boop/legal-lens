// ABOUTME: Shared animation variants and utilities for the Legal Lens landing page.
// ABOUTME: Provides consistent motion language across all animated components.

import type { Variants } from "motion/react";

/**
 * Standard reveal animation - element fades in while sliding up.
 * Use for section reveals and content appearing on scroll.
 */
export const fadeInUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: "easeOut",
    },
  },
};

/**
 * Simple fade without movement.
 * Use for overlays, backgrounds, or subtle transitions.
 */
export const fadeIn: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

/**
 * Parent variant for staggered children animations.
 * Apply to container element with children using itemVariants.
 */
export const staggerContainer: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

/**
 * Hover interaction for cards and interactive elements.
 * Use with whileHover prop on motion components.
 */
export const scaleOnHover = {
  scale: 1.02,
  transition: {
    duration: 0.2,
  },
};

/**
 * Slide in from left - for alternating layout sections.
 * Use for left-aligned content in two-column layouts.
 */
export const slideInFromLeft: Variants = {
  hidden: {
    opacity: 0,
    x: -30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

/**
 * Slide in from right - counterpart to slideInFromLeft.
 * Use for right-aligned content in two-column layouts.
 */
export const slideInFromRight: Variants = {
  hidden: {
    opacity: 0,
    x: 30,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};
