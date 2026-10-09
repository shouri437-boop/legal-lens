# Legal Lens Design System

A quick-reference guide to Legal Lens' design tokens, component patterns, and styling conventions.

---

## Quick Reference: Colors

### Dark Mode (Default)

| Token | Hex | Tailwind | Purpose |
|-------|-----|----------|---------|
| `--color-charcoal` | `#050505` | `bg-charcoal` | Primary background |
| `--color-jet` | `#111111` | `bg-jet` | Secondary/card background |
| `--color-smoke` | `#f8f7f4` | `text-smoke` | Primary text |
| `--color-stone` | `#8a8a82` | `text-stone` | Muted text |
| `--color-accent` | `#f5f4ef` | `text-accent` | Emphasis/links |
| `--color-accent-muted` | `#d4d3ce` | `text-accent-muted` | Secondary emphasis |

### Light Mode (Application UI)

| Token | Hex | Purpose |
|-------|-----|---------|
| `--color-light-bg` | `#faf9f7` | Primary background (warm off-white) |
| `--color-light-bg-subtle` | `#f5f4f1` | Cards/secondary backgrounds |
| `--color-light-text` | `#1a1918` | Primary text (warm near-black) |
| `--color-light-text-muted` | `#6b6a66` | Secondary/muted text |
| `--color-light-border` | `#e8e7e3` | Borders/dividers |
| `--color-light-accent` | `#2a2825` | Primary accent (buttons/links) |
| `--color-light-accent-hover` | `#3d3a36` | Hover state |

**Usage:** Add `.light` class to `<html>` or a container to switch themes.

---

## Quick Reference: Typography

| Purpose | Font | CSS Variable | Usage |
|---------|------|--------------|-------|
| Headlines (Landing ONLY) | Playfair Display | `--font-family-serif` | `font-serif` |
| Body / App UI | DM Sans | `--font-family-sans` | `font-sans` |

### Letter Spacing

| Token | Value | Class |
|-------|-------|-------|
| `--tracking-body` | `0.025em` | `.tracking-body` |
| `--tracking-tight` | `-0.01em` | `tracking-tight` |
| `--tracking-wide` | `0.05em` | `.tracking-wide` |

---

## Source Files

| Purpose | Path |
|---------|------|
| Design tokens | `frontend/src/app/globals.css` |
| Animation variants | `frontend/src/lib/animations.ts` |
| Glass card component | `frontend/src/components/ui/glass-card.tsx` |
| Font configuration | `frontend/src/app/layout.tsx` |
| Landing spec | `DOCS/UI/LANDING.md` |

---

## Design Philosophy: Landing vs Application

| Aspect | Landing Page | Application |
|--------|-------------|-------------|
| **Theme** | Dark only | Light default, dark option |
| **Glass effects** | Full 4-layer Liquid Glass | Minimal (`liquid-glass-subtle` only) |
| **Typography** | Serif headlines (Playfair) | Sans throughout (DM Sans) |
| **Animations** | Dramatic scroll-triggered | Subtle fade-in only |
| **Layout** | Generous whitespace, editorial | Compact, efficient |
| **Color palette** | Charcoal/smoke with cream accents | Warm neutrals, high contrast |

---

## Shadcn/ui Integration

The design system provides CSS variable mappings compatible with Shadcn/ui components.

### Mapped Variables

```css
/* Dark mode (default) */
--background    /* charcoal */
--foreground    /* smoke */
--card          /* jet */
--primary       /* accent cream */
--secondary     /* stone */
--muted         /* jet */
--border        /* smoke @ 10% opacity */
--ring          /* accent */
--radius        /* 0.5rem */
```

### Usage Strategy

1. **Use Shadcn defaults** for forms, tables, inputs, data display
2. **Keep custom components** for landing page (`GlassCard`, navigation)
3. **Apply `liquid-glass-subtle`** sparingly in app UI (tooltips, dropdowns)
4. **Don't mix** dramatic glass effects with standard Shadcn components

### Adding Shadcn Components

```bash
npx shadcn@latest init  # If not initialized
npx shadcn@latest add button input card
```

Components will automatically inherit Legal Lens colors via CSS variable mapping.

---

## Glass Effects

### Available Classes

| Class | Use Case | Intensity |
|-------|----------|-----------|
| `glass-panel` | Basic glass card | Low |
| `glass-nav` | Navigation bars | Low |
| `liquid-glass-card` | Feature cards (landing) | High |
| `liquid-glass-modal` | Dialogs/overlays | High |
| `liquid-glass-nav` | Landing navigation | Medium |
| `liquid-glass-subtle` | Tooltips, dropdowns | Minimal |
| `liquid-glass-button` | Premium buttons | Medium |

### Liquid Glass Layers

The 4-layer structure for dramatic glass effects:

```html
<div class="liquid-glass-card">
  <div class="liquid-glass-filter"></div>   <!-- Layer 1: Backdrop blur -->
  <div class="liquid-glass-overlay"></div>  <!-- Layer 2: Gradient tint -->
  <div class="liquid-glass-specular"></div> <!-- Layer 3: Edge highlights -->
  <div class="liquid-glass-content">        <!-- Layer 4: Content -->
    <!-- Your content here -->
  </div>
</div>
```

### GlassCard Component

Prefer using the React component over raw CSS classes:

```tsx
import { GlassCard } from "@/components/ui/glass-card";

// Variants: "card" | "modal" | "nav" | "subtle"
<GlassCard variant="card" hover={true}>
  <h3>Title</h3>
  <p>Content</p>
</GlassCard>
```

### When to Use Glass

| Context | Recommendation |
|---------|----------------|
| Landing page cards | `liquid-glass-card` |
| Landing navigation | `liquid-glass-nav` |
| App modals/dialogs | Avoid or use `liquid-glass-subtle` |
| App tooltips | `liquid-glass-subtle` |
| App cards/panels | Standard Shadcn `Card` |
| App forms | Standard Shadcn components |

---

## Animation Reference

Animations are defined in `frontend/src/lib/animations.ts` using Framer Motion.

### Available Variants

| Variant | Effect | Use Case |
|---------|--------|----------|
| `fadeInUp` | Fade + slide up (y: 20 → 0) | Section reveals |
| `fadeIn` | Simple opacity fade | Overlays, backgrounds |
| `staggerContainer` | Parent for staggered children | Lists, grids |
| `slideInFromLeft` | Fade + slide from left | Alternating layouts |
| `slideInFromRight` | Fade + slide from right | Alternating layouts |
| `scaleOnHover` | Scale to 1.02 | Interactive cards |

### Usage

```tsx
import { motion } from "motion/react";
import { fadeInUp, staggerContainer } from "@/lib/animations";

// Single element
<motion.div
  variants={fadeInUp}
  initial="hidden"
  whileInView="visible"
  viewport={{ once: true }}
>
  Content
</motion.div>

// Staggered children
<motion.ul variants={staggerContainer} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.li key={item.id} variants={fadeInUp}>
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### Timing Defaults

| Property | Value |
|----------|-------|
| Fade duration | 0.5-0.6s |
| Slide distance | 20-30px |
| Stagger delay | 0.15s |
| Hover scale | 1.02 |
| Easing | `easeOut` |

### Reduced Motion

All animations respect `prefers-reduced-motion`. Users with this preference enabled will see instant transitions (0.01ms duration).

---

## Shadows

| Token | Use Case |
|-------|----------|
| `--shadow-glass` | Default glass panel shadow |
| `--shadow-glass-hover` | Hover state |
| `--shadow-glow-accent` | Subtle accent glow |

---

## Best Practices

1. **Consistency over creativity** in app UI; save distinctive styling for landing
2. **Use semantic tokens** (`--background`, `--foreground`) not raw colors in app UI
3. **Reserve glass effects** for landing page and special UI moments
4. **Respect reduced motion** preferences in all animations
