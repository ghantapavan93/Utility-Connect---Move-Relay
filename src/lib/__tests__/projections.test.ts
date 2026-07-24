import { describe, it, expect, beforeAll } from "vitest";
import { query, withTransaction } from "../db";
import { persistCandidates, candidatesFromSubmission } from "../ingestion";
import { conciergeView, customerView, partnerView } from "../projections";

/**
 * Projection isolation is a security claim, so it is tested, not asserted.
 *
 * The tests assert what each audience must NOT see, because a leak is a failure
 * to withhold, and only a negative assertion catches it.
 */

let org: string;
let move: string;
let partnerA: string;
let partnerB: string;

beforeAll(async () => {
  org = (await query<{ id: string }>(`INSERT INTO organizations (name, slug) VALUES ('Proj','proj') RETURNING id`))[0]!.id;
  partnerA = (await query<{ id: string }>(`INSERT INTO partners (organization_id, name, slug) VALUES ($1,'Partner A','pa') RETURNING id`, [org]))[0]!.id;
  partnerB = (await query<{ id: string }>(`INSERT INTO partners (organization_id, name, slug) VALUES ($1,'Partner B','pb') RETURNING id`, [org]))[0]!.id;
  move = (await query<{ id: string }>(`INSERT INTO moves (organization_id, reference, state) VALUES ($1,'MR-PROJ-1','canonical') RETURNING id`, [org]))[0]!.id;

  const sub = (await query<{ id: string }>(
    `INSERT INTO raw_submissions (organization_id, partner_id, channel, payload, payload_hash, correlation_id)
     VALUES ($1,$2,'partner_api','{}','proj-h',gen_random_uuid()) RETURNING id`,
    [org, partnerA],
  ))[0]!.id;

  const candidates = candidatesFromSubmission({
    id: sub,
    channel: "partner_api",
    partner_id: partnerA,
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya@example.com", phone: "469-555-0142", ssn: "999-00-1234" },
      move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX" },
    },
    received_at: "2026-07-20T10:00:00Z",
  });

  await withTransaction((c) =>
    persistCandidates(c, { organizationId: org, moveId: move, correlationId: "33333333-3333-4333-8333-333333333333" }, candidates),
  );

  // A provider order with an account number the customer and partner must not see.
  const sr = (await query<{ id: string }>(
    `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
     VALUES ($1,$2,'electric','Reliant') RETURNING id`,
    [org, move],
  ))[0]!.id;
  await query(
    `INSERT INTO provider_submissions
       (organization_id, service_request_id, operation_key, request_fingerprint,
        state, provider_order_id, request_payload)
     VALUES ($1,$2,'op-proj','fp','reconciled','RLNT-SECRET-9','{}')`,
    [org, sr],
  );
});

describe("concierge view — the trusted operator sees everything", () => {
  it("shows services and their live provider state", async () => {
    const v = await conciergeView(org, move);
    expect(v.services.length).toBeGreaterThan(0);
    expect(v.audience).toBe("concierge");
  });
});

describe("customer view — no internal machinery", () => {
  it("shows the move in plain terms", async () => {
    const v = await customerView(move);
    const blob = JSON.stringify(v);
    expect(blob).toContain("Move date");
    expect(v.services.length).toBeGreaterThan(0);
  });

  it("never exposes the provider account number", async () => {
    const blob = JSON.stringify(await customerView(move));
    expect(blob).not.toContain("RLNT-SECRET-9");
  });

  it("never exposes the SSN", async () => {
    const blob = JSON.stringify(await customerView(move));
    expect(blob).not.toContain("999-00-1234");
    expect(blob.toLowerCase()).not.toContain("ssn");
  });

  it("translates a reconciled order to a plain 'Scheduled', never 'reconciled'", async () => {
    const v = await customerView(move);
    const electric = v.services.find((s) => s.service === "electric");
    expect(electric?.status).toBe("Scheduled");
    expect(JSON.stringify(v)).not.toContain("reconciled");
  });
});

describe("partner view — attributed engagement only", () => {
  it("shows engagement to the attributed partner", async () => {
    const v = await partnerView(move, partnerA);
    expect(v.attributed).toBe(true);
    expect(v.progress?.servicesRequested).toBeGreaterThan(0);
  });

  it("shows nothing to a partner with no attribution on this move", async () => {
    // Partner B never touched this move. Default is deny.
    const v = await partnerView(move, partnerB);
    expect(v.attributed).toBe(false);
    expect(v.progress).toBeUndefined();
  });

  it("never exposes the provider account number to a partner", async () => {
    const blob = JSON.stringify(await partnerView(move, partnerA));
    expect(blob).not.toContain("RLNT-SECRET-9");
  });

  it("never exposes customer PII beyond the move date to a partner", async () => {
    const blob = JSON.stringify(await partnerView(move, partnerA));
    expect(blob).not.toContain("999-00-1234");
    expect(blob).not.toContain("maya@example.com");
    expect(blob).not.toContain("469-555-0142");
  });

  it("never names another partner", async () => {
    const blob = JSON.stringify(await partnerView(move, partnerA));
    expect(blob).not.toContain(partnerB);
    expect(blob).not.toContain("Partner B");
  });
});
