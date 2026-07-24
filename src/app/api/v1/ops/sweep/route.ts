import { NextResponse } from "next/server";
import { sweepUnknownOutcomes } from "@/lib/ops";
import { lookupOrder } from "@/lib/provider-simulator";
import { demoConstants } from "@/lib/demo-orchestrator";

/**
 * POST /api/v1/ops/sweep
 *
 * Runs the reconciliation sweep: every submission still in UNKNOWN is driven
 * through provider lookup — never resubmission. In production this is a
 * worker on a timer; here it is a button on the Reliability page, so a
 * reviewer can create ambiguity in the demo and watch the sweep drain it.
 */
export async function POST() {
  // The demo's provider simulator keys orders by the demo request key; other
  // tenants' submissions resolve as not-found and simply become retry-eligible.
  const result = await sweepUnknownOutcomes(() => lookupOrder(demoConstants.REQUEST_KEY));
  return NextResponse.json({ ok: true, ...result });
}
