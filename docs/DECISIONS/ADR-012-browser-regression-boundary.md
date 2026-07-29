# ADR-012 — Browser specs cover what only a real document can settle

**Status:** Accepted · **Date:** 2026-07-29

## Context

The Failure Theater's decision logic is pure and well covered. `verdictOf`
resolves a response into `held`, `violated` or `inconclusive`; `resultLayers`
decides which sentences a verdict earns; `establishesInvariant` decides whether
evidence can support a claim at all. Each has assertions that go red when the
logic is wrong, and each was proven to discriminate by restoring the defect.

None of that reaches the browser. Whether the component renders what those
functions return, whether the tablist keeps one tab stop, whether the evidence
drawer stays outside the live region — all of it was verified by driving a real
page and measuring the DOM. That is worth doing and it is not a regression
barrier: it establishes the state of one afternoon and says nothing about the
next edit.

Three of those properties are also the ones most likely to break silently. A
refactor that inlines `resultLayers` back into the component, a tidy-up that
moves the evidence `<pre>` one level up the tree, a styling pass that drops the
non-colour selected cue — none produces a type error and none fails a unit test.

The fourth is unreachable by any other means. A verdict of `violated` cannot
occur against the hardened backend, because every invariant holds. That is the
desired state and it leaves the most consequential rendering path — the one that
must not print prevention language over a breach — with no automated coverage in
a real document.

## Decision

**Playwright is added as a dev dependency, under one standing rule: a browser
spec exists only where a real document is the only thing that can settle the
claim. Anything decidable in a function belongs in Vitest.**

It began at four claims about the Failure Theater, and each section below records
what met that bar afterwards.

The four:

1. The prevention sentence is absent when the invariant did not hold.
2. The violation sentence is rendered, in the server's own words.
3. The breach evidence is shown, reporting the unflattering numbers — and is
   withheld, with the breach still stated, when the evidence cannot support it.
4. Selection, focus and `aria-labelledby` stay synchronised through keyboard
   navigation.

Coverage of the Attack Builder and the unsafe baseline followed for the same
reason: both have branches whose absence is the assertion, and an absence is
what a rendering test is uniquely able to check.

The breach is produced by intercepting the route inside the spec. No application
code changes, no safeguard is disabled, and no production path exists that could
return `VIOLATION` — the stub lives in the test file, where it cannot ship.

## Options considered

1. **Add jsdom and Testing Library, and render components in Vitest.** Cheaper
   to run and already adjacent to the existing suite. Rejected: the four claims
   include computed font weight, live-region containment and focus behaviour,
   which jsdom either does not implement or implements approximately. A test
   that passes in a simulated DOM and says nothing about a real one is worse
   than no test, because it reports coverage that does not exist.
2. **Leave it at manual verification and write the findings down.** Free, and
   honest about what was checked. Rejected: the properties at risk are exactly
   the ones a later refactor breaks without any other signal, and a note in a
   document does not run.
3. **Build out a full end-to-end suite across every route.** Rejected as the
   opposite failure. Every spec here is slower and more brittle than the unit
   test that could have replaced it, so the boundary is stated rather than left
   to grow: browser specs cover what only a real document can settle. Anything
   decidable in a function belongs in Vitest.

## Consequences

- `@playwright/test` is a dev dependency. It ships in no bundle and the route
  under test loads no new code.
- Two runners share a repository and not a scope. Vitest excludes `e2e/**`,
  because its default glob would otherwise collect the Playwright specs and
  report a broken unit suite for a browser test that was never its job.
- The specs run against a live database through the real API, so they run with
  one worker and no retries. A retry that passed on the second attempt would
  hide the flake worth knowing about.
- `npm run verify` is unchanged and still fast. Browser specs are `npm run
  test:e2e`, deliberately separate: the fast gate should stay fast, and a
  contributor without browsers installed should not see a red suite.
- The published test count continues to describe the Vitest suite only. The
  browser specs are a different kind of evidence and are not added to it.

## Mobile viewports, added for the same reason

Four defect classes were found by measuring real pages during development, and
all four are invisible to every other check the project runs:

| Defect | How it appeared |
|---|---|
| Content clipped and unreachable | a card rendered 579px wide inside a 320px column, putting its button off-screen behind `overflow-x-hidden` |
| Labels collapsed to nothing | six instruments shrank to 40px with labels measuring zero, leaving identical squares |
| Type scaled below reading | an SVG hero rendered its labels at 2.8px, a diagram at 6.7px |
| Targets too small to hit | primary controls at 28px and 36px |

None produced a type error. None failed a unit test. None is visible in a
screenshot unless already suspected, which is why they survived as long as they
did.

Checked at 320 and 375 across `/theater`, `/reliability`, `/industries/[slug]`
and `/connect-flow`. 320 is deliberate: every one of these was introduced or made
materially worse below 375, and a suite checking only the common phone width
would have passed while the narrow case was broken.

Two notes on how the checks are written. Text-free decoration is excluded from
the overflow check, because several backdrops overscan by design and are
contained by an ancestor — a *readable* thing past the right edge is the defect.
Inline links are exempt from the 44px rule per WCAG 2.5.8, by computed display
rather than by name, so the exemption cannot quietly widen.

The four assertions are soft, so one failure does not hide the other three. Run
sequentially, a page with both a small control and unreadable SVG text reported
only the first — which is how a fix can look complete while a second defect on
the same page is still there.

## Reduced motion

The wrong reading of `prefers-reduced-motion` is "show less". These pages carry
their argument *in* the motion — a diagram draws to say a thing was built — so
disabling the animation without rendering its finished state leaves a reviewer
with an empty diagram. That is not hypothetical: a `draw()` helper with two
identical branches left seven scenes frozen at their initial state, and it
survived weeks because no screenshot shows it.

So the rule under test is: **stillness collapses pacing, never content.**

| Claim | How it is checked |
|---|---|
| Diagrams render finished | no path left at `stroke-dasharray: 0 1`, the unstarted frame |
| Nothing moves | geometry sampled twice 700ms apart; any change is a failure |
| No CSS animation loops | WAAPI timeline, infinite iterations |
| Every fact still arrives | the four result sentences, all eight incident stages, the manifest, the lineage drawer, the refusal |

Set via `contextOptions.reducedMotion`, and a `beforeEach` asserts the media
query actually reached the browser — written as a bare `reducedMotion` option it
type-checks as an unknown fixture and is silently ignored, which made every
assertion measure the ordinary animated page.

One check here was replaced after it failed to discriminate. Asking
`document.getAnimations()` for infinite iterations reads well and proves almost
nothing on this codebase: Framer animates `offsetDistance` — what every
travelling pulse uses — through requestAnimationFrame, so those never appear in
that list. Installing the defect it was written to catch left it green. Sampling
geometry twice catches it, and is indifferent to which technology is moving
things.

## The drawings

Six glyphs and a travelling capsule are the most expensive thing on these pages
and the easiest to get silently wrong. Three failure modes have all happened
here, and none produces a type error, fails a unit test, or shows in a
screenshot:

| Failure | What it looked like |
|---|---|
| Frozen | a `draw()` helper with two identical branches left every scene unstarted; the pages looked designed and conveyed nothing |
| Undifferentiated | one animation parameterised by colour — a reviewer learns six things happened, not what any of them was |
| Overwritten | Framer draws `pathLength` by writing `stroke-dasharray`, silently clobbering a deliberately dashed conflict line |

So the specs assert **difference**: between the six glyphs, between a glyph's
states, across the capsule's phases. Difference is what separates a drawing from
decoration.

Signatures are structural — marks and shape attributes, never colour. Colour is
exactly what an undifferentiated implementation *does* vary, so including it
would let the failure being looked for pass.

One spec was rewritten after failing to discriminate, for the second time in
this suite. The capsule phase test used the full signature and passed with the
capsule hard-wired to ignore its phase, because a travelling dot rewrites its
own `cx` every frame — consecutive samples differed no matter what the wire was
doing, so the check proved an animation existed, which was never in question.
Reading paths and rects only collapses it to one sample under the same defect.

That is twice now that a check written from the outside looked right and proved
nothing. Installing the defect a test exists to catch is the only thing that has
reliably distinguished the two.

## The control room, and the one control that commits a decision

`/dashboard` earned browser coverage for a reason the boundary above already
states: its load-bearing properties are *absences*, and an absence in a rendered
document is what only a rendered document can settle.

Two are about what the page may claim. A failed read must not render as a calm
empty shift, and a metric must not print `0` while the server is still being
asked — both are the same defect, a page answering a question it has not had
answered. A component reaches that defect by treating an empty array as good
news, which is the natural way to write it.

The merge approval control is the sharpest case. It is the UI for the one
operation on the never-automate list that a person actually performs, so the
specs assert what it refuses to do:

| Claim | Why a rendering test is the only place it can be settled |
|---|---|
| No value is preselected — not even the recommendation | Defaulting to the suggestion turns one click into approval of a machine's choice. It is also the tidier implementation, so it is the one a refactor arrives at |
| A reason is required before anything commits | A canonical value whose justification is blank is a decision nobody can review, and `selection_reason` is stored beside the actor precisely so it can be |
| A stale merge reads as someone else's commit, not an error | Rendering the version check as a failure teaches an operator to retry over a colleague's decision — the exact overwrite the check exists to prevent |
| The authority boundary is on the control, not in a footnote | A recommendation whose limit is unstated reads as an instruction |

The 409 path is driven by stubbing the route, for the same reason the theater's
breach is: the safe outcome is the only one the real backend produces, and the
unsafe rendering path is the one worth testing. Both stubs live in spec files
where they cannot ship.

Each of the four was confirmed by installing its defect — preselecting the
recommendation, and deleting the 409 branch — and watching the assertion go red.

## What this does not cover

Every named gap is closed. Browser coverage now spans `/theater`, `/dashboard`,
`/views`, `/reliability`, `/industries/[slug]` and `/connect-flow`. `/story`,
`/demo`, `/architecture` and `/future` have none, and that is a deliberate scope
decision rather than an oversight: they render argument, not state, and a
mistake in them is visible to anyone who opens the page.
