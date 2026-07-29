import { NextResponse } from "next/server";

import { isDenial, requireView } from "@/lib/actor";
import { moveRecord } from "@/lib/move-record";

/**
 * GET /api/v1/moves/:id
 *
 * Everything known about one move: every field with its full version history,
 * which channels contributed, the services and their provider outcomes, the
 * consent ledger, and the audit trail.
 *
 * Gated on the authorization graph like every other read. A move's provenance
 * is the most sensitive thing this system holds — it names a household, their
 * address, their move date and who asserted each of those — so "who is asking"
 * is answered before any of it is assembled, and a caller with no path learns
 * only that they have no path.
 *
 * `requireView` rather than `requireConciergeWrite`: a customer may read their
 * own record. What they may not do is merge it, which is a different endpoint
 * with a different gate.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const gate = await requireView(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  const record = await moveRecord(id);
  if (!record) return NextResponse.json({ error: "no such move" }, { status: 404 });

  return NextResponse.json({ ...record, viewer: gate.actor.subject, via: gate.via });
}
