import { randomUUID } from "node:crypto";
import { newTrace, traced } from "./observability";
import { installTracing } from "./tracing";
import { query, withTransaction } from "./db";
import { materialiseServices } from "./fulfillment";
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
 * Write a payload's consent grants to the ledger.
 *
 * One function called from both the create and the attach paths, because it was
 * previously inlined in only one of them and the omission was invisible.
 *
 * Every (purpose, channel) pair is its own row. Consent is not a boolean —
 * agreeing to be phoned about an appointment is not agreeing to be emailed
 * about an account — and a single "granted: true" cannot answer the only
 * question that matters later, which is whether *this* contact was permitted.
 *
 * The wording version travels with it, so a grant can be read back against the
 * text the customer actually saw rather than whatever the current text says.
 */
async function recordConsentFrom(
  c: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  organizationId: string,
  moveId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const consent = payload["consent"] as
    | { granted?: boolean; channels?: string[]; purposes?: string[]; text_version?: string }
    | undefined;
  if (!consent?.granted || !consent.text_version) return;

  for (const purpose of consent.purposes ?? []) {
    for (const channel of consent.channels ?? []) {
      await c.query(
        `INSERT INTO consent_events
           (organization_id, move_id, purpose, channel, granted, consent_text_version)
         VALUES ($1,$2,$3,$4,TRUE,$5)`,
        [organizationId, moveId, purpose, channel, consent.text_version],
      );
    }
  }
}

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

  /*
    Which partner this referral is attributed to.

    This was `null`, unconditionally. Every channel's contract carries
    `referral.partner_slug` and the column exists on every field version, and
    the value was dropped on the floor between them — so a brokerage that
    referred a household through the API was never attributed to it, and their
    own partner projection answered "No engagement attributed to this partner"
    about a referral they had just sent.

    Attribution is one of the guarantees this system is *for*: which partner
    brought this move is the question the whole partner surface exists to
    answer. Unresolved slugs stay null rather than guessing — a referral naming
    a brokerage nobody has onboarded is attributed to nobody, which is the
    honest answer and is visible as one.
  */
  const partnerSlug = (input.payload["referral"] as { partner_slug?: unknown } | undefined)
    ?.partner_slug;
  const partnerId =
    typeof partnerSlug === "string"
      ? ((
          await query<{ id: string }>(
            `SELECT id FROM partners WHERE organization_id = $1 AND slug = $2`,
            [input.organizationId, partnerSlug],
          )
        )[0]?.id ?? null)
      : null;

  const fieldCandidates: FieldCandidate[] = candidatesFromSubmission({
    id: submission.id,
    channel: input.channel as Channel,
    partner_id: partnerId,
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
      /*
        A later source may name services the first one did not — the customer
        adding home security on their own form is the demo's own scenario. The
        insert is idempotent on (move, service, provider), so services both
        sources agree on are not duplicated.
      */
      await materialiseServices(c, input.organizationId, attachTo.moveId, input.payload["services"]);

      /*
        Consent, on the attach path too.

        This was only written when a referral *created* a move, and the customer
        form is both the channel that carries consent and — because the customer
        usually confirms a move a partner already referred — the channel that
        most often attaches. So the commonest way a household grants consent was
        the one path that discarded it.

        Silently. The referral returned 200, the record showed the customer as a
        source, and the consent ledger stayed empty, which on this system means
        "they never agreed". Of everything that could be dropped here, this is
        the one with legal weight.
      */
      await recordConsentFrom(c, input.organizationId, attachTo.moveId, input.payload);
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

    /*
      The move's owner, in the authorization graph.

      Authorization here is relationship-based: a concierge reaches a case by
      being a member of an organization that owns it, and with no owning edge
      there is no path at all. Only the demo orchestrator wrote these tuples, and
      only for its one scripted move — so every move from the real intake path
      was structurally unreachable. Not merely unfulfillable: a `GET` on it
      returned 403 to the very operator who had just created it.

      Written inside the same transaction as the move, because a move that
      exists with nobody able to reach it is worse than no move at all.
    */
    await c.query(
      `INSERT INTO auth_tuples (subject, relation, object)
       SELECT 'org:' || o.slug, 'owner', 'move:' || $1
         FROM organizations o WHERE o.id = $2
       ON CONFLICT DO NOTHING`,
      [move, input.organizationId],
    );

    /*
      And the operator, as a member of the owning organization.

      The edge above makes the organization the owner; it does not give any
      human a path. `checkView` reaches a move through membership of an owning
      org, and that membership was written only by the demo orchestrator — so a
      move created through intake was owned by an organization nobody belonged
      to, and the console returned 403 on the rows it had just created. The
      comment above this one says a move nobody can reach is worse than no move
      at all; this is the other half of meaning it.

      `user:concierge-7` is the identity the console sends and the concierge
      entry in `DEMO_ACTORS`. Naming it here is the same demo stand-in as the
      `X-Actor` header: authorization is real, identity is not, and both are
      stated wherever they appear.
    */
    await c.query(
      `INSERT INTO auth_tuples (subject, relation, object)
       SELECT 'user:concierge-7', 'member', 'org:' || o.slug
         FROM organizations o WHERE o.id = $1
       ON CONFLICT DO NOTHING`,
      [input.organizationId],
    );

    /*
      And the referring partner, where the referral named one.

      Attribution and access are two halves of the same claim. Recording that a
      brokerage referred a household while giving them no path to read it means
      their own partner projection answers "no engagement attributed" about
      their own referral — which was measurably the case: a partner-API referral
      naming `ntr` returned 403 to `user:ntr-agent`.

      Scoped to the move they actually referred, so this grants a path to that
      record and to nothing else. A partner still sees only the partner
      projection of it, which withholds provider internals and every other
      partner's work.
    */
    if (partnerId) {
      await c.query(
        `INSERT INTO auth_tuples (subject, relation, object)
         SELECT 'org:' || p.slug, 'owner', 'move:' || $1
           FROM partners p WHERE p.id = $2
         ON CONFLICT DO NOTHING`,
        [move, partnerId],
      );
    }

    /*
      The services this referral asked for become rows that can be fulfilled.

      Without this a move created through the real intake path had no service
      requests at all, so it could never be submitted to a provider, time out,
      or be reconciled. The only code that created one lived inside the demo
      workflow and hardcoded electricity — which meant every move outside the
      one scripted narrative was silently a dead end.
    */
    await materialiseServices(c, input.organizationId, move, input.payload["services"]);

    await recordConsentFrom(c, input.organizationId, move, input.payload);

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
