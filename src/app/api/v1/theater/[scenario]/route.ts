import { NextResponse } from "next/server";
import { SCENARIOS } from "@/lib/theater";

/**
 * POST /api/v1/theater/:scenario
 *
 * Runs one safe synthetic failure against the real backend and returns the
 * evidence. Nothing here is scripted animation — each scenario performs actual
 * database work and reports the rows that prove (or would expose a violation
 * of) its invariant.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scenario: string }> },
) {
  const { scenario } = await params;
  const run = SCENARIOS[scenario];

  if (!run) {
    return NextResponse.json(
      { error: `unknown scenario '${scenario}'`, valid: Object.keys(SCENARIOS) },
      { status: 404 },
    );
  }

  try {
    const result = await run();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, scenario, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
