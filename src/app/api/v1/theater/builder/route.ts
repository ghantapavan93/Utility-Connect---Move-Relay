import { NextResponse } from "next/server";
import { BUILDER, MUTATIONS, type Mutation } from "@/lib/theater-builder";

/**
 * POST /api/v1/theater/builder
 *
 * Body: `{ "mutation": "<one of MUTATIONS>" }`
 *
 * The only input this surface accepts is a choice from a closed set. No tenant
 * identifier, no payload, no field names, no code — the reviewer picks which
 * supported fault to introduce and the server builds everything else. A route
 * that accepted a payload would be a public write path into a real database
 * dressed as a demonstration.
 *
 * Domain outcomes ride in the 200 envelope, as everywhere else in this surface.
 * A non-2xx here is a routing or server fault, never a defence doing its job.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { mutation?: unknown };

  if (typeof body.mutation !== "string" || !MUTATIONS.includes(body.mutation as Mutation)) {
    return NextResponse.json(
      { error: `unknown mutation '${String(body.mutation)}'`, valid: MUTATIONS },
      { status: 400 },
    );
  }

  const mutation = body.mutation as Mutation;

  try {
    const result = await BUILDER[mutation]();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, mutation, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
