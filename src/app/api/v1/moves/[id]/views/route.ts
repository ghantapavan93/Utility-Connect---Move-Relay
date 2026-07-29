import { NextResponse } from "next/server";

import { isDenial, requireView } from "@/lib/actor";
import { viewForActor } from "@/lib/audience-view";

/**
 * GET /api/v1/moves/:id/views
 *
 * The projection the calling actor is entitled to, for this move.
 *
 * The audience is a property of who is asking, never a query parameter. It was
 * `?audience=partner` once, which the caller wrote themselves — so a projection
 * that withheld a provider account number from partners was worth very little,
 * because anyone could ask for the concierge view instead.
 *
 * Authorized against the relationship graph before any projection runs, and the
 * granting path travels back with the response so the decision can be reviewed
 * rather than merely trusted.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const gate = await requireView(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  const view = await viewForActor(id, gate.actor, gate.via);
  // A move that does not exist and an actor who cannot be shown one are both
  // "nothing to render", and the page treats them the same way. Neither is a
  // server error, so neither gets a 500.
  return NextResponse.json(view, { status: view.exists ? 200 : 404 });
}
