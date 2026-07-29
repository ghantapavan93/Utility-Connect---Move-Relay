import { query } from "./db";
import { setSpanWriter, log } from "./observability";

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
 * Writes that have been started and not yet settled.
 *
 * Tracked so `flushTracing` has something to wait for. Kept as a Set so a
 * settled write removes itself in O(1) and the collection cannot grow without
 * bound on a long-running process.
 */
const pending = new Set<Promise<unknown>>();

/** Failed span writes since process start. Never resets; monotonic by design. */
let failures = 0;
let lastFailure: string | null = null;

/**
 * How tracing is doing, for anyone who wants to look.
 *
 * The previous `.catch(() => {})` was correct about the *policy* — telemetry
 * must never fail the request it measures — and wrong about the consequence:
 * a span write that failed left no trace anywhere, including in the count of
 * things that failed. During this work a probe silently persisted nothing and
 * reported success, which is exactly the failure mode a swallowed error buys.
 */
export function tracingHealth(): { pending: number; failures: number; lastFailure: string | null } {
  return { pending: pending.size, failures, lastFailure };
}

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
    const write = query(
      `INSERT INTO trace_spans
         (trace_id, span_id, parent_span_id, correlation_id, organization_id,
          name, outcome, duration_ms, started_at, finished_at, attributes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.traceId,
        row.spanId,
        row.parentSpanId ?? null,
        row.correlationId ?? null,
        row.organizationId ?? null,
        row.name,
        row.outcome,
        row.durationMs,
        // The real times, not the insertion time. See the schema comment.
        row.startedAt,
        row.finishedAt,
        JSON.stringify(row.attributes ?? {}),
      ],
    )
      .catch((err: unknown) => {
        /*
          Still swallowed as far as the caller is concerned — the domain
          operation must not fail because its telemetry did — but no longer
          invisible. One structured line and a counter is the whole budget:
          anything that retries or buffers turns telemetry into the durable
          queue this deliberately is not.
        */
        failures += 1;
        lastFailure = err instanceof Error ? err.message : String(err);
        log("warn", {
          event: "span.write.failed",
          span_name: row.name,
          error: lastFailure,
          failures_total: failures,
        });
      })
      .finally(() => {
        pending.delete(write);
      });

    pending.add(write);
  });
}

/**
 * Wait for in-flight span writes, up to `timeoutMs`.
 *
 * **Trace persistence is best-effort and non-authoritative.** A graceful flush
 * attempts to persist pending spans; abrupt process termination may lose
 * in-flight telemetry, and that is an accepted trade rather than an oversight.
 *
 * Deliberately not called from request paths. Awaiting a span write on the way
 * out of a request would make instrumenting a path slow it down and couple its
 * latency to the telemetry table — the reason observability gets removed again
 * six months later. Its uses are tests, which need determinism, and any real
 * controlled-shutdown path that already exists.
 *
 * The timeout is what keeps flush from becoming a hang. A database that has
 * stopped answering must not be able to hold a shutdown open indefinitely, so
 * the wait is bounded and the return value says whether everything landed.
 */
export async function flushTracing({ timeoutMs = 2000 }: { timeoutMs?: number } = {}): Promise<{
  flushed: boolean;
  stillPending: number;
}> {
  if (pending.size === 0) return { flushed: true, stillPending: 0 };

  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const outcome = await Promise.race([
      Promise.allSettled([...pending]).then(() => "settled" as const),
      expired,
    ]);
    return { flushed: outcome === "settled", stillPending: pending.size };
  } finally {
    if (timer) clearTimeout(timer);
  }
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
    finished_at: string;
    created_at: string;
  }>(
    `SELECT trace_id, span_id, parent_span_id, name, outcome, duration_ms, attributes,
            started_at, finished_at, created_at
       FROM trace_spans
      ORDER BY started_at DESC, id DESC
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
    finished_at: string;
    created_at: string;
  }>(
    `SELECT span_id, parent_span_id, name, outcome, duration_ms, attributes,
            started_at, finished_at, created_at
       FROM trace_spans WHERE trace_id = $1 ORDER BY started_at ASC, id ASC`,
    [traceId],
  );
}
