import { NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db";
import { runCaseAgent } from "@/lib/agent/case-agent";
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
 * The response returns as soon as the agent needs a human. It does not stream:
 * the run is a handful of database reads, and streaming a sub-second process is
 * theatre. The steps come back in full so the inspector can render the whole
 * path, including the refused one.
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

  const run = await runCaseAgent({
    organizationId: move.organization_id,
    moveId: parsed.data.moveId,
  });
  return NextResponse.json(run, { status: 200 });
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
