# Design Reference Matrix

Compiled 2026-07-23.

**Verification note.** Awwwards Sites of the Day was browsed live on 2026-07-23. The
product references below are described from prior knowledge of these products, not from
a live crawl of each on that date. Marked `[LIVE]` where inspected, `[KNOWN]` otherwise.
Before Phase 2 locks any token, the top six must be re-inspected live. Applying the
project's own evidence discipline to its own design research.

---

## First: Awwwards is the wrong reference class here

Sites of the Day, browsed live `[LIVE]`: LaNegrita, Studio Freight, Merci Michel, Lama
Lama, baqemono.inc, Hiroto Sato, FLOT NOIR, Demande Spéciale, Utsubo, makemepulse,
Cuchillo, UNCOMMON, Rogue Studio, Locomotive, HOLOGRAPHIK, AUGE EXPERIENCE.

Nearly all are **design-studio portfolios and brand campaign sites**. The craft is
genuinely world-class. The *reference class* is wrong for this project, for three
reasons:

1. **Their job is to impress. Ours is to be trusted.** A portfolio wants you to feel
   something. An operational integrity console wants you to believe a number. Opposite
   burdens of proof.
2. **Their motion is expressive. Ours must be diagnostic.** The brief bans "motion that
   does not communicate system state." Most SOTD motion is, by design, exactly that.
3. **They carry almost no data density.** Move Relay's hardest screens are field-level
   conflict tables and audit timelines. Portfolio sites solve no comparable problem.

Copying that aesthetic onto a provenance platform produces a beautiful site a CTO
distrusts within ten seconds. That is the specific failure the brief's red-teamer warns
about: *"Is the visual design masking weak engineering?"*

**Correct use of Awwwards: craft technique, not information architecture.** Study easing
curves, typographic scale, scroll choreography, and 60fps discipline. Take none of the
layout or structure.

Two SOTD sites are worth studying for technique specifically:
- **Locomotive** `[KNOWN]` — scroll orchestration, restrained palette, editorial grid.
  Their open-source scroll library is production-grade.
- **makemepulse** `[KNOWN]` — WebGL that stays performant and degrades. Directly relevant
  to the Handoff Constellation's mobile fallback requirement.

---

## The right reference class: operational software people trust with money and state

| # | Reference | Why it matters here | Steal | Reject |
|---|---|---|---|---|
| 1 | **Linear** `[KNOWN]` | The benchmark for dense UI that still feels calm. Keyboard-first, near-zero chrome. | Typographic restraint (2 weights, tight scale), instant state transitions, contextual density | Its brand-dark aesthetic — too cool for a trust product |
| 2 | **Temporal** `[KNOWN]` | Closest conceptual sibling: durable execution, retries, timeouts, replay. Their UI shows workflow history as first-class. | Event-history-as-primary-view, non-decorative state colour, honest failure display | Developer-only framing; ours must read to a founder |
| 3 | **Stripe** `[KNOWN]` | Gold standard for explaining complex money flows to mixed audiences. | Progressive disclosure, diagram-as-explanation, docs/product visual continuity | Gradient-heavy hero era — now widely imitated |
| 4 | **Modern Treasury** `[KNOWN]` | Payment ops with reconciliation as the core product. **Nearly our exact problem.** | Reconciliation vocabulary, ledger visualisation, calm B2B tone | Sparse motion — we need more for the demo |
| 5 | **Mercury** `[KNOWN]` | Financial trust without looking like a bank. Warmth plus precision. | Colour discipline, generous spacing at high density, trustworthy typography | Consumer-fintech softness on operational screens |
| 6 | **Vercel** `[KNOWN]` | Monochrome plus one accent. Proof that restraint reads as confidence. | Near-monochrome base, single accent for state, geometric precision | Black-and-white severity — too cold for a moving service |
| 7 | **Sentry** `[KNOWN]` | Errors, stack traces, and failure states presented without panic. | Failure-state design, severity hierarchy, timeline of a single event | Dense nav that assumes daily use |
| 8 | **Datadog** `[KNOWN]` | Extreme data density that working operators tolerate for hours. | Correlated-timeline patterns, status colour systems | Visual overload; a demo cannot look like this |
| 9 | **Grafana** `[KNOWN]` | Open-source observability; excellent time-series and annotation conventions. | Annotation-on-timeline, threshold visualisation | Configurability-first UI |
| 10 | **Retool** `[KNOWN]` | Internal-tools aesthetic — exactly the concierge workspace register. | Internal-tool honesty, form/table density, no marketing gloss | Deliberately utilitarian; our demo needs polish |
| 11 | **Ramp** `[KNOWN]` | Approval flows and human-in-the-loop as a designed experience. | Approval-gate UI, reviewer context, decision affordances | Heavy brand illustration |
| 12 | **Segment** `[KNOWN]` | Multi-source data flowing into one canonical profile. **Structurally identical to our ingestion story.** | Source→destination visual grammar, identity-resolution explanation | Older visual language |
| 13 | **Cloudflare** `[KNOWN]` | Network topology and traffic state made legible to non-engineers. | Topology diagrams that carry real data, global status pages | Enormous surface area |
| 14 | **Railway** `[KNOWN]` | Deployment state as a live, legible graph. | Node-and-edge state rendering, deploy timeline | Playful palette |
| 15 | **Resend** `[KNOWN]` | Email delivery: sent, delivered, bounced, complained. Small, sharp, honest. | Event-state clarity, minimal chrome, excellent empty states | Small scope |
| 16 | **Figma community — Untitled UI / Radix / shadcn** `[KNOWN]` | Token architecture and accessible primitives, not visual identity. | Token naming, spacing scale, component-state matrices, a11y defaults | Their default look — that *is* the generic-AI aesthetic |

**Reference 4 (Modern Treasury) and reference 12 (Segment) are the two closest analogues
and should be studied first.** One solves reconciliation; the other solves multi-source
identity resolution. Together they are Move Relay's problem.

---

## Evaluation criteria — how the top six score

Scored 1–5 on what we should *learn* from each, not on how good they are overall.

| Criterion | Linear | Temporal | Stripe | Modern Treasury | Vercel | Segment |
|---|---|---|---|---|---|---|
| Typography | 5 | 3 | 5 | 4 | 5 | 3 |
| Spacing system | 5 | 3 | 4 | 4 | 5 | 3 |
| Colour discipline | 4 | 4 | 3 | 5 | 5 | 3 |
| Grid | 4 | 3 | 5 | 4 | 5 | 4 |
| Navigation | 5 | 3 | 4 | 4 | 4 | 3 |
| Data density | 5 | 5 | 2 | 5 | 2 | 4 |
| Motion | 4 | 2 | 4 | 2 | 4 | 2 |
| 3D usage | 1 | 1 | 2 | 1 | 3 | 1 |
| Interaction patterns | 5 | 4 | 4 | 4 | 4 | 3 |
| Mobile | 3 | 3 | 5 | 4 | 5 | 4 |
| Accessibility | 4 | 3 | 5 | 4 | 4 | 3 |
| **Feels designed, not generated** | 5 | 3 | 5 | 4 | 5 | 3 |

**No reference scores above 3 on 3D.** Serious operational software essentially never
uses 3D. That is a warning, not a gap in the market: the Handoff Constellation must earn
its place by rendering real demo state, or it becomes the exact decoration the brief
bans. It is the project's largest design risk. See ADR-005.

---

## Why the strong references feel designed rather than generated

Five recurring properties. These become the design system's acceptance tests.

1. **Constraint is visible.** Two type weights, one accent, one grid. Generated design
   reaches for variety; designed work reaches for repetition.
2. **Every colour means something.** In Sentry, red is severity, not garnish. If a colour
   can be swapped without changing meaning, it is decoration.
3. **Density is earned, not avoided.** Weak design pads whitespace to look calm. Linear
   and Datadog are dense and still calm, because hierarchy does the work.
4. **Motion explains causality.** Good transitions answer "where did that come from?"
   Generated motion answers "isn't this nice?"
5. **Empty, loading, and error states are designed.** This is the clearest tell. Generated
   work ships the happy path only. Resend and Sentry treat failure as a first-class screen.

Property 5 maps directly onto the brief's centrepiece: our most important screen is a
timeout. **The failure state is the product.**

---

## Adopted direction

- **Base:** near-monochrome, from Utility Connect's navy. Deep navy ground, cool greys.
- **Accent:** teal, used *only* for verified state. Scarcity gives it meaning.
- **Semantic set:** verified / pending / conflicting / in-transit / failed / recovered /
  locked. Seven states, each with colour **plus** icon **plus** text — never colour alone.
- **Type:** one family, two weights, tight scale. Tabular numerals throughout — this
  product is full of timestamps and IDs.
- **Motion:** one language. Transitions show a value moving from its source to the
  canonical record. If an animation does not answer "where did this come from, and who
  said so?", it is deleted.
- **3D:** exactly one instance. Renders live demo state. Static image fallback on mobile
  and under `prefers-reduced-motion`. Never blocks a CTA.

## Banned, per brief — restated as review checklist

Neon gradients · floating glowing spheres · heavy glassmorphism · endless rounded cards ·
purple-blue "AI" palettes · decorative particle fields · oversized empty hero copy ·
robot and chat-bubble icons · motion that does not communicate state · animation
libraries used because they exist.

Add one, from the analysis above: **no colour that carries no meaning.**

## Open — needs Pavan's input

- Exact navy/teal values from Utility Connect brand assets. Their `/branding` page is not
  yet audited.
- Whether to match their existing typeface or deliberately diverge.
- `MLKill` and `TailSkill` remain unidentified. Nothing will be installed under those
  names. Confirm what was meant.
