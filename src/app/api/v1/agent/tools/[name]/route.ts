import { NextResponse } from "next/server";
import { z } from "zod";

import { query } from "@/lib/db";
import { invokeTool, toolByName } from "@/lib/agent/tools";

export const dynamic = "force-dynamic";

/**
 * Invoke one governed tool over HTTP.
 *
 * `POST /api/v1/agent/tools/get_move_record` with `{ moveId }`.
 *
 * This exists so the tool registry has more than one consumer. The case agent
 * calls `invokeTool` in-process; the MCP server calls it through here; a
 * developer can call it with `curl`. All three go through the same authority
 * check, and a tool that is forbidden is forbidden identically in all three —
 * which is the difference between a boundary and a convention that happens to
 * be observed by the one caller anybody tested.
 *
 * Only `read_only` tools are reachable. `requires_approval` tools are refused
 * here on purpose: approving an action is a decision with an actor and a
 * recorded run behind it, and a bare HTTP endpoint that executed one would be a
 * second, unaudited path into the domain. Approvals go through
 * `POST /api/v1/agent/runs/[id]`, where the run and the human are both known.
 *
 * The tenant is derived from the move, never accepted from the caller.
 */
const Body = z.object({
  moveId: z.string().uuid(),
});

export async function POST(request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;

  const tool = toolByName(name);
  if (!tool) {
    return NextResponse.json({ error: `No tool named "${name}"` }, { status: 404 });
  }

  /*
    Refused before the body is even parsed, and refused with the registry's own
    stated reason rather than a generic 403. A caller who reaches for
    `submit_provider_enrollment` should be told exactly why it will never work,
    because the reason is the useful part.
  */
  if (tool.authority !== "read_only") {
    return NextResponse.json(
      {
        error: `"${name}" is not callable here.`,
        authority: tool.authority,
        reason:
          tool.refusal ??
          "This action requires a named human approving a specific agent run. Use POST /api/v1/agent/runs/[id].",
      },
      { status: 403 },
    );
  }

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
  if (!move) return NextResponse.json({ error: "No such move" }, { status: 404 });

  const call = await invokeTool(
    name,
    {},
    { organizationId: move.organization_id, moveId: parsed.data.moveId },
  );

  return NextResponse.json(call, { status: call.outcome === "error" ? 500 : 200 });
}
