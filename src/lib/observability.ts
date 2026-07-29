import { createHash, randomUUID } from "node:crypto";

/**
 * Observability primitives — the thin, honest version.
 *
 * This is not OpenTelemetry wired to Tempo and Grafana; standing that up
 * verifiably in this environment would be theatre. What it IS: real correlation
 * and causation ids, structured JSON logs with PII kept out by construction, and
 * span timing — the concepts that matter, implemented so every request can be
 * followed end to end and shown in the Engineering View.
 *
 * The upgrade path to OpenTelemetry is a drop-in: `startSpan` already carries the
 * trace/span/parent shape OTel uses, so exporting to a collector later is an
 * adapter, not a rewrite. That is the point — the seams are correct now.
 */

export interface TraceContext {
  traceId: string;
  /**
   * The span this context sits inside, or `null` at the root of a trace.
   *
   * It used to be a freshly minted id that no span ever wrote. Every first
   * application span therefore recorded `parent_span_id` pointing at a row that
   * did not exist — one dangling edge per trace, in a graph whose only job is
   * to be walkable. `null` says the true thing: nothing came before this.
   */
  spanId: string | null;
  parentSpanId?: string;
  correlationId: string;
}

export function newTrace(correlationId?: string): TraceContext {
  return {
    traceId: randomUUID(),
    // No invented root. The first `traced()` call becomes the root span and
    // persists with `parent_span_id = NULL`.
    spanId: null,
    correlationId: correlationId ?? randomUUID(),
  };
}

/** Field names whose values are never allowed into a log line. */
const PII_KEYS = new Set([
  "ssn", "social_security_number", "password", "account_number",
  "email", "phone", "first_name", "last_name", "address",
]);

/**
 * Recursively strips PII from a value before it can be logged. The privacy
 * policy says registered-user data includes an SSN; logs are the easiest place
 * for such a value to leak, so redaction is structural, not a reviewer's job.
 */
export function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = PII_KEYS.has(k.toLowerCase()) ? "[redacted]" : scrub(v);
    }
    return out;
  }
  return value;
}

type Level = "debug" | "info" | "warn" | "error";

export interface LogFields {
  event: string;
  trace?: TraceContext;
  [k: string]: unknown;
}

/** A structured JSON log line. Machine-parseable, PII-safe, correlated. */
export function log(level: Level, fields: LogFields): void {
  const { trace, ...rest } = fields;
  const line = {
    level,
    ts: new Date().toISOString(),
    ...(trace && {
      trace_id: trace.traceId,
      span_id: trace.spanId,
      parent_span_id: trace.parentSpanId,
      correlation_id: trace.correlationId,
    }),
    ...(scrub(rest) as Record<string, unknown>),
  };
  // Single line, JSON — the shape a log aggregator ingests.
  const sink = level === "error" ? console.error : console.log;
  sink(JSON.stringify(line));
}

export interface Span {
  ctx: TraceContext;
  end(outcome?: "ok" | "error", extra?: Record<string, unknown>): number;
}

/**
 * Where spans go to be readable later.
 *
 * Injected rather than imported so this module stays free of a database
 * dependency — it is the thing that has to keep working when the database is
 * the problem. `instrument()` wires the real writer at startup; until then
 * spans log and nothing persists, which is exactly the old behaviour.
 */
type SpanWriter = (row: {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  correlationId?: string;
  organizationId?: string;
  name: string;
  outcome: string;
  durationMs: number;
  /**
   * When the span actually began and ended, in wall-clock terms.
   *
   * Both were previously computed and thrown away: `startSpan` captured the
   * start to derive `durationMs`, and the row carried neither. The database
   * column named `started_at` then defaulted to the insertion time, which for
   * a fire-and-forget write lands after the span has already finished.
   */
  startedAt: Date;
  finishedAt: Date;
  attributes: Record<string, unknown>;
}) => void;

let writeSpan: SpanWriter | null = null;

export function setSpanWriter(w: SpanWriter | null): void {
  writeSpan = w;
}

/**
 * Opens a child span under `parent`. Returns the span and a stopwatch; `end`
 * records the duration and outcome. This is the unit the Engineering View reads
 * to show where a request spent its time.
 *
 * Persisting was the missing half. This module produced correct structured JSON
 * on the console and nothing else, so an Engineering View that promised traces
 * had nothing to query — the claim was aspirational and the code was fine, which
 * is the hardest combination to notice.
 */
export function startSpan(name: string, parent: TraceContext, monotonicNow: number): Span {
  const ctx: TraceContext = {
    traceId: parent.traceId,
    spanId: randomUUID().slice(0, 16),
    // `undefined` at the root, which the writer turns into SQL NULL. A root
    // span with no parent is the honest shape; the previous code pointed it at
    // an id that was never written.
    parentSpanId: parent.spanId ?? undefined,
    correlationId: parent.correlationId,
  };
  // Captured once, here, and carried to the row. This is the value the column
  // named `started_at` should always have held.
  const startedAt = new Date(monotonicNow);
  log("debug", { event: "span.start", span_name: name, trace: ctx });
  return {
    ctx,
    end(outcome = "ok", extra = {}) {
      const finishedAt = new Date();
      const duration = Math.max(0, Date.now() - monotonicNow);
      log(outcome === "error" ? "error" : "info", {
        event: "span.end",
        span_name: name,
        duration_ms: duration,
        outcome,
        trace: ctx,
        ...extra,
      });

      // Best-effort, and never in the caller's way. Telemetry that can fail a
      // request it was only supposed to measure is worse than no telemetry.
      try {
        const { organizationId, ...attrs } = extra as { organizationId?: string };
        writeSpan?.({
          traceId: ctx.traceId,
          // Always a string for a real span — only a `TraceContext` root is null.
          spanId: ctx.spanId!,
          parentSpanId: ctx.parentSpanId,
          correlationId: ctx.correlationId,
          organizationId,
          name,
          outcome,
          durationMs: duration,
          startedAt,
          finishedAt,
          attributes: scrub(attrs) as Record<string, unknown>,
        });
      } catch {
        // Swallowed on purpose. See above.
      }

      return duration;
    },
  };
}

/**
 * Runs `fn` inside a span, recording its outcome either way.
 *
 * The wrapper exists so instrumenting a function is one line rather than a
 * try/finally at every call site — the friction that keeps observability
 * modules unused.
 */
export async function traced<T>(
  name: string,
  parent: TraceContext,
  attrs: Record<string, unknown>,
  fn: (ctx: TraceContext) => Promise<T>,
): Promise<T> {
  const span = startSpan(name, parent, Date.now());
  try {
    const out = await fn(span.ctx);
    span.end("ok", attrs);
    return out;
  } catch (err) {
    // The failing span is the one worth having. Record the class of error, not
    // the message — messages carry payload fragments.
    span.end("error", { ...attrs, error: (err as Error).name });
    throw err;
  }
}

/** Stable fingerprint of a payload — for idempotency and log correlation. */
export function fingerprint(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}
