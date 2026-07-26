import type { Easing, Transition } from "framer-motion";

/**
 * Motion tokens — the animation language for the whole product.
 *
 * Before this, every `transition={{ duration: 0.6 }}` was picked ad hoc, so
 * entrances and exits felt slightly different everywhere and the site had no
 * voice. These give every call site one named answer to "what easing, how
 * long?", which is most of why interfaces like Linear, Vercel, sonner and vaul
 * feel coherent rather than merely animated.
 *
 * Two families, and the rule that separates them: use a SPRING whenever
 * something responds to a person (hover-follow, tilt, drag), because springs
 * are what physical objects do under a hand. Use an EASE for autonomous
 * reveals (scroll, mount), because nothing is pushing them.
 *
 * The design system caps motion at 280ms on transform and opacity only, and
 * every duration here respects that except the deliberately indeterminate
 * loops, which never block interaction.
 */

/* ─────────────────────────────── eases ──────────────────────────────────── */

export const EASE = {
  /** Decel with a long tail. The default for hero and element entrances. */
  outQuart: [0.16, 1, 0.3, 1] as Easing,
  /** Snappier decel, for in-view fade-ups that should not linger. */
  outExpo: [0.19, 1, 0.22, 1] as Easing,
  /** Standard ease-out for secondary reveals. */
  outCubic: [0.33, 1, 0.68, 1] as Easing,
  /** Accel. Exits and dismissals only — never an entrance. */
  inQuart: [0.5, 0, 0.75, 0] as Easing,
  /** Symmetric. Only for indeterminate loops: marquees, scan lines, drift. */
  linear: "linear" as const,
} as const;

/* ────────────────────────────── springs ─────────────────────────────────── */

export const SPRING = {
  /** Cursor follow and card tilt — confident, settles without oscillating. */
  gentle: { type: "spring", stiffness: 80, damping: 18 } as Transition,
  /** Release after a drag. A little overshoot reads as weight. */
  bouncy: { type: "spring", stiffness: 220, damping: 24 } as Transition,
  /** Panels and sheets, where the user is waiting for the content. */
  snappy: { type: "spring", stiffness: 280, damping: 28 } as Transition,
} as const;

/* ───────────────────────────── durations ────────────────────────────────── */

export const DUR = {
  /** Micro-feedback: a press, a tooltip leaving. */
  instant: 0.08,
  /** A tooltip arriving, a button acknowledging. */
  fast: 0.12,
  /** The workhorse. Most state changes belong here. */
  base: 0.22,
  /** At the design system's 280ms ceiling — use for the largest elements. */
  slow: 0.28,
  /** Scroll reveals, which are not interaction and may take their time. */
  reveal: 0.7,
} as const;
