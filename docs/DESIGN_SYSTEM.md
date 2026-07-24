# Design System — Move Relay

Tokens extracted from the live Utility Connect site on 2026-07-23 via computed-style
sampling of 996 DOM elements. Motion rules derive from Emil Kowalski's published
principles. Every value below is measured or cited, not invented.

---

## 1. Their actual brand — measured, not guessed

Utility Connect reads at a glance as a navy-and-teal brand. **The measurement
says otherwise**, and the difference matters enough to build on:

| Role | Measured value | Hex | Usage count |
|---|---|---|---|
| **Primary brand** | `rgb(0, 135, 181)` | **`#0087B5`** | 18 backgrounds + 94 text — dominant |
| Primary, hover variant | `rgb(38, 135, 181)` | `#2687B5` | 2 |
| Primary @ 75% | `rgba(0,135,181,.75)` | — | 1 |
| **Dark ground** | `rgb(26, 33, 40)` | **`#1A2128`** | 4 |
| Dark, secondary | `rgb(32, 40, 48)` | `#202830` | 2 |
| Dark, tinted | `rgb(52, 57, 77)` | `#34394D` | 1 |
| **Body text** | `rgb(92, 94, 100)` | **`#5C5E64`** | 517 — the single most-used colour |
| Muted text | `rgb(95, 99, 106)` | `#5F636A` | 5 |
| Surface | `rgb(241,241,241)` / `rgb(244,244,244)` | `#F1F1F1` / `#F4F4F4` | 4 |

**Typeface:** `"Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif` — 817 of 996
elements.

**What this actually is:** a saturated **cyan-blue** (`#0087B5`, hue ≈ 195°), not navy.
Ground is near-black charcoal with a cool cast. Body copy is warm-grey, notably **not**
pure black — it is `#5C5E64`, which reads softer and more approachable than `#000`.

That last detail is the most instructive one on the whole site. Someone deliberately
avoided black body text. Preserve that decision.

## 2. What we keep, change, and why

**Keep — this is their brand equity, and recognition matters to the interviewer**
- `#0087B5` as the primary. Immediately legible as Utility Connect.
- Cool charcoal ground, not blue-black.
- Warm-grey body text rather than black.

**Change — with reasons**
- **Open Sans → a tabular-numeral family.** This product is timestamps, correlation IDs,
  phone numbers, and version counters in aligned columns. Open Sans has no tabular
  figures; numbers will jitter between rows in the audit timeline. Non-negotiable for
  a provenance UI. *Candidate: Inter (tabular via `font-feature-settings`), or Geist.*
- **`#0087B5` demoted from decoration to semantics.** On the current site it is
  background, text, buttons, and accents simultaneously. Here it means exactly one thing:
  **verified**. Scarcity is what gives it meaning.
- **Dark-first.** Their site is light-first. Operational consoles are dark-first — see
  Linear, Sentry, Datadog, Grafana. The 3D constellation also needs a dark ground to read.

## 3. Colour tokens

```
--ground-0    #12171C   deepest, page background
--ground-1    #1A2128   measured from their site — primary surface
--ground-2    #202830   measured — raised surface
--ground-3    #2A333D   borders, dividers
--text-hi     #E8EAED   primary text on dark
--text-mid    #9BA1A9   secondary
--text-lo     #5F636A   measured — muted, disabled
```

### Semantic state — seven states, colour is never the only signal

Each state ships **colour + icon + text label**. This satisfies WCAG 1.4.1 and the
brief's rule against hover-only or colour-only meaning.

| State | Token | Hex | Icon | Line treatment |
|---|---|---|---|---|
| Verified | `--state-verified` | `#0087B5` *(their brand)* | check | solid |
| Pending | `--state-pending` | `#8A8F98` | clock | dashed |
| Conflicting | `--state-conflict` | `#E8A33D` | split-arrows | split |
| In transit | `--state-transit` | `#4DA8C8` | arrow-right | pulsing |
| Failed | `--state-failed` | `#E5484D` | x-octagon | red break |
| Recovered | `--state-recovered` | `#3DA76A` | rotate-ccw | rejoined |
| Locked | `--state-locked` | `#A78BFA` | lock | locked node |

`#0087B5` = verified is the keystone decision. Their brand colour comes to mean
*"this fact is confirmed."* Every other state is measured against it.

> Amber `#E8A33D` for conflict rather than red: a conflict is not an error. It is an
> expected, healthy state requiring human judgement. Red is reserved for genuine failure.
> The palette encodes the product thesis.

## 4. Type scale

One family, two weights (400 / 600). Tabular numerals everywhere numbers align.

```
display  40 / 44   -0.02em   600
h1       30 / 36   -0.01em   600
h2       22 / 28   -0.01em   600
h3       17 / 24    0        600
body     15 / 22    0        400
small    13 / 18    0        400
mono     13 / 20    0        400   IDs, timestamps, payloads
```

## 5. Spacing and radius

4px base. `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`.

Radius: `2` inputs · `6` cards · `10` modals · `999` pills. Deliberately tighter than the
current site — large radii everywhere is on the banned generic-AI list.

## 6. Motion — Emil Kowalski's rules, adopted verbatim

Source: [emilkowal.ski/ui/great-animations](https://emilkowal.ski/ui/great-animations).
Emil is a Design Engineer at **Linear**, previously **Vercel** — reference #1 in our
[matrix](../research/design-reference-matrix.md). Convergent, not coincidental.

**Hard rules**

1. **Under 300ms.** Longer feels frustrating on repeated actions.
2. **`ease-out` for responsive feel** — fast start, slow settle. **`ease` for elegance**
   (what Sonner uses), paired with a longer duration.
3. **Animate `transform` and `opacity` only.** These hit compositing alone. Never animate
   `padding` or `margin` — those trigger layout, paint, *and* composite.
4. **60fps or delete it.** "If our animations won't run at 60 frames per second,
   everything else we've talked about becomes useless."
5. **Interruptible.** Must respond to input mid-flight. Framer Motion handles this.
6. **Honour `prefers-reduced-motion`** — fall back to opacity-only.
7. **Only animate where it enriches information or indicates a state change.**

Rule 7 is the one that governs this product. Motion that does not communicate
system state is banned outright, and rule 7 states the same constraint from a
craft direction rather than an architectural one. Two independent routes to the
same conclusion is the strongest evidence available that it is the right one.

His article **"You Don't Need Animations"** is the counterweight. Default to none.

**Token set**

```
--dur-instant   100ms   hover, focus, press
--dur-fast      160ms   toggles, checkboxes, tooltips
--dur-base      220ms   panels, cards, list items
--dur-slow      280ms   route transitions, modals   ← ceiling
--ease-out      cubic-bezier(0.16, 1, 0.3, 1)
--ease-inout    cubic-bezier(0.65, 0, 0.35, 1)
```

Nothing exceeds 280ms. The one exception is the Handoff Constellation's scripted demo
sequence, which is narrative playback rather than UI feedback — budgeted separately in
`MOTION_AND_3D_SYSTEM.md`.

**What earns motion in this product**

| Interaction | Motion | Why |
|---|---|---|
| Field value supersedes an earlier one | Old value slides up and out, new settles in | Shows *causality* — rule 7 |
| Conflict resolved | Two split lines converge into one solid | The merge is the story |
| Provider call times out | Line freezes mid-pulse, does not turn red | `UNKNOWN` ≠ failed. Motion carries the distinction |
| Reconciliation succeeds | Frozen line resumes, rejoins | Recovery made visible |
| Human approval required | Node locks with a short scale-down | Signals a hard stop |

Everything else: no animation.

## 7. Libraries — versions verified 2026-07-23

| Package | Version | Purpose | Justification |
|---|---|---|---|
| `next` | 16.2.11 | framework | brief |
| `tailwindcss` | 4.3.3 | styling | brief |
| `framer-motion` | 12.42.2 | motion | brief; interruptible animations, rule 5 |
| `sonner` | 2.0.7 | toasts | **Emil Kowalski.** Demo emits async events — provider responses, reconciliation — that need non-blocking notification |
| `vaul` | 1.1.2 | drawers | **Emil Kowalski.** Mobile provenance inspector: tap a field → drawer with source history. Solves the mobile depth problem without a route change |

`@react-three/fiber` is deferred to Phase 3, gated on ADR-005.

**Not adopted:** Vanta.js (banned by brief). Matter.js / Phaser (no justified contained
simulation yet).

## 8. Accessibility floor

- Contrast ≥ 4.5:1 body, ≥ 3:1 large text and UI boundaries
- Every state = colour **+** icon **+** text
- Full keyboard path through conflict resolution; visible focus rings
- Audit timeline is an ordered list with real semantics, screen-reader traversable
- No hover-only affordances
- No autoplaying motion above the fold
- Mobile is fully functional with **zero** 3D
- No blocking shader compile on any primary CTA

## 9. Open

- `/branding` page not yet audited — may publish official brand assets
- Final typeface pending tabular-numeral evaluation
- **`CLAUDE.md` currently says "navy/teal".** Measurement shows cyan-blue `#0087B5` on
  charcoal. Project memory is only updated on Pavan's explicit instruction, so this
  correction is logged here and awaits `Update project memory.`
