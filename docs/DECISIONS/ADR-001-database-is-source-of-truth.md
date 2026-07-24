# ADR-001 — The database is the source of truth

**Status:** Accepted · **Date:** 2026-07-23

## Context

Move Relay is a workflow system: a move progresses through intake, conflict,
canonical, in-service, completed. Workflow state has to live somewhere, and there
are three tempting places to put the authority — a state-machine library (XState)
in the app, the frontend, or the database.

The product's entire promise is that every consequential transition is visible,
attributable, and reversible. That promise is only as strong as the weakest place
state can change without a record.

## Decision

**The database is the single source of truth for workflow state.** Transitions are
enforced by service logic inside transactions, backed by constraints. XState may be
used to *visualise* state in the UI, but it is never the backend authority.

## Options considered

1. **XState as the workflow engine.** Clean modelling, good visualisation. But its
   state lives in a process; a crash mid-transition, a second instance, or a
   restart can diverge from what was persisted. The authority would be in memory.
2. **Frontend-driven state.** Fastest to build a demo. Catastrophic for a trust
   product — the client can assert any state.
3. **Database-authoritative (chosen).** State transitions are rows and constraint
   checks. Two instances, a restart, or a crash cannot produce an inconsistent
   authority, because the authority is the committed row.

## Consequences

- A partial unique index (`field_versions_one_canonical_idx`) permits exactly one
  canonical value per field per move. Two concurrent approvals cannot create two
  truths — the second insert is rejected by Postgres.
- Every state change and its audit event commit in the same transaction
  (`withTransaction`), so a state change without an explanation is not reachable.
- The UI is free to model state however it likes; it can never be wrong in a way
  that matters, because it is not the authority.

**Enforced by:** `db/schema.sql` constraints · `scenario.test.ts` Act 2 ·
`verify-constraints.mjs` (11 guarantees).

**Trade-off:** more logic lives in SQL and transactions than in a tidy app-layer
state machine. Accepted deliberately: correctness beats elegance here.
