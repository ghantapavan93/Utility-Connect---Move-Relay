import { randomUUID } from "node:crypto";
import { query, withTransaction } from "./db";
import { publish, dispatch } from "./outbox";
import { defineWorkflow, startWorkflow, runWorkflow, history } from "./workflow";
import { writeTuple, checkView } from "./authz";
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

async function theaterOrg(): Promise<string> {
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

export interface TheaterResult {
  scenario: string;
  invariant: string;
  outcome: string;
  evidence: Record<string, unknown>;
}

// ---------------------------------------------------------------------------

/** The same CSV uploaded twice. The second upload must collapse, not duplicate. */
export async function duplicateCsv(): Promise<TheaterResult> {
  const org = await theaterOrg();
  const payload = { customer: { first_name: "Maya" }, batch: randomUUID().slice(0, 8) };
  const hash = `theater-csv-${payload.batch}`;

  const insert = () =>
    query<{ id: string }>(
      `INSERT INTO raw_submissions (organization_id, channel, payload, payload_hash, correlation_id)
       VALUES ($1,'csv_upload',$2,$3,$4)
       ON CONFLICT (organization_id, channel, payload_hash) DO NOTHING RETURNING id`,
      [org, JSON.stringify(payload), hash, randomUUID()],
    );

  const first = await insert();
  const second = await insert();

  return {
    scenario: "duplicate_csv",
    invariant: "Identical payloads on one channel collapse to a single submission.",
    outcome: second.length === 0 ? "second upload collapsed — no duplicate row" : "VIOLATION",
    evidence: {
      firstInsertReturnedRow: first.length === 1,
      secondInsertReturnedRow: second.length === 1,
      constraint: "UNIQUE (organization_id, channel, payload_hash)",
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
      : "VIOLATION",
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
        : "VIOLATION",
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
        : "VIOLATION",
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
        : "VIOLATION",
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
      : "VIOLATION",
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
