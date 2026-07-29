import { NextResponse } from "next/server";
import { signatureSubmit, signatureRetry, signatureReconcile } from "@/lib/theater-signature";

/**
 * POST /api/v1/theater/signature/:stage
 *
 * Three round trips, because the point of this incident is *when* each fact
 * becomes knowable. `submit` opens a run and returns its id; `retry` and
 * `reconcile` take that id in the body and act on the same provider operation.
 *
 * Deliberately not folded into `/api/v1/theater/:scenario`. That route's
 * registry is exactly the six attacks — the scoreboard counts it, a test
 * asserts the narrative covers every key in it, and adding three stages of one
 * incident would quietly make all of those mean something else.
 */

type Stage = "submit" | "retry" | "reconcile";

const NEEDS_RUN: Record<Stage, boolean> = { submit: false, retry: true, reconcile: true };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ stage: string }> },
) {
  const { stage } = await params;

  if (stage !== "submit" && stage !== "retry" && stage !== "reconcile") {
    return NextResponse.json(
      { error: `unknown stage '${stage}'`, valid: ["submit", "retry", "reconcile"] },
      { status: 404 },
    );
  }

  /*
    A stage that needs a handle and did not get one is a client bug, not a
    server error. Returning 400 with the reason keeps it out of the 500s, where
    a genuine invariant failure would otherwise be lost among them.
  */
  let runId: string | undefined;
  if (NEEDS_RUN[stage]) {
    const body = (await request.json().catch(() => ({}))) as { runId?: unknown };
    if (typeof body.runId !== "string" || !body.runId) {
      return NextResponse.json({ error: `stage '${stage}' requires a runId` }, { status: 400 });
    }
    runId = body.runId;
  }

  try {
    const result =
      stage === "submit"
        ? await signatureSubmit()
        : stage === "retry"
          ? await signatureRetry(runId!)
          : await signatureReconcile(runId!);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, stage, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
