import { createHash } from "node:crypto";
import { withTransaction, type Queryable } from "./db";
import { recordAudit } from "./audit";
import { publish } from "./outbox";

/**
 * Safe provider submission.
 *
 * The governing fact comes from Utility Connect's own Terms of Service:
 *
 *   "You are not purchasing or ordering products or services from Utility
 *    Connect, LLC when you order a service."
 *
 * The provider owns order truth. We only ever hold a *belief* about it, formed
 * from a network response that may never arrive. That single fact drives every
 * design decision in this file:
 *
 *   1. A timeout is not a failure. It is UNKNOWN. The provider may well have
 *      created the order before the response was lost.
 *   2. Retrying an UNKNOWN blindly risks a duplicate order in a system we do not
 *      control and are contractually not responsible for.
 *   3. Recovery is therefore reconciliation — ask the provider what exists —
 *      never resubmission.
 *
 * Idempotency is enforced by a unique index on (organization_id, operation_key),
 * not by a Redis lock. A lock that vanishes on eviction or restart is not a
 * correctness guarantee; it is a timing preference.
 */

export type SubmissionState =
  | "pending"
  | "submitted"
  | "confirmed"
  | "failed"
  | "unknown"
  | "reconciled"
  | "duplicate";

export interface SubmitInput {
  organizationId: string;
  moveId: string;
  serviceRequestId: string;
  payload: Record<string, unknown>;
  correlationId: string;
  actor: string;
}

export interface SubmitResult {
  state: SubmissionState;
  submissionId: string;
  providerOrderId: string | null;
  /** True when an existing attempt was returned instead of a new one being made. */
  deduplicated: boolean;
  message: string;
}

/** Stable across retries of the same intent; changes when the intent changes. */
export function operationKey(serviceRequestId: string): string {
  return `provider_submit:${serviceRequestId}`;
}

/**
 * Canonical fingerprint of a payload: key order never matters, nested content
 * always does.
 *
 * The first implementation passed `Object.keys(payload).sort()` as a
 * JSON.stringify replacer — which FILTERS keys at every depth, so nested
 * objects serialized as {} and two payloads differing only in a nested field
 * (a changed move date!) produced identical fingerprints. Caught by the intake
 * idempotency test; recorded as Build Ledger entry 10. Canonicalize
 * recursively instead.
 */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (v !== null && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      out[k] = canonical((v as Record<string, unknown>)[k]);
    }
    return out;
  }
  return v;
}

export function fingerprint(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(canonical(payload))).digest("hex");
}

/**
 * States from which resubmitting is safe.
 *
 * `unknown` is deliberately absent, and that absence is the whole point. It is
 * also enforced below rather than merely documented here.
 */
const RESUBMITTABLE: ReadonlySet<SubmissionState> = new Set<SubmissionState>([
  "pending",
  "failed",
]);

export async function submitToProvider(
  input: SubmitInput,
  callProvider: (payload: Record<string, unknown>) => Promise<ProviderResponse>,
): Promise<SubmitResult> {
  const key = operationKey(input.serviceRequestId);
  const fp = fingerprint(input.payload);

  // Phase 1 — claim the intent, or discover it is already claimed.
  const claim = await withTransaction(async (client) => {
    const existing = await client.query<ProviderSubmissionRow>(
      `SELECT * FROM provider_submissions
        WHERE organization_id = $1 AND operation_key = $2`,
      [input.organizationId, key],
    );

    const prior = existing.rows[0];
    if (prior) return { prior, created: false as const };

    const inserted = await client.query<ProviderSubmissionRow>(
      `INSERT INTO provider_submissions
         (organization_id, service_request_id, operation_key,
          request_fingerprint, state, request_payload)
       VALUES ($1, $2, $3, $4, 'submitted', $5)
       RETURNING *`,
      [
        input.organizationId,
        input.serviceRequestId,
        key,
        fp,
        JSON.stringify(input.payload),
      ],
    );

    await recordAudit(client, {
      organizationId: input.organizationId,
      moveId: input.moveId,
      eventType: "provider.submission.started",
      actor: input.actor,
      correlationId: input.correlationId,
      stateAfter: { state: "submitted" },
      detail: { operationKey: key, serviceRequestId: input.serviceRequestId },
    });
    await publish(client, {
      organizationId: input.organizationId,
      eventType: "provider.submitted",
      aggregateId: input.moveId,
      payload: { moveId: input.moveId, serviceRequestId: input.serviceRequestId },
    });

    return { prior: inserted.rows[0]!, created: true as const };
  });

  // Phase 2 — an intent already existed. Decide whether acting again is safe.
  if (!claim.created) {
    const prior = claim.prior;
    const state = prior.state as SubmissionState;

    if (state === "confirmed" || state === "reconciled") {
      return {
        state,
        submissionId: prior.id,
        providerOrderId: prior.provider_order_id,
        deduplicated: true,
        message: "Order already exists. Returning the stored outcome.",
      };
    }

    // The load-bearing branch.
    if (state === "unknown") {
      await withTransaction((client) =>
        recordAudit(client, {
          organizationId: input.organizationId,
          moveId: input.moveId,
          eventType: "provider.retry.blocked",
          actor: "system",
          correlationId: input.correlationId,
          stateAfter: { state: "unknown" },
          detail: {
            reason:
              "Outcome is UNKNOWN. The provider may already have created this " +
              "order. Resubmitting could create a duplicate in a system we do " +
              "not control. Reconciliation is required before any further action.",
            operationKey: key,
          },
        }),
      );

      return {
        state: "unknown",
        submissionId: prior.id,
        providerOrderId: null,
        deduplicated: true,
        message:
          "Retry blocked. Outcome unknown — reconcile against the provider first.",
      };
    }

    if (!RESUBMITTABLE.has(state)) {
      return {
        state,
        submissionId: prior.id,
        providerOrderId: prior.provider_order_id,
        deduplicated: true,
        message: `No action taken. State '${state}' is not resubmittable.`,
      };
    }
  }

  // Phase 3 — actually call the provider, outside any transaction. Holding a
  // database transaction open across a network call would pin a connection for
  // the length of an external timeout.
  const submissionId = claim.prior.id;

  let response: ProviderResponse;
  try {
    response = await callProvider(input.payload);
  } catch (err) {
    const timedOut =
      err instanceof Error && err.name === "ProviderTimeoutError";

    return await withTransaction(async (client) => {
      // A timeout means we do not know. Anything else is a genuine failure.
      const nextState: SubmissionState = timedOut ? "unknown" : "failed";

      await client.query(
        `UPDATE provider_submissions
            SET state = $1, error_category = $2, settled_at = now()
          WHERE id = $3`,
        [nextState, timedOut ? "timeout" : "provider_error", submissionId],
      );

      if (timedOut) {
        await client.query(
          `INSERT INTO reconciliation_jobs
             (organization_id, provider_submission_id, reason)
           VALUES ($1, $2, 'timeout_unknown_outcome')`,
          [input.organizationId, submissionId],
        );
        await publish(client, {
          organizationId: input.organizationId,
          eventType: "provider.unknown",
          aggregateId: input.moveId,
          payload: { moveId: input.moveId, serviceRequestId: input.serviceRequestId },
        });
      }

      await recordAudit(client, {
        organizationId: input.organizationId,
        moveId: input.moveId,
        eventType: timedOut
          ? "provider.submission.unknown"
          : "provider.submission.failed",
        actor: "system",
        correlationId: input.correlationId,
        stateBefore: { state: "submitted" },
        stateAfter: { state: nextState },
        detail: {
          error: err instanceof Error ? err.message : String(err),
          ...(timedOut && {
            note:
              "Response lost. The provider may or may not have created the " +
              "order. Reconciliation queued; retry is blocked until it settles.",
          }),
        },
      });

      return {
        state: nextState,
        submissionId,
        providerOrderId: null,
        deduplicated: false,
        message: timedOut
          ? "Provider did not respond. Outcome unknown — reconciliation queued."
          : "Provider rejected the submission.",
      };
    });
  }

  // Phase 4 — settle a definite answer.
  return await withTransaction(async (client) => {
    const state: SubmissionState = response.duplicate ? "duplicate" : "confirmed";

    await client.query(
      `UPDATE provider_submissions
          SET state = $1, provider_order_id = $2,
              response_payload = $3, settled_at = now()
        WHERE id = $4`,
      [state, response.orderId, JSON.stringify(response.raw), submissionId],
    );

    await client.query(
      `UPDATE service_requests SET state = $1 WHERE id = $2`,
      [state, input.serviceRequestId],
    );

    await recordAudit(client, {
      organizationId: input.organizationId,
      moveId: input.moveId,
      eventType: "provider.submission.confirmed",
      actor: "system",
      correlationId: input.correlationId,
      stateBefore: { state: "submitted" },
      stateAfter: { state, providerOrderId: response.orderId },
      detail: { operationKey: key },
    });
    await publish(client, {
      organizationId: input.organizationId,
      eventType: "provider.confirmed",
      aggregateId: input.moveId,
      payload: { moveId: input.moveId, serviceRequestId: input.serviceRequestId },
    });

    return {
      state,
      submissionId,
      providerOrderId: response.orderId,
      deduplicated: false,
      message: response.duplicate
        ? "Provider reported an existing order for this request."
        : "Order created.",
    };
  });
}

/**
 * Resolves an UNKNOWN outcome by asking the provider what actually exists.
 *
 * This is the only sanctioned path out of `unknown`. It never submits.
 */
export async function reconcile(
  input: {
    organizationId: string;
    moveId: string;
    submissionId: string;
    correlationId: string;
  },
  lookupOrder: () => Promise<{ orderId: string } | null>,
): Promise<{ outcome: string; providerOrderId: string | null }> {
  const found = await lookupOrder();

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE reconciliation_jobs
          SET outcome = $1, found_order_id = $2,
              attempts = attempts + 1, completed_at = now()
        WHERE provider_submission_id = $3 AND completed_at IS NULL`,
      [found ? "found_existing" : "not_found", found?.orderId ?? null, input.submissionId],
    );

    if (found) {
      // The order existed all along. We were never uncertain about the world,
      // only about our knowledge of it.
      await client.query(
        `UPDATE provider_submissions
            SET state = 'reconciled', provider_order_id = $1, settled_at = now()
          WHERE id = $2`,
        [found.orderId, input.submissionId],
      );
    } else {
      // Genuinely absent. Now — and only now — resubmission is safe.
      await client.query(
        `UPDATE provider_submissions
            SET state = 'pending', error_category = NULL, settled_at = NULL
          WHERE id = $1`,
        [input.submissionId],
      );
    }

    if (found) {
      // The event must carry the service_request id so the projector can name
      // the service in customer language — look it up from the submission row.
      const srRows = await client.query<{ service_request_id: string }>(
        `SELECT service_request_id FROM provider_submissions WHERE id = $1`,
        [input.submissionId],
      );
      await publish(client, {
        organizationId: input.organizationId,
        eventType: "provider.reconciled",
        aggregateId: input.moveId,
        payload: {
          moveId: input.moveId,
          submissionId: input.submissionId,
          serviceRequestId: srRows.rows[0]?.service_request_id,
        },
      });
    }

    await recordAudit(client, {
      organizationId: input.organizationId,
      moveId: input.moveId,
      eventType: "provider.reconciliation.completed",
      actor: "system",
      correlationId: input.correlationId,
      stateBefore: { state: "unknown" },
      stateAfter: { state: found ? "reconciled" : "pending" },
      detail: found
        ? {
            outcome: "found_existing",
            providerOrderId: found.orderId,
            note: "Existing order recovered. No duplicate was created.",
          }
        : {
            outcome: "not_found",
            note: "No order exists at the provider. Resubmission is now safe.",
          },
    });

    return {
      outcome: found ? "found_existing" : "not_found",
      providerOrderId: found?.orderId ?? null,
    };
  });
}

export interface ProviderResponse {
  orderId: string;
  duplicate: boolean;
  raw: Record<string, unknown>;
}

export interface ProviderSubmissionRow {
  id: string;
  state: string;
  provider_order_id: string | null;
  request_fingerprint: string;
  attempt: number;
}

export type { Queryable };
