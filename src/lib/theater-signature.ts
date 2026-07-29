import { randomUUID } from "node:crypto";

import { query, withTransaction } from "./db";
import { materialiseServices, providerRequestKey, submitService, retryService, reconcileService } from "./fulfillment";
import { lookupOrder } from "./provider-simulator";
import { theaterOrg } from "./theater";
import { VIOLATION } from "./theater-contract";

/**
 * The signature incident: the provider created the order and the reply never came.
 *
 * The six attacks each prove one guarantee in isolation. This proves the thing
 * the whole system was designed around, and it needs three separate round trips
 * because the point is *when* each fact becomes known — a single call that
 * returned the finished story would be a narration of a failure rather than a
 * failure, and the page would be animating through stages that had already
 * resolved.
 *
 * ## Why this does not reuse the demo orchestrator
 *
 * `/api/v1/demo/:step` already exposes submit, retry and reconcile, and reusing
 * it was the obvious move. It would have been wrong twice over. Those steps run
 * against the `uc-demo` organisation — the `/demo` page's own state, which
 * `demo.reset()` deletes outright — so attacking from here would mutate a
 * different page under a different reviewer. And they refuse to run without the
 * six preceding steps, because they operate on one scripted move.
 *
 * This composes the same underlying services against the throwaway theater
 * tenant, which is what lets the hero keep claiming an isolated synthetic
 * tenant without an asterisk. Each run makes its own move, so two reviewers
 * pressing at once cannot collide.
 *
 * ## Reading the provider's own ledger
 *
 * Each stage peeks at the simulator's store directly. That is not a shortcut
 * around the proof — it *is* the proof. The provider's ledger is deliberately
 * separate from ours, and the entire drama of this incident is that the two
 * disagree: the provider holds a created order at the exact moment our state
 * says `unknown`. Showing only our side would reduce the centrepiece to a
 * status field, and showing only theirs would skip the ambiguity.
 */

export interface SignatureStage {
  stage: "submit" | "retry" | "reconcile";
  /** Handle for the following stages. */
  runId: string;
  invariant: string;
  outcome: string;
  evidence: Record<string, unknown>;
}

/** Everything a later stage needs, carried in the URL rather than in memory. */
interface Handle {
  moveId: string;
  serviceRequestId: string;
}

/**
 * `moveId:serviceRequestId`, both UUIDs.
 *
 * Server state keyed by a run id would not survive a redeploy or a second
 * instance, and a client that reloads mid-incident would be holding a handle to
 * something that no longer exists. Both halves are re-validated against the
 * theater organisation on every stage, so a forged handle reaches nothing.
 */
const encode = (h: Handle) => `${h.moveId}:${h.serviceRequestId}`;

function decode(runId: string): Handle {
  const [moveId, serviceRequestId] = runId.split(":");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!moveId || !serviceRequestId || !uuid.test(moveId) || !uuid.test(serviceRequestId)) {
    throw new Error("malformed run id");
  }
  return { moveId, serviceRequestId };
}

/**
 * Confirm the handle belongs to a move in the theater tenant.
 *
 * Without this, a run id naming a real customer's move would drive real
 * provider submissions from a public button. The scenarios are safe because
 * they build their own data; this one accepts input, so it has to prove the
 * input is its own before acting on it.
 */
async function contextFor(runId: string) {
  const { moveId, serviceRequestId } = decode(runId);
  const org = await theaterOrg();

  const rows = await query<{ id: string }>(
    `SELECT m.id FROM moves m WHERE m.id = $1 AND m.organization_id = $2`,
    [moveId, org],
  );
  if (!rows[0]) throw new Error("that run does not belong to the theater tenant");

  return {
    organizationId: org,
    moveId,
    serviceRequestId,
    correlationId: randomUUID(),
    actor: "human:theater-reviewer",
  };
}

/** What the provider believes, independent of what we know. */
async function providerSide(serviceRequestId: string) {
  const order = await lookupOrder(providerRequestKey(serviceRequestId));
  return order?.orderId ?? null;
}

/**
 * Stage one. Submit, and lose the reply.
 *
 * Creates its own move so the incident is repeatable and concurrent-safe.
 */
export async function signatureSubmit(): Promise<SignatureStage> {
  const org = await theaterOrg();

  const { moveId, serviceRequestId } = await withTransaction(async (c) => {
    const move = (
      await c.query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference) VALUES ($1, $2) RETURNING id`,
        [org, `MR-THTR-${randomUUID().slice(0, 8)}`],
      )
    ).rows[0]!;
    const ids = await materialiseServices(c, org, move.id, ["electric"]);
    const serviceRequestId = ids[0];
    if (!serviceRequestId) throw new Error("theater move created without an electric service");
    return { moveId: move.id, serviceRequestId };
  });

  const ctx = {
    organizationId: org,
    moveId,
    serviceRequestId,
    correlationId: randomUUID(),
    actor: "human:theater-reviewer",
  };

  const result = await submitService(ctx, "timeout_after_create");
  const held = await providerSide(serviceRequestId);

  return {
    stage: "submit",
    runId: encode({ moveId, serviceRequestId }),
    invariant: "A lost reply becomes UNKNOWN, never a guess in either direction.",
    // The state must be `unknown`. `failed` would be a guess that the order does
    // not exist; `confirmed` a guess that it does. Both are wrong, and both are
    // the mistake that enrols a household twice.
    outcome:
      result.state === "unknown" && result.providerOrderId === null
        ? "the reply never arrived — our state is UNKNOWN"
        : VIOLATION,
    evidence: {
      ourState: result.state,
      ourProviderOrderId: result.providerOrderId,
      providerHoldsOrder: held,
      operationKey: `provider_submit:${serviceRequestId}`,
      message: result.message,
    },
  };
}

/**
 * Stage two. Try the retry that would create the second order.
 *
 * `retryService` hands the provider a callback that throws if it is ever
 * reached, so a returned result is itself the proof that nobody was contacted.
 */
export async function signatureRetry(runId: string): Promise<SignatureStage> {
  const ctx = await contextFor(runId);
  const before = await providerSide(ctx.serviceRequestId);

  const result = await retryService(ctx);
  const after = await providerSide(ctx.serviceRequestId);

  return {
    stage: "retry",
    runId,
    invariant: "While the outcome is UNKNOWN, the provider is not contacted again.",
    outcome:
      result.blocked && before === after
        ? "blind retry refused — the provider was never called"
        : VIOLATION,
    evidence: {
      blocked: result.blocked,
      stateAfterRetry: result.state,
      // Identical before and after is the whole claim: no second order exists
      // because no second request was made.
      providerOrderBefore: before,
      providerOrderAfter: after,
      duplicateOrdersCreated: before === after ? 0 : 1,
      message: result.message,
    },
  };
}

/** Stage three. Ask the provider what it actually has, and adopt the answer. */
export async function signatureReconcile(runId: string): Promise<SignatureStage> {
  const ctx = await contextFor(runId);
  const result = await reconcileService(ctx);
  const held = await providerSide(ctx.serviceRequestId);

  const settled = await query<{ state: string; provider_order_id: string | null }>(
    `SELECT ps.state, ps.provider_order_id
       FROM provider_submissions ps
      WHERE ps.service_request_id = $1`,
    [ctx.serviceRequestId],
  );

  return {
    stage: "reconcile",
    runId,
    invariant: "Reconciliation adopts the order that exists; it never creates a second one.",
    outcome:
      result.outcome === "found_existing" && settled[0]?.provider_order_id === held
        ? "the existing order was found and adopted"
        : VIOLATION,
    evidence: {
      reconciliationOutcome: result.outcome,
      recoveredOrderId: result.providerOrderId,
      finalState: settled[0]?.state ?? null,
      providerHoldsOrder: held,
      // The same order the provider created in stage one, never a new one.
      ordersForThisRequest: held ? 1 : 0,
    },
  };
}

export const SIGNATURE_STAGES = {
  submit: () => signatureSubmit(),
  retry: (runId: string) => signatureRetry(runId),
  reconcile: (runId: string) => signatureReconcile(runId),
};
