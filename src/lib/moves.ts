import { query, withTransaction } from "./db";
import { newTrace, traced } from "./observability";
import { installTracing } from "./tracing";
import { recordAudit } from "./audit";
import { publish } from "./outbox";
import { runProjector } from "./projector";
import { detectConflicts, type FieldCandidate, type Channel } from "./ingestion";

/**
 * The generalized move workspace — list, inspect, and resolve ANY move.
 *
 * The demo resolves one scripted move; intake creates arbitrary ones. This
 * module is the missing end of that arc: the same human-approval merge,
 * generalized, with the guarantees intact and one added:
 *
 *   - A canonical value still requires a named human (DB constraint).
 *   - The merge is OPTIMISTICALLY LOCKED: the caller names the move version
 *     they read, and a stale merge is rejected rather than silently stacking
 *     on top of someone else's decision. Two concierges, one record, no lost
 *     updates — now enforced at the API boundary, not only in a test.
 *   - The canonical write, the audit event, and the domain event commit in one
 *     transaction; the projector then speaks to the customer in their language.
 */

export interface MoveSummary {
  id: string;
  reference: string;
  state: string;
  version: number;
  openConflicts: number;
  sources: number;
  createdAt: string;
}

export async function listMoves(organizationId: string): Promise<MoveSummary[]> {
  return query<MoveSummary>(
    `SELECT m.id, m.reference, m.state, m.version, m.created_at AS "createdAt",
            (SELECT count(DISTINCT fv.channel)::int FROM field_versions fv
              WHERE fv.move_id = m.id) AS sources,
            (SELECT count(*)::int FROM (
               SELECT fv.field_path FROM field_versions fv
                WHERE fv.move_id = m.id AND NOT fv.is_canonical
                GROUP BY fv.field_path HAVING count(DISTINCT fv.value) > 1
             ) c
             WHERE c.field_path NOT IN (
               SELECT DISTINCT field_path FROM field_versions
                WHERE move_id = m.id AND is_canonical
             )) AS "openConflicts"
       FROM moves m
      WHERE m.organization_id = $1
      ORDER BY m.created_at DESC`,
    [organizationId],
  );
}

export interface MoveConflicts {
  move: { id: string; reference: string; state: string; version: number };
  conflicts: ReturnType<typeof detectConflicts>;
}

export async function conflictsFor(moveId: string): Promise<MoveConflicts | null> {
  const move = (
    await query<{ id: string; reference: string; state: string; version: number }>(
      `SELECT id, reference, state, version FROM moves WHERE id = $1`,
      [moveId],
    )
  )[0];
  if (!move) return null;

  const rows = await query<{
    field_path: string;
    value: unknown;
    channel: string;
    partner_id: string | null;
    verification: string;
    confidence: string;
    recorded_at: string;
    raw_submission_id: string | null;
  }>(
    `SELECT field_path, value, channel, partner_id, verification, confidence,
            recorded_at, raw_submission_id
       FROM field_versions
      WHERE move_id = $1 AND NOT is_canonical
      ORDER BY field_path, recorded_at`,
    [moveId],
  );

  const resolved = await query<{ field_path: string }>(
    `SELECT DISTINCT field_path FROM field_versions WHERE move_id = $1 AND is_canonical`,
    [moveId],
  );
  const done = new Set(resolved.map((r) => r.field_path));

  const candidates: FieldCandidate[] = rows
    .filter((r) => !done.has(r.field_path))
    .map((r) => ({
      fieldPath: r.field_path,
      value: r.value,
      channel: r.channel as Channel,
      partnerId: r.partner_id,
      rawSubmissionId: r.raw_submission_id ?? "",
      verification: r.verification as never,
      confidence: Number(r.confidence),
      recordedAt: new Date(r.recorded_at).toISOString(),
    }));

  return { move, conflicts: detectConflicts(candidates) };
}

export class StaleMergeError extends Error {
  constructor(readonly currentVersion: number) {
    super("move was modified since it was read; re-read and merge again");
  }
}

export interface MergeDecision {
  fieldPath: string;
  value: unknown;
  reason: string;
}

/**
 * Apply a human's merge to any move, optimistically locked on the version the
 * human read. Everything commits together or not at all.
 */
type MergeInput = {
  organizationId: string;
  moveId: string;
  expectedVersion: number;
  actor: string;
  decisions: MergeDecision[];
  correlationId?: string;
};

/**
 * Instrumented entry point.
 *
 * The one step in the whole pipeline a human performs, so the span carries the
 * actor. When someone later asks who resolved a conflicting move date and when,
 * the audit trail answers it — and the trace answers how long they took and
 * whether the optimistic lock rejected an earlier attempt.
 */
export async function approveMergeFor(
  input: MergeInput,
): Promise<{ newVersion: number; resolved: string[] }> {
  installTracing();
  return traced(
    "merge.approve",
    newTrace(input.correlationId),
    {
      organizationId: input.organizationId,
      moveId: input.moveId,
      actor: input.actor,
      decisions: input.decisions.length,
    },
    () => approveMergeForImpl(input),
  );
}

async function approveMergeForImpl(
  input: MergeInput,
): Promise<{ newVersion: number; resolved: string[] }> {
  if (!input.actor.trim()) throw new Error("a merge requires a named human actor");
  if (input.decisions.length === 0) throw new Error("no decisions supplied");

  const result = await withTransaction(async (c) => {
    // The optimistic gate: zero rows means someone merged after our read.
    const bump = await c.query<{ version: number }>(
      `UPDATE moves SET state = 'canonical', version = version + 1, updated_at = now()
        WHERE id = $1 AND version = $2
        RETURNING version`,
      [input.moveId, input.expectedVersion],
    );
    if (!bump.rows[0]) {
      const current = await c.query<{ version: number }>(
        `SELECT version FROM moves WHERE id = $1`,
        [input.moveId],
      );
      throw new StaleMergeError(current.rows[0]?.version ?? -1);
    }

    for (const d of input.decisions) {
      await c.query(
        `UPDATE field_versions SET is_canonical = FALSE
          WHERE move_id = $1 AND field_path = $2 AND is_canonical`,
        [input.moveId, d.fieldPath],
      );
      await c.query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel,
            verification, confidence, is_canonical, selected_by, selection_reason)
         VALUES ($1,$2,$3,$4,'concierge_manual','human_approved',1.00,TRUE,$5,$6)`,
        [input.organizationId, input.moveId, d.fieldPath, JSON.stringify(d.value), input.actor, d.reason],
      );
    }

    await recordAudit(c, {
      organizationId: input.organizationId,
      moveId: input.moveId,
      eventType: "move.canonical.approved",
      actor: input.actor,
      correlationId: input.correlationId ?? null,
      stateBefore: { version: input.expectedVersion },
      stateAfter: { state: "canonical", version: bump.rows[0].version },
      detail: { fieldsResolved: input.decisions.map((d) => d.fieldPath) },
    });
    await publish(c, {
      organizationId: input.organizationId,
      eventType: "move.canonical.approved",
      aggregateId: input.moveId,
      payload: { moveId: input.moveId },
    });

    return { newVersion: bump.rows[0].version, resolved: input.decisions.map((d) => d.fieldPath) };
  });

  await runProjector();
  return result;
}
