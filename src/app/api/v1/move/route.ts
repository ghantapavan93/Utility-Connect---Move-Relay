import { NextResponse } from "next/server";
import { getMoveRecord, getAuditTimeline } from "@/lib/demo-orchestrator";

/**
 * GET /api/v1/move
 *
 * The canonical Move Record and its audit timeline, exactly as stored. This is
 * the read model every screen renders from. It reflects database state at the
 * moment of the request — replay a demo step, call this again, see the change.
 */
export async function GET() {
  const [record, timeline] = await Promise.all([getMoveRecord(), getAuditTimeline()]);

  if (!record) {
    return NextResponse.json(
      { exists: false, message: "No Move Record yet. Run the demo from the start." },
      { status: 200 },
    );
  }

  return NextResponse.json({ exists: true, ...record, timeline });
}
