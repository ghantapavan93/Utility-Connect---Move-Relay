# ADR-005 — Exactly one signature 3D experience, rendering real state

**Status:** Accepted — built · **Date:** 2026-07-24 (supersedes the earlier deferral)

## Context

The brief calls for one signature Three.js experience — the Handoff Constellation.
The design research found that serious operational software almost never uses 3D,
and that a 3D scene which does not render real state becomes exactly the decoration
the design system bans. So 3D was initially deferred until it could earn its place.

The constellation earns its place: it is Utility Connect's own orbiting-particle
logo made functional — referral sources orbiting a canonical record, each line's
colour carrying its workflow state.

## Decision

**Build exactly one 3D experience, the Handoff Constellation, and only if it
renders real state.** It does: line colour is state (verified, conflict, transit,
pending), conflict and transit nodes pulse, the core fills with the brand colour
only once converged. No second 3D surface anywhere.

## Options considered

1. **No 3D.** Safe, but forgoes a signature moment the brand motif genuinely
   supports.
2. **Decorative 3D hero.** The banned outcome — a CTO distrusts it in seconds.
3. **One functional 3D visualization (chosen).** It shows the same source→record
   convergence the whole product is about, and degrades honestly.

## Consequences

- `Constellation3D.tsx` (React Three Fiber). `prefers-reduced-motion` renders it
  static; a WebGL capability probe falls back to a text summary; dpr is capped at
  1.75; no shadows or post-processing; the Canvas is client-only so SSR and the
  static prerender are unaffected.
- A 2D SVG `Constellation` remains for contexts where WebGL is unwanted.
- Matter.js / Phaser remain unused; if ever added, only inside a contained
  Scenario Compiler simulation, never globally.

**Enforced by:** design review checklist in `docs/DESIGN_SYSTEM.md` (motion must
communicate state) · production build still prerenders the landing statically.

**Trade-off:** Three.js adds bundle weight and a WebGL dependency. Bounded to one
component, lazy in effect, with a real fallback — accepted.
