import { NextResponse } from "next/server";
import { z } from "zod";

import { decideAgentProposal, getAgentRun } from "@/lib/agent/case-agent";
import { lookupOrder } from "@/lib/provider-simulator";

export const dynamic = "force-dynamic";

/**
 * One run: read it, or decide on it.
 *
 * The decision used to live at `[id]/decision`, and that nested segment was
 * dropped. Turbopack's dev server registered it only intermittently — a
 * production build routed it correctly every time, while `next dev` answered
 * its own 404 page for the same URL depending on nothing reproducible. Rather
 * than ship a route whose behaviour differs between dev and production, the
 * decision became a `POST` to the run itself.
 *
 * It is also the better shape. A run is the resource; approving is a
 * transition on it, not a sub-resource of its own.
 */
const Decision = z.object({
  decision: z.enum(["approved", "rejected"]),
});

const CORRELATION = "33333333-3333-4333-8333-333333333333";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getAgentRun(id);
  if (!run) return NextResponse.json({ error: "No such run" }, { status: 404 });
  return NextResponse.json(run, { status: 200 });
}

/**
 * Approve or reject the agent's proposal.
 *
 * The actor arrives in the `X-Actor` header — the same forgeable header the
 * rest of this API uses, labelled as such everywhere. Authentication is the
 * known gap; authorization and attribution are real.
 *
 * An approval runs the genuine `reconcile()`, the same function the concierge's
 * own button calls. The agent contributed the arguments and the reasoning; it
 * contributed no privileges.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  const actor = request.headers.get("X-Actor");
  if (!actor) {
    // An unattributed approval is worse than no approval: the audit row would
    // record that a human authorised a provider call without recording which.
    return NextResponse.json({ error: "X-Actor header is required" }, { status: 400 });
  }

  try {
    const result = await decideAgentProposal({
      runId: id,
      actor,
      decision: parsed.data.decision,
      correlationId: CORRELATION,
      /*
        Ask with the key we gave the provider, not ours.

        This first looked up by `operationKey` — an identifier the provider has
        never seen — so their ledger reported nothing and reconciliation
        concluded `not_found`. That is the most expensive wrong answer this
        system can produce, because `not_found` is precisely the outcome that
        makes resubmission safe: a lookup by the wrong key turns the safe path
        into the duplicate-creating one.

        Throwing on a missing key rather than returning null is the same
        distinction. "We never recorded how to ask" and "we asked and there is
        no order" are opposite instructions, and collapsing them into null
        would reintroduce the identical bug through a different door.
      */
      lookupOrder: async ({ requestKey }) => {
        if (!requestKey) {
          throw new Error(
            "This submission has no recorded provider request key, so the provider cannot be asked about it. A human must resolve it directly — treating this as 'no order exists' would make a duplicate enrolment look safe.",
          );
        }
        return lookupOrder(requestKey);
      },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // A second approval, a missing run, a vanished submission, or an
    // unaskable provider. All are state conflicts, all reported rather than
    // swallowed.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
