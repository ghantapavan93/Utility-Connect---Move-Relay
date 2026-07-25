import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { listMoves } from "@/lib/moves";

/** GET /api/v1/moves — every move in the demo tenant, with open-conflict counts. */
export async function GET() {
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`)
  )[0];
  if (!org) return NextResponse.json({ moves: [] });
  return NextResponse.json({ moves: await listMoves(org.id) });
}
