import { NextResponse } from "next/server";
import { conflictsFor } from "@/lib/moves";

/**
 * GET /api/v1/moves/:id/conflicts — the fields where sources disagree, each
 * with every candidate, its provenance, and a deterministic recommendation.
 * The response carries the move's current version: a later merge must present
 * it back, which is how the API refuses stale decisions.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await conflictsFor(id);
  if (!result) return NextResponse.json({ error: "unknown move" }, { status: 404 });
  return NextResponse.json(result);
}
