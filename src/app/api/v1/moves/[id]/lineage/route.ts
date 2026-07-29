import { NextResponse } from "next/server";

import { isDenial, requireView } from "@/lib/actor";
import { fieldLineage } from "@/lib/field-lineage";

/**
 * GET /api/v1/moves/:id/lineage?field=move.date
 *
 * Where one projected field came from, told to the audience that received it.
 *
 * Behind the same gate as the projection itself, and for the same reason: the
 * history of a field carries its rejected values, its source channels and the
 * operator who chose between them. A second endpoint that returned all of that
 * would undo the first one — provenance is not neutral just because it is
 * metadata.
 *
 * The audience comes from the actor, never the query string. `field` is the
 * only parameter, and it is checked against a per-audience allow-list rather
 * than used to build a query.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const field = new URL(request.url).searchParams.get("field");

  if (!field) {
    return NextResponse.json({ error: "field is required" }, { status: 400 });
  }

  const gate = await requireView(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  const lineage = await fieldLineage(id, field, gate.actor.audience);

  /*
    One answer for "no such field" and for "not for you".

    Distinguishing them would turn this into an oracle: ask for every plausible
    path and the 404s map exactly what the record holds. A single shape means a
    caller learns nothing they did not already supply.
  */
  if (!lineage) {
    return NextResponse.json(
      { available: false, detail: "No lineage available for this field in this view." },
      { status: 200 },
    );
  }

  return NextResponse.json({ available: true, ...lineage });
}
