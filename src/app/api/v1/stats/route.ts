import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/v1/stats
 *
 * Dashboard metrics computed from actual database rows. Nothing here is
 * fabricated — every number is a COUNT over real tables in the demo tenant. When
 * the demo has not been run yet the counts are simply zero, which is the honest
 * state, not a placeholder.
 *
 * A dashboard of invented figures is the fastest way for a technical reviewer to
 * stop trusting everything else on the page. So these are real, and the ones that
 * cannot be real yet are absent rather than faked.
 */
export async function GET() {
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`)
  )[0];

  if (!org) {
    return NextResponse.json({
      hasData: false,
      stats: emptyStats(),
    });
  }

  const [moves, canonical, submissions, blocked, conflicts, audit, aiRuns] = await Promise.all([
    count(`SELECT count(*)::int AS n FROM moves WHERE organization_id = $1`, [org.id]),
    count(`SELECT count(*)::int AS n FROM moves WHERE organization_id = $1 AND state = 'canonical'`, [org.id]),
    count(`SELECT count(*)::int AS n FROM provider_submissions WHERE organization_id = $1`, [org.id]),
    count(`SELECT count(*)::int AS n FROM audit_events WHERE organization_id = $1 AND event_type = 'provider.retry.blocked'`, [org.id]),
    count(`SELECT count(*)::int AS n FROM field_versions fv WHERE organization_id = $1 AND NOT is_canonical
             AND (SELECT count(DISTINCT value) FROM field_versions f2 WHERE f2.move_id = fv.move_id AND f2.field_path = fv.field_path) > 1`, [org.id]),
    count(`SELECT count(*)::int AS n FROM audit_events WHERE organization_id = $1`, [org.id]),
    count(`SELECT count(*)::int AS n FROM ai_runs WHERE organization_id = $1`, [org.id]),
  ]);

  const reconciled = await count(
    `SELECT count(*)::int AS n FROM provider_submissions WHERE organization_id = $1 AND state = 'reconciled'`,
    [org.id],
  );

  return NextResponse.json({
    hasData: moves > 0,
    stats: {
      activeMoves: moves,
      canonicalMoves: canonical,
      providerSubmissions: submissions,
      duplicatesPrevented: blocked,
      openConflicts: conflicts,
      auditEvents: audit,
      aiBriefings: aiRuns,
      ordersRecovered: reconciled,
    },
  });
}

async function count(sql: string, params: unknown[]): Promise<number> {
  const rows = await query<{ n: number }>(sql, params);
  return rows[0]?.n ?? 0;
}

function emptyStats() {
  return {
    activeMoves: 0, canonicalMoves: 0, providerSubmissions: 0, duplicatesPrevented: 0,
    openConflicts: 0, auditEvents: 0, aiBriefings: 0, ordersRecovered: 0,
  };
}
