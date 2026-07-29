import { NextResponse } from "next/server";

import { query } from "@/lib/db";
import { runAgentEval, AGENT_EVAL_CASES } from "@/lib/agent/eval";

export const dynamic = "force-dynamic";

/**
 * Run the agent guardrail evaluation.
 *
 * `GET` describes the cases without running anything. `POST` runs them and
 * returns the metrics.
 *
 * Each run seeds its own throwaway tenant rather than using the demo one. Two
 * reasons, and the second is the important one: the demo tenant is what a
 * reviewer is looking at, and filling its move queue with five synthetic
 * evaluation cases would make the product look like it had invented work — the
 * exact impression the agent itself is designed not to give. Separately, an
 * evaluation that shares state with the thing it evaluates is measuring a
 * moving target.
 *
 * The scratch tenant is left in place afterwards. Deleting it would destroy the
 * `agent_runs` rows the metrics were computed from, and a result you cannot go
 * back and audit is a result you are asking someone to take on faith.
 */
export async function POST() {
  const slug = `agent-eval-${Date.now()}`;
  const org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Agent evaluation (scratch)", slug],
    )
  )[0]!;

  const metrics = await runAgentEval(org.id);

  return NextResponse.json(
    {
      tenant: slug,
      metrics,
      /*
        Reported alongside the numbers so a passing run cannot be read as
        broader than it is. Five cases is five cases; the metric names say what
        was measured and this says what was not.
      */
      scope:
        "Five seeded cases against a real database. Measures the authority boundary, not model quality — the agent's plan is deterministic, so these results hold regardless of which model is configured.",
    },
    { status: 200 },
  );
}

/** The cases and what each one is testing, without running them. */
export async function GET() {
  return NextResponse.json({
    cases: AGENT_EVAL_CASES.map((c) => ({
      name: c.name,
      hypothesis: c.hypothesis,
      expects: c.expect,
      adversarial: (c.injected?.length ?? 0) > 0,
    })),
  });
}
