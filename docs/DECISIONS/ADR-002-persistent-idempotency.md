# ADR-002 — Idempotency is persisted, not Redis-only

**Status:** Accepted · **Date:** 2026-07-23

## Context

The provider submission path must never act twice on one intent. The classic
pattern is a distributed lock in Redis: check whether this operation is in flight,
skip if so. It is fast and familiar.

But Utility Connect is a facilitator — their ToS states the customer contracts
directly with the provider. A duplicate submission is a real duplicate order at a
real utility, in a system Utility Connect does not control. The cost of getting
this wrong is not a retry; it is a customer enrolled twice.

## Decision

**Idempotency is guaranteed by persistent Postgres state, not by a cache.** A
unique index on `(organization_id, operation_key)` makes a second submission for
one intent structurally impossible. Redis may be used for short-lived locks and
rate limiting, where losing the lock is harmless.

## Options considered

1. **Redis lock only.** Fast, but a lock evaporates on eviction or restart, and
   takes the guarantee with it. Two requests racing across a restart both proceed.
2. **Persistent idempotency table + unique constraint (chosen).** The database
   refuses the duplicate regardless of application state, and the guarantee
   survives restart and cache eviction.
3. **Both, with Redis as the fast path.** Reasonable at scale, but for this proof
   the persistent guarantee is the one that must be demonstrably unbreakable, so
   it is the one that is built and tested.

## Consequences

- `provider_submissions` carries `UNIQUE (organization_id, operation_key)`. The
  second insert throws.
- Recovery from an ambiguous timeout is reconciliation, never resubmission
  (see ADR-003's sibling logic in `provider-submission.ts`).

**Enforced by:** `provider_submissions_operation_key_idx` ·
`verify-constraints.mjs` ("one provider submission per operation key") ·
`scenario.test.ts` Act 3 (blind retry blocked, provider left uncalled).

**Trade-off:** a database round-trip on the hot path instead of an in-memory
check. Accepted: correctness after a restart is worth more than microseconds.
