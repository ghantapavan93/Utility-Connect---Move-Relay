# Edge-Case Atlas

The catalogue of ways this domain breaks, each mapped to the invariant that
protects against it, the architectural response, and its current status. This is
where "we thought about it" becomes checkable — every BUILT row names its test
or constraint.

| Label | Meaning |
|---|---|
| **HANDLED** | The running system handles it; a named test or constraint proves it |
| **DESIGNED** | The schema/seams accommodate it; handling logic not yet written |
| **DOCUMENTED** | Recognised, with a stated response; not represented in code |

---

## Identity and household

| Case | Invariant / response | Status |
|---|---|---|
| Same person arrives via API, CSV, and form | deterministic scoring merges to one move, human-approved | **HANDLED** — `scenario.test.ts` Act 1–2 |
| One mistyped phone digit in hand-exported CSV | phone weighted 0.05 so a typo cannot split one family into two moves | **HANDLED** — `ingestion.test.ts` |
| Roommates: same address, different people | must remain distinct; address alone never merges | **HANDLED** — roommate test |
| Relatives sharing a surname | surname alone never merges | **HANDLED** — shared-surname test |
| Spouses with different numbers, one household | needs household modelling distinct from person identity | DESIGNED — `field_versions` can carry `household.*` paths |
| Customer with two simultaneous moves | move ≠ customer; each move is its own aggregate | DESIGNED — schema already separates `moves` from customer fields |
| Agent submits stale data after the customer corrected it | verification hierarchy: customer-confirmed outranks partner-reported regardless of recency ordering conflicts | **HANDLED** — channel trust inversion, tested |

## Referral and attribution

| Case | Invariant / response | Status |
|---|---|---|
| Two partners claim the same customer | provenance keeps both attributions visible; resolution is human | DESIGNED — `partner_id` on every field version |
| Duplicate CSV uploaded twice | identical payload on one channel collapses to one submission | **HANDLED** — unique `(org, channel, payload_hash)`, constraint-verified |
| Partner withdraws a referral | attribution history must survive withdrawal (append-only) | DESIGNED — nothing is deleted; a withdrawal is a new event |
| Agent changes brokerage; attribution vs access diverge | attribution is historical fact; access is current relationship | DOCUMENTED — the distinction is why projections take an actor parameter |

## Consent

| Case | Invariant / response | Status |
|---|---|---|
| Consent is scoped: four purposes, three channels | a boolean cannot represent it; `consent_events` models purpose × channel × wording version | **HANDLED** — schema + constraint test (a fifth purpose is unrepresentable) |
| Customer allows calls but not SMS | per-channel rows | **HANDLED** — schema |
| Consent revoked mid-workflow | revocation is a new event; outbound must resolve consent at send time | DESIGNED — ledger supports it; enforcement hook not written |
| Consent language changes after submission | wording version stored per event | **HANDLED** — `consent_text_version` |
| No consent on file | briefing states "do not contact" | **HANDLED** — `briefing.test.ts` |

## Provider operations — the heart of the system

| Case | Invariant / response | Status |
|---|---|---|
| Provider creates order, response lost | **UNKNOWN, never failure; reconcile, never blind retry** | **HANDLED** — Act 3, the centrepiece |
| Blind retry attempted while UNKNOWN | structurally refused; provider not called; audit records why | **HANDLED** — retry-blocked test + unique operation key |
| Provider reports duplicate (409) | recorded as `duplicate`, existing order adopted | **HANDLED** — simulator + submission states |
| Webhook / response arrives twice | idempotent settle path; one row per operation key | **HANDLED** — unique index |
| Schema-invalid payload | definitive `failed`, resubmittable — distinct from UNKNOWN | **HANDLED** — `ProviderRejectedError` category |
| Provider degraded (slow but working) | slowness ≠ ambiguity; settles normally | **HANDLED** — degraded scenario test |
| Reconciliation finds nothing | only then does the operation return to resubmittable | **HANDLED** — `not_found → pending` |
| Customer changes move date after provider confirmation | requires compensation workflow | DOCUMENTED — the bitemporal question (valid time vs system time) is named in ARCHITECTURE as TARGET |

## AI

| Case | Invariant / response | Status |
|---|---|---|
| Model asserts a fact no source supports | every claim must cite a field id; uncited claims dropped | **HANDLED** for v1 — grounded-by-construction; contract on the seam |
| Model outage | deterministic path is the default, not a fallback bolted on | **HANDLED** |
| Briefing trusted without being read | accept/edit/reject recorded; ~100% acceptance is defined as failure | **HANDLED** — `ai_runs.human_decision` + BUSINESS_VALUE criterion |
| PII (SSN) into a prompt or log | scrub-by-construction in audit and logs; v1 has no prompt at all | **HANDLED** — `redact()`, `scrub()`, projection tests |
| Prompt injection in customer notes | v1 has no model in the loop, so no injection surface; the future seam only rephrases structured claims | **HANDLED** structurally; adversarial suite DOCUMENTED for the live-model version |
| AI merging two families' records | level-4 execution unrepresentable — canonical write requires a named human | **HANDLED** — CHECK constraint |

## Infrastructure

| Case | Invariant / response | Status |
|---|---|---|
| Crash between state change and its audit event | impossible to commit one without the other | **HANDLED** — single-transaction rule |
| Restart / cache eviction during in-flight submission | idempotency is a database row, not a lock | **HANDLED** — constraint-verified |
| Audit tampering (UPDATE/DELETE) | rows survive both, silently | **HANDLED** — DO INSTEAD NOTHING rules, tested |
| Two concurrent merge approvals | second canonical insert rejected by partial unique index | **HANDLED** — constraint-verified |
| Worker crash after external side effect | exactly the UNKNOWN pattern generalised | DESIGNED — reconciliation jobs table is the seam |
| Events out of order / projection lag | projections recomputed from authoritative rows | **HANDLED** at current scale; outbox is the TARGET seam |
| WebGL context loss / weak GPU | capability probe → text fallback; reduced-motion → static | **HANDLED** — `Constellation3D` probes before rendering |
| Browser blocks animation | reduced-motion collapses all motion to opacity | **HANDLED** — global CSS + per-component checks |

## Frontend / experience

| Case | Invariant / response | Status |
|---|---|---|
| Customer sees "UNKNOWN" or an error state | customer projection translates ambiguity to "In progress" | **HANDLED** — projection test |
| Partner sees another partner's pipeline | attribution check; default deny | **HANDLED** — negative-asserted |
| Screen reader hits the audit timeline | ordered list semantics | **HANDLED** |
| Meaning carried by colour alone | every state = colour + glyph + label | **HANDLED** — StateBadge |

---

## How to read this honestly

The HANDLED rows are the proof. The DESIGNED rows are the senior signal — the
schema was shaped so those cases have somewhere to land. The DOCUMENTED rows are
the humility: known, named, not yet built. A system that claimed all three
columns were HANDLED in two days of building would be lying, and a reviewer
would know.
