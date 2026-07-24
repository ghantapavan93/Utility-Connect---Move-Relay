import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { demoConstants } from "@/lib/demo-orchestrator";

/**
 * GET /api/v1/provenance?field=move.date
 *
 * The full version history of one field on the demo move: every value ever
 * held, its channel, verification, both clocks (valid time and system time),
 * and — where a human chose — who and why. This is the drawer's data source:
 * tap a field, see its life.
 */
export async function GET(request: Request) {
  const field = new URL(request.url).searchParams.get("field");
  if (!field) {
    return NextResponse.json({ error: "field parameter required" }, { status: 400 });
  }

  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0];
  if (!org) return NextResponse.json({ exists: false });

  const move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, demoConstants.MOVE_REF],
    )
  )[0];
  if (!move) return NextResponse.json({ exists: false });

  const versions = await query(
    `SELECT value, channel, verification, confidence, is_canonical,
            selected_by, selection_reason, valid_at, recorded_at
       FROM field_versions
      WHERE move_id = $1 AND field_path = $2
      ORDER BY recorded_at, id`,
    [move.id, field],
  );

  return NextResponse.json({ exists: true, field, versions });
}
