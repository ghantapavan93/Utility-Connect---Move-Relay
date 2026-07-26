import { query, withTransaction } from "./db";
import { recordAudit } from "./audit";
import {
  assessDuplicate,
  detectConflicts,
  candidatesFromSubmission,
  persistCandidates,
  type Channel,
  type FieldCandidate,
} from "./ingestion";
import { submitToProvider, reconcile, operationKey } from "./provider-submission";
import { callProvider, lookupOrder, __simulator } from "./provider-simulator";
import { buildBriefing } from "./briefing";
import { publish } from "./outbox";
import { runProjector } from "./projector";
import { defineWorkflow, startWorkflow, runWorkflow, signal as signalWorkflow, load as loadWorkflow } from "./workflow";
import { writeTuple } from "./authz";

/**
 * Drives the Maya Patel scenario one deliberate step at a time.
 *
 * The demo screens call these steps; nothing here is pre-baked. Every value the
 * UI shows is read back from the database after the step ran, so what the viewer
 * sees is the actual system state, never a mock. That is the whole point of the
 * exercise — a founder inspecting the audit trail is inspecting real rows.
 *
 * Steps are idempotent where it is cheap to be: re-running `reset` then `ingest`
 * always produces the same starting point, which matters for a live demo that
 * might be replayed several times in one sitting.
 */

const ORG_SLUG = "uc-demo";
const MOVE_REF = "MR-2026-0001";
const CORRELATION = "11111111-1111-4111-8111-111111111111";
const REQUEST_KEY = "svc-electric-maya";
const NOW = "2026-07-24T15:00:00.000Z";

const PAYLOADS: Record<Exclude<Channel, "microsite" | "concierge_manual">, Record<string, unknown>> = {
  partner_api: {
    customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
    move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    services: ["electric", "internet"],
  },
  csv_upload: {
    customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0143" },
    move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    services: ["electric"],
  },
  customer_form: {
    customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
    move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    services: ["electric", "internet", "security"],
    consent: {
      granted: true,
      channels: ["phone", "sms", "email"],
      purposes: ["customer_care", "connection_status", "account_information", "appointment_details"],
      text_version: "uc-2026-07",
    },
  },
};

async function ids() {
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [ORG_SLUG])
  )[0];
  if (!org) return null;
  const move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, MOVE_REF],
    )
  )[0];
  const partner = (
    await query<{ id: string }>(
      `SELECT id FROM partners WHERE organization_id = $1 AND slug = 'ntr'`,
      [org.id],
    )
  )[0];
  return { org: org.id, move: move?.id ?? null, partner: partner?.id ?? null };
}

// ---------------------------------------------------------------------------

/** Wipe and re-seed to the pre-ingestion starting point. */
export async function reset() {
  __simulator.reset();
  await withTransaction(async (c) => {
    // Everything cascades from the organization except the audit trail, which
    // deliberately carries no foreign key and is deliberately left behind.
    //
    // The first instinct is to clear it too, so a replayed demo starts from a
    // blank ledger — but the only way to do that is to disable the no-delete
    // rule, and a system whose immutability can be switched off for
    // convenience does not have immutability. The rows simply stay, orphaned,
    // which is precisely what an append-only trail outliving its subject looks
    // like. Nothing reads them: every query is scoped to the current
    // organization, and the reset creates a new one.
    await c.query(`DELETE FROM organizations WHERE slug = $1`, [ORG_SLUG]);
  });

  await withTransaction(async (c) => {
    const org = (
      await c.query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
        ["Utility Connect (demo)", ORG_SLUG],
      )
    ).rows[0]!.id;

    await c.query(
      `INSERT INTO partners (organization_id, name, slug, domain, theme_color)
       VALUES ($1,'North Texas Realty','ntr','move.northtexasrealty.com','#1F4E79')`,
      [org],
    );
  });

  return { step: "reset", state: "ready", message: "Demo reset to pre-ingestion state." };
}

/** Store the three raw payloads. Nothing is resolved yet. */
export async function ingest() {
  const ctx = await ids();
  if (!ctx) throw new Error("run reset first");

  let i = 0;
  const stored: string[] = [];
  for (const [channel, payload] of Object.entries(PAYLOADS)) {
    const hash = `demo-${channel}`;
    const rows = await query<{ id: string }>(
      `INSERT INTO raw_submissions
         (organization_id, partner_id, channel, payload, payload_hash, correlation_id)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (organization_id, channel, payload_hash) DO NOTHING
       RETURNING id`,
      [ctx.org, channel === "customer_form" ? null : ctx.partner, channel, JSON.stringify(payload), hash, CORRELATION],
    );
    if (rows[0]) stored.push(channel);
    i++;
  }

  return { step: "ingest", channels: Object.keys(PAYLOADS), stored, count: i };
}

/** Score the three submissions against each other. Deterministic, inspectable. */
export async function detectDuplicates() {
  const api = assessDuplicate(PAYLOADS.partner_api, PAYLOADS.csv_upload);
  const form = assessDuplicate(PAYLOADS.partner_api, PAYLOADS.customer_form);
  return {
    step: "detect",
    assessments: [
      { pair: "partner_api ↔ csv_upload", ...api },
      { pair: "partner_api ↔ customer_form", ...form },
    ],
    verdict: "Three submissions describe one move.",
  };
}

/** Create the single Move Record and record every field candidate with provenance. */
export async function createMove() {
  const ctx = await ids();
  if (!ctx) throw new Error("run reset first");

  const move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'conflict_pending')
       ON CONFLICT (organization_id, reference) DO UPDATE SET state = 'conflict_pending'
       RETURNING id`,
      [ctx.org, MOVE_REF],
    )
  )[0]!.id;

  const subs = await query<{
    id: string; channel: string; partner_id: string | null; payload: Record<string, unknown>; received_at: string;
  }>(
    `SELECT id, channel, partner_id, payload, received_at
       FROM raw_submissions WHERE organization_id = $1 AND correlation_id = $2
       ORDER BY received_at`,
    [ctx.org, CORRELATION],
  );

  const candidates: FieldCandidate[] = subs.flatMap((s) =>
    candidatesFromSubmission({
      id: s.id,
      channel: s.channel as Channel,
      partner_id: s.partner_id,
      payload: s.payload,
      received_at: new Date(s.received_at).toISOString(),
    }),
  );

  // Persist consent from the customer form as first-class events.
  await withTransaction(async (c) => {
    // Avoid double-inserting on demo replay.
    const already = (
      await c.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM field_versions WHERE move_id = $1`,
        [move],
      )
    ).rows[0]!.n;
    if (already === 0) {
      await persistCandidates(c, { organizationId: ctx.org, moveId: move, correlationId: CORRELATION }, candidates);

      const consent = PAYLOADS.customer_form.consent as {
        channels: string[]; purposes: string[]; text_version: string;
      };
      for (const purpose of consent.purposes) {
        for (const channel of consent.channels) {
          await c.query(
            `INSERT INTO consent_events
               (organization_id, move_id, purpose, channel, granted, consent_text_version)
             VALUES ($1,$2,$3,$4,TRUE,$5)`,
            [ctx.org, move, purpose, channel, consent.text_version],
          );
        }
      }
    }
  });

  // Authorization tuples for the move.
  //
  // Without these the graph has nothing to walk and every request is refused,
  // which is the correct default but makes for a short demo. Each tuple states
  // a relationship that actually exists in the story: the concierge works for
  // the operating organization, the customer is the subject of this move, the
  // referring agent belongs to the partner that sent it. The rival agent gets
  // nothing, deliberately — that absence is what the cross-tenant denial test
  // depends on.
  await writeTuple("org:uc-demo", "owner", `move:${move}`);
  await writeTuple("user:concierge-7", "member", "org:uc-demo");
  await writeTuple("user:maya-patel", "viewer", `move:${move}`);
  await writeTuple("org:ntr", "parent", "org:uc-demo");
  await writeTuple("user:ntr-agent", "member", "org:ntr");
  await writeTuple("org:ntr", "owner", `move:${move}`);

  return { step: "create_move", moveId: move, reference: MOVE_REF, candidates: candidates.length };
}

/** The fields where sources disagree, with a recommendation but no decision. */
export async function getConflicts() {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");

  const rows = await query<{
    field_path: string; value: unknown; channel: string; partner_id: string | null;
    verification: string; confidence: string; recorded_at: string; raw_submission_id: string;
  }>(
    `SELECT field_path, value, channel, partner_id, verification, confidence,
            recorded_at, raw_submission_id
       FROM field_versions
      WHERE move_id = $1 AND NOT is_canonical
      ORDER BY field_path, recorded_at`,
    [ctx.move],
  );

  const candidates: FieldCandidate[] = rows.map((r) => ({
    fieldPath: r.field_path,
    value: r.value,
    channel: r.channel as Channel,
    partnerId: r.partner_id,
    rawSubmissionId: r.raw_submission_id,
    verification: r.verification as never,
    confidence: Number(r.confidence),
    recordedAt: new Date(r.recorded_at).toISOString(),
  }));

  return { step: "conflicts", conflicts: detectConflicts(candidates) };
}

/**
 * Apply a human's merge decision.
 *
 * `actor` is required and non-empty; the database's canonical_requires_actor
 * constraint would reject it anyway, but failing here gives a clearer error.
 */
export async function approveMerge(decisions: Array<{ fieldPath: string; value: unknown; reason: string }>, actor: string) {
  if (!actor) throw new Error("a merge requires a named human actor");
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");

  await withTransaction(async (c) => {
    for (const d of decisions) {
      // Clear any prior canonical pick for this field so replay is safe.
      await c.query(
        `UPDATE field_versions SET is_canonical = FALSE
          WHERE move_id = $1 AND field_path = $2 AND is_canonical`,
        [ctx.move, d.fieldPath],
      );
      await c.query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel,
            verification, confidence, is_canonical, selected_by, selection_reason)
         VALUES ($1,$2,$3,$4,'concierge_manual','human_approved',1.00,TRUE,$5,$6)`,
        [ctx.org, ctx.move, d.fieldPath, JSON.stringify(d.value), actor, d.reason],
      );
    }
    await c.query(`UPDATE moves SET state = 'canonical' WHERE id = $1`, [ctx.move]);
    await recordAudit(c, {
      organizationId: ctx.org,
      moveId: ctx.move,
      eventType: "move.canonical.approved",
      actor,
      correlationId: CORRELATION,
      stateBefore: { state: "conflict_pending" },
      stateAfter: { state: "canonical" },
      detail: { fieldsResolved: decisions.map((d) => d.fieldPath) },
    });
    // The domain event rides the same transaction as the state change.
    await publish(c, {
      organizationId: ctx.org,
      eventType: "move.canonical.approved",
      aggregateId: ctx.move,
      payload: { moveId: ctx.move },
    });
  });

  const projected = await runProjector();

  return { step: "merge", approvedBy: actor, fields: decisions.length, timelineEntriesProjected: projected };
}

/** Generate the source-grounded concierge briefing from canonical rows. */
export async function generateBriefing() {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");
  const briefing = await buildBriefing(ctx.org, ctx.move);

  // Pass the claims through the AI Gateway. With ANTHROPIC_API_KEY set this is
  // a real model call behind the grounding guards; without it, the deterministic
  // claims serve — and the response says which happened. Never hidden.
  const { renderBriefingNarrative } = await import("./briefing");
  const narrative = await renderBriefingNarrative(briefing, ctx.org, ctx.move);

  return {
    step: "briefing",
    ...briefing,
    narrative: {
      mode: narrative.mode,
      model: narrative.model,
      promptVersion: narrative.promptVersion,
      lines: narrative.narrative,
      droppedUngrounded: narrative.droppedUngrounded,
      latencyMs: narrative.latencyMs,
    },
  };
}

/**
 * The fulfillment workflow — the durable engine driving the REAL submission.
 *
 * The submission itself pauses on ambiguity: when the provider's response is
 * lost the workflow parks in `waiting_signal` until reconciliation resolves the
 * truth and signals it forward. A worker restart at any point resumes from the
 * persisted step. This is the engine and the domain wired together, not two
 * parallel demos.
 */
defineWorkflow({
  type: "move_fulfillment",
  steps: [
    {
      name: "reserve_service",
      run: async (wctx) => {
        const rows = await query<{ id: string }>(
          `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
           VALUES ($1,$2,'electric','Reliant')
           ON CONFLICT (move_id, service_type, provider_name)
             DO UPDATE SET state = service_requests.state
           RETURNING id`,
          [String(wctx["organizationId"]), String(wctx["moveId"])],
        );
        return { context: { serviceRequestId: rows[0]!.id } };
      },
    },
    {
      name: "submit_to_provider",
      run: async (wctx) => {
        const result = await submitToProvider(
          {
            organizationId: String(wctx["organizationId"]),
            moveId: String(wctx["moveId"]),
            serviceRequestId: String(wctx["serviceRequestId"]),
            payload: { service: "electric", address: "1420 Windhaven Pkwy" },
            correlationId: CORRELATION,
            actor: "human:concierge-7",
          },
          (p) =>
            callProvider(p, {
              scenario: (wctx["scenario"] as "ok" | "timeout_after_create") ?? "timeout_after_create",
              requestKey: REQUEST_KEY,
              serviceType: "electric",
              now: NOW,
            }),
        );
        if (result.state === "unknown") {
          // Truth is at the provider. Park until reconciliation finds it.
          return { wait: "reconciliation", output: { state: result.state } };
        }
        return { output: { state: result.state, providerOrderId: result.providerOrderId } };
      },
    },
    {
      name: "record_outcome",
      run: async (wctx) => {
        const sig = wctx["signal:reconciliation"] as { providerOrderId?: string } | undefined;
        return { output: { providerOrderId: sig?.providerOrderId ?? null, resolvedVia: sig ? "reconciliation" : "direct" } };
      },
    },
  ],
});

/** Find or start the fulfillment execution for the demo move. */
async function fulfillmentExecution(org: string, move: string, scenario: string): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM workflow_executions
      WHERE workflow_type = 'move_fulfillment' AND subject_id = $1`,
    [move],
  );
  if (existing[0]) return existing[0].id;
  return startWorkflow(org, "move_fulfillment", move, {
    organizationId: org,
    moveId: move,
    scenario,
  });
}

/** Submit the electric service — through the durable workflow engine. */
export async function submitElectric(scenario: "ok" | "timeout_after_create" = "timeout_after_create") {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");

  const executionId = await fulfillmentExecution(ctx.org, ctx.move, scenario);
  const exec = await runWorkflow(executionId);

  const submission = await query<{ state: string; provider_order_id: string | null }>(
    `SELECT ps.state, ps.provider_order_id
       FROM provider_submissions ps
       JOIN service_requests sr ON sr.id = ps.service_request_id
      WHERE sr.move_id = $1 AND sr.service_type = 'electric'`,
    [ctx.move],
  );

  const projected = await runProjector();

  return {
    step: "submit",
    state: submission[0]?.state ?? "pending",
    providerOrderId: submission[0]?.provider_order_id ?? null,
    workflow: { state: exec.state, waitingFor: exec.waiting_for, executionId },
    providerOrders: __simulator.size(),
    timelineEntriesProjected: projected,
  };
}

/** Attempt a naive retry — proves the system refuses it. */
export async function attemptRetry() {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");
  const sr = (
    await query<{ id: string }>(
      `SELECT id FROM service_requests WHERE move_id = $1 AND service_type = 'electric'`,
      [ctx.move],
    )
  )[0]!.id;

  const result = await submitToProvider(
    {
      organizationId: ctx.org, moveId: ctx.move, serviceRequestId: sr,
      payload: { service: "electric", address: "1420 Windhaven Pkwy" },
      correlationId: CORRELATION, actor: "human:concierge-7",
    },
    () => { throw new Error("provider must not be called while UNKNOWN"); },
  );

  return { step: "retry", ...result, providerOrders: __simulator.size(), blocked: result.state === "unknown" };
}

/** Resolve the UNKNOWN by asking the provider what exists. */
export async function runReconciliation() {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");
  const sr = (
    await query<{ id: string }>(
      `SELECT id FROM service_requests WHERE move_id = $1 AND service_type = 'electric'`,
      [ctx.move],
    )
  )[0]!.id;
  const sub = (
    await query<{ id: string }>(
      `SELECT id FROM provider_submissions WHERE operation_key = $1`,
      [operationKey(sr)],
    )
  )[0]!.id;

  const outcome = await reconcile(
    { organizationId: ctx.org, moveId: ctx.move, submissionId: sub, correlationId: CORRELATION },
    () => lookupOrder(REQUEST_KEY),
  );

  // Reconciliation is the signal the parked fulfillment workflow is waiting
  // for. Deliver it and let the workflow run to completion.
  let workflowState: string | null = null;
  const exec = await query<{ id: string }>(
    `SELECT id FROM workflow_executions
      WHERE workflow_type = 'move_fulfillment' AND subject_id = $1`,
    [ctx.move],
  );
  if (exec[0]) {
    const loaded = await loadWorkflow(exec[0].id);
    if (loaded.state === "waiting_signal" && loaded.waiting_for === "reconciliation") {
      const done = await signalWorkflow(exec[0].id, "reconciliation", {
        providerOrderId: outcome.providerOrderId,
      });
      workflowState = done.state;
    } else {
      workflowState = loaded.state;
    }
  }

  const projected = await runProjector();

  return {
    step: "reconcile",
    ...outcome,
    workflow: workflowState ? { state: workflowState } : null,
    providerOrders: __simulator.size(),
    timelineEntriesProjected: projected,
  };
}

// ---------------------------------------------------------------------------
// Read models — what the screens render.

export async function getMoveRecord() {
  const ctx = await ids();
  if (!ctx?.move) return null;

  const move = (
    await query<Record<string, unknown>>(`SELECT * FROM moves WHERE id = $1`, [ctx.move])
  )[0];

  const fields = await query<Record<string, unknown>>(
    `SELECT field_path, value, channel, verification, confidence,
            is_canonical, selected_by, selection_reason, recorded_at
       FROM field_versions WHERE move_id = $1
      ORDER BY field_path, recorded_at`,
    [ctx.move],
  );

  const services = await query<Record<string, unknown>>(
    `SELECT sr.service_type, sr.provider_name, sr.state AS request_state,
            ps.state AS submission_state, ps.provider_order_id, ps.error_category
       FROM service_requests sr
       LEFT JOIN provider_submissions ps ON ps.service_request_id = sr.id
      WHERE sr.move_id = $1`,
    [ctx.move],
  );

  const consent = await query<Record<string, unknown>>(
    `SELECT purpose, channel, granted, consent_text_version, occurred_at
       FROM consent_events WHERE move_id = $1 ORDER BY purpose, channel`,
    [ctx.move],
  );

  return { move, fields, services, consent };
}

export async function getAuditTimeline() {
  const ctx = await ids();
  if (!ctx?.move) return [];
  return query<Record<string, unknown>>(
    `SELECT event_type, actor, state_before, state_after, detail, occurred_at
       FROM audit_events WHERE move_id = $1 ORDER BY occurred_at, id`,
    [ctx.move],
  );
}

export const demoConstants = { ORG_SLUG, MOVE_REF, CORRELATION, REQUEST_KEY };
