# ADR-008 — A cinematic vision layer, and `lucide-react`

**Status:** accepted
**Date:** 2026-07-25

## Context

The future-vision page was eight stacked paragraphs. Everything in it was true
and nobody would have read it, because a wall of confident prose about software
that does not exist is the least persuasive artefact in product work. The same
problem was starting to affect the demo page.

A prior project, ShelfTrace Control Plane, solved this with a cinematic scroll
layer: one act per concept, copy on one side, a live mockup of the mechanism on
the other, sides alternating, chapter markers between acts. It works because the
reader can judge whether a mechanism is *coherent* rather than whether a
sentence is well written.

## Decision

Port that structure here, in Utility Connect's type and colour, as
`src/components/cinematic/`. Rebuild `/future` on it.

Two adaptations, not stylistic preferences:

1. **Accents name utility states.** ShelfTrace assigns each concept an arbitrary
   hue (orange, violet, emerald, sky, rose, amber) purely to differentiate
   cards. This project's design system forbids that: *a colour that does not
   name a utility state is a bug*. The `Accent` union here is therefore
   `verified | conflict | unknown | recovered | electricity | internet |
   security | solar` — every value is a state or a service that owns it.

2. **The honesty label rides with the claim.** ShelfTrace prints a generic
   "vision concept" chip. Here each act carries BUILT AND FUNCTIONING,
   INTERACTIVE CONCEPT or FUTURE HYPOTHESIS next to its own body copy, not in a
   key at the bottom of the page, because CLAUDE.md 6a requires the three labels
   never be blurred.

The live mockups are deliberately *mechanisms*, not screenshots of imagined UI.
A screenshot of software that does not exist is the least honest thing a vision
page can contain; a diagram of how something would work is a claim that can be
argued with.

## New dependency: `lucide-react`

Required by the project's "no new library without" rule.

- **Purpose.** One icon set across the cinematic layer. The alternative is
  hand-drawn inline SVG per icon, which is what the rest of the site does and
  which does not scale to ~10 glyphs per vision page.
- **Non-duplication.** Nothing in the dependency tree provides icons. The 3D
  work uses geometry, not iconography; the marketing pages use bespoke SVG for
  the two or three marks that are brand-specific, and those stay bespoke.
- **Performance.** Tree-shaken per icon — each is a small React component
  wrapping one `<svg>`, roughly 0.5–1KB before compression. The nine icons used
  on `/future` add well under 10KB to that route. No runtime, no font file, no
  sprite sheet request.
- **Why it is acceptable here specifically.** Icons on this page are
  navigational and semantic, not decorative: each one marks which module an act
  belongs to. That is a job, which is the test the design system applies.

## Consequences

- `/future` is now a client component. It was static text; it is now a
  scroll-driven narrative with in-view triggers, so this is inherent rather than
  incidental.
- The mockups animate on an interval. Every one of them freezes to its first and
  most legible frame under `prefers-reduced-motion` via `useCyclePhase`, rather
  than stopping on an arbitrary mid-cycle state.
- Motion tokens moved into `src/lib/motion.ts` so the vision layer and the rest
  of the site share one easing vocabulary instead of each picking durations ad
  hoc.

## Alternatives rejected

- **Leave the page as prose.** Rejected: it was accurate and unread.
- **Screenshot-style mockups of the unbuilt modules.** Rejected as dishonest —
  see above.
- **Copy ShelfTrace's palette wholesale.** Rejected: it would have imported six
  decorative hues into a system whose central rule is that colour carries
  meaning.
