# ADR-004 — RAG is postponed; v1 briefings are deterministic

**Status:** Accepted · **Date:** 2026-07-23

## Context

The concierge briefing is the obvious place for AI, and the job description asks
for RAG and vector databases. The reflex is to reach for them immediately: embed
the move data, retrieve, and have a model write the briefing.

But the v1 briefing summarises a single move's own structured rows. There is no
corpus to retrieve from yet, and every fact needed is already in the database with
its provenance. Adding RAG here would be technology for its own sake, and it would
introduce a step where a model could assert a fact no source supports.

## Decision

**v1 briefings are generated deterministically from structured database rows, with
no model in the loop.** Every claim traces to a specific `field_version`. RAG is
documented as a future step for when there is an approved corpus to ground against.

## Options considered

1. **RAG now, over the move's own data.** Retrieval adds nothing when the data is
   one small structured record, and it adds a hallucination surface.
2. **LLM summary of the record, no retrieval.** Still risks ungrounded claims and
   is not testable deterministically.
3. **Deterministic generation (chosen).** Grounded by construction, offline,
   fully unit-tested. A model seam exists for later, contractually limited to
   rephrasing claims it is handed, each of which must cite a source field id.

## Consequences

- `briefing.ts` builds claims from rows; `renderNarrative` (the LLM seam) throws,
  by design, until a grounded future version.
- `ai_runs` records each briefing as `grounded: true` with `human_decision` null
  until a human accepts, edits, or rejects it.
- Future RAG would retrieve approved provider policies, FAQs, and runbooks — a real
  corpus — and every retrieved claim would show its source or read "Unknown —
  specialist verification required."

**Enforced by:** `briefing.ts` · `briefing.test.ts` (every substantive claim cites
a source field id; generating a briefing never advances state).

**Trade-off:** the v1 briefing is templated, not fluent prose. Accepted: grounded
and testable beats fluent and unverifiable, and this is the role's own "use tech
only when justified" principle applied honestly.
