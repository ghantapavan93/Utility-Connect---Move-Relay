import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { reset } from "../demo-orchestrator";
import { ingestReferral } from "../intake";
import { recentSpans, traceById, installTracing } from "../tracing";
import { newTrace, traced, scrub } from "../observability";
import { demoConstants } from "../demo-orchestrator";

/**
 * Tracing.
 *
 * An audit classified observability PARTIAL with a blunt finding: the module was
 * real, correct and *had zero importers*. It emitted well-formed structured JSON
 * to a console and persisted nothing, while `/api/v1/engineering` advertised
 * traces it had no way to fetch. The code was fine and the claim was
 * aspirational, which is the hardest combination to notice — nothing fails.
 *
 * The fix was durability plus call sites. These tests hold both: that a span
 * survives as a row, that the four instrumented paths actually emit, that a
 * failure is recorded rather than swallowed, and — the one that matters most —
 * that telemetry can never take down the thing it is measuring.
 */

let org: string;

beforeAll(async () => {
  await reset();
  installTracing();
  org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0]!.id;
});

const validPayload = {
  customer: {
    first_name: "Trace",
    last_name: "Probe",
    email: "trace.probe@example.com",
    phone: "469-555-0101",
  },
  move: { date: "2026-09-01", to_address: "1 Trace Way, Plano, TX 75093" },
};

describe("a span survives as a row", () => {
  it("records name, outcome and duration for a real ingestion", async () => {
    await ingestReferral({
      organizationId: org,
      channel: "customer_form",
      payload: validPayload,
      idempotencyKey: `trace-${Date.now()}`,
    });

    // Writes are fire-and-forget by design, so allow the insert to land.
    await new Promise((r) => setTimeout(r, 120));

    const spans = await recentSpans(20);
    const ingest = spans.find((s) => s.name === "ingest.referral");
    expect(ingest, "ingest.referral produced no span").toBeDefined();
    expect(ingest!.outcome).toBe("ok");
    expect(ingest!.duration_ms).toBeGreaterThanOrEqual(0);
    expect((ingest!.attributes as { channel?: string }).channel).toBe("customer_form");
  });

  it("keeps every span of one trace together, with parentage intact", async () => {
    /*
      This used to assert the retrieval order — child first, "because the child
      ends first". That was never a guarantee the implementation made. Span
      writes are fire-and-forget, so the two inserts race, and `started_at` is
      the row's insert time rather than the span's start time. Whichever insert
      reaches the server first gets the earlier timestamp.

      It passed on PostgreSQL 17.8 and failed 2 runs in 5 on PostgreSQL 16 —
      not a version behaviour difference, just different timing exposing a
      test that had been relying on luck. `traceById` now has a deterministic
      tiebreak so repeated reads are stable, but stable is not the same as
      ordered-by-completion, and asserting the latter would put the flake back.

      What a trace actually promises is structural: every span carries the same
      trace id, and the child names its parent. That is what a reader needs to
      reconstruct the tree, and it holds regardless of which insert lands first.
    */
    const trace = newTrace();
    await traced("probe.parent", trace, { n: 1 }, async (ctx) => {
      await traced("probe.child", ctx, { n: 2 }, async () => undefined);
    });
    await new Promise((r) => setTimeout(r, 120));

    const spans = await traceById(trace.traceId);
    expect(spans.map((s) => s.name).sort()).toEqual(["probe.child", "probe.parent"]);

    const parent = spans.find((s) => s.name === "probe.parent")!;
    const child = spans.find((s) => s.name === "probe.child")!;

    /*
      `newTrace()` establishes a root context whose span is never written — the
      trace exists before any instrumented work happens — so `probe.parent`
      legitimately carries a parent id pointing at it. The assertion that
      matters is the link between the two spans that *were* recorded.
    */
    expect(child.parent_span_id, "the child must name its parent").toBe(parent.span_id);
    expect(parent.span_id, "the two spans must be distinct").not.toBe(child.span_id);
  });

  it("records a failure instead of swallowing it", async () => {
    const trace = newTrace();
    await expect(
      traced("probe.explodes", trace, {}, async () => {
        throw new TypeError("boom");
      }),
    ).rejects.toThrow("boom");

    await new Promise((r) => setTimeout(r, 120));
    const spans = await traceById(trace.traceId);
    expect(spans[0]!.outcome).toBe("error");
    // The error *class*, never the message — messages carry payload fragments.
    expect((spans[0]!.attributes as { error?: string }).error).toBe("TypeError");
  });
});

describe("telemetry never takes down what it measures", () => {
  it("returns the caller's value even when the span write fails", async () => {
    // The failure mode worth guarding: an instrumented function that starts
    // throwing because the *tracing* broke would be a straight downgrade on the
    // uninstrumented version.
    const { setSpanWriter } = await import("../observability");
    setSpanWriter(() => {
      throw new Error("span sink is down");
    });

    const out = await traced("probe.resilient", newTrace(), {}, async () => "still fine");
    expect(out).toBe("still fine");

    // Put the real writer back. This is why installTracing carries no
    // `installed` guard — with one, the sabotage above would leak into every
    // test that ran after it.
    installTracing();
  });

  it("scrubs PII out of span attributes before they are stored", async () => {
    // Attributes are written by call sites, and a call site will eventually
    // pass something it should not. The scrub is the backstop.
    const cleaned = scrub({ email: "maya@example.com", channel: "csv_upload" }) as Record<
      string,
      unknown
    >;
    expect(cleaned.channel).toBe("csv_upload");
    expect(cleaned.email).not.toBe("maya@example.com");
  });
});
