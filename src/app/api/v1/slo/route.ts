import { NextResponse } from "next/server";
import { computeObjectives } from "@/lib/slo";

/**
 * GET /api/v1/slo
 *
 * Transport only. The objectives themselves are computed in `lib/slo.ts` so
 * they can be tested directly — see `slo.test.ts`, which seeds real breaches
 * and asserts each one turns red.
 */
export async function GET() {
  return NextResponse.json(await computeObjectives());
}
