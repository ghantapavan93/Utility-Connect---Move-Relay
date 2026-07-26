import { query } from "./db";
import { setSpanWriter } from "./observability";

/**
 * Wires spans to the database.
 *
 * This is a separate module from `observability.ts` on purpose. That one has to
 * keep working when the database is the thing that has failed, so it holds no
 * database import and takes its writer by injection. This file is the seam
 * where the two meet.
 *
 * Writes are fire-and-forget. A span is a record of something that already
 * happened; making a caller wait for it — or worse, fail because of it — would
 * mean instrumenting a path made that path slower and less reliable, which is
 * how observability gets stripped out again six months later.
 */

/**
 * Installs the database writer.
 *
 * Deliberately not guarded by an `installed` flag. Assigning the same writer
 * twice is harmless, and the guard actively hurt: a test that swapped in a
 * failing writer to prove telemetry cannot break a request had no way to put
 * the real one back, so the sabotage leaked into every later test in the file.
 * Idempotent-by-nature beats idempotent-by-flag.
 */
export function installTracing(): void {
  setSpanWriter((row) => {
    void query(
      `INSERT INTO trace_spans
         (trace_id, span_id, parent_span_id, correlation_id, organization_id,
          name, outcome, duration_ms, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        row.traceId,
        row.spanId,
        row.parentSpanId ?? null,
        row.correlationId ?? null,
        row.organizationId ?? null,
        row.name,
        row.outcome,
        row.durationMs,
        JSON.stringify(row.attributes ?? {}),
      ],
      // The catch is the point: a failed span insert must never surface to the
      // request that produced it.
    ).catch(() => {});
  });
}

/** Recent spans, newest first — what the Engineering View renders. */
export async function recentSpans(limit = 40) {
  return query<{
    trace_id: string;
    span_id: string;
    parent_span_id: string | null;
    name: string;
    outcome: string;
    duration_ms: number;
    attributes: Record<string, unknown>;
    started_at: string;
  }>(
    `SELECT trace_id, span_id, parent_span_id, name, outcome, duration_ms, attributes, started_at
       FROM trace_spans
      ORDER BY started_at DESC
      LIMIT $1`,
    [limit],
  );
}

/** One trace, oldest first — a single request's shape. */
export async function traceById(traceId: string) {
  return query<{
    span_id: string;
    parent_span_id: string | null;
    name: string;
    outcome: string;
    duration_ms: number;
    attributes: Record<string, unknown>;
    started_at: string;
  }>(
    `SELECT span_id, parent_span_id, name, outcome, duration_ms, attributes, started_at
       FROM trace_spans WHERE trace_id = $1 ORDER BY started_at ASC`,
    [traceId],
  );
}
