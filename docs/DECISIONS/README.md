# Architecture Decision Records

Each ADR records one decision that carried real risk: the context, the options,
the choice, and the consequences. They are referenced by number from the code and
the docs. Where a decision is enforced by a constraint or a test, the ADR names it.

| # | Decision | Status |
|---|---|---|
| [001](ADR-001-database-is-source-of-truth.md) | The database is the source of truth, not XState or the frontend | Accepted |
| [002](ADR-002-persistent-idempotency.md) | Idempotency is persisted in Postgres, not Redis-only | Accepted |
| [003](ADR-003-ai-cannot-merge.md) | AI explains conflicts but never performs the merge | Accepted |
| [004](ADR-004-rag-postponed.md) | RAG is postponed; v1 briefings are deterministic | Accepted |
| [005](ADR-005-one-signature-3d.md) | Exactly one signature 3D experience, rendering real state | Accepted — built |
| [006](ADR-006-providers-simulated.md) | Provider integrations are simulated, faithfully | Accepted |
| [007](ADR-007-public-site-not-internal-evidence.md) | The public marketing site is not evidence of internal quality | Accepted |
