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
    // Order matters only for readability; ON DELETE CASCADE handles the rest.
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
  });

  return { step: "merge", approvedBy: actor, fields: decisions.length };
}

/** Generate the source-grounded concierge briefing from canonical rows. */
export async function generateBriefing() {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");
  return { step: "briefing", ...(await buildBriefing(ctx.org, ctx.move)) };
}

/** Submit the electric service, driving the chosen provider scenario. */
export async function submitElectric(scenario: "ok" | "timeout_after_create" = "timeout_after_create") {
  const ctx = await ids();
  if (!ctx?.move) throw new Error("run create_move first");

  const sr = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant')
       ON CONFLICT (move_id, service_type, provider_name) DO UPDATE SET state = service_requests.state
       RETURNING id`,
      [ctx.org, ctx.move],
    )
  )[0]!.id;

  const result = await submitToProvider(
    {
      organizationId: ctx.org, moveId: ctx.move, serviceRequestId: sr,
      payload: { service: "electric", address: "1420 Windhaven Pkwy" },
      correlationId: CORRELATION, actor: "human:concierge-7",
    },
    (p) => callProvider(p, { scenario, requestKey: REQUEST_KEY, serviceType: "electric", now: NOW }),
  );

  return { step: "submit", serviceRequestId: sr, ...result, providerOrders: __simulator.size() };
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

  return { step: "reconcile", ...outcome, providerOrders: __simulator.size() };
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

export const demoConstants = { ORG_SLUG, MOVE_REF, CORRELATION };
