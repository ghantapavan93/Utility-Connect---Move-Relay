import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { reset, ingest, createMove, demoConstants } from "../demo-orchestrator";
import { notifyCustomer, notifyAcross, setTransport } from "../notify";
import { recordConsent } from "../consent";

/**
 * The consent gate, exercised.
 *
 * An audit classified the consent ledger PARTIAL for a precise reason: the
 * table was real, the writes were real, and `canContact` was a correct
 * deny-by-default, per-channel, per-purpose, versioned gate with **zero
 * production callers**. Nothing in the system ever sent anything, so the gate
 * had never fired once. A permission check that has never refused anything is
 * not a guarantee — it is an intention with test coverage.
 *
 * `notify.ts` is now the single door outbound messages leave by, and these
 * tests drive it: granted, missing, revoked, per-channel, and audited either
 * way. The transport is stubbed here so the assertions are about the decision
 * rather than about a delivery that never happens in this project anyway.
 */

let org: string;
let move: string;
const attempted: string[] = [];

beforeAll(async () => {
  await reset();
  await ingest();
  await createMove();

  const o = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0]!;
  org = o.id;
  move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org, demoConstants.MOVE_REF],
    )
  )[0]!.id;

  // Records what would have gone out, so "did it send" is observable.
  setTransport(async (i) => {
    attempted.push(`${i.channel}:${i.template}`);
  });
});

const auditFor = (type: string) =>
  query<{ n: string }>(
    `SELECT count(*)::text AS n FROM audit_events
      WHERE move_id = $1 AND event_type = $2`,
    [move, type],
  ).then((r) => Number(r[0]!.n));

describe("nothing leaves without a consent decision", () => {
  it("sends when the customer granted that channel and purpose", async () => {
    attempted.length = 0;
    const r = await notifyCustomer({
      organizationId: org,
      moveId: move,
      channel: "email",
      purpose: "connection_status",
      template: "electric.connected",
    });

    expect(r.sent).toBe(true);
    expect(attempted).toContain("email:electric.connected");
    // The version of the consent text they agreed to travels with the decision.
    expect(r.consentTextVersion).toBe("uc-2026-07");
  });

  it("refuses a move with no consent on file at all, by default", async () => {
    // The first draft of this test asked for a `marketing` purpose and the
    // database refused the query outright — `consent_purpose` is an enum of
    // four values and nothing outside it is representable. That is a stronger
    // guarantee than the one being tested, so the deny-by-default case has to
    // be reached the way it actually happens: a real purpose, on a move whose
    // ledger is empty.
    attempted.length = 0;
    const bare = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1, 'MR-NO-CONSENT', 'canonical') RETURNING id`,
        [org],
      )
    )[0]!.id;

    const r = await notifyCustomer({
      organizationId: org,
      moveId: bare,
      channel: "email",
      purpose: "account_information",
      template: "account.summary",
    });

    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/no consent on file/);
    // Nothing reached the transport. This is the assertion that matters.
    expect(attempted).toHaveLength(0);
  });

  it("stops sending on that channel once consent is revoked", async () => {
    attempted.length = 0;

    await recordConsent(org, move, "connection_status", "sms", false, "uc-2026-07");

    const r = await notifyCustomer({
      organizationId: org,
      moveId: move,
      channel: "sms",
      purpose: "connection_status",
      template: "electric.connected",
    });

    expect(r.sent).toBe(false);
    expect(r.reason).toMatch(/revoked/);
    expect(attempted).toHaveLength(0);
  });

  it("treats each channel separately rather than as one flag", async () => {
    attempted.length = 0;
    const results = await notifyAcross(
      {
        organizationId: org,
        moveId: move,
        purpose: "connection_status",
        template: "electric.connected",
      },
      ["email", "sms", "phone"],
    );

    // SMS was revoked in the previous test; the other two were never touched.
    // A system that treats consent as a single boolean texts this customer.
    expect(results.email!.sent).toBe(true);
    expect(results.phone!.sent).toBe(true);
    expect(results.sms!.sent).toBe(false);
    expect(attempted).not.toContain("sms:electric.connected");
  });
});

describe("both outcomes are written to the trail", () => {
  it("audits a withheld message, not only a sent one", async () => {
    const before = await auditFor("notification.withheld");

    await notifyCustomer({
      organizationId: org,
      moveId: move,
      channel: "sms",
      purpose: "connection_status",
      template: "electric.connected",
    });

    // A denial that leaves no trace is indistinguishable from a message nobody
    // tried to send, and the difference matters to whoever later asks why the
    // customer was never told.
    expect(await auditFor("notification.withheld")).toBe(before + 1);
  });

  it("marks every notification row as simulated", async () => {
    const rows = await query<{ detail: { delivery?: string } }>(
      `SELECT detail FROM audit_events
        WHERE move_id = $1 AND event_type IN ('notification.sent','notification.withheld')
        LIMIT 5`,
      [move],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      // Nobody reading this trail should be able to mistake it for evidence
      // that a real message was delivered to a real person.
      expect(r.detail.delivery).toMatch(/simulated/);
    }
  });
});
