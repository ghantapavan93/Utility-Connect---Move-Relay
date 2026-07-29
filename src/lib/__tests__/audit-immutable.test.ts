import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";

/**
 * Tampering with the audit trail must fail loudly.
 *
 * The trail was already immutable in effect: an `UPDATE` or `DELETE` against
 * `audit_events` changed nothing. It did so by being *ignored* — the statement
 * returned success and quietly did no work, which is a worse guarantee than it
 * appears.
 *
 * A silent no-op tells a caller its write succeeded. Code that believed it had
 * corrected an audit row would carry on, tests written against it would pass,
 * and the divergence between what the system thinks it recorded and what it
 * recorded would surface much later, if ever. The failure is not that history
 * changes; it is that a component can be wrong about history for an arbitrarily
 * long time and never learn.
 *
 * Refusing out loud makes the boundary teachable. There is exactly one way to
 * correct the record — append a new event — and an error at the moment of the
 * mistake is what says so.
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Audit org", `audit-immutable-${Date.now()}`],
    )
  )[0]!.id;

  await query(
    `INSERT INTO audit_events (organization_id, event_type, actor)
     VALUES ($1,'provider.retry.blocked','system')`,
    [org],
  );
});

describe("the audit trail refuses to be rewritten", () => {
  it("raises on UPDATE rather than ignoring it", async () => {
    await expect(
      query(`UPDATE audit_events SET actor = 'tampered' WHERE organization_id = $1`, [org]),
    ).rejects.toThrow(/append-only|immutable|cannot be (updated|modified)/i);
  });

  it("raises on DELETE rather than ignoring it", async () => {
    await expect(
      query(`DELETE FROM audit_events WHERE organization_id = $1`, [org]),
    ).rejects.toThrow(/append-only|immutable|cannot be deleted/i);
  });

  it("leaves the row exactly as written", async () => {
    const rows = await query<{ actor: string }>(
      `SELECT actor FROM audit_events WHERE organization_id = $1`,
      [org],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor).toBe("system");
  });

  it("still accepts a correcting event appended after the fact", async () => {
    // The sanctioned path. History is not editable; it is extendable, and a
    // correction is itself a fact with an actor and a time.
    await query(
      `INSERT INTO audit_events (organization_id, event_type, actor, detail)
       VALUES ($1,'audit.correction','human:concierge-7',$2)`,
      [org, JSON.stringify({ corrects: "provider.retry.blocked", note: "misattributed" })],
    );

    const rows = await query<{ event_type: string }>(
      `SELECT event_type FROM audit_events WHERE organization_id = $1 ORDER BY id`,
      [org],
    );
    expect(rows.map((r) => r.event_type)).toEqual([
      "provider.retry.blocked",
      "audit.correction",
    ]);
  });
});
