import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { demoConstants } from "@/lib/demo-orchestrator";
import { recentSpans } from "@/lib/tracing";

/**
 * GET /api/v1/engineering
 *
 * The Engineering View data source: the system's internals for the demo move,
 * exactly as stored. Raw payloads, provenance rows, fulfilment and idempotency
 * state, AI runs with their metrics, the audit trail, workflow executions, and
 * queue depths. This is what turns the demo from "a polished flow" into "an
 * inspectable system" — the reviewer sees the rows, not a summary of them.
 */
export async function GET() {
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0];
  if (!org) return NextResponse.json({ exists: false });

  const move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, demoConstants.MOVE_REF],
    )
  )[0];

  const [rawSubmissions, fieldVersions, fulfilment, reconciliation, aiRuns, audit, workflows, outboxDepth, quarantineDepth] =
    await Promise.all([
      query(
        `SELECT id, channel, payload, payload_hash, correlation_id, received_at
           FROM raw_submissions WHERE organization_id = $1 ORDER BY received_at`,
        [org.id],
      ),
      move
        ? query(
            `SELECT field_path, value, channel, verification, confidence,
                    is_canonical, selected_by, selection_reason, recorded_at
               FROM field_versions WHERE move_id = $1 ORDER BY field_path, recorded_at`,
            [move.id],
          )
        : Promise.resolve([]),
      query(
        `SELECT ps.operation_key, ps.request_fingerprint, ps.state,
                ps.provider_order_id, ps.error_category, ps.attempt,
                ps.started_at, ps.settled_at
           FROM provider_submissions ps WHERE ps.organization_id = $1`,
        [org.id],
      ),
      query(
        `SELECT reason, outcome, found_order_id, attempts, created_at, completed_at
           FROM reconciliation_jobs WHERE organization_id = $1`,
        [org.id],
      ),
      query(
        `SELECT purpose, model, prompt_version, grounded, fallback, metrics,
                human_decision, created_at
           FROM ai_runs WHERE organization_id = $1 ORDER BY created_at DESC LIMIT 10`,
        [org.id],
      ),
      move
        ? query(
            `SELECT event_type, actor, correlation_id, state_before, state_after,
                    detail, occurred_at
               FROM audit_events WHERE move_id = $1 ORDER BY occurred_at, id`,
            [move.id],
          )
        : Promise.resolve([]),
      query(
        `SELECT e.workflow_type, e.state, e.current_step, e.waiting_for,
                (SELECT json_agg(json_build_object('step', s.step_name, 'status', s.status)
                        ORDER BY s.step_index)
                   FROM workflow_steps s WHERE s.execution_id = e.id) AS steps
           FROM workflow_executions e ORDER BY e.created_at DESC LIMIT 5`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbox_events e
          LEFT JOIN outbox_consumers c ON c.event_id = e.id AND c.consumer = 'projector'
         WHERE c.event_id IS NULL`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM quarantined_submissions WHERE NOT resolved`,
      ),
    ]);

  // Traces, at last. This route has claimed to show where a request spent its
  // time since it was written, while the observability module logged to a
  // console nobody could query and persisted nothing. Spans are now rows.
  const spans = await recentSpans(40);

  return NextResponse.json({
    exists: true,
    moveId: move?.id ?? null,
    spans,
    rawSubmissions,
    fieldVersions,
    fulfilment,
    reconciliation,
    aiRuns,
    audit,
    workflows,
    queues: {
      outboxBacklog: outboxDepth[0]?.n ?? 0,
      quarantineBacklog: quarantineDepth[0]?.n ?? 0,
    },
  });
}
