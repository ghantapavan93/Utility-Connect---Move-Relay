import { createHash, randomUUID } from "node:crypto";
import { query, withTransaction } from "./db";
import { publish, dispatch } from "./outbox";
import { defineWorkflow, startWorkflow, runWorkflow, history } from "./workflow";
import { writeTuple, checkView } from "./authz";
import { parseCsv, mapRows } from "./csv";
import { ingestReferral } from "./intake";
import { validateSubmission, quarantineSubmission } from "./contracts";

/**
 * The Failure Theater — safe, synthetic failure injection against the REAL
 * backend.
 *
 * Most demos show a happy path. This module exists so a reviewer can push the
 * system where it is supposed to hurt and watch the actual mechanism respond:
 * every scenario runs against the live database and returns the evidence rows,
 * not a scripted animation. The invariant each scenario proves is stated in its
 * result, alongside what actually happened.
 *
 * Everything here is tenant-scoped to a throwaway theater org and safe to run
 * repeatedly.
 */

/**
 * The throwaway tenant every scenario on this page runs inside.
 *
 * Exported because the signature incident composes the same fulfilment
 * services against it. Sharing the accessor rather than the slug string is
 * deliberate: two modules independently writing `'theater'` would drift the
 * moment one of them changed, and the isolation claim in the hero depends on
 * both of them meaning the same organisation.
 */
export async function theaterOrg(): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE slug = 'theater'`,
  );
  if (existing[0]) return existing[0].id;
  const created = await query<{ id: string }>(
    `INSERT INTO organizations (name, slug) VALUES ('Failure Theater','theater')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
  );
  return created[0]!.id;
}

// The result shape and the breach marker live in `theater-contract.ts`, which
// imports nothing — the browser needs them, and reaching them through this
// module pulled `pg` (and therefore `dns`) into the client bundle.
export { VIOLATION, type TheaterResult } from "./theater-contract";
import { VIOLATION, type TheaterResult } from "./theater-contract";

// ---------------------------------------------------------------------------

/**
 * The same CSV uploaded twice. The second upload must replay, not duplicate.
 *
 * This scenario used to insert a synthetic JSON row and assert a unique index
 * rejected the second copy. The index is real and the assertion was true, but
 * the card said "upload the same CSV twice" and nothing was ever uploaded and
 * no CSV was ever parsed — an audit flagged it as a claim the code did not
 * back.
 *
 * It now parses actual CSV text through the real parser and runs both rows
 * through `ingestReferral`, exactly as the upload endpoint does. The second
 * pass reuses the same content-derived batch id, so the idempotency records
 * from the first pass are found and the rows replay. That is the property worth
 * demonstrating: not that a database rejected a byte-identical insert, but that
 * a partner re-sending yesterday's export does not enrol anyone twice.
 */
export async function duplicateCsv(): Promise<TheaterResult> {
  const org = await theaterOrg();

  const csv = [
    "first_name,last_name,email,phone,move_date,to_address",
    "Maya,Patel,maya.patel@example.com,469-555-0143,2026-08-14,1420 Windhaven Pkwy Plano TX",
    "Dev,Shah,dev.shah@example.com,469-555-0180,8/20/2026,88 Legacy Dr Frisco TX",
    "",
  ].join("\n");

  // Content-derived, so "the same file" means the same bytes rather than the
  // same request. A random id here would make every upload look novel.
  const batch = createHash("sha256").update(csv).digest("hex").slice(0, 12);
  const { mapped } = mapRows(parseCsv(csv));

  const runPass = async () => {
    const statuses: string[] = [];
    for (const row of mapped) {
      const r = await ingestReferral({
        organizationId: org,
        channel: "csv_upload",
        payload: row.payload,
        idempotencyKey: `theater-csv:${batch}:${row.line}`,
      });
      statuses.push(r.status);
    }
    return statuses;
  };

  const first = await runPass();
  const second = await runPass();

  const allReplayed = second.length > 0 && second.every((s) => s === "replayed");

  return {
    scenario: "duplicate_csv",
    invariant: "Re-uploading an identical file replays; it never creates a second set of referrals.",
    outcome: allReplayed ? "second upload replayed — no duplicate referrals" : VIOLATION,
    evidence: {
      rowsParsed: mapped.length,
      batchId: batch,
      firstPass: first,
      secondPass: second,
      mechanism: "persisted idempotency_records keyed on a content hash of the file",
    },
  };
}

/** The same event delivered twice. The handler must run once. */
export async function webhookTwice(): Promise<TheaterResult> {
  const org = await theaterOrg();
  const consumer = `theater-${randomUUID().slice(0, 8)}`;

  await withTransaction((c) =>
    publish(c, {
      organizationId: org,
      eventType: "theater.webhook",
      payload: { nonce: randomUUID() },
    }),
  );

  let handled = 0;
  const firstDelivery = await dispatch(consumer, async () => {
    handled++;
  });
  const redelivery = await dispatch(consumer, async () => {
    handled++;
  });

  return {
    scenario: "webhook_twice",
    invariant: "Delivery is at-least-once; handling is exactly-once per consumer.",
    outcome: handled === firstDelivery && redelivery === 0
      ? `handler ran ${handled}× despite two deliveries`
      : VIOLATION,
    evidence: {
      firstDeliveryProcessed: firstDelivery,
      redeliveryProcessed: redelivery,
      handlerInvocations: handled,
      mechanism: "PRIMARY KEY (consumer, event_id) claim before handling",
    },
  };
}

// A workflow that crashes on its second step until disarmed.
defineWorkflow({
  type: "theater_crash",
  steps: [
    {
      name: "reserve",
      run: async (ctx) => ({ context: { reservedAt: String(ctx["nonce"]) } }),
    },
    {
      name: "submit",
      run: async (ctx) => {
        if (ctx["armed"]) throw new Error("simulated worker crash");
        return { output: { submitted: true } };
      },
    },
    { name: "finalize", run: async () => ({ output: { done: true } }) },
  ],
});

/** Kill the worker mid-workflow, restart it, prove resume without repetition. */
export async function workerCrash(): Promise<TheaterResult> {
  const org = await theaterOrg();
  const subject = randomUUID();

  const executionId = await startWorkflow(org, "theater_crash", subject, {
    armed: true,
    nonce: randomUUID().slice(0, 8),
  });

  const crashed = await runWorkflow(executionId);

  // "Restart the worker" with the fault cleared.
  await query(
    `UPDATE workflow_executions
        SET state = 'running',
            context = context::jsonb - 'armed'
      WHERE id = $1`,
    [executionId],
  );
  const resumed = await runWorkflow(executionId);
  const steps = await history(executionId);

  const reserveCompletions = steps.filter((s) => s.step_name === "reserve").length;

  return {
    scenario: "worker_crash",
    invariant: "A crashed workflow resumes where it stopped; completed steps never re-run.",
    outcome:
      crashed.state === "failed" && resumed.state === "completed" && reserveCompletions === 1
        ? "crashed at step 2, resumed, completed — step 1 ran exactly once"
        : VIOLATION,
    evidence: {
      stateAfterCrash: crashed.state,
      stateAfterResume: resumed.state,
      stepHistory: steps.map((s) => ({ step: s.step_name, status: s.status })),
      reserveCompletions,
    },
  };
}

/** A partner from another tenant tries to read a referral. Deny by default. */
export async function crossTenant(): Promise<TheaterResult> {
  const referral = `referral:theater-${randomUUID().slice(0, 8)}`;
  await writeTuple("org:theater-office", "owner", referral);
  await writeTuple("user:theater-agent", "member", "org:theater-office");

  const owner = await checkView("user:theater-agent", referral);
  const rival = await checkView("user:rival-brokerage-admin", referral);
  const anonymous = await checkView("user:nobody", referral);

  return {
    scenario: "cross_tenant",
    invariant: "No relationship path, no access. Deny is the default, not a filter.",
    outcome:
      owner.allowed && !rival.allowed && !anonymous.allowed
        ? "owner granted with explanation; rival and anonymous denied"
        : VIOLATION,
    evidence: {
      owningAgent: owner,
      rivalTenantAdmin: rival,
      anonymous,
    },
  };
}

/** Two concierges write from the same read. The second cannot silently win. */
export async function staleWrite(): Promise<TheaterResult> {
  const org = await theaterOrg();
  const move = (
    await query<{ id: string; version: number }>(
      `INSERT INTO moves (organization_id, reference)
       VALUES ($1, $2) RETURNING id, version`,
      [org, `MR-THTR-${randomUUID().slice(0, 6)}`],
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
  const final = await query<{ state: string; version: number }>(
    `SELECT state, version FROM moves WHERE id = $1`,
    [move.id],
  );

  return {
    scenario: "stale_write",
    invariant: "A stale write updates zero rows and surfaces as a conflict — never a silent overwrite.",
    outcome:
      first.length === 1 && second.length === 0
        ? "first write won; second was rejected as stale"
        : VIOLATION,
    evidence: {
      firstWriteRows: first.length,
      secondWriteRows: second.length,
      survivingState: final[0],
    },
  };
}

/** A partner's schema drifts. The payload is quarantined, never force-fed. */
export async function schemaDrift(): Promise<TheaterResult> {
  const org = await theaterOrg();

  // The partner renamed move.date to moveDate and dropped the email — the
  // classic unannounced integration change.
  const drifted = {
    customer: { first_name: "Maya", last_name: "Patel", phone: "469-555-0142" },
    move: { moveDate: "08/16/2026", to_address: "1420 Windhaven Pkwy" },
  };

  const validation = validateSubmission("partner_api", drifted);
  let quarantineId: string | null = null;
  if (!validation.ok) {
    quarantineId = await quarantineSubmission(org, "partner_api", drifted, validation);
  }

  return {
    scenario: "schema_drift",
    invariant: "A payload failing its channel contract is quarantined with reasons — never dropped, never force-fed.",
    outcome: !validation.ok && quarantineId
      ? `quarantined with ${validation.issues.length} machine-readable issues`
      : VIOLATION,
    evidence: {
      contractVersion: validation.version,
      issues: validation.ok ? [] : validation.issues,
      quarantineId,
    },
  };
}

export const SCENARIOS: Record<string, () => Promise<TheaterResult>> = {
  duplicate_csv: duplicateCsv,
  webhook_twice: webhookTwice,
  worker_crash: workerCrash,
  cross_tenant: crossTenant,
  stale_write: staleWrite,
  schema_drift: schemaDrift,
};
