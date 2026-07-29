import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { isDenial, requireConciergeWrite } from "@/lib/actor";
import { approveMergeFor, StaleMergeError, type MergeDecision } from "@/lib/moves";

/**
 * POST /api/v1/moves/:id/merge
 *
 * Body: { expectedVersion, decisions: [{ fieldPath, value, reason }] }
 * Header: X-Actor
 *
 * The human-approval gate for any move. Refuses a stale merge with 409 and the
 * current version, so two concierges cannot silently overwrite each other
 * through this endpoint any more than through the schema.
 *
 * It is also gated on the authorization graph, which it was not. The route
 * previously took the actor's *name from the request body* and looked the
 * organization up from the move it was about to write to — so a caller who knew
 * a move id could resolve a stranger's conflict under any name they invented,
 * and the audit row would faithfully record the invented name. The identity now
 * comes from the request rather than from the payload, and it must reach this
 * move through a real relationship before anything is written.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  /*
    Authorized before the body is parsed and before the move is read. A caller
    with no path to this record should learn nothing about it — not even whether
    it exists — from the shape of the failure.
  */
  const gate = await requireConciergeWrite(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  let body: { expectedVersion?: number; decisions?: MergeDecision[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof body.expectedVersion !== "number" || !body.decisions?.length) {
    return NextResponse.json(
      { error: "body must be { expectedVersion, decisions:[{fieldPath,value,reason}] }" },
      { status: 400 },
    );
  }

  const org = (
    await query<{ organization_id: string }>(
      `SELECT organization_id FROM moves WHERE id = $1`,
      [id],
    )
  )[0];
  if (!org) return NextResponse.json({ error: "unknown move" }, { status: 404 });

  try {
    const result = await approveMergeFor({
      organizationId: org.organization_id,
      moveId: id,
      expectedVersion: body.expectedVersion,
      // The authenticated subject, never a name the caller supplied. The audit
      // row is only worth keeping if it records who actually acted.
      actor: gate.actor.subject,
      decisions: body.decisions,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof StaleMergeError) {
      return NextResponse.json(
        { ok: false, error: err.message, currentVersion: err.currentVersion },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 422 },
    );
  }
}
