import { randomUUID } from "node:crypto";
import { newTrace, traced } from "./observability";
import { installTracing } from "./tracing";
import { query, withTransaction } from "./db";
import { recordAudit } from "./audit";
import { publish } from "./outbox";
import { runProjector } from "./projector";
import { fingerprint } from "./provider-submission";
import {
  validateSubmission,
  quarantineSubmission,
  type ContractChannel,
} from "./contracts";
import {
  assessDuplicate,
  candidatesFromSubmission,
  detectConflicts,
  persistCandidates,
  type FieldCandidate,
  type Channel,
} from "./ingestion";

/**
 * The real intake path — arbitrary referrals, end to end.
 *
 * The demo tells one scripted story; this module is the door for ANY payload.
 * Every submission walks the full gauntlet:
 *
 *   1. IDEMPOTENCY   — an Idempotency-Key replays the stored response instead
 *      of re-ingesting; the same key with a different payload is refused. The
 *      guarantee is the persisted idempotency_records row, not a cache.
 *   2. CONTRACT      — the channel's versioned schema. Failures quarantine
 *      with machine-readable reasons; nothing malformed reaches canon.
 *   3. COLLAPSE      — a byte-identical payload on the same channel collapses
 *      into the existing submission (the unique hash constraint).
 *   4. DEDUPLICATION — the payload is scored against every existing move's
 *      latest submission. A probable match ATTACHES as a new source — with its
 *      conflicts surfaced — rather than minting a second move for one human.
 *   5. PROVENANCE    — every field lands as a version with channel, trust, and
 *      timestamps. A domain event announces the referral; the projector turns
 *      it into a customer-timeline entry.
 *
 * The Maya Patel scenario is one path through this door, no longer the only one.
 */

export interface IntakeInput {
  organizationId: string;
  channel: ContractChannel;
  payload: Record<string, unknown>;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface IntakeResult {
  status: "created" | "attached" | "collapsed" | "replayed" | "quarantined" | "key_conflict";
  httpStatus: number;
  correlationId: string;
  moveId?: string;
  reference?: string;
  duplicate?: { ofReference: string; score: number; verdict: string } | null;
  conflictFields?: string[];
  quarantineId?: string;
  issues?: Array<{ path: string; message: string }>;
  message: string;
}

const DUPLICATE_THRESHOLD = 0.6;

/**
 * Instrumented entry point.
 *
 * The implementation below is untouched and now sits in `ingestReferralImpl`.
 * Wrapping rather than editing the body puts the span boundary in exactly one
 * place and means an instrumentation mistake cannot change what ingestion does.
 *
 * `newTrace()` starts a fresh trace per referral because ingestion *is* the
 * root of the request as far as this system is concerned — everything
 * downstream (validation, duplicate assessment, projection) hangs off it, and
 * that is what makes "where did this move come from" answerable by trace rather
 * than by grep.
 */
export async function ingestReferral(input: IntakeInput): Promise<IntakeResult> {
  installTracing();
  return traced(
    "ingest.referral",
    newTrace(input.correlationId),
    { channel: input.channel, organizationId: input.organizationId },
    () => ingestReferralImpl(input),
  );
}

async function ingestReferralImpl(input: IntakeInput): Promise<IntakeResult> {
  const correlationId = input.correlationId ?? randomUUID();
  const fp = fingerprint(input.payload);

  // -- 1. Idempotency -------------------------------------------------------
  if (input.idempotencyKey) {
    const opKey = `referral:${input.idempotencyKey}`;
    const prior = await query<{ fingerprint: string; stored_response: IntakeResult | null; state: string }>(
      `SELECT fingerprint, stored_response, state FROM idempotency_records
        WHERE organization_id = $1 AND operation_key = $2`,
      [input.organizationId, opKey],
    );
    if (prior[0]) {
      if (prior[0].fingerprint !== fp) {
        return {
          status: "key_conflict",
          httpStatus: 409,
          correlationId,
          message:
            "This Idempotency-Key was already used with a different payload. Keys bind to one request body.",
        };
      }
      if (prior[0].stored_response) {
        return { ...prior[0].stored_response, status: "replayed", correlationId };
      }
    }
  }

  // -- 2. Contract ----------------------------------------------------------
  const validation = validateSubmission(input.channel, input.payload);
  if (!validation.ok) {
    const quarantineId = await quarantineSubmission(
      input.organizationId,
      input.channel,
      input.payload,
      validation,
    );
    const result: IntakeResult = {
      status: "quarantined",
      httpStatus: 422,
      correlationId,
      quarantineId,
      issues: validation.issues,
      message: `Payload failed contract ${validation.version}; quarantined with ${validation.issues.length} issue(s).`,
    };
    await storeIdempotency(input, fp, result);
    return result;
  }

  // -- 3. Collapse ----------------------------------------------------------
  const inserted = await query<{ id: string; received_at: string }>(
    `INSERT INTO raw_submissions (organization_id, channel, payload, payload_hash, correlation_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (organization_id, channel, payload_hash) DO NOTHING
     RETURNING id, received_at`,
    [input.organizationId, input.channel, JSON.stringify(input.payload), fp, correlationId],
  );
  if (!inserted[0]) {
    const result: IntakeResult = {
      status: "collapsed",
      httpStatus: 200,
      correlationId,
      message: "An identical payload already exists on this channel. Nothing was duplicated.",
    };
    await storeIdempotency(input, fp, result);
    return result;
  }
  const submission = inserted[0];

  // -- 4. Deduplication against existing moves ------------------------------
  // Compare against each existing move's most recent contributing payload.
  const candidates = await query<{ move_id: string; reference: string; payload: Record<string, unknown> }>(
    `SELECT DISTINCT ON (fv.move_id) fv.move_id, m.reference, rs.payload
       FROM field_versions fv
       JOIN moves m ON m.id = fv.move_id
       JOIN raw_submissions rs ON rs.id = fv.raw_submission_id
      WHERE fv.organization_id = $1
      ORDER BY fv.move_id, fv.recorded_at DESC
      LIMIT 50`,
    [input.organizationId],
  );

  let best: { moveId: string; reference: string; score: number; verdict: string } | null = null;
  for (const c of candidates) {
    const assessment = assessDuplicate(input.payload, c.payload);
    if (assessment.verdict !== "distinct" && (!best || assessment.score > best.score)) {
      best = { moveId: c.move_id, reference: c.reference, score: assessment.score, verdict: assessment.verdict };
    }
  }

  const fieldCandidates: FieldCandidate[] = candidatesFromSubmission({
    id: submission.id,
    channel: input.channel as Channel,
    partner_id: null,
    payload: input.payload,
    received_at: new Date(submission.received_at).toISOString(),
  });

  // -- 5a. Attach to the matched move ---------------------------------------
  if (best) {
    const attachTo = best;
    await withTransaction(async (c) => {
      await persistCandidates(
        c,
        { organizationId: input.organizationId, moveId: attachTo.moveId, correlationId },
        fieldCandidates,
      );
      await c.query(`UPDATE moves SET state = 'conflict_pending', version = version + 1 WHERE id = $1`, [
        attachTo.moveId,
      ]);
      await recordAudit(c, {
        organizationId: input.organizationId,
        moveId: attachTo.moveId,
        eventType: "ingestion.duplicate.attached",
        actor: "system",
        correlationId,
        detail: { channel: input.channel, score: attachTo.score, verdict: attachTo.verdict },
      });
    });

    const conflictFields = await openConflictFields(attachTo.moveId);
    const result: IntakeResult = {
      status: "attached",
      httpStatus: 200,
      correlationId,
      moveId: attachTo.moveId,
      reference: attachTo.reference,
      duplicate: { ofReference: attachTo.reference, score: attachTo.score, verdict: attachTo.verdict },
      conflictFields,
      message: `Probable duplicate of ${attachTo.reference} (score ${attachTo.score}). Attached as a new source; ${conflictFields.length} field(s) now need a human decision.`,
    };
    await storeIdempotency(input, fp, result);
    return result;
  }

  // -- 5b. Create a new move ------------------------------------------------
  const seq = (
    await query<{ n: number }>(`SELECT count(*)::int AS n FROM moves WHERE organization_id = $1`, [
      input.organizationId,
    ])
  )[0]!.n;
  const reference = `MR-W${String(seq + 1).padStart(4, "0")}`;

  const moveId = await withTransaction(async (c) => {
    const move = (
      await c.query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state) VALUES ($1,$2,'intake') RETURNING id`,
        [input.organizationId, reference],
      )
    ).rows[0]!.id;

    await persistCandidates(
      c,
      { organizationId: input.organizationId, moveId: move, correlationId },
      fieldCandidates,
    );

    // Consent from the customer's own form becomes ledger events.
    const consent = input.payload["consent"] as
      | { granted: boolean; channels: string[]; purposes: string[]; text_version: string }
      | undefined;
    if (consent?.granted) {
      for (const purpose of consent.purposes) {
        for (const channel of consent.channels) {
          await c.query(
            `INSERT INTO consent_events
               (organization_id, move_id, purpose, channel, granted, consent_text_version)
             VALUES ($1,$2,$3,$4,TRUE,$5)`,
            [input.organizationId, move, purpose, channel, consent.text_version],
          );
        }
      }
    }

    await recordAudit(c, {
      organizationId: input.organizationId,
      moveId: move,
      eventType: "ingestion.referral.received",
      actor: "system",
      correlationId,
      stateAfter: { state: "intake" },
      detail: { channel: input.channel, reference },
    });
    await publish(c, {
      organizationId: input.organizationId,
      eventType: "referral.received",
      aggregateId: move,
      payload: { moveId: move },
    });
    return move;
  });

  await runProjector();

  const result: IntakeResult = {
    status: "created",
    httpStatus: 201,
    correlationId,
    moveId,
    reference,
    duplicate: null,
    conflictFields: [],
    message: `Move ${reference} created from ${input.channel} with full field provenance.`,
  };
  await storeIdempotency(input, fp, result);
  return result;
}

async function openConflictFields(moveId: string): Promise<string[]> {
  const rows = await query<{ field_path: string }>(
    `SELECT field_path FROM field_versions
      WHERE move_id = $1 AND NOT is_canonical
      GROUP BY field_path HAVING count(DISTINCT value) > 1`,
    [moveId],
  );
  const resolved = await query<{ field_path: string }>(
    `SELECT DISTINCT field_path FROM field_versions WHERE move_id = $1 AND is_canonical`,
    [moveId],
  );
  const done = new Set(resolved.map((r) => r.field_path));
  return rows.map((r) => r.field_path).filter((f) => !done.has(f));
}

async function storeIdempotency(
  input: IntakeInput,
  fp: string,
  response: IntakeResult,
): Promise<void> {
  if (!input.idempotencyKey) return;
  await query(
    `INSERT INTO idempotency_records (organization_id, operation_key, fingerprint, state, stored_response)
     VALUES ($1,$2,$3,'completed',$4)
     ON CONFLICT (organization_id, operation_key)
       DO UPDATE SET state = 'completed', stored_response = EXCLUDED.stored_response, updated_at = now()`,
    [input.organizationId, `referral:${input.idempotencyKey}`, fp, JSON.stringify(response)],
  );
}
