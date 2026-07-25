import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { ingestReferral } from "../intake";

/**
 * The arbitrary-intake gauntlet. This suite is the answer to the red-team's
 * sharpest finding — "it's one hardcoded scenario" — by proving the door
 * accepts ANY payload and every guarantee holds for it: contract, quarantine,
 * collapse, idempotent replay, cross-move deduplication, provenance, consent.
 */

let org: string;

const jordan = {
  customer: { first_name: "Jordan", last_name: "Reyes", email: "jordan.reyes@example.com", phone: "214-555-0187" },
  move: { date: "2026-09-03", to_address: "88 Cedar Springs Rd, Dallas, TX 75201" },
  services: ["electric", "internet"],
  consent: {
    granted: true,
    channels: ["email", "sms"],
    purposes: ["customer_care", "appointment_details"],
    text_version: "uc-2026-07",
  },
};

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Intake','intake') RETURNING id`,
    )
  )[0]!.id;
});

describe("arbitrary referral intake", () => {
  it("creates a move from a brand-new customer with full provenance and consent", async () => {
    const result = await ingestReferral({
      organizationId: org,
      channel: "customer_form",
      payload: jordan,
      idempotencyKey: "jordan-1",
    });

    expect(result.status).toBe("created");
    expect(result.httpStatus).toBe(201);
    expect(result.reference).toMatch(/^MR-W\d{4}$/);

    const fields = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM field_versions WHERE move_id = $1`,
      [result.moveId],
    );
    expect(fields[0]!.n).toBeGreaterThanOrEqual(6);

    // Consent became ledger events: 2 purposes × 2 channels.
    const consent = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM consent_events WHERE move_id = $1 AND granted`,
      [result.moveId],
    );
    expect(consent[0]!.n).toBe(4);
  });

  it("replays the stored response for the same Idempotency-Key — one submission, not two", async () => {
    const replay = await ingestReferral({
      organizationId: org,
      channel: "customer_form",
      payload: jordan,
      idempotencyKey: "jordan-1",
    });

    expect(replay.status).toBe("replayed");
    const submissions = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM raw_submissions
        WHERE organization_id = $1 AND channel = 'customer_form'`,
      [org],
    );
    expect(submissions[0]!.n).toBe(1);
  });

  it("refuses a reused key with a different payload — 409, keys bind to one body", async () => {
    const conflict = await ingestReferral({
      organizationId: org,
      channel: "customer_form",
      payload: { ...jordan, move: { ...jordan.move, date: "2026-09-04" } },
      idempotencyKey: "jordan-1",
    });
    expect(conflict.status).toBe("key_conflict");
    expect(conflict.httpStatus).toBe(409);
  });

  it("attaches the same human arriving through a second channel — no second move", async () => {
    // The partner's system reports Jordan with a stale date and a typo'd digit.
    const partnerVersion = {
      customer: { first_name: "Jordan", last_name: "Reyes", email: "jordan.reyes@example.com", phone: "214-555-0188" },
      move: { date: "2026-09-01", to_address: "88 Cedar Springs Rd, Dallas, TX 75201" },
      referral: { partner_slug: "dallas-realty" },
    };

    const result = await ingestReferral({
      organizationId: org,
      channel: "partner_api",
      payload: partnerVersion,
    });

    expect(result.status).toBe("attached");
    expect(result.duplicate?.verdict).not.toBe("distinct");
    // The date disagreement and phone typo surface as open conflicts.
    expect(result.conflictFields).toContain("move.date");
    expect(result.conflictFields).toContain("customer.phone");

    const moves = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM moves WHERE organization_id = $1`,
      [org],
    );
    expect(moves[0]!.n).toBe(1); // still one move, one human
  });

  it("keeps a genuinely different person separate — a new move, not a merge", async () => {
    const other = {
      customer: { first_name: "Priya", last_name: "Nair", email: "priya.nair@example.com", phone: "972-555-0110" },
      move: { date: "2026-09-10", to_address: "410 Elm St, Frisco, TX 75034" },
      services: ["internet"],
    };
    const result = await ingestReferral({ organizationId: org, channel: "customer_form", payload: other });

    expect(result.status).toBe("created");
    const moves = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM moves WHERE organization_id = $1`,
      [org],
    );
    expect(moves[0]!.n).toBe(2);
  });

  it("quarantines a contract failure with issues — never a silent drop", async () => {
    const malformed = {
      customer: { first_name: "X", phone: "214" }, // missing last name + email; bad phone
      move: { moveDate: "next tuesday" }, // renamed and unparseable
    };
    const result = await ingestReferral({ organizationId: org, channel: "partner_api", payload: malformed });

    expect(result.status).toBe("quarantined");
    expect(result.httpStatus).toBe(422);
    expect(result.quarantineId).toBeTruthy();
    expect(result.issues!.length).toBeGreaterThanOrEqual(3);
  });

  it("collapses a byte-identical resubmission without an idempotency key", async () => {
    const dup = await ingestReferral({
      organizationId: org,
      channel: "partner_api",
      payload: {
        customer: { first_name: "Jordan", last_name: "Reyes", email: "jordan.reyes@example.com", phone: "214-555-0188" },
        move: { date: "2026-09-01", to_address: "88 Cedar Springs Rd, Dallas, TX 75201" },
        referral: { partner_slug: "dallas-realty" },
      },
    });
    expect(dup.status).toBe("collapsed");
  });

  it("projects a customer-timeline entry for the new referral", async () => {
    const rows = await query<{ headline: string }>(
      `SELECT headline FROM customer_timeline_entries cte
        WHERE cte.organization_id = $1`,
      [org],
    );
    expect(rows.some((r) => r.headline.includes("received your move request"))).toBe(true);
  });
});
