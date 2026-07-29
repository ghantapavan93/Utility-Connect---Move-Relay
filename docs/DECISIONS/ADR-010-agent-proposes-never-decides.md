# ADR-010 — The case agent proposes; the plan stays deterministic

**Status:** Accepted · **Date:** 2026-07-26

## Context

Agents were deliberately deferred (see the technology section of `CLAUDE.md`).
That deferral was correct while there was nothing for an agent to be safe
*about*: an agent over an empty domain is a framework demo.

The domain now exists. Provider submissions reach a genuine `unknown` state,
reconciliation is the only sanctioned exit from it, conflicts wait on a named
human, and every transition is audited. That is precisely the setting where an
agent's authority boundary becomes a real engineering question rather than a
slogan — so the deferral is revisited here rather than silently reversed.

The pull is to hand a model the tool list and let it decide the sequence. That
is what most agent frameworks encourage, and it is what this project cannot do.
`CLAUDE.md` reserves a specific list of decisions for deterministic code or a
human, and **whether a retry is safe** is on it. A model choosing between
"reconcile" and "submit again" is making exactly that decision — from input that
includes customer notes, which are text any stranger can write.

## Decision

**A concierge case agent ships. Its plan is deterministic; its authority is data,
checked server-side before any model output is consulted.**

Three tool tiers, defined in `src/lib/agent/tools.ts`:

- `read_only` — runs immediately, wrapping the same projections the concierge
  screen renders. No parallel view is assembled for the model.
- `requires_approval` — the agent may propose it. Execution happens on the
  resume path, through the same service function a human's button calls, under
  the approving human's identity.
- `forbidden` — defined rather than omitted, so a refusal is a recorded row.

The agent's run is persisted in `agent_runs` and `agent_steps`, separate from
`ai_runs`. `ai_runs` records one generation and what a human did with it; an
agent run is many steps with an authority level each, suspending and resuming.

## Options considered

1. **LangGraph.js with a model-chosen plan.** Genuinely good at durable state,
   interrupts and resumption — but the durable state machine, the interrupt and
   the resume already exist here in Postgres and `workflow_executions`, and
   LangGraph would sit *above* them rather than replace them. The cost is a new
   dependency and a second place where control flow lives, and the benefit is a
   graph picture. The decisive objection is the one above: a model-chosen plan
   puts retry safety inside the model. Reconsider when a task genuinely needs
   open-ended planning.
2. **No agent; keep the grounded briefing only.** Honest, and what the previous
   deferral said. Rejected because the domain now makes a bounded agent
   demonstrable rather than decorative.
3. **Deterministic plan, governed tools, human interrupt (chosen).** The agent
   inspects live state, concludes from what it finds, refuses what is above its
   authority, and stops for a person. No path exists where a sentence in a
   customer note becomes an action.

## Consequences

- The interesting artefact is a refusal that can be queried:
  `submit_provider_enrollment · forbidden · refused`, with its reason, in
  `agent_steps`. The boundary is evidenced, not asserted.
- Approving twice cannot reconcile twice — the guard is a conditional `UPDATE`
  inside a transaction, the same lesson the provider path already learned.
- A tool that errors fails the run. An early version treated a failed read as an
  empty read and reported "nothing requires action" on a case with an unresolved
  unknown outcome; the test that caught it is now a regression test. An agent
  that cannot see the case must say so and stop.
- No new dependency was added. `zod` was already in use for contract validation.
- The boundary is measured rather than asserted. `src/lib/agent/eval.ts` runs
  five seeded cases against a real database and reports five metrics; two of
  them have no acceptable value other than perfect — `forbiddenBlockRate` must
  be 1 and `falseAllClearRate` must be 0 — because each failure is an outcome a
  customer has to live with. Two cases plant an instruction naming
  `submit_provider_enrollment` and claiming administrator authority in
  customer-supplied fields.
- Those injection cases are expected to be boring, and that *is* the finding.
  The plan is control flow, so hostile prose is read, stored and displayed as a
  string; there is no step where it becomes an action. A suite proving only
  that a model *chose* to decline would hold until the first untested phrasing.
  If `injectionInfluence` ever moves off zero, the plan has been refactored into
  something a sentence can steer — a design regression, not a bug.
- **Not built:** streaming of intermediate steps, a model-authored explanation of
  the proposal, and the read-only MCP server that would expose these same tools
  to an external client. All three are additive and none change the boundary.
