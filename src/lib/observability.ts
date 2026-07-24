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
  spanId: string;
  parentSpanId?: string;
  correlationId: string;
}

export function newTrace(correlationId?: string): TraceContext {
  return {
    traceId: randomUUID(),
    spanId: randomUUID().slice(0, 16),
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
 * Opens a child span under `parent`. Returns the span and a stopwatch; `end`
 * logs the duration and outcome. This is the unit the Engineering View reads to
 * show where a request spent its time.
 */
export function startSpan(name: string, parent: TraceContext, monotonicNow: number): Span {
  const ctx: TraceContext = {
    traceId: parent.traceId,
    spanId: randomUUID().slice(0, 16),
    parentSpanId: parent.spanId,
    correlationId: parent.correlationId,
  };
  log("debug", { event: "span.start", span_name: name, trace: ctx });
  return {
    ctx,
    end(outcome = "ok", extra = {}) {
      const duration = Math.max(0, Date.now() - monotonicNow);
      log(outcome === "error" ? "error" : "info", {
        event: "span.end",
        span_name: name,
        duration_ms: duration,
        outcome,
        trace: ctx,
        ...extra,
      });
      return duration;
    },
  };
}

/** Stable fingerprint of a payload — for idempotency and log correlation. */
export function fingerprint(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
}
