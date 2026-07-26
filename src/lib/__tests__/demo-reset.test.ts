import { describe, it, expect } from "vitest";
import { query } from "../db";
import { reset, ingest } from "../demo-orchestrator";

/**
 * The demo reset path.
 *
 * This exists because the reset was broken in production for an unknown length
 * of time and the whole 152-test suite stayed green throughout — nothing
 * exercised it, so nothing caught it.
 *
 * The bug was a genuine design conflict rather than a typo. `audit_events` had
 * `ON DELETE CASCADE` from `organizations`, and *also* a rule making audit rows
 * undeletable. The rule wins, so the cascade could not remove the children,
 * and Postgres refused to delete the organization at all. The immutability
 * guarantee — one of this project's headline claims — was breaking the first
 * button on the demo page.
 *
 * It also had a second, quieter symptom worth remembering: because the reset
 * failed, the previous run's submissions survived, and the next `ingest`
 * silently deduplicated all three channels down to nothing. A visitor saw
 * "count: 3" and an empty `stored` array, which looks like success.
 *
 * The fix removed the foreign keys from `audit_events` — an append-only ledger
 * has to outlive what it describes, which is why `outbox_events` never had them
 * either. These tests hold that line.
 */

describe("the demo can be replayed", () => {
  it("resets cleanly, twice in a row", async () => {
    // Twice, because the failure mode was specifically that the *second* run
    // tripped over rows the first one could not delete.
    await expect(reset()).resolves.toBeDefined();
    await expect(reset()).resolves.toBeDefined();
  });

  it("ingests all three channels after a reset, not zero", async () => {
    await reset();
    const result = await ingest();
    // `count` was 3 even when the reset had failed. `stored` is the honest
    // signal — it lists what actually landed.
    expect(result.stored).toHaveLength(3);
    expect(result.stored).toEqual(
      expect.arrayContaining(["partner_api", "csv_upload", "customer_form"]),
    );
  });

  it("leaves the audit trail behind rather than deleting it", async () => {
    await reset();
    await ingest();
    const before = await query<{ n: string }>(`SELECT count(*)::text AS n FROM audit_events`);
    await reset();
    const after = await query<{ n: string }>(`SELECT count(*)::text AS n FROM audit_events`);

    // An append-only ledger outlives its subject. The rows are orphaned by the
    // reset, never removed — and nothing reads them, because every query is
    // scoped to the organization the reset just recreated.
    expect(Number(after[0]!.n)).toBeGreaterThanOrEqual(Number(before[0]!.n));
  });
});

describe("audit immutability survives the fix", () => {
  it("still refuses to delete an audit row", async () => {
    await reset();
    await ingest();
    const rows = await query<{ id: string }>(`SELECT id FROM audit_events LIMIT 1`);
    if (rows.length === 0) return; // nothing written yet; nothing to assert

    await query(`DELETE FROM audit_events WHERE id = $1`, [rows[0]!.id]);
    const still = await query<{ id: string }>(`SELECT id FROM audit_events WHERE id = $1`, [
      rows[0]!.id,
    ]);
    // Dropping the foreign key must not have weakened the rule that matters.
    expect(still).toHaveLength(1);
  });
});
