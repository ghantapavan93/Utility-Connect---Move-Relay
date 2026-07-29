import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { query } from "@/lib/db";
import { isDenial, requireConciergeWrite } from "@/lib/actor";
import {
  servicesFor,
  submitService,
  retryService,
  reconcileService,
  backfillServices,
} from "@/lib/fulfillment";
import type { Scenario } from "@/lib/provider-simulator";

/**
 * The fulfillment half of a move, for any move.
 *
 * `GET`  — every service on this move with whatever the provider has said.
 * `POST` — drive one of them: submit, retry, or reconcile.
 *
 * This exists because the equivalent operations were only reachable through
 * `/api/v1/demo/:step`, which resolves one hardcoded move by reference. Any
 * move created through the real intake endpoint could be read and merged but
 * never fulfilled — there was no route that would take a move id.
 *
 * Every action is a write, so all of them go through the same authorization
 * gate the merge endpoint uses: the actor comes from the request rather than
 * the body, and must reach this move through a real relationship before
 * anything happens.
 */

const ACTIONS = ["submit", "retry", "reconcile"] as const;
type Action = (typeof ACTIONS)[number];

const SCENARIOS: Scenario[] = [
  "ok",
  "timeout_after_create",
  "duplicate_409",
  "invalid_payload",
  "degraded",
  "hard_failure",
];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // Reads are gated too. Whether a household has an electricity order pending
  // is not public, and the shape of a refusal should not reveal it either.
  const gate = await requireConciergeWrite(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  return NextResponse.json({ services: await servicesFor(id) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const gate = await requireConciergeWrite(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  let body: { action?: string; serviceRequestId?: string; scenario?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const action = body.action as Action;
  if (!ACTIONS.includes(action)) {
    return NextResponse.json(
      { error: `action must be one of ${ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!body.serviceRequestId) {
    return NextResponse.json({ error: "serviceRequestId is required" }, { status: 400 });
  }

  const move = (
    await query<{ organization_id: string }>(`SELECT organization_id FROM moves WHERE id = $1`, [id])
  )[0];
  if (!move) return NextResponse.json({ error: "no such move" }, { status: 404 });

  const ctx = {
    organizationId: move.organization_id,
    moveId: id,
    serviceRequestId: body.serviceRequestId,
    // A correlation id per action, so each step of a run is independently
    // traceable rather than all of them sharing one thread.
    correlationId: randomUUID(),
    // The subject, not the actor object. Audit rows record who acted, and a
    // serialised object in that column is a row nobody can query by actor.
    actor: gate.actor.subject,
  };

  try {
    if (action === "submit") {
      /*
        The scenario is the caller's choice and is validated against the
        simulator's own list rather than passed through. Defaulting to the
        timeout is deliberate: it is the failure this system was designed
        around, and making the happy path the default would let a reviewer run
        the whole console without ever meeting it.
      */
      const scenario = SCENARIOS.includes(body.scenario as Scenario)
        ? (body.scenario as Scenario)
        : "timeout_after_create";
      return NextResponse.json({ ok: true, action, ...(await submitService(ctx, scenario)) });
    }

    if (action === "retry") {
      return NextResponse.json({ ok: true, action, ...(await retryService(ctx)) });
    }

    return NextResponse.json({ ok: true, action, ...(await reconcileService(ctx)) });
  } catch (err) {
    /*
      A refusal is not a server error.

      `retryService` reaching the provider throws by design, and a reconcile
      with nothing to reconcile is a caller mistake. Returning 500 for either
      would put a real invariant holding into the same bucket as a crash, and
      the console would show a red box where it should show a refusal.
    */
    const message = err instanceof Error ? err.message : "unknown error";
    const clientFault = /no such service request|never submitted/.test(message);
    return NextResponse.json(
      { ok: false, action, error: message },
      { status: clientFault ? 409 : 500 },
    );
  }
}

/**
 * PATCH — backfill services for a move ingested before they were materialised.
 *
 * Separate from POST because it is a repair, not a step of the workflow, and
 * putting it in the same switch would make it look like one.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const gate = await requireConciergeWrite(request, `move:${id}`);
  if (isDenial(gate)) return gate.response;

  const move = (
    await query<{ organization_id: string }>(`SELECT organization_id FROM moves WHERE id = $1`, [id])
  )[0];
  if (!move) return NextResponse.json({ error: "no such move" }, { status: 404 });

  const created = await backfillServices(move.organization_id, id);
  return NextResponse.json({ ok: true, created: created.length, services: await servicesFor(id) });
}
