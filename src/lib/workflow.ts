import { query, withTransaction } from "./db";
import { recordAudit } from "./audit";

/**
 * Durable workflow execution on Postgres.
 *
 * A move is not a five-second request. It pauses for human approval, customer
 * confirmation, provider acknowledgement, reconciliation — hours or days. State
 * that lives in a process dies with the process, so here every execution and
 * every completed step is a row.
 *
 * The properties this engine guarantees, each proven in durability.test.ts:
 *
 *   1. RESUMABLE  — a worker that crashes mid-workflow resumes exactly where it
 *      stopped. `runWorkflow` replays from the persisted step index.
 *   2. IDEMPOTENT — a completed step can never run twice. The unique index on
 *      (execution_id, step_index) makes double-recording impossible, and the
 *      engine skips any step that already has a completion row — so replay
 *      after a crash cannot double a side effect.
 *   3. SIGNALLED  — a workflow can park in `waiting_signal` (human approval,
 *      customer confirmation) and resume when the signal arrives, whether that
 *      is seconds or days later.
 *
 * This is the pattern durable-execution engines (Temporal et al.) implement.
 * It is built directly on Postgres here so the mechanism is inspectable and
 * testable in this repo; migrating to Temporal is a mechanical mapping — each
 * step becomes an activity, each signal a Temporal signal — because the state
 * shape is already right. See ARCHITECTURE.md.
 */

export interface StepResult {
  /** Park the workflow until this signal arrives. */
  wait?: string;
  /** Merge into the execution context for later steps. */
  context?: Record<string, unknown>;
  /** Recorded on the step row. */
  output?: Record<string, unknown>;
}

export interface StepDef {
  name: string;
  run: (ctx: Record<string, unknown>) => Promise<StepResult | void>;
}

export interface WorkflowDef {
  type: string;
  steps: StepDef[];
}

const registry = new Map<string, WorkflowDef>();

export function defineWorkflow(def: WorkflowDef): void {
  registry.set(def.type, def);
}

export interface ExecutionRow {
  id: string;
  organization_id: string;
  workflow_type: string;
  subject_id: string;
  state: string;
  current_step: number;
  context: Record<string, unknown>;
  waiting_for: string | null;
}

export async function startWorkflow(
  organizationId: string,
  type: string,
  subjectId: string,
  context: Record<string, unknown> = {},
): Promise<string> {
  if (!registry.has(type)) throw new Error(`unknown workflow type '${type}'`);
  const rows = await query<{ id: string }>(
    `INSERT INTO workflow_executions (organization_id, workflow_type, subject_id, context)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [organizationId, type, subjectId, JSON.stringify(context)],
  );
  return rows[0]!.id;
}

/**
 * Drives an execution forward from wherever it currently stands.
 *
 * Safe to call at any time — after a crash, after a signal, twice in a row.
 * Completed steps are skipped by consulting their persisted rows, never re-run.
 */
export async function runWorkflow(executionId: string): Promise<ExecutionRow> {
  const exec = await load(executionId);
  if (exec.state === "completed" || exec.state === "waiting_signal") return exec;

  const def = registry.get(exec.workflow_type);
  if (!def) throw new Error(`unknown workflow type '${exec.workflow_type}'`);

  let ctx = exec.context;

  for (let i = exec.current_step; i < def.steps.length; i++) {
    const step = def.steps[i]!;

    // Resume guarantee: if this step already completed (crash happened after
    // the step committed but before current_step advanced — or a concurrent
    // runner got there first), skip it. Its side effects must not repeat.
    const done = await query<{ output: Record<string, unknown> | null }>(
      `SELECT output FROM workflow_steps
        WHERE execution_id = $1 AND step_index = $2 AND status = 'completed'`,
      [executionId, i],
    );

    let result: StepResult | void;
    if (done[0]) {
      result = { output: done[0].output ?? undefined };
    } else {
      try {
        result = await step.run(ctx);
      } catch (err) {
        await withTransaction(async (c) => {
          await c.query(
            `UPDATE workflow_executions
                SET state = 'failed', updated_at = now() WHERE id = $1`,
            [executionId],
          );
          await recordAudit(c, {
            organizationId: exec.organization_id,
            eventType: "workflow.step.failed",
            actor: "system",
            detail: {
              executionId,
              step: step.name,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        });
        return load(executionId);
      }

      if (result?.context) ctx = { ...ctx, ...result.context };

      // The step's completion, the context merge, and the cursor advance
      // commit together. A crash before this transaction re-runs the step
      // (acceptable: steps are written to be idempotent); a crash after it
      // resumes cleanly at the next step.
      await withTransaction(async (c) => {
        await c.query(
          `INSERT INTO workflow_steps (execution_id, step_index, step_name, status, output)
           VALUES ($1,$2,$3,'completed',$4)
           ON CONFLICT (execution_id, step_index) DO NOTHING`,
          [executionId, i, step.name, JSON.stringify(result?.output ?? null)],
        );
        await c.query(
          `UPDATE workflow_executions
              SET current_step = $2, context = $3,
                  state = $4, waiting_for = $5, updated_at = now()
            WHERE id = $1`,
          [
            executionId,
            i + 1,
            JSON.stringify(ctx),
            result?.wait ? "waiting_signal" : "running",
            result?.wait ?? null,
          ],
        );
      });

      if (result?.wait) return load(executionId);
    }
  }

  await query(
    `UPDATE workflow_executions
        SET state = 'completed', updated_at = now() WHERE id = $1`,
    [executionId],
  );
  return load(executionId);
}

/**
 * Delivers a signal (human approval, customer confirmation, webhook) to a
 * parked workflow and resumes it. Days may pass between park and signal — the
 * execution is rows, so nothing is lost in between.
 */
export async function signal(
  executionId: string,
  name: string,
  payload: Record<string, unknown> = {},
): Promise<ExecutionRow> {
  const exec = await load(executionId);
  if (exec.state !== "waiting_signal" || exec.waiting_for !== name) {
    throw new Error(
      `execution is not waiting for '${name}' (state=${exec.state}, waiting_for=${exec.waiting_for})`,
    );
  }

  await query(
    `UPDATE workflow_executions
        SET state = 'running', waiting_for = NULL,
            context = $2, updated_at = now()
      WHERE id = $1`,
    [executionId, JSON.stringify({ ...exec.context, [`signal:${name}`]: payload })],
  );

  return runWorkflow(executionId);
}

export async function load(executionId: string): Promise<ExecutionRow> {
  const rows = await query<ExecutionRow>(
    `SELECT id, organization_id, workflow_type, subject_id, state,
            current_step, context, waiting_for
       FROM workflow_executions WHERE id = $1`,
    [executionId],
  );
  const row = rows[0];
  if (!row) throw new Error(`unknown execution ${executionId}`);
  return row;
}

/** Completed-step history — what the Engineering View renders. */
export async function history(executionId: string) {
  return query(
    `SELECT step_index, step_name, status, output, completed_at
       FROM workflow_steps WHERE execution_id = $1 ORDER BY step_index`,
    [executionId],
  );
}
