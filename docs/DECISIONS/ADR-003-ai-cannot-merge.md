# ADR-003 — AI explains conflicts but never performs the merge

**Status:** Accepted · **Date:** 2026-07-23

## Context

When the same move arrives from several channels, a human — or a model — has to
decide which values are canonical. An LLM is genuinely good at reading two records
and proposing which is the same person and which value to keep. It is tempting to
let it do the merge and move on.

Identity resolution decides whose data is combined with whose. A model that is
right 97% of the time will, at scale, eventually merge two different families'
moves. There is no audit trail that makes that acceptable.

## Decision

**AI may explain a conflict in plain language. It may never perform the merge.**
Duplicate scoring and conflict detection are fully deterministic, with explicit
inspectable weights. A canonical value requires a named human actor.

## Options considered

1. **LLM decides the merge.** Best demo, worst failure mode — an unexplainable,
   occasionally catastrophic wrong merge.
2. **LLM proposes, human confirms, no enforcement.** Better, but nothing stops a
   future code path from writing a canonical value without a human.
3. **Deterministic detection + human approval enforced by the database (chosen).**
   The AI's role is explanation only; the merge is gated by a constraint.

## Consequences

- `assessDuplicate` and `detectConflicts` are pure, deterministic, and unit-tested,
  including the roommate case (same address, different people, must stay distinct)
  and the shared-surname case.
- Phone carries only 0.05 weight, because a single mistyped digit is the most
  common defect in hand-exported data and must not split one family into two moves.
- `canonical_requires_actor` is a CHECK constraint: a canonical value with no
  named selector cannot be inserted. "AI cannot merge" is enforced by the schema,
  not by policy.

**Enforced by:** `ingestion.ts` · `ingestion.test.ts` · `canonical_requires_actor`
CHECK · `verify-constraints.mjs`.

**Trade-off:** the deterministic scorer needs hand-tuned weights and cannot catch
every exotic duplicate a model might. Accepted: a missed merge is recoverable; a
wrong merge of two real families is not.
