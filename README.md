# Move Relay

**Verified handoff infrastructure for a home-services concierge platform.**
A proof-of-work built for Utility Connect: one move arrives through a partner
API, a CSV, and the customer's own form — no two agree — and the system turns
that into a single provenance-aware record that is visible, attributable,
reversible, and verifiable. AI accelerates the people operating it. AI never
becomes the source of truth.

> The centrepiece is a failure: a provider creates the order and the response is
> lost. The system enters `UNKNOWN`, refuses the blind retry, reconciles against
> the provider, and recovers the existing order. One order. Never two.

## Run it

```bash
npm install
npm run verify   # 11 schema guarantees + 175 tests — no Docker, no server needed
npm run dev      # http://localhost:3000
```

No external services required: the demo runs on an embedded Postgres (PGlite).
Point `DATABASE_URL` at a real Postgres and set `RELAY_DB=pg` for the server
path. Set `ANTHROPIC_API_KEY` and the concierge briefing narrative flips from
deterministic to a live model call behind the same guards — zero code changes.

## The surfaces

| Route | What it is |
|---|---|
| `/` | The redesigned marketing site — faithful to the real one, platform woven in |
| `/story` | **The Living Move** — the cinematic chapter scroll; its failure chapter drives the real API |
| `/demo` | The 10-step live workflow with the **⚿ Reveal system** engineering view |
| `/theater` | **Failure Theater** — six "break it" buttons that hit the real backend |
| `/views` | One record, three audiences — concierge / customer / partner projections |
| `/dashboard` | Operator console; every number is a live database count |
| `/architecture` · `/future` | The decisions and the vision |
| `/api/v1/health` · `/api/v1/slo` | Readiness probe · live-computed SLOs |

## What is proven, not claimed

Every consequential rule is enforced by a constraint or a test a reviewer can
run in one command:

- **A canonical value requires a named human.** `CHECK` constraint — AI cannot
  merge records, structurally.
- **Exactly one canonical value per field.** Partial unique index — two
  concurrent approvals cannot create two truths.
- **A blind retry is impossible.** Unique operation key, persisted — survives
  restart and cache eviction.
- **The audit log survives `UPDATE` and `DELETE`.** Rules, tested.
- **A crashed workflow resumes without re-running completed steps.** Durable
  execution on Postgres, side-effect counters proven.
- **Events are exactly-once per consumer.** Transactional outbox; a rolled-back
  transaction leaves no orphan event.
- **Cross-tenant access is denied by default.** Relationship-tuple authorization
  with the granting path returned on every allow.
- **Ungrounded AI output never displays.** Every model claim must cite source
  field ids; a prompt-injected "fact" has no citation and dies. PII is masked
  before input leaves the process. Model down → deterministic path serves.
- **Contract drift quarantines.** Versioned per-channel schemas; failures land
  with machine-readable reasons, never force-fed.
- **Consent resolves at send time.** Per-channel, per-purpose, versioned
  wording, deny by default, revocation is just a newer event.
- **Provenance is bitemporal.** "What did we believe on Tuesday?" and "which
  submissions acted on stale truth?" are queries, not archaeology.
- **The architecture is executable.** Fitness tests fail CI if an AI module
  writes canonical tables, a projection reads raw PII, or a domain module
  imports the UI.

## The documents

| | |
|---|---|
| [ARCHITECTURE](docs/ARCHITECTURE.md) | The system in three honesty tiers: BUILT / DESIGNED / TARGET |
| [EDGE_CASE_ATLAS](docs/EDGE_CASE_ATLAS.md) | The domain's failure catalogue, each row naming its test |
| [AI_BUILD_LEDGER](docs/AI_BUILD_LEDGER.md) | Nine real entries: what AI proposed, what was wrong, the fix, the test |
| [DECISIONS/](docs/DECISIONS/) | Seven ADRs, each naming its enforcing constraint |
| [BUSINESS_VALUE](docs/BUSINESS_VALUE.md) | Instrumentation, not invented metrics — every baseline stated unknown |
| [FUTURE_VISION](docs/FUTURE_VISION.md) | The Continuum — labelled BUILT / CONCEPT / HYPOTHESIS, never blurred |
| [DEMO_SCRIPT](docs/DEMO_SCRIPT.md) | 30-second, 2-minute, and 10-minute walkthroughs |
| [red-team-review](research/red-team-review.md) | The unsoftened self-critique |

## Honest limitations

- Provider integrations are **simulated** — faithfully, with a separate ledger,
  so reconciliation interrogates a system that does not share our state. The
  simulation is labelled everywhere.
- There is **no authentication layer**; authorization is proven at the function
  level, not behind a login.
- All data is synthetic. Public-site observations describe the marketing layer
  only and are never presented as claims about any internal system.
- Not affiliated with Utility Connect. A hypothesis-driven, additive layer built
  from public workflows.
