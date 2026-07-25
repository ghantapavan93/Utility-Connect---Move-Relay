import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { approveMergeFor, StaleMergeError, type MergeDecision } from "@/lib/moves";

/**
 * POST /api/v1/moves/:id/merge
 *
 * Body: { actor, expectedVersion, decisions: [{ fieldPath, value, reason }] }
 *
 * The human-approval gate for any move. Refuses an unnamed actor (the DB
 * constraint would too), and refuses a stale merge with 409 + the current
 * version — two concierges cannot silently overwrite each other through this
 * endpoint any more than through the schema.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { actor?: string; expectedVersion?: number; decisions?: MergeDecision[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.actor?.trim() || typeof body.expectedVersion !== "number" || !body.decisions?.length) {
    return NextResponse.json(
      { error: "body must be { actor, expectedVersion, decisions:[{fieldPath,value,reason}] }" },
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
      actor: body.actor,
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
