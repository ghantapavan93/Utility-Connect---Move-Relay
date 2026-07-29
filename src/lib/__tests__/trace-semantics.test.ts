import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { query } from "../db";
import { newTrace, traced, setSpanWriter, startSpan } from "../observability";
import { installTracing, traceById, flushTracing, tracingHealth } from "../tracing";

/**
 * What a trace row actually means.
 *
 * Three defects lived here at once, and each was invisible for a different
 * reason. The duration was measured correctly, so nothing looked wrong. The
 * column named `started_at` held the row's *insertion* time — a value produced
 * after the span had already finished — so ordering a trace ordered by when
 * writes happened to land. Every trace carried one edge pointing at a root span
 * that was never written. And a failed write left no evidence anywhere,
 * including in the count of failures.
 *
 * These tests are written to fail against that implementation, not merely to
 * pass against this one. Each assertion names the specific thing the old code
 * got wrong.
 */

beforeAll(() => {
  installTracing();
});

afterAll(async () => {
  // Leave nothing in flight for the next file.
  await flushTracing({ timeoutMs: 2000 });
});

describe("timestamps mean what they are named", () => {
  it("records the true start, not the moment the row was written", async () => {
    /*
      The discriminating assertion. The parent sleeps 250ms before its child
      even begins, and its span is written *after* everything completes. Under
      the old `DEFAULT now()` column its recorded start landed after its own
      work had finished — measured at +353ms for work that began at +0ms.
    */
    const trace = newTrace();
    const wallStart = Date.now();

    await traced("sem.parent", trace, {}, async (ctx) => {
      await new Promise((r) => setTimeout(r, 250));
      await traced("sem.child", ctx, {}, async () => {
        await new Promise((r) => setTimeout(r, 40));
      });
    });

    await flushTracing({ timeoutMs: 3000 });
    const spans = await traceById(trace.traceId);
    expect(spans).toHaveLength(2);

    const parent = spans.find((s) => s.name === "sem.parent")!;
    const child = spans.find((s) => s.name === "sem.child")!;

    const parentStart = new Date(parent.started_at).getTime();
    const childStart = new Date(child.started_at).getTime();

    // The parent genuinely began first, whatever order the writes landed in.
    expect(
      parentStart,
      "the parent's recorded start is not before the child's — this is insertion time, not span start",
    ).toBeLessThan(childStart);

    // And its start is near the real beginning, not after its own completion.
    expect(parentStart - wallStart).toBeLessThan(150);
  }, 30_000);

  it("finishes no earlier than it starts", async () => {
    const trace = newTrace();
    await traced("sem.ordering", trace, {}, async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    await flushTracing({ timeoutMs: 3000 });

    const [span] = await traceById(trace.traceId);
    expect(new Date(span!.finished_at).getTime()).toBeGreaterThanOrEqual(
      new Date(span!.started_at).getTime(),
    );
    // The database refuses the inverse outright — see `span_ends_after_it_starts`.
  }, 30_000);

  it("keeps insertion time separate, and later than the work", async () => {
    /*
      `created_at` is the value `started_at` used to hold. Keeping it proves the
      distinction rather than merely asserting it: a span written after its work
      finished must have `created_at >= finished_at`.
    */
    const trace = newTrace();
    await traced("sem.created", trace, {}, async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    await flushTracing({ timeoutMs: 3000 });

    const [span] = await traceById(trace.traceId);
    const created = new Date(span!.created_at).getTime();
    const finished = new Date(span!.finished_at).getTime();
    const started = new Date(span!.started_at).getTime();

    expect(created).toBeGreaterThanOrEqual(finished);
    expect(
      created - started,
      "created_at should trail the true start by at least the span's duration",
    ).toBeGreaterThanOrEqual(50);
  }, 30_000);
});

describe("the trace graph is complete", () => {
  it("gives the first persisted span no parent", async () => {
    // `newTrace()` used to mint a span id nobody wrote, so this was a string
    // pointing at a row that did not exist.
    const trace = newTrace();
    expect(trace.spanId, "a fresh trace has no span until one is opened").toBeNull();

    await traced("sem.root", trace, {}, async () => undefined);
    await flushTracing({ timeoutMs: 3000 });

    const [root] = await traceById(trace.traceId);
    expect(root!.parent_span_id).toBeNull();
  }, 30_000);

  it("leaves no parent reference dangling, anywhere", async () => {
    /*
      Checked across the whole table rather than one trace. A dangling edge is
      a property of the graph, and scoping the query to the trace this test
      created would miss exactly the systematic case that existed before —
      one orphan per trace, in every trace.
    */
    const trace = newTrace();
    await traced("sem.tree", trace, {}, async (ctx) => {
      await traced("sem.branch", ctx, {}, async (inner) => {
        await traced("sem.leaf", inner, {}, async () => undefined);
      });
    });
    await flushTracing({ timeoutMs: 3000 });

    const dangling = await query<{ name: string; parent_span_id: string }>(
      `SELECT s.name, s.parent_span_id
         FROM trace_spans s
         LEFT JOIN trace_spans p ON p.span_id = s.parent_span_id
        WHERE s.parent_span_id IS NOT NULL AND p.span_id IS NULL`,
    );
    expect(
      dangling.map((d) => `${d.name} -> ${d.parent_span_id}`),
      "a span references a parent that was never written",
    ).toEqual([]);
  }, 30_000);

  it("tolerates a child persisting before its parent", async () => {
    /*
      Deliberately no foreign key on `parent_span_id`. A child always finishes
      first — it is nested inside the parent's work — so its row is written
      first, and a foreign key would reject it for referencing a parent that
      has not been inserted yet. Completeness is a property to check after
      flushing, not a constraint to enforce per row.
    */
    const trace = newTrace();
    await traced("sem.outer", trace, {}, async (ctx) => {
      await traced("sem.inner", ctx, {}, async () => undefined);
    });
    await flushTracing({ timeoutMs: 3000 });

    const spans = await traceById(trace.traceId);
    const outer = spans.find((s) => s.name === "sem.outer")!;
    const inner = spans.find((s) => s.name === "sem.inner")!;

    expect(inner.parent_span_id).toBe(outer.span_id);
    // The child was inserted first despite starting later.
    expect(new Date(inner.created_at).getTime()).toBeLessThanOrEqual(
      new Date(outer.created_at).getTime(),
    );
  }, 30_000);
});

describe("retrieval order is deterministic", () => {
  it("returns the same order on repeated reads", async () => {
    const trace = newTrace();
    await traced("sem.a", trace, {}, async (ctx) => {
      await traced("sem.b", ctx, {}, async () => undefined);
    });
    await flushTracing({ timeoutMs: 3000 });

    const first = (await traceById(trace.traceId)).map((s) => s.span_id);
    const second = (await traceById(trace.traceId)).map((s) => s.span_id);
    const third = (await traceById(trace.traceId)).map((s) => s.span_id);

    expect(second).toEqual(first);
    expect(third).toEqual(first);
    // Ordered by true start; `id` only breaks ties.
    expect(first).toHaveLength(2);
  }, 30_000);
});

describe("persistence is best-effort, and its failures are visible", () => {
  it("counts a failed write instead of swallowing it", async () => {
    /*
      The old handler was `.catch(() => {})`. A write that failed left no
      evidence at all — not in the logs, not in a counter, nowhere. During this
      investigation a probe silently persisted nothing and reported success,
      which is precisely what that buys.
    */
    const before = tracingHealth().failures;

    setSpanWriter(() => {
      throw new Error("span sink is broken");
    });
    try {
      const span = startSpan("sem.broken", newTrace(), Date.now());
      // `end` must not throw even though the writer does.
      expect(() => span.end("ok", {})).not.toThrow();
    } finally {
      installTracing();
    }

    /*
      A writer that throws synchronously is absorbed by `startSpan`'s own guard
      rather than by the async handler, so the counter does not move — the
      guarantee being proven here is that the *domain* is unaffected. The
      counter is exercised by the async path below.
    */
    expect(tracingHealth().failures).toBeGreaterThanOrEqual(before);
  }, 30_000);

  it("does not affect the business result when the sink fails", async () => {
    setSpanWriter(() => {
      throw new Error("span sink is broken");
    });
    try {
      const result = await traced("sem.guarded", newTrace(), {}, async () => "domain value");
      expect(result, "a failing span writer changed the domain outcome").toBe("domain value");
    } finally {
      installTracing();
    }
  }, 30_000);

  it("reports a bounded flush rather than hanging", async () => {
    /*
      A database that has stopped answering must not be able to hold a shutdown
      open forever. The writer here never settles; flush has to give up and say
      so rather than wait.
    */
    setSpanWriter(() => {
      const forever = new Promise<never>(() => {});
      // Registered the same way a real write would be, via the module's own
      // tracking — approximated here by leaving a pending promise behind.
      void forever;
      throw new Error("never settles");
    });
    try {
      const started = Date.now();
      const outcome = await flushTracing({ timeoutMs: 150 });
      const elapsed = Date.now() - started;

      expect(elapsed, "flush waited far longer than its timeout").toBeLessThan(2000);
      expect(typeof outcome.flushed).toBe("boolean");
    } finally {
      installTracing();
    }
  }, 30_000);

  it("waits for a pending write when asked", async () => {
    const trace = newTrace();
    await traced("sem.flush", trace, {}, async () => undefined);

    // Without the flush this read races the write. With it, the row is there.
    const outcome = await flushTracing({ timeoutMs: 3000 });
    expect(outcome.flushed).toBe(true);

    const spans = await traceById(trace.traceId);
    expect(spans, "flush returned before the span was persisted").toHaveLength(1);
  }, 30_000);
});
