import { NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db";
import { runCaseAgent, type AgentStepRecord } from "@/lib/agent/case-agent";
import { advertisedTools, TOOLS } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

/**
 * Start a concierge case agent run.
 *
 * `POST /api/v1/agent/runs` with `{ moveId }`.
 *
 * The tenant is derived from the move rather than accepted from the caller.
 * Taking `organizationId` from the request body would let anyone claim any
 * tenant simply by asserting it, and the move already determines the answer
 * unambiguously — a parameter whose only correct value is derivable is a
 * parameter that exists to be got wrong.
 *
 * ## Streaming, and why the earlier position reversed
 *
 * This route used to state flatly that it does not stream, "because the run is
 * a handful of database reads, and streaming a sub-second process is theatre."
 * That was written against an embedded database where the whole run finished
 * in tens of milliseconds. Against a remote Postgres every step is a real
 * network round trip — 40 to 400ms each, measured — and the page was papering
 * over the lump-sum response with a staggered entrance animation. Which is the
 * actual theatre: pretending to be live is worse than being slow.
 *
 * So `?stream=1` now returns NDJSON — one `{"type":"step"}` line per step,
 * written after that step is persisted, then one `{"type":"run"}` line with
 * the complete result. Every event echoes a row that already exists, so a
 * client that saw a step can always read it back; nothing is emitted ahead of
 * the database. The plain POST is unchanged for every existing caller.
 */
const Body = z.object({
  moveId: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "moveId must be a UUID" }, { status: 400 });
  }

  const move = (
    await query<{ organization_id: string }>(
      `SELECT organization_id FROM moves WHERE id = $1`,
      [parsed.data.moveId],
    )
  )[0];
  if (!move) {
    return NextResponse.json({ error: "No such move" }, { status: 404 });
  }

  const wantsStream = new URL(request.url).searchParams.get("stream") === "1";

  if (!wantsStream) {
    const run = await runCaseAgent({
      organizationId: move.organization_id,
      moveId: parsed.data.moveId,
    });
    return NextResponse.json(run, { status: 200 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}
`));
      try {
        const run = await runCaseAgent({
          organizationId: move.organization_id,
          moveId: parsed.data.moveId,
          onStep: (step: AgentStepRecord) => send({ type: "step", step }),
        });
        send({ type: "run", run });
      } catch (error) {
        /*
          A failure mid-stream cannot become an HTTP status — the 200 already
          left. The error travels as the last event instead, and the client
          treats an ended stream with no final run as exactly what it is: an
          investigation that did not complete.
        */
        send({ type: "error", error: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

/**
 * The tool catalogue, including the forbidden entries.
 *
 * Publishing what the agent is *not* allowed to do is the point. A reviewer can
 * read the boundary without reading the source, and the same list is what the
 * tests assert against — there is no second copy to drift.
 */
export async function GET() {
  return NextResponse.json({
    advertisedToModel: advertisedTools().map((t) => ({
      name: t.name,
      authority: t.authority,
      description: t.description,
    })),
    tools: TOOLS.map((t) => ({
      name: t.name,
      authority: t.authority,
      description: t.description,
      refusal: t.refusal ?? null,
    })),
  });
}
