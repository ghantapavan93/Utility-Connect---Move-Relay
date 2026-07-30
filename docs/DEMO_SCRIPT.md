# Demo Script

Three cuts of the same story, for three attention budgets. Every beat names the
surface to show and the sentence to say. Nothing in any cut claims more than the
system does.

---

## The 30-second cut — business value only

**Surface:** `/story`, scrolled briskly; or `/demo` pre-run.

> One customer's move arrives three times — from her agent's system, a
> spreadsheet, and her own form. The dates disagree and one phone digit is
> wrong. The system catches the duplicate, a human approves the merge, and the
> electricity order goes out. Then the provider's response is lost. Most systems
> retry — and enroll her twice. This one refuses, asks the provider what
> exists, and recovers the order it already had. One order. Never two. Every
> step is in the audit trail.

Stop there. The pause after "never two" does more work than another sentence.

---

## The 2-minute cut — the demo, live

**Surface:** `/demo`. Click through; the toasts narrate.

1. **Reset → Ingest.** "Three channels, one human. Stored verbatim, hashed,
   deduplicated."
2. **Detect.** "Deterministic scoring — 0.95, certain duplicate, despite the
   mistyped digit. The weights are inspectable; no model decides identity."
3. **Create → Conflicts.** "Only the fields where sources disagree. The
   customer's own form outranks the partner API — the messier channel wins
   because it is the only one where the customer speaks."
4. **Merge.** "A named concierge approves. The database refuses a canonical
   value from anyone else — that is a constraint, not a policy."
5. **Briefing.** "Every claim cites the row it came from. With a model key this
   is a live LLM behind the same guards; without one, deterministic. Either
   way, ungrounded output cannot display."
6. **Submit.** *Point at the toast.* "The provider created the order — and the
   response is lost. State: UNKNOWN. Not failed. We genuinely do not know."
7. **Retry.** "Blocked. The audit trail records why in plain English. Still one
   order at the provider."
8. **Reconcile.** "Ask, don't assume. Found the existing order. Recovered."
9. **Open ⚿ Reveal system.** "And here are the actual rows — payloads,
   provenance, idempotency, the workflow history, the audit trail. This is not
   a mockup of a system; it is one."

---

## The 10-minute technical walkthrough

**Audience:** engineers. **Surfaces:** `/theater`, the repo, `/api/v1/slo`.

**Minute 0–2 — run the proof.**
`npm run verify` on screen. "Eleven schema guarantees — SQL that must be
rejected — then 565 tests. The claims in the docs re-verify on every commit."

**Minute 2–4 — the state machine.**
Open `provider-submission.ts`. Walk UNKNOWN → reconcile → recovered. "Their own
public terms say the customer contracts directly with the provider. So order
truth lives *there*, and a lost response is uncertainty, not failure. The
resubmittable set excludes UNKNOWN — that absence is the design."

**Minute 4–6 — Failure Theater.**
`/theater`. Click *worker crash*: "crashed at step 2, resumed, completed — step
1 ran exactly once. Durable execution as rows; the unique step constraint is
the resume guarantee." Click *cross-tenant*: "denied by default, and the grant
that succeeds returns the relationship path that explains it." Click *schema
drift*: "quarantined with machine-readable reasons — one drifting partner
integration pollutes a quarantine, not canonical data."

**Minute 6–8 — the AI boundary.**
Open `ai-gateway.ts` and the golden set. "PII is masked before input leaves the
process. Output must be schema-valid JSON. Every claim must cite input field
ids — a prompt-injected fact has no citation and is dropped; the eval proves
it. Model down, the deterministic path serves. And the authority ladder tops
out below execution: a canonical write without a named human is unrepresentable."

**Minute 8–9 — the Build Ledger.**
"Nine entries. Each maps to a commit and a test. Two were caught only by
running the system, not reading it — including the retry-after-timeout that
would have double-enrolled a customer. This is what reviewing AI-generated code
actually looks like."

**Minute 9–10 — close on honesty.**
`/api/v1/slo`, then the limitations section of the README. "Targets computed
live from rows, labelled as prototype targets. Providers are simulated and say
so. No invented metrics anywhere. The parts that are not built are named, with
the seams that make them extensions rather than rewrites."

---

## Question handling

- **"Is the AI real?"** — The guards are real and proven; the model seam is
  live when a key is present, deterministic otherwise, and the response always
  says which. Nothing displayed is ever ungrounded either way.
- **"Would this scale?"** — The consistency model is stated: transactional
  core, eventually-consistent projections, outbox seam already in place.
  ARCHITECTURE.md names what changes at scale and what does not.
- **"What would you build next?"** — The deploy pipeline, a real auth boundary,
  and the contract-test generator for partner onboarding — in that order, and
  the reasons are in the red-team review.
