# Business Value and Measurement Framework

Move Relay makes no claim about revenue, conversion, or cost savings. It has no
access to Utility Connect's production data, so any such number would be
invented, and an invented number is worse than no number — it is the fastest way
for a founder to stop believing the rest of the document.

What this prototype does instead is **build the instrumentation** that would let
each hypothesis be tested against real data.

Preferred framing throughout:

> This prototype creates the instrumentation needed to test whether the workflow
> reduces reconciliation time and prevents duplicate actions.

Not:

> ~~This will increase conversion by 40%.~~

Every signal below is labelled:

| Label | Meaning |
|---|---|
| **INSTRUMENTED** | The running system already emits this. Query it today. |
| **DERIVABLE** | The data is captured; the metric needs a view or a rollup. |
| **REQUIRES COMPANY DATA** | Cannot be measured without Utility Connect's own systems. |

**Every baseline is unknown.** That is stated once here and holds everywhere.

---

## 1 · Partner growth

**Primary stakeholder** Head of Partnerships · Founder
**Current friction** Each new partner arrives with its own payload shape. Onboarding effort scales with partner count unless the mapping step becomes repeatable.
**Proposed improvement** Versioned schemas, deterministic validation, and synthetic referrals that prove an integration works before it carries a real customer.
**Risk / negative side effect** A validation gate that is too strict blocks legitimate partners and pushes them back to email and spreadsheets — the exact channel this is meant to reduce.

| Signal | Status | Where it comes from |
|---|---|---|
| Referral-payload validation success rate | **INSTRUMENTED** | `raw_submissions` vs rejected payloads |
| Share of referrals arriving via automated channels | **INSTRUMENTED** | `raw_submissions.channel` distribution |
| Integration error rate by partner | **DERIVABLE** | `audit_events` filtered by `partner_id` |
| Schema-drift incidents | FUTURE — Network Launchpad | not built |
| Time to launch a new partner | REQUIRES COMPANY DATA | onboarding start is not observable here |
| White-label activation time | REQUIRES COMPANY DATA | — |
| Partner support requests | REQUIRES COMPANY DATA | lives in their support system |

**Success** A new partner reaches first successful synthetic referral without engineering involvement.
**Failure** Validation rejects more valid payloads than it catches malformed ones.

---

## 2 · Customer experience

**Primary stakeholder** The mover · Concierge team
**Current friction** A customer whose details arrived from several sources may be asked to confirm things the company already knows, or contacted twice about one move.
**Proposed improvement** One canonical record, so every outbound contact resolves against a single set of confirmed facts and a live consent state.
**Risk** Over-consolidation. Merging two genuinely different people is far more damaging than leaving two records unmerged. Hence deterministic matching and a mandatory human gate.

| Signal | Status | Where it comes from |
|---|---|---|
| Records requiring clarification | **INSTRUMENTED** | count of open conflicts per move |
| Duplicate-contact incidents | **INSTRUMENTED** | `provider_submissions` deduplicated by `operation_key` |
| Customer corrections to supplied data | **INSTRUMENTED** | `field_versions` where a `customer_form` value supersedes a partner value |
| Time from referral to first concierge action | **DERIVABLE** | first `audit_event` minus `raw_submissions.received_at` |
| Service readiness before move date | **DERIVABLE** | `service_requests.state` vs canonical `move.date` |
| Intake completion rate | REQUIRES COMPANY DATA | needs abandonment data from their funnel |
| Customer satisfaction | REQUIRES COMPANY DATA | — |

**Success** Fewer moves reach the concierge with unresolved contradictions.
**Failure** Two distinct customers are merged even once.

---

## 3 · Concierge productivity

**Primary stakeholder** Concierge specialists · Operations lead
**Current friction** Context has to be reassembled before a call. Reassembly effort grows with the number of sources that touched the move.
**Proposed improvement** A briefing where every claim is traceable to the field version it came from, with unknowns stated as unknowns rather than omitted.
**Risk** A briefing that is trusted without being read. Mitigated by requiring an explicit accept / edit / reject, and recording which was chosen.

| Signal | Status | Where it comes from |
|---|---|---|
| Briefing accept / edit / reject rate | **INSTRUMENTED** | `ai_runs.human_decision` |
| Manual data-correction volume | **INSTRUMENTED** | human-approved `field_versions` |
| Exception-resolution time | **DERIVABLE** | `unknown` → `reconciled` interval |
| Unknown outcomes awaiting a human | **INSTRUMENTED** | open `reconciliation_jobs` |
| Time spent reconstructing context | REQUIRES COMPANY DATA | needs time-tracking |
| Systems opened per move | REQUIRES COMPANY DATA | — |
| Moves handled per specialist | REQUIRES COMPANY DATA | — |

**Success** Edit rate on briefings falls while reject rate stays flat — the briefing is getting more useful without being trusted more than it earns.
**Failure** Acceptance approaches 100%. That is not success; it means nobody is reading it.

> The edit rate is the honest metric. A briefing accepted without edits *and*
> without reading is indistinguishable, in the data, from a perfect briefing.
> Tracking rejects and edits separately is what keeps the distinction visible.

---

## 4 · Attribution and revenue integrity

**Primary stakeholder** Founder · Finance · Partner success
**Current friction** Attribution arrives out-of-band from the customer. Where a move is touched by several channels, the question of which partner introduced it is answered by whichever record was written last unless provenance is preserved deliberately.
**Proposed improvement** Every value carries its source, channel, partner, and timestamp permanently, so attribution is reconstructible rather than inferred.
**Risk** Provenance makes disputes *visible* that were previously invisible. Short-term this can look like more conflict, not less.

| Signal | Status | Where it comes from |
|---|---|---|
| Referrals with complete source attribution | **INSTRUMENTED** | `field_versions.partner_id` coverage |
| Conflicting-attribution incidents | **INSTRUMENTED** | multiple partners on one move |
| Services activated without a traceable source | **INSTRUMENTED** | `service_requests` with no attributed referral |
| Duplicate provider orders | **INSTRUMENTED** | structurally prevented; count is the metric |
| Unknown provider outcomes | **INSTRUMENTED** | `provider_submissions.state = 'unknown'` |
| Partner disputes | REQUIRES COMPANY DATA | — |

**Success** Every activated service resolves to a named, timestamped referral source.
**Failure** Provenance is captured but never consulted, making it storage cost with no decision attached.

---

## 5 · Provider reliability

**Primary stakeholder** Operations · Engineering
**Current friction** A provider that creates an order and then fails to respond is indistinguishable, from the caller's side, from one that never created it.
**Proposed improvement** Ambiguity is recorded as `UNKNOWN` rather than collapsed into success or failure, and is resolved by asking the provider rather than by resubmitting.
**Risk** Reconciliation adds latency. A customer waits slightly longer for confirmation in exchange for not being enrolled twice.

| Signal | Status | Where it comes from |
|---|---|---|
| Submission success rate | **INSTRUMENTED** | `provider_submissions.state` |
| Timeout rate | **INSTRUMENTED** | `error_category = 'timeout'` |
| Unknown-outcome count | **INSTRUMENTED** | `state = 'unknown'` |
| Reconciliation success rate | **INSTRUMENTED** | `reconciliation_jobs.outcome` |
| **Duplicate requests prevented** | **INSTRUMENTED** | `provider.retry.blocked` audit events |
| Failure rate by provider and service | **DERIVABLE** | group by `provider_name`, `service_type` |
| Acknowledgement latency | **DERIVABLE** | `settled_at` − `started_at` |

**Success** Unknown outcomes reach a definite state without a single duplicate order.
**Failure** Reconciliation itself becomes a queue nobody drains.

> `provider.retry.blocked` is the most commercially legible metric in the system.
> It is a direct count of duplicate provider orders that did not happen — each one
> a customer not enrolled twice, and a call the concierge did not have to make.

---

## 6 · Engineering velocity and quality

**Primary stakeholder** CTO · Engineering
**Current friction** AI-assisted development raises output volume. Without a review record, it also raises the volume of plausible-but-wrong code reaching production.
**Proposed improvement** An AI Build Ledger recording, per decision: what was proposed, what was wrong with it, the correction, and the test that now prevents regression.
**Risk** The Ledger becomes theatre — written after the fact to look rigorous. It is only worth anything if entries correspond to real commits and real tests.

| Signal | Status | Where it comes from |
|---|---|---|
| AI-generated code rejection / correction rate | **INSTRUMENTED** | `docs/AI_BUILD_LEDGER.md` entries vs commits |
| Contract-test coverage of critical paths | **INSTRUMENTED** | 575 tests, incl. 11 schema-guarantee checks |
| Failures caught before release | **INSTRUMENTED** | test suite |
| Setup success rate | **INSTRUMENTED** | `npm install && npm run verify`, no Docker required |
| Mean time to identify a workflow failure | **DERIVABLE** | audit trail reconstructs any move |
| Accessibility / visual-regression pass rate | PLANNED | not yet built |
| Deployment frequency | **DERIVABLE** | git history |

**Success** Every Ledger entry names a real commit and a real test.
**Failure** Ledger entries exist that no test corresponds to.

---

## What is already measurable today

Not a plan — these run now:

| Question | Answer available from |
|---|---|
| How many duplicate provider orders were prevented? | `provider.retry.blocked` count |
| Which channel supplied each field, and when? | `field_versions` |
| Who approved this merge, and what reason did they give? | `field_versions.selected_by`, `selection_reason` |
| What did the customer actually consent to, and when? | `consent_events` |
| Which submissions are ambiguous right now? | `provider_submissions.state = 'unknown'` |
| Can this move's full history be reconstructed? | `audit_events`, append-only |
| Did anyone edit the AI's briefing? | `ai_runs.human_decision` |

Seven operational questions answerable from a running system with synthetic data.
None require a fabricated number to be useful.

---

## How this is presented

Every element in the demo carries one of three labels, and they are never blurred:

| Label | Meaning |
|---|---|
| **BUILT AND FUNCTIONING** | Real code, real database, covered by tests |
| **INTERACTIVE CONCEPT** | Explorable, but not wired to a live backend |
| **FUTURE HYPOTHESIS** | Described and reasoned about. Not built. |

The measurement framework itself is **BUILT AND FUNCTIONING** for every row
marked INSTRUMENTED, and **FUTURE HYPOTHESIS** for everything else. Nothing in
the presentation implies a baseline exists where none does.
