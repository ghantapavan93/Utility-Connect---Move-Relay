import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { conciergeView, customerView, partnerView } from "@/lib/projections";
import { demoConstants } from "@/lib/demo-orchestrator";
import { isDenial, requireView } from "@/lib/actor";

/**
 * GET /api/v1/views
 *
 * Returns the tenant-safe projection of the current demo move for the calling
 * actor. Two things changed here and the second is the important one.
 *
 * The audience is no longer a query parameter. It was `?audience=partner`,
 * which the caller wrote themselves — so a projection that carefully withheld
 * the provider account number from partners was worth very little, because
 * anyone could ask for the concierge view instead. The audience is now a
 * property of who you are.
 *
 * And the request is now authorized against the relationship graph before any
 * projection runs. `checkView` walks ownership and membership tuples and
 * returns the granting path; the route refuses when there is no path. Identity
 * itself is still a header — a demo stand-in, and labelled as one — but the
 * decision that follows it is real, server-side, and explainable.
 */
export async function GET(request: Request) {
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [demoConstants.ORG_SLUG])
  )[0];
  if (!org) return NextResponse.json({ exists: false }, { status: 200 });

  const move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, demoConstants.MOVE_REF],
    )
  )[0];
  if (!move) return NextResponse.json({ exists: false }, { status: 200 });

  const gate = await requireView(request, `move:${move.id}`);
  if (isDenial(gate)) return gate.response;
  const { actor, via } = gate;

  // The granting path travels with the response. An authorization decision the
  // system cannot explain is one nobody can review, and the engineering view
  // renders this directly.
  const authorization = { actor: actor.subject, audience: actor.audience, via };

  if (actor.audience === "customer") {
    return NextResponse.json({ exists: true, authorization, ...(await customerView(move.id)) });
  }

  if (actor.audience === "partner") {
    const partner = (
      await query<{ id: string }>(
        `SELECT id FROM partners WHERE organization_id = $1 AND slug = 'ntr'`,
        [org.id],
      )
    )[0];
    if (!partner) return NextResponse.json({ exists: false }, { status: 200 });
    return NextResponse.json({
      exists: true,
      authorization,
      ...(await partnerView(move.id, partner.id)),
    });
  }

  return NextResponse.json({ exists: true, authorization, ...(await conciergeView(org.id, move.id)) });
}
