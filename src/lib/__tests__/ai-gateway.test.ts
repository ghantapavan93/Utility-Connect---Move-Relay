import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { maskPII, renderNarrative } from "../ai-gateway";
import { runEvaluation, scriptedAdapter, GOLDEN_CASES } from "../ai-eval";

/**
 * The AI-safety suite. It proves the gateway's guards, which is what makes any
 * model — present or future — safe to plug in behind the adapter seam.
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('AI Eval','ai-eval') RETURNING id`,
    )
  )[0]!.id;
});

describe("PII masking", () => {
  it("masks phone numbers in every common format", () => {
    expect(maskPII("call 469-555-0142 today")).not.toContain("469-555-0142");
    expect(maskPII("call (469) 555-0142")).not.toContain("555-0142");
    expect(maskPII("call +1 469.555.0142")).not.toContain("0142");
  });

  it("masks emails and SSNs", () => {
    expect(maskPII("reach maya.patel@example.com")).toContain("[email on file]");
    expect(maskPII("ssn 123-45-6789 on record")).toContain("[ssn on file]");
    expect(maskPII("ssn 123-45-6789 on record")).not.toContain("123-45-6789");
  });

  it("leaves non-PII text untouched", () => {
    const text = "Move date: 2026-08-16 — sources disagree.";
    expect(maskPII(text)).toBe(text);
  });
});

describe("gateway guards", () => {
  const claim = (n: number, text: string) => ({
    text,
    sourceFieldIds: [`00000000-0000-4000-8000-${String(n).padStart(12, "0")}`],
    kind: "known",
  });

  it("runs deterministically when no adapter is configured — the default is the fallback", async () => {
    const result = await renderNarrative([claim(1, "Move date: 2026-08-16 — confirmed.")], {
      organizationId: org,
      moveId: null,
      adapter: null,
    });
    expect(result.mode).toBe("deterministic");
    expect(result.narrative).toHaveLength(1);
    expect(result.fallbackReason).toBeUndefined(); // no adapter is not a failure
  });

  it("drops model claims that cite ids the input never supplied", async () => {
    const seen = { inputs: [] as string[] };
    const result = await renderNarrative([claim(2, "Move date: 2026-08-16 — confirmed.")], {
      organizationId: org,
      moveId: null,
      adapter: scriptedAdapter("injects_claim", seen),
    });
    expect(result.mode).toBe("model");
    expect(result.droppedUngrounded).toBe(1);
    // The invented claim is gone; only the grounded rephrasing survives.
    expect(JSON.stringify(result.narrative)).not.toContain("RLNT-9");
  });

  it("falls back on non-JSON model output — prose is never displayed raw", async () => {
    const seen = { inputs: [] as string[] };
    const result = await renderNarrative([claim(3, "Move date: 2026-08-16 — confirmed.")], {
      organizationId: org,
      moveId: null,
      adapter: scriptedAdapter("invalid_json", seen),
    });
    expect(result.mode).toBe("deterministic");
    expect(result.fallbackReason).toBe("invalid_output");
  });

  it("falls back on a hung model — a timeout cannot take the briefing down", async () => {
    const seen = { inputs: [] as string[] };
    const result = await renderNarrative([claim(4, "Move date: 2026-08-16 — confirmed.")], {
      organizationId: org,
      moveId: null,
      adapter: scriptedAdapter("hangs", seen),
      timeoutMs: 80,
    });
    expect(result.mode).toBe("deterministic");
    expect(result.fallbackReason).toBe("model timeout");
  });

  it("records every run in ai_runs — model and fallback alike", async () => {
    const before = (
      await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ai_runs WHERE purpose = 'briefing_narrative'`,
      )
    )[0]!.n;

    await renderNarrative([claim(5, "Move date: 2026-08-16 — confirmed.")], {
      organizationId: org,
      moveId: null,
      adapter: null,
    });

    const rows = await query<{ model: string; fallback: boolean; metrics: { mode: string } }>(
      `SELECT model, fallback, metrics FROM ai_runs
        WHERE purpose = 'briefing_narrative' ORDER BY created_at DESC LIMIT 1`,
    );
    const after = (
      await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ai_runs WHERE purpose = 'briefing_narrative'`,
      )
    )[0]!.n;

    expect(after).toBe(before + 1);
    expect(rows[0]!.metrics.mode).toBe("deterministic");
  });
});

describe("golden evaluation set", () => {
  it("passes every case, catches the injection, and leaks zero PII", async () => {
    const report = await runEvaluation(org);

    expect(report.cases).toBe(GOLDEN_CASES.length);
    expect(report.failures).toEqual([]);
    expect(report.passed).toBe(report.cases);

    // The three numbers that matter:
    expect(report.piiLeaks).toBe(0); // no contact digits ever reached the adapter
    expect(report.injectionsCaught).toBeGreaterThanOrEqual(1); // the invented claim died
    expect(report.fallbacks).toBeGreaterThanOrEqual(2); // invalid output + hang both fell back
  });
});
