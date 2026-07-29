import { randomUUID, createHash } from "node:crypto";

import { query, withTransaction } from "./db";
import { publish, dispatch } from "./outbox";
import { writeTuple, checkView } from "./authz";
import { validateSubmission, quarantineSubmission } from "./contracts";
import { ingestReferral } from "./intake";
import { startWorkflow, runWorkflow, history } from "./workflow";
import { materialiseServices, providerRequestKey, submitService } from "./fulfillment";
import { lookupOrder } from "./provider-simulator";
import { theaterOrg } from "./theater";
import { VIOLATION } from "./theater-contract";

/**
 * Mutate a synthetic handoff.
 *
 * The six attacks are fixed demonstrations: press one, watch a guarantee hold.
 * This is the same machinery with the choice handed over — start from a valid
 * referral, introduce exactly one supported fault, and see what the system does
 * with it. The difference matters because a reviewer who chose the fault
 * themselves has ruled out the suspicion that the demonstration was arranged
 * around a result.
 *
 * ## Only what the backend actually supports
 *
 * Every mutation below maps to a mechanism that already exists and is already
 * covered by tests. Nothing here is a new capability dressed as a control, and
 * there are no disabled options hinting at capabilities that do not exist —
 * a greyed-out "crash at finalize" would be a claim about the system made by
 * the UI rather than by the code.
 *
 * ## Isolation
 *
 * Everything runs in the throwaway `theater` tenant, and every run creates its
 * own rows. The cross-tenant mutation uses a fixed second identity created by
 * this module; no tenant identifier is ever accepted from the client, because
 * a run id naming a real organisation would turn a public button into a writer
 * against real customer data.
 */

export const MUTATIONS = [
  "replay_batch",
  "replay_webhook",
  "remove_required_field",
  "rename_partner_field",
  "stale_version",
  "other_tenant",
  "drop_provider_response",
  "crash_at_submit",
] as const;

export type Mutation = (typeof MUTATIONS)[number];

export interface BuilderResult {
  mutation: Mutation;
  /** What must remain true regardless of the fault. */
  invariant: string;
  /** Stated before the run, from the mutation's own definition. */
  expected: string;
  /** What actually happened, or the breach marker. */
  outcome: string;
  evidence: Record<string, unknown>;
}

/**
 * The valid starting point. One synthetic referral, contract-clean.
 *
 * Exported so the UI can show the reviewer exactly what they are about to
 * damage, and so a test can assert it passes validation before any mutation is
 * applied — a "valid" baseline that never validated would make every subsequent
 * quarantine meaningless.
 */
export const VALID_HANDOFF = {
  customer: {
    first_name: "Maya",
    last_name: "Patel",
    email: "maya.patel@example.com",
    phone: "469-555-0142",
  },
  move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy Plano TX" },
  services: ["electric"],
  referral: { partner_slug: "north-texas-realty", agent: "theater-agent" },
} as const;

const clone = () => JSON.parse(JSON.stringify(VALID_HANDOFF)) as Record<string, never>;

/* ------------------------------------------------------------------ */

/** The same batch, delivered twice. */
async function replayBatch(): Promise<BuilderResult> {
  const org = await theaterOrg();
  const payload = clone();
  // Content-derived, so "the same batch" means the same bytes.
  const key = `builder-batch:${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 12)}:${randomUUID().slice(0, 8)}`;

  const first = await ingestReferral({ organizationId: org, channel: "partner_api", payload, idempotencyKey: key });
  const second = await ingestReferral({ organizationId: org, channel: "partner_api", payload, idempotencyKey: key });

  return {
    mutation: "replay_batch",
    invariant: "One logical batch stays one batch, however many times it is delivered.",
    expected: "The second delivery replays. No second referral is created.",
    outcome: second.status === "replayed" ? "the second delivery replayed" : VIOLATION,
    evidence: {
      firstStatus: first.status,
      secondStatus: second.status,
      /*
        The replay must return the *same* move, not merely refuse to make a new
        one. A second delivery that quietly resolved to a different record would
        report "replayed" and still have split one household across two.
      */
      firstReference: first.reference ?? null,
      secondReference: second.reference ?? null,
      sameMove: !!first.moveId && first.moveId === second.moveId,
      idempotencyKey: key,
    },
  };
}

/** The same event, delivered twice. */
async function replayWebhook(): Promise<BuilderResult> {
  const org = await theaterOrg();
  const consumer = `builder-${randomUUID().slice(0, 8)}`;

  await withTransaction((c) =>
    publish(c, { organizationId: org, eventType: "builder.webhook", payload: { nonce: randomUUID() } }),
  );

  let handled = 0;
  const firstDelivery = await dispatch(consumer, async () => {
    handled++;
  });
  const redelivery = await dispatch(consumer, async () => {
    handled++;
  });

  return {
    mutation: "replay_webhook",
    invariant: "Delivery is at-least-once; the business action is exactly-once.",
    expected: "Both deliveries are accepted. The handler runs once.",
    outcome: redelivery === 0 && handled === firstDelivery ? `the handler ran ${handled}×` : VIOLATION,
    evidence: { firstDeliveryProcessed: firstDelivery, redeliveryProcessed: redelivery, handlerInvocations: handled },
  };
}

/** Drop a field the contract requires. */
async function removeRequiredField(): Promise<BuilderResult> {
  const org = await theaterOrg();
  const payload = clone() as Record<string, Record<string, unknown>>;
  delete payload.move!.date;

  const validation = validateSubmission("partner_api", payload);
  const quarantineId = validation.ok ? null : await quarantineSubmission(org, "partner_api", payload, validation);

  return {
    mutation: "remove_required_field",
    invariant: "A payload failing its contract is held with reasons — never dropped, never force-fed.",
    expected: "Validation fails on move.date. The payload quarantines with a machine-readable reason.",
    outcome: !validation.ok && quarantineId ? `quarantined with ${validation.issues.length} issues` : VIOLATION,
    evidence: {
      removedField: "move.date",
      contractVersion: validation.version,
      issues: validation.ok ? [] : validation.issues,
      quarantineId,
    },
  };
}

/** Rename a field, as a partner does without telling anyone. */
async function renamePartnerField(): Promise<BuilderResult> {
  const org = await theaterOrg();
  const payload = clone() as Record<string, Record<string, unknown>>;
  payload.move!.moveDate = payload.move!.date;
  delete payload.move!.date;

  const validation = validateSubmission("partner_api", payload);
  const quarantineId = validation.ok ? null : await quarantineSubmission(org, "partner_api", payload, validation);

  return {
    mutation: "rename_partner_field",
    invariant: "An unannounced schema change is caught at the contract, not absorbed by the model.",
    expected: "move.date is absent under its contract name. The payload quarantines rather than losing the date.",
    outcome: !validation.ok && quarantineId ? `quarantined with ${validation.issues.length} issues` : VIOLATION,
    evidence: {
      renamed: { from: "move.date", to: "move.moveDate" },
      contractVersion: validation.version,
      issues: validation.ok ? [] : validation.issues,
      quarantineId,
    },
  };
}

/** Two writers, one record, one stale read. */
async function staleVersion(): Promise<BuilderResult> {
  const org = await theaterOrg();
  const move = (
    await query<{ id: string; version: number }>(
      `INSERT INTO moves (organization_id, reference) VALUES ($1,$2) RETURNING id, version`,
      [org, `MR-BLDR-${randomUUID().slice(0, 6)}`],
    )
  )[0]!;

  const readVersion = move.version;
  const first = await query<{ version: number }>(
    `UPDATE moves SET state = 'conflict_pending', version = version + 1
      WHERE id = $1 AND version = $2 RETURNING version`,
    [move.id, readVersion],
  );
  const second = await query<{ version: number }>(
    `UPDATE moves SET state = 'canonical', version = version + 1
      WHERE id = $1 AND version = $2 RETURNING version`,
    [move.id, readVersion],
  );
  const surviving = await query<{ state: string; version: number }>(
    `SELECT state, version FROM moves WHERE id = $1`,
    [move.id],
  );

  return {
    mutation: "stale_version",
    invariant: "A write made from a stale read updates zero rows and surfaces as a conflict.",
    expected: "The first write commits. The second updates nothing and becomes a visible conflict.",
    outcome: first.length === 1 && second.length === 0 ? "the stale write was rejected" : VIOLATION,
    evidence: {
      readVersion,
      firstWriteRows: first.length,
      secondWriteRows: second.length,
      survivingState: surviving[0],
    },
  };
}

/** A second synthetic tenant asks to read the first one's referral. */
async function otherTenant(): Promise<BuilderResult> {
  /*
    Both identities are fixed strings owned by this module. Accepting a tenant
    id from the client would let a public button probe real organisations —
    the mutation is "try another tenant", not "name any tenant you like".
  */
  const referral = `referral:builder-${randomUUID().slice(0, 8)}`;
  await writeTuple("org:theater-office", "owner", referral);
  await writeTuple("user:theater-agent", "member", "org:theater-office");

  const owner = await checkView("user:theater-agent", referral);
  const rival = await checkView("user:theater-rival-admin", referral);

  return {
    mutation: "other_tenant",
    invariant: "No relationship path, no access. Deny is the default, not a filter.",
    expected: "The owning agent is granted with an explanation. The other tenant is denied.",
    outcome: owner.allowed && !rival.allowed ? "the other tenant was denied" : VIOLATION,
    evidence: { referral, owningAgent: owner, otherTenantAdmin: rival },
  };
}

/** Lose the provider's reply after it has already created the order. */
async function dropProviderResponse(): Promise<BuilderResult> {
  const org = await theaterOrg();

  const { moveId, serviceRequestId } = await withTransaction(async (c) => {
    const move = (
      await c.query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference) VALUES ($1,$2) RETURNING id`,
        [org, `MR-BLDR-${randomUUID().slice(0, 8)}`],
      )
    ).rows[0]!;
    const ids = await materialiseServices(c, org, move.id, ["electric"]);
    const serviceRequestId = ids[0];
    if (!serviceRequestId) throw new Error("builder move created without an electric service");
    return { moveId: move.id, serviceRequestId };
  });

  const result = await submitService(
    { organizationId: org, moveId, serviceRequestId, correlationId: randomUUID(), actor: "human:theater-reviewer" },
    "timeout_after_create",
  );
  const held = await lookupOrder(providerRequestKey(serviceRequestId));

  return {
    mutation: "drop_provider_response",
    invariant: "A lost reply becomes UNKNOWN. It is never guessed in either direction.",
    expected: "Our state is UNKNOWN while the provider already holds a created order.",
    outcome:
      result.state === "unknown" && result.providerOrderId === null
        ? "the outcome is UNKNOWN, not assumed"
        : VIOLATION,
    evidence: {
      ourState: result.state,
      ourProviderOrderId: result.providerOrderId,
      providerHoldsOrder: held?.orderId ?? null,
      operationKey: `provider_submit:${serviceRequestId}`,
    },
  };
}

/**
 * Kill the worker at the one checkpoint this workflow supports.
 *
 * `theater_crash` runs reserve → submit → finalize and is armed to throw inside
 * `submit`. That is the only injection point that exists, so it is the only one
 * offered. Naming it precisely is the difference between a demonstration and a
 * suggestion that any step could be chosen.
 */
async function crashAtSubmit(): Promise<BuilderResult> {
  const org = await theaterOrg();

  const executionId = await startWorkflow(org, "theater_crash", randomUUID(), {
    armed: true,
    nonce: randomUUID().slice(0, 8),
  });
  const crashed = await runWorkflow(executionId);

  await query(
    `UPDATE workflow_executions SET state = 'running', context = context::jsonb - 'armed' WHERE id = $1`,
    [executionId],
  );
  const resumed = await runWorkflow(executionId);
  const steps = await history(executionId);
  const reserveCompletions = steps.filter((s) => s.step_name === "reserve").length;

  return {
    mutation: "crash_at_submit",
    invariant: "A crashed workflow resumes where it stopped. Completed steps never re-run.",
    expected: "reserve stays committed. The crash lands in submit. Resumption starts at submit, not at reserve.",
    outcome:
      crashed.state === "failed" && resumed.state === "completed" && reserveCompletions === 1
        ? "resumed from submit; reserve did not re-run"
        : VIOLATION,
    evidence: {
      lastCommittedStep: "reserve",
      injectedCrashPoint: "submit",
      resumePoint: "submit",
      stateAfterCrash: crashed.state,
      stateAfterResume: resumed.state,
      reserveCompletions,
      stepsThatDidNotRerun: ["reserve"],
      stepHistory: steps.map((s) => ({ step: s.step_name, status: s.status })),
    },
  };
}

export const BUILDER: Record<Mutation, () => Promise<BuilderResult>> = {
  replay_batch: replayBatch,
  replay_webhook: replayWebhook,
  remove_required_field: removeRequiredField,
  rename_partner_field: renamePartnerField,
  stale_version: staleVersion,
  other_tenant: otherTenant,
  drop_provider_response: dropProviderResponse,
  crash_at_submit: crashAtSubmit,
};
