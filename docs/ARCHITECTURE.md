# Architecture

Move Relay's architecture, in three honesty tiers, consistently labelled:

| Label | Meaning |
|---|---|
| **BUILT** | Running code, covered by tests, verifiable with `npm run verify` |
| **DESIGNED** | Interfaces and seams exist in the code; the full capability does not |
| **TARGET** | The reference architecture this system would grow into. Not built. |

The senior claim this document makes is not "everything is implemented." It is:
**the seams are in the right places**, so each TARGET capability is an extension,
not a rewrite. Every DESIGNED row names the seam that makes that true.

---

## The shape: a modular monolith with a workflow spine

One deployable application. Clearly separated domain modules. PostgreSQL as the
single authority. A provider simulator that keeps its own ledger. This is a
deliberate senior decision, not a shortcut:

- The core proof — provenance, human-gated merge, idempotent fulfilment,
  append-only audit — depends on **transactional correctness**. A monolith gives
  those guarantees with one database and no distributed-consistency machinery.
- Microservices would add network partitions between modules that currently
  share transactions — importing the hardest problem in distributed systems into
  a proof that does not need it.
- **Extraction boundaries are preserved** through module ownership: each module
  touches only its own tables, and cross-module effects flow through recorded
  events. A module can be extracted when scale or team ownership justifies it.

Kubernetes is deliberately absent. The honest trigger list for ever adopting it:
many independently deployed services, divergent scaling patterns, multiple
teams, multi-region orchestration. None apply to a vertical slice. Choosing not
to use it, with reasons, is the stronger signal.

## The six planes

```
1 EXPERIENCE   Next.js — customer, partner, concierge, engineering views  BUILT
2 ACCESS       validation, versioned REST, tenant scoping                 PARTIAL
3 DOMAIN       intake → canonicalize → move → fulfil → project            BUILT
4 AI CONTROL   grounding, human decision record, model seam, fallback     BUILT (deterministic core)
5 DATA/EVENTS  PostgreSQL, provenance, audit, idempotency                 BUILT
6 EVIDENCE     tests, constraints, ADRs, Build Ledger, CI, health, logs   BUILT
```

## Domain modules (bounded contexts)

The Eric Evans view of the system. Each module's ownership is exclusive.

| Module | Owns | Status |
|---|---|---|
| **Referral Intake** | `raw_submissions` — immutable, hash-deduped, correlation-tagged | BUILT |
| **Identity & Canonicalization** | duplicate scoring, `field_versions`, human merge. Invariant: *a canonical value may change; its history and origin may never disappear* — enforced by append-only versions + `canonical_requires_actor` | BUILT |
| **Consent & Attribution** | `consent_events` — per-purpose, per-channel, versioned wording | BUILT |
| **Move Orchestration** | `moves`, state transitions in transactions | BUILT |
| **Concierge Operations** | grounded briefing, `ai_runs.human_decision` | BUILT |
| **Provider Fulfilment** | operation keys, idempotency, UNKNOWN, reconciliation. Invariant: *a timeout is evidence of uncertainty, not failure* | BUILT |
| **Stakeholder Projections** | server-side allow-list views per audience | BUILT |
| **AI Governance** | `ai_runs` (model, prompt version, inputs, grounded flag, human decision) | BUILT (registry: DESIGNED — the seam is `ai_runs.prompt_version`) |
| **Partner Integration Contracts** | schema versions, contract tests, drift quarantine | TARGET — seam: `raw_submissions.payload_hash` + channel typing |
| **Customer Lifecycle** | post-move events (`move.completed`, `promotion.expiring`…) | TARGET — seam: the audit event stream is already the event log |
| **Scenario & Replay** | executable failure scenarios | DESIGNED — `scenario.test.ts` and the demo orchestrator are the working seed |

## Consistency model — stated, not implied

**Strongly consistent (same transaction):** canonical merge + its audit event ·
consent recording · provider idempotency reservation · state transitions.
`withTransaction` is the only write path; a state change cannot commit without
its explanation.

**Eventually consistent (read models):** customer timeline, partner status,
dashboard stats — all recomputed from authoritative rows on read. At demo scale
they are synchronous queries; the TARGET moves them behind an outbox. The seam
exists: every consequential change already emits an audit event in-transaction,
which is precisely what an outbox row is.

**Concurrency:** the partial unique index on canonical fields makes concurrent
merge approval safe today (second writer fails loudly). TARGET adds `version`
columns + optimistic concurrency for concierge co-editing — additive.

## The provider state machine (BUILT — the core of the proof)

```
pending → submitted → confirmed
                    ↘ failed            (definitive rejection — resubmittable)
                    ↘ UNKNOWN           (response lost — NOT resubmittable)
                        ↓ reconcile
                        ├─ found_existing → reconciled   (order recovered, no duplicate)
                        └─ not_found      → pending      (now safe to retry)
```

Enforced by: the resubmittable-state set in `provider-submission.ts`, the unique
`operation_key` index, the `order_id_requires_settled_state` CHECK, and
`scenario.test.ts` Act 3 — which kills the response *after* the simulated
provider creates the order, attempts a blind retry, and proves exactly one order
exists at the provider afterwards.

**TARGET (durable execution):** the workflow states are database rows, which is
what makes a Temporal migration mechanical — each state maps to a workflow step,
human approval becomes a signal, reconciliation a scheduled activity. Temporal is
named as the target engine, not cosplayed in the prototype.

## AI authority levels — the governance model

| Level | Meaning | Status |
|---|---|---|
| 0 Transform | structure a payload, map a CSV | BUILT (deterministic) |
| 1 Explain | explain a conflict, summarise a record | BUILT (grounded briefing) |
| 2 Recommend | next question, suggested resolution | DESIGNED — recommendation fields exist |
| 3 Prepare | draft a communication or payload | TARGET |
| 4 Execute | consequential action | **permanently gated** — `canonical_requires_actor` makes level-4 writes unrepresentable |

The model seam (`renderNarrative`) is contractually limited: it may only rephrase
claims it is handed, each citing a source field id; uncited output is dropped.
Model unavailable → the deterministic path *is* the fallback, because it is the
default. Core operations never depend on a model being up.

## Multi-tenancy — honest status

`organization_id` scopes every table; projections are computed server-side by
allow-list and tested with negative assertions (SSN, provider order ids, and
cross-partner data proven absent). **There is no authentication layer** — that is
a stated limitation, not a hidden one. TARGET: relationship-based authorization
(OpenFGA-style: network → brokerage → office → team → agent), justified by the
LeadingRE-scale hierarchy. The seam: every projection function already takes the
actor's identity as an explicit parameter.

## Observability

BUILT: structured JSON logs with PII scrubbed **by construction** (`scrub()`),
trace/span/correlation ids in OTel-compatible shape, span timing, `/api/v1/health`
with a real DB probe, and the append-only audit trail answering "who changed
business state and why" — which logs alone never answer.

TARGET: OTel export → Prometheus/Grafana/Tempo. The adapter is small because the
id model already matches.

## Delivery

BUILT: CI on every push — typecheck, 11 schema guarantees, 194 tests, production
build. The claims in these documents are re-verified on every commit.
TARGET: staging → smoke → approval → production, expand-and-contract migrations,
feature flags. Deploy reference: Vercel + Neon now; ECS/RDS as the AWS shape.

## Prototype SLOs — project targets, not production claims

- 100% of canonical fields carry provenance *(constraint-enforced)*
- 100% of consequential transitions produce an audit event *(same-transaction)*
- 0 duplicate provider orders across the timeout suite *(tested)*
- 0 cross-audience leaks in projection tests *(negative-asserted)*
- Breach response is defined: e.g. if grounding fails, generative output is
  disabled and the deterministic template continues.

## What this architecture is protecting against

The pressure-to-response map, honestly labelled:

| Predictable pressure | Response | Status |
|---|---|---|
| Same customer through many doors | temporal provenance + human merge | BUILT |
| One mistyped digit splits a family | low phone weight in scoring | BUILT + tested |
| Provider creates order, response lost | UNKNOWN + reconcile, never blind retry | BUILT + tested |
| Duplicate webhook / replayed CSV | payload-hash dedupe, idempotent keys | BUILT |
| AI hallucination reaching a customer | grounding contract + human decision record | BUILT |
| Model outage | deterministic default path | BUILT |
| Partner reads another partner's pipeline | server-side allow-list projections | BUILT + tested |
| Partner schema drift | versioned contracts + quarantine | TARGET |
| Two concierges edit simultaneously | unique canonical index today; optimistic locking | PARTIAL |
| Traffic spike / batch CSV | queue + backpressure | TARGET |
| Institutional knowledge loss | ADRs, Build Ledger, executable scenarios | BUILT |
```
