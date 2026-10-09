## Landing Page Design Prompt: Legal Lens

### Brand Identity
**Product:** Legal Lens — Legal Intelligence Platform  
**Primary Tagline:** "Deduce. Discover. Decide."  
**Secondary Tagline:** "When you have eliminated the impossible, whatever remains, however improbable, must be the truth." — Legal Lens

**Tone:** Investigative, sharp, cutting-edge tech startup. Think detective noir meets modern AI.  
**Visual Direction:** Dark professional with minimalist modern tech elegance. Apply Liquid Glass design language—translucent UI elements with refraction/reflection effects, adaptive depth, and fluid transformations that respond to scroll/interaction.

---

### Page Structure (Top to Bottom)

**1. Navigation**
- Logo (Legal Lens) left-aligned
- Minimal nav links: Platform, Features, How It Works
- CTA buttons: Login, Get Started

**2. Hero Section**
- Primary tagline prominently displayed
- Secondary tagline (Legal Lens quote) beneath, styled as attribution
- Embedded product demo video (auto-muted, looping preview or click-to-play)
- Primary CTA button

**3. Problem Section**
- Headline addressing core pain points
- 3-4 problem statements: Evidence overload, AI black box, fragmented workflows, cross-modal blindness
- Visual treatment: subtle, understated—text-focused with minimal iconography

**4. Solution Section**
- Headline introducing Legal Lens as the answer
- Key solution pillars: Unified case workspace, transparent agent decisions, source-linked citations, knowledge graph visualization
- Consider layered card layout with Liquid Glass styling

**5. How It Works**
- Visual workflow diagram showing: Upload → Triage → Domain Analysis → Synthesis → Knowledge Graph
- Animated on scroll—nodes/connections reveal progressively
- Brief descriptor per stage

**6. Feature Highlights**
- Agent Decision Graph (Trace Theater): Full AI transparency
- Knowledge Graph: Entity/relationship visualization with toggleable layers
- Cross-Modal Evidence Linking: Automatic connections across file types
- Contradiction & Gap Detection: Proactive inconsistency surfacing
- Use cards or alternating left/right sections with subtle Liquid Glass containers

**7. Trust & Differentiators**
- Security/compliance signals (icons or badges)
- Key differentiators: Not simple RAG, not a prompt wrapper, native multimodal processing
- Brief, confident copy—no testimonials needed

**8. Final CTA Section**
- Repeat primary tagline
- Strong call-to-action: "Start Your Investigation" or similar
- Email capture or Get Started button

**9. Footer**
- Minimal: Logo, nav links, legal links, copyright

---

### Animation & Interaction Guidelines
- **Scroll-triggered:** Fade-in, scale-up, parallax depth on sections
- **Liquid Glass elements:** Subtle refraction shift on hover/scroll, translucent cards with backdrop blur
- **Hero video:** Smooth reveal animation on load
- **Workflow diagram:** Sequential node activation as user scrolls into view
- **Micro-interactions:** Button hover states with glass shimmer, smooth transitions

---

### Technical Notes
- Framework: Next.js with React
- Styling: Tailwind CSS, custom Liquid Glass utility classes
- Animation: Framer Motion for scroll-triggered and entrance animations
- Dark theme as default (light theme optional/later)
- Fully responsive: Desktop-first, mobile-optimized

---

### General Guidelines
- You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:
- Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

- Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

- Motion: Use animations for effects and micro-interactions. Use Framer Motion when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

- Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
