import { query, withTransaction } from "../db";
import { recordAudit } from "../audit";
import { reconcile } from "../provider-submission";
import { invokeTool, toolByName, type ToolInvocation } from "./tools";

/**
 * The concierge case agent.
 *
 * It answers one question — *what should happen next on this case?* — by
 * reading the verified state through tools, choosing the next safe action,
 * refusing the unsafe one, and stopping for a named human before anything
 * consequential happens.
 *
 * ## Why the plan is deterministic
 *
 * The obvious way to build this is to hand a model the tool list and let it
 * decide the sequence. That is not permitted here, and the reason is not
 * squeamishness about LLMs. `CLAUDE.md` reserves a specific list of decisions
 * for deterministic code or a human, and *whether a retry is safe* is on it.
 * A model choosing between "reconcile" and "submit again" is making exactly
 * that decision, and it would be making it from text that includes customer
 * notes — an input any stranger can write into.
 *
 * So the control flow below is ordinary code. The agent is real in the way
 * that matters: it inspects live system state through a governed tool
 * interface, reaches conclusions from what it finds rather than from a script,
 * refuses actions above its authority, and suspends for approval. What it does
 * not do is improvise its way around a safety boundary, because there is no
 * path through this function where a sentence in a customer note becomes an
 * action.
 *
 * A model still has a job — explaining the case in the concierge's language,
 * grounded in cited fields — and that already exists in `ai-gateway.ts`, with
 * citation-dropping and PII masking wrapped around it. This module deliberately
 * does not duplicate it.
 *
 * ## The shape of a run
 *
 *   get_move_record → get_provider_operation
 *      ↓ finds a submission in state 'unknown'
 *   get_audit_history                      (what has already been attempted?)
 *      ↓
 *   submit_provider_enrollment → REFUSED   (recorded, not merely skipped)
 *      ↓
 *   propose request_provider_reconciliation
 *      ↓
 *   [ awaiting_approval ] ── human approves ──→ reconcile() runs for real
 *
 * The refused step is the point of the whole thing. It is written to
 * `agent_steps` with `authority = 'forbidden'` and `outcome = 'refused'`, so
 * "the agent was stopped from creating a duplicate order" is a row a reviewer
 * can select, not a claim in a slide.
 */

export type AgentRunState =
  | "running"
  | "awaiting_approval"
  | "completed"
  | "rejected"
  | "failed";

export interface AgentStepRecord {
  seq: number;
  tool: string;
  authority: string;
  outcome: string;
  note: string | null;
  durationMs: number | null;
  /**
   * What the tool actually returned.
   *
   * Already persisted — `recordStep` has always written it — and until now it
   * was write-only, readable in psql and nowhere else. Returning it is what
   * lets a surface state the case in business language ("the partner said
   * August 14, the customer confirmed August 16") instead of listing tool
   * names, and derive that sentence from the row the agent stored rather than
   * from a second query that could disagree with it.
   *
   * `null` for a refused or failed step, which is the honest value: there was
   * no observation, and an empty object would read as "nothing was found".
   */
  observation: unknown;
}

export interface AgentRun {
  id: string;
  state: AgentRunState;
  goal: string;
  proposal: { tool: string; args: Record<string, unknown>; why: string } | null;
  refusal: { tool: string; reason: string } | null;
  summary: string;
  steps: AgentStepRecord[];
}

/** Persist one step. Sequence is assigned by the caller so ordering is explicit. */
async function recordStep(
  runId: string,
  seq: number,
  call: ToolInvocation,
  args: Record<string, unknown>,
): Promise<void> {
  await query(
    `INSERT INTO agent_steps (run_id, seq, tool, authority, arguments, outcome, observation, note, duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      runId,
      seq,
      call.tool,
      call.authority,
      JSON.stringify(args),
      call.outcome,
      /*
        Observations are stored so a reviewer can see what the agent actually
        saw. They are already the same projections the concierge screen renders,
        which have their own redaction — storing the model's paraphrase instead
        would make the run unfalsifiable.
      */
      call.observation === undefined ? null : JSON.stringify(call.observation ?? null),
      call.note ?? null,
      call.durationMs,
    ],
  );
}

/**
 * Run the agent over one move.
 *
 * Returns as soon as it needs a human. Nothing in this function writes domain
 * state — the only tables it touches are its own ledger.
 */
export async function runCaseAgent(input: {
  organizationId: string;
  moveId: string;
  model?: string;
  /**
   * Fired after each step is persisted, with exactly the record that was
   * pushed. This is what lets the HTTP layer stream the investigation as it
   * happens instead of replaying it afterwards — and the ordering guarantee
   * matters: the callback runs after the INSERT, so a client that saw the
   * event can always read the same row back. An observer of the run, never a
   * participant: nothing about planning or authority consults it, and a
   * throwing callback is the caller's bug, not a new agent failure mode.
   */
  onStep?: (step: AgentStepRecord) => void;
}): Promise<AgentRun> {
  const ctx = { organizationId: input.organizationId, moveId: input.moveId };
  const model = input.model ?? "deterministic";

  const run = (
    await query<{ id: string }>(
      `INSERT INTO agent_runs (organization_id, move_id, goal, model, state)
       VALUES ($1,$2,'next_safe_action',$3,'running') RETURNING id`,
      [input.organizationId, input.moveId, model],
    )
  )[0]!;

  const steps: AgentStepRecord[] = [];
  let seq = 0;

  const step = async (tool: string, args: Record<string, unknown> = {}) => {
    seq += 1;
    const call = await invokeTool(tool, args, ctx);
    await recordStep(run.id, seq, call, args);
    const record: AgentStepRecord = {
      seq,
      tool: call.tool,
      authority: call.authority,
      outcome: call.outcome,
      note: call.note ?? null,
      durationMs: call.durationMs,
      observation: call.outcome === "ok" ? (call.observation ?? null) : null,
    };
    steps.push(record);
    input.onStep?.(record);
    return call;
  };

  // ── Look at the case ────────────────────────────────────────────────
  const record = await step("get_move_record");
  const operations = await step("get_provider_operation");

  const finish = async (
    state: AgentRunState,
    summary: string,
    extra: {
      proposal?: { tool: string; args: Record<string, unknown>; why: string };
      refusal?: { tool: string; reason: string };
    } = {},
  ): Promise<AgentRun> => {
    await query(
      `UPDATE agent_runs
          SET state = $1, proposed_tool = $2, proposed_args = $3, proposal_why = $4,
              refused_tool = $5, refused_reason = $6, summary = $7,
              completed_at = CASE WHEN $1 IN ('completed','failed') THEN now() ELSE NULL END
        WHERE id = $8`,
      [
        state,
        extra.proposal?.tool ?? null,
        extra.proposal ? JSON.stringify(extra.proposal.args) : null,
        extra.proposal?.why ?? null,
        extra.refusal?.tool ?? null,
        extra.refusal?.reason ?? null,
        summary,
        run.id,
      ],
    );
    return {
      id: run.id,
      state,
      goal: "next_safe_action",
      proposal: extra.proposal ?? null,
      refusal: extra.refusal ?? null,
      summary,
      steps,
    };
  };

  /*
    A failed read is not an empty read.

    The first version of this treated a tool error as "no rows", so a typo in
    the provider query made the agent report "nothing requires action" on a
    case with an unresolved unknown outcome — the most dangerous sentence it
    could possibly say, delivered with total confidence. The bug was mine and
    the test caught it, which is exactly why the state-reading step is checked
    here rather than assumed.

    An agent that cannot see the case must say so and stop. Silence about a
    failure is worse than the failure.
  */
  for (const call of [record, operations]) {
    if (call.outcome !== "ok") {
      return finish(
        "failed",
        `Could not read the case: ${call.tool} returned ${call.outcome}. No recommendation is possible, and none is offered.`,
      );
    }
  }

  const submissions = Array.isArray(operations.observation)
    ? (operations.observation as Array<Record<string, unknown>>)
    : [];
  const unknown = submissions.find((s) => s.state === "unknown");

  // ── An outcome we do not know ───────────────────────────────────────
  if (unknown) {
    // What has already been attempted? A recommendation made without reading
    // the history is how the same mistake gets made twice.
    await step("get_audit_history");

    /*
      Consent, read before anything customer-facing is prepared.

      `get_consent_status` sat in the registry unused, which made it a tool the
      agent advertised and never exercised. It matters here specifically: this
      branch ends with a proposal to contact the provider about the customer's
      order, and a surface built on this run drafts a message to that customer.
      Reading the consent record is what lets the draft state its own basis
      instead of assuming one. The tool reports the record and never judges
      validity — that judgement stays on the forbidden list.
    */
    await step("get_consent_status");

    /*
      The refusal, executed rather than described.

      The agent genuinely calls the tool. The registry refuses it, and the
      refusal lands in `agent_steps`. Skipping the call and writing a note
      saying "we would not do this" would produce the same page and none of
      the proof — the interesting claim is that the boundary is enforced by
      the system, not honoured by the caller.
    */
    const refused = await step("submit_provider_enrollment", {
      submissionId: unknown.id,
    });

    const proposal = {
      tool: "request_provider_reconciliation",
      args: { submissionId: String(unknown.id), reason: "timeout_unknown_outcome" },
      why:
        `The ${String(unknown.service_type ?? "provider")} submission is in state 'unknown': the request was sent and the response was lost, ` +
        `so the order may already exist. Reconciliation asks the provider what is actually there. ` +
        `It never creates an order, which is why it is safe when resubmission is not.`,
    };

    return finish(
      "awaiting_approval",
      "One provider outcome is unknown. Reconciliation is proposed; resubmission was refused.",
      {
        proposal,
        refusal: {
          tool: refused.tool,
          reason: refused.note ?? toolByName(refused.tool)?.refusal ?? "Above the agent's authority.",
        },
      },
    );
  }

  // ── A conflict a human owns ─────────────────────────────────────────
  const view = (record.observation ?? {}) as { openConflicts?: string[] };
  if (view.openConflicts && view.openConflicts.length > 0) {
    await step("list_field_conflicts");
    /*
      The history, on this branch too. It was read only on the unknown-outcome
      path, which meant a conflict case reached its conclusion without knowing
      what had already been attempted — the exact omission the unknown branch's
      own comment warns about. A merge surfaced to a person should arrive with
      the events that led to it, and the depth view renders that trail.
    */
    await step("get_audit_history");
    // The competing values mean little without knowing what the customer was
    // told and agreed to, and a merge recommendation that ignores it is a
    // recommendation made with one eye shut.
    await step("get_consent_status");
    const refused = await step("merge_canonical_record", { fields: view.openConflicts });

    return finish(
      "completed",
      `${view.openConflicts.length} field(s) still disagree. A named person selects the surviving value; the agent can only surface the disagreement.`,
      {
        refusal: {
          tool: refused.tool,
          reason: refused.note ?? "Selecting the surviving value is a human decision.",
        },
      },
    );
  }

  return finish("completed", "Nothing requires action. No unknown provider outcomes, no open conflicts.");
}

/**
 * Approve or reject a proposal, and — if approved — actually do it.
 *
 * The approved action runs through `reconcile()`, the same service function the
 * concierge's own button calls, inside its own transaction. The agent supplied
 * the arguments and nothing else. A rejection is recorded just as durably: a
 * human declining the machine's suggestion is a fact worth keeping.
 */
export async function decideAgentProposal(input: {
  runId: string;
  actor: string;
  decision: "approved" | "rejected";
  correlationId: string;
  /**
   * Ask the provider what order exists.
   *
   * `requestKey` is the key we gave the provider when we sent the request, read
   * back off the stored request payload — it is what their ledger is indexed
   * by. `operationKey` is *ours*, and the provider has never seen it. Looking
   * up by the wrong one returns "no order exists", which is the single most
   * expensive wrong answer this system can produce: it is the sentence that
   * makes resubmission look safe.
   */
  lookupOrder: (submission: {
    id: string;
    operationKey: string;
    requestKey: string | null;
  }) => Promise<{ orderId: string } | null>;
}): Promise<{ state: AgentRunState; outcome?: string; providerOrderId?: string | null }> {
  const rows = await query<{
    id: string;
    organization_id: string;
    move_id: string;
    state: string;
    proposed_tool: string | null;
    proposed_args: Record<string, unknown> | null;
  }>(
    `SELECT id, organization_id, move_id, state, proposed_tool, proposed_args
       FROM agent_runs WHERE id = $1`,
    [input.runId],
  );
  const run = rows[0];
  if (!run) throw new Error(`No agent run ${input.runId}`);

  /*
    Approving twice must not reconcile twice. The guard is a state check inside
    a transaction rather than a flag read beforehand — the same lesson the
    provider path already learned about idempotency living in the database.
  */
  if (run.state !== "awaiting_approval") {
    throw new Error(`Run ${input.runId} is ${run.state}, not awaiting approval`);
  }

  if (input.decision === "rejected") {
    await query(
      `UPDATE agent_runs SET state = 'rejected', human_actor = $1, human_decision = 'rejected',
              decided_at = now(), completed_at = now()
        WHERE id = $2 AND state = 'awaiting_approval'`,
      [input.actor, input.runId],
    );
    await withTransaction((client) =>
      recordAudit(client, {
        organizationId: run.organization_id,
        moveId: run.move_id,
        eventType: "agent.proposal.rejected",
        actor: input.actor,
        correlationId: input.correlationId,
        detail: { runId: input.runId, tool: run.proposed_tool },
      }),
    );
    return { state: "rejected" };
  }

  const claimed = await withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE agent_runs SET state = 'running', human_actor = $1, human_decision = 'approved', decided_at = now()
        WHERE id = $2 AND state = 'awaiting_approval'
      RETURNING id`,
      [input.actor, input.runId],
    );
    return result.rows.length > 0;
  });
  if (!claimed) throw new Error(`Run ${input.runId} was already decided`);

  const submissionId = String(run.proposed_args?.submissionId ?? "");
  const submission = (
    await query<{ id: string; operation_key: string; provider_request_key: string | null }>(
      `SELECT id, operation_key, provider_request_key FROM provider_submissions WHERE id = $1`,
      [submissionId],
    )
  )[0];
  if (!submission) {
    await query(`UPDATE agent_runs SET state = 'failed', completed_at = now() WHERE id = $1`, [
      input.runId,
    ]);
    throw new Error(`Proposed submission ${submissionId} no longer exists`);
  }

  const outcome = await reconcile(
    {
      organizationId: run.organization_id,
      moveId: run.move_id,
      submissionId: submission.id,
      correlationId: input.correlationId,
    },
    () =>
      input.lookupOrder({
        id: submission.id,
        operationKey: submission.operation_key,
        // What we actually sent the provider. Null only for rows written before
        // the column existed; the caller decides what that means rather than
        // having a fallback silently invented here.
        requestKey: submission.provider_request_key,
      }),
  );

  await query(
    `UPDATE agent_runs SET state = 'completed', completed_at = now() WHERE id = $1`,
    [input.runId],
  );
  await withTransaction((client) =>
    recordAudit(client, {
      organizationId: run.organization_id,
      moveId: run.move_id,
      eventType: "agent.proposal.approved",
      actor: input.actor,
      correlationId: input.correlationId,
      detail: { runId: input.runId, tool: run.proposed_tool, outcome: outcome.outcome },
    }),
  );

  return {
    state: "completed",
    outcome: outcome.outcome,
    providerOrderId: outcome.providerOrderId,
  };
}

/** Read a run back, steps included, for the inspector and for tests. */
export async function getAgentRun(runId: string): Promise<AgentRun | null> {
  const rows = await query<{
    id: string;
    state: AgentRunState;
    goal: string;
    proposed_tool: string | null;
    proposed_args: Record<string, unknown> | null;
    proposal_why: string | null;
    refused_tool: string | null;
    refused_reason: string | null;
    summary: string | null;
  }>(
    `SELECT id, state, goal, proposed_tool, proposed_args, proposal_why,
            refused_tool, refused_reason, summary
       FROM agent_runs WHERE id = $1`,
    [runId],
  );
  const run = rows[0];
  if (!run) return null;

  const steps = await query<{
    seq: number;
    tool: string;
    authority: string;
    outcome: string;
    note: string | null;
    duration_ms: number | null;
    observation: unknown;
  }>(
    `SELECT seq, tool, authority, outcome, note, duration_ms, observation
       FROM agent_steps WHERE run_id = $1 ORDER BY seq`,
    [runId],
  );

  return {
    id: run.id,
    state: run.state,
    goal: run.goal,
    proposal: run.proposed_tool
      ? { tool: run.proposed_tool, args: run.proposed_args ?? {}, why: run.proposal_why ?? "" }
      : null,
    refusal: run.refused_tool
      ? { tool: run.refused_tool, reason: run.refused_reason ?? "" }
      : null,
    summary: run.summary ?? "",
    steps: steps.map((s) => ({
      seq: s.seq,
      tool: s.tool,
      authority: s.authority,
      outcome: s.outcome,
      note: s.note,
      durationMs: s.duration_ms,
      observation: s.observation ?? null,
    })),
  };
}
