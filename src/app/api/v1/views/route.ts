import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { conciergeView, customerView, partnerView } from "@/lib/projections";
import { demoConstants } from "@/lib/demo-orchestrator";

/**
 * GET /api/v1/views?audience=concierge|customer|partner
 *
 * Returns the tenant-safe projection of the current demo move for one audience.
 * The projection is computed on the server by allow-list; the client receives
 * only what that audience is permitted to see. Withholding happens here, never
 * in the browser.
 */
export async function GET(request: Request) {
  const audience = new URL(request.url).searchParams.get("audience") ?? "concierge";

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

  if (audience === "customer") {
    return NextResponse.json({ exists: true, ...(await customerView(move.id)) });
  }
  if (audience === "partner") {
    const partner = (
      await query<{ id: string }>(
        `SELECT id FROM partners WHERE organization_id = $1 AND slug = 'ntr'`,
        [org.id],
      )
    )[0];
    if (!partner) return NextResponse.json({ exists: false }, { status: 200 });
    return NextResponse.json({ exists: true, ...(await partnerView(move.id, partner.id)) });
  }
  return NextResponse.json({ exists: true, ...(await conciergeView(org.id, move.id)) });
}
