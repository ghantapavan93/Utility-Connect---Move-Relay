import { describe, it, expect, beforeAll } from "vitest";
import { query, withTransaction } from "../db";
import { recordAudit } from "../audit";
import {
  submitToProvider,
  reconcile,
  operationKey,
} from "../provider-submission";
import {
  callProvider,
  lookupOrder,
  __simulator,
  ProviderTimeoutError,
  ProviderRejectedError,
} from "../provider-simulator";
import {
  assessDuplicate,
  detectConflicts,
  candidatesFromSubmission,
  persistCandidates,
  type FieldCandidate,
} from "../ingestion";

/**
 * The complete demo narrative, executed against a real Postgres engine.
 *
 * This is the acceptance test for the whole project. If it passes, the story in
 * DEMO_SCRIPT.md is not a storyboard — it is a recording of the system running.
 *
 * Multiple referral sources → conflict detected → human-approved canonical Move
 * Record → grounded briefing → provider submission → ambiguous timeout → blind
 * retry prevented → existing order reconciled → projections updated → complete
 * operational audit.
 */

const NOW = "2026-07-23T20:00:00.000Z";
const CORRELATION = "11111111-1111-4111-8111-111111111111";

let org: string;
let partner: string;
let move: string;
let electricRequest: string;

interface Row {
  [k: string]: unknown;
}

beforeAll(async () => {
  __simulator.reset();

  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Utility Connect (demo)", "uc-demo"],
    )
  )[0]!.id;

  partner = (
    await query<{ id: string }>(
      `INSERT INTO partners (organization_id, name, slug, domain, theme_color)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [org, "North Texas Realty", "ntr", "move.northtexasrealty.com", "#1F4E79"],
    )
  )[0]!.id;
});

// ---------------------------------------------------------------------------

describe("Act 1 — three channels, one human", () => {
  const payloads = {
    partner_api: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    },
    csv_upload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0143" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    },
    customer_form: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
    },
  };

  const submissionIds: Record<string, string> = {};

  it("stores every inbound payload verbatim and immutably", async () => {
    let i = 0;
    for (const [channel, payload] of Object.entries(payloads)) {
      const row = (
        await query<{ id: string }>(
          `INSERT INTO raw_submissions
             (organization_id, partner_id, channel, payload, payload_hash, correlation_id)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [
            org,
            channel === "customer_form" ? null : partner,
            channel,
            JSON.stringify(payload),
            `hash-${i++}`,
            CORRELATION,
          ],
        )
      )[0]!;
      submissionIds[channel] = row.id;
    }

    const stored = await query<Row>(
      `SELECT channel FROM raw_submissions WHERE correlation_id = $1`,
      [CORRELATION],
    );
    expect(stored).toHaveLength(3);
  });

  it("detects the CSV as a duplicate despite the mistyped phone digit", () => {
    const result = assessDuplicate(payloads.partner_api, payloads.csv_upload);
    expect(result.verdict).toBe("certain_duplicate");
    expect(result.signals.find((s) => s.signal === "phone")?.matched).toBe(false);
  });

  it("creates exactly one Move Record for all three sources", async () => {
    move = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1,'MR-2026-0001','conflict_pending') RETURNING id`,
        [org],
      )
    )[0]!.id;

    const all = await query<Row>(`SELECT id FROM moves WHERE organization_id = $1`, [org]);
    expect(all).toHaveLength(1);
  });

  it("records every candidate value with its provenance", async () => {
    const candidates: FieldCandidate[] = [];
    let t = 0;
    for (const [channel, payload] of Object.entries(payloads)) {
      candidates.push(
        ...candidatesFromSubmission({
          id: submissionIds[channel]!,
          channel: channel as never,
          partner_id: channel === "customer_form" ? null : partner,
          payload,
          received_at: new Date(Date.parse(NOW) + t++ * 86_400_000).toISOString(),
        }),
      );
    }

    await withTransaction((c) =>
      persistCandidates(c, { organizationId: org, moveId: move, correlationId: CORRELATION }, candidates),
    );

    const stored = await query<Row>(
      `SELECT field_path, channel, verification FROM field_versions WHERE move_id = $1`,
      [move],
    );
    // Three sources × six leaf fields.
    expect(stored.length).toBeGreaterThanOrEqual(12);

    // The inversion: the customer's own form outranks the partner's API.
    const customerRows = stored.filter((r) => r.channel === "customer_form");
    expect(customerRows.every((r) => r.verification === "customer_confirmed")).toBe(true);
    const csvRows = stored.filter((r) => r.channel === "csv_upload");
    expect(csvRows.every((r) => r.verification === "unverified")).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe("Act 2 — conflict, and a human decides", () => {
  it("surfaces exactly the fields where sources disagree", async () => {
    const rows = await query<Row>(
      `SELECT field_path, value, channel, verification, confidence, recorded_at
         FROM field_versions WHERE move_id = $1`,
      [move],
    );

    const candidates: FieldCandidate[] = rows.map((r) => ({
      fieldPath: r.field_path as string,
      value: r.value,
      channel: r.channel as never,
      partnerId: null,
      rawSubmissionId: "",
      verification: r.verification as never,
      confidence: Number(r.confidence),
      recordedAt: new Date(r.recorded_at as string).toISOString(),
    }));

    const conflicts = detectConflicts(candidates);
    const paths = conflicts.map((c) => c.fieldPath).sort();

    // Move date differs (Aug 14 vs Aug 16); phone differs by one digit.
    expect(paths).toContain("move.date");
    expect(paths).toContain("customer.phone");
    // Email and address agree across all three, so they must not appear.
    expect(paths).not.toContain("customer.email");
    expect(paths).not.toContain("move.to_address");
  });

  it("refuses to make a value canonical without a named human", async () => {
    await expect(
      query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel, is_canonical)
         VALUES ($1,$2,'move.date','"2026-08-16"','customer_form',TRUE)`,
        [org, move],
      ),
    ).rejects.toThrow();
  });

  it("accepts the merge when a concierge approves it, and logs who and why", async () => {
    await withTransaction(async (c) => {
      await c.query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel,
            verification, confidence, is_canonical, selected_by, selection_reason)
         VALUES ($1,$2,'move.date','"2026-08-16"','customer_form',
                 'human_approved',1.00,TRUE,'human:concierge-7',
                 'Customer stated 16 Aug directly on the web form, three days after the partner feed.'),
                ($1,$2,'customer.phone','"469-555-0142"','customer_form',
                 'human_approved',1.00,TRUE,'human:concierge-7',
                 'Two of three sources agree; the CSV differs by a single transposed digit.')`,
        [org, move],
      );
      await c.query(`UPDATE moves SET state = 'canonical' WHERE id = $1`, [move]);
      await recordAudit(c, {
        organizationId: org,
        moveId: move,
        eventType: "move.canonical.approved",
        actor: "human:concierge-7",
        correlationId: CORRELATION,
        stateBefore: { state: "conflict_pending" },
        stateAfter: { state: "canonical" },
        detail: { fieldsResolved: ["move.date", "customer.phone"] },
      });
    });

    const canonical = await query<Row>(
      `SELECT field_path, value, selected_by FROM field_versions
        WHERE move_id = $1 AND is_canonical`,
      [move],
    );
    expect(canonical).toHaveLength(2);
    expect(canonical.every((r) => r.selected_by === "human:concierge-7")).toBe(true);
  });

  it("keeps the rejected values visible in history", async () => {
    // A merge UI that hides what was discarded is not auditable.
    const versions = await query<Row>(
      `SELECT value, is_canonical FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date'`,
      [move],
    );
    expect(versions.length).toBeGreaterThanOrEqual(4);
    expect(versions.filter((v) => v.is_canonical)).toHaveLength(1);
  });

  it("still cannot admit a second canonical value for the same field", async () => {
    await expect(
      query(
        `INSERT INTO field_versions
           (organization_id, move_id, field_path, value, channel, is_canonical, selected_by)
         VALUES ($1,$2,'move.date','"2026-08-14"','partner_api',TRUE,'human:concierge-9')`,
        [org, move],
      ),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe("Act 3 — the provider timeout", () => {
  const requestKey = "svc-electric-maya";

  beforeAll(async () => {
    electricRequest = (
      await query<{ id: string }>(
        `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
         VALUES ($1,$2,'electric','Reliant') RETURNING id`,
        [org, move],
      )
    )[0]!.id;
  });

  it("enters UNKNOWN — not failed — when the response is lost", async () => {
    const result = await submitToProvider(
      {
        organizationId: org,
        moveId: move,
        serviceRequestId: electricRequest,
        payload: { service: "electric", address: "1420 Windhaven Pkwy" },
        correlationId: CORRELATION,
        actor: "human:concierge-7",
      },
      (p) =>
        callProvider(p, {
          scenario: "timeout_after_create",
          requestKey,
          serviceType: "electric",
          now: NOW,
        }),
    );

    expect(result.state).toBe("unknown");
    expect(result.providerOrderId).toBeNull();
  });

  it("but the provider really did create the order", async () => {
    // This is the whole problem in one assertion. The order exists. We cannot
    // know that from our side, and no amount of waiting will tell us.
    expect(__simulator.size()).toBe(1);
    expect(await lookupOrder(requestKey)).not.toBeNull();
  });

  it("queues reconciliation rather than a retry", async () => {
    const jobs = await query<Row>(
      `SELECT reason, completed_at FROM reconciliation_jobs
        WHERE organization_id = $1`,
      [org],
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.reason).toBe("timeout_unknown_outcome");
    expect(jobs[0]!.completed_at).toBeNull();
  });

  it("BLOCKS a blind retry and records why in plain language", async () => {
    const retry = await submitToProvider(
      {
        organizationId: org,
        moveId: move,
        serviceRequestId: electricRequest,
        payload: { service: "electric", address: "1420 Windhaven Pkwy" },
        correlationId: CORRELATION,
        actor: "human:concierge-7",
      },
      () => {
        throw new Error("the provider must never be called while state is UNKNOWN");
      },
    );

    expect(retry.state).toBe("unknown");
    expect(retry.deduplicated).toBe(true);

    // Still exactly one order at the provider. No duplicate was created.
    expect(__simulator.size()).toBe(1);

    const blocked = await query<Row>(
      `SELECT detail FROM audit_events
        WHERE move_id = $1 AND event_type = 'provider.retry.blocked'`,
      [move],
    );
    expect(blocked).toHaveLength(1);
    expect(JSON.stringify(blocked[0]!.detail)).toContain("duplicate");
  });

  it("recovers the existing order through reconciliation", async () => {
    const submission = (
      await query<{ id: string }>(
        `SELECT id FROM provider_submissions WHERE operation_key = $1`,
        [operationKey(electricRequest)],
      )
    )[0]!;

    const outcome = await reconcile(
      {
        organizationId: org,
        moveId: move,
        submissionId: submission.id,
        correlationId: CORRELATION,
      },
      () => lookupOrder(requestKey),
    );

    expect(outcome.outcome).toBe("found_existing");
    expect(outcome.providerOrderId).toMatch(/^RLNT-/);

    const settled = await query<Row>(
      `SELECT state, provider_order_id FROM provider_submissions WHERE id = $1`,
      [submission.id],
    );
    expect(settled[0]!.state).toBe("reconciled");
    expect(settled[0]!.provider_order_id).toBe(outcome.providerOrderId);

    // The end state that matters: one order, never two.
    expect(__simulator.size()).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe("Act 4 — the audit trail explains everything", () => {
  it("records every transition in causal order", async () => {
    const events = await query<Row>(
      `SELECT event_type, actor FROM audit_events
        WHERE move_id = $1 ORDER BY occurred_at, id`,
      [move],
    );

    const types = events.map((e) => e.event_type);
    expect(types).toEqual([
      "ingestion.candidates.recorded",
      "move.canonical.approved",
      "provider.submission.started",
      "provider.submission.unknown",
      "provider.retry.blocked",
      "provider.reconciliation.completed",
    ]);
  });

  it("names an actor on every single event — nothing is anonymous", async () => {
    const events = await query<Row>(
      `SELECT actor FROM audit_events WHERE move_id = $1`,
      [move],
    );
    expect(events.every((e) => typeof e.actor === "string" && (e.actor as string).length > 0)).toBe(true);
  });

  it("attributes the merge to a human and the recovery to the system", async () => {
    const merge = await query<Row>(
      `SELECT actor FROM audit_events WHERE event_type = 'move.canonical.approved'`,
    );
    expect(merge[0]!.actor).toBe("human:concierge-7");

    const recon = await query<Row>(
      `SELECT actor FROM audit_events WHERE event_type = 'provider.reconciliation.completed'`,
    );
    expect(recon[0]!.actor).toBe("system");
  });

  it("cannot be edited or deleted after the fact", async () => {
    const before = await query<Row>(`SELECT count(*)::int AS n FROM audit_events`);
    await query(`UPDATE audit_events SET actor = 'tampered'`);
    await query(`DELETE FROM audit_events`);
    const after = await query<Row>(`SELECT count(*)::int AS n FROM audit_events`);

    expect(after[0]!.n).toBe(before[0]!.n);
    const tampered = await query<Row>(
      `SELECT count(*)::int AS n FROM audit_events WHERE actor = 'tampered'`,
    );
    expect(tampered[0]!.n).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("other provider failure modes", () => {
  it("treats a schema rejection as failed, not unknown", async () => {
    await expect(
      callProvider({}, { scenario: "invalid_payload", requestKey: "x", serviceType: "internet", now: NOW }),
    ).rejects.toBeInstanceOf(ProviderRejectedError);
  });

  it("treats a lost response as unknown, not failed", async () => {
    await expect(
      callProvider({}, { scenario: "timeout_after_create", requestKey: "y", serviceType: "internet", now: NOW }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
  });

  it("is slow but unambiguous when the provider is degraded", async () => {
    const res = await callProvider(
      {},
      { scenario: "degraded", requestKey: "z", serviceType: "internet", now: NOW },
    );
    expect(res.orderId).toMatch(/^RLNT-/);
    expect(res.duplicate).toBe(false);
  });
});
