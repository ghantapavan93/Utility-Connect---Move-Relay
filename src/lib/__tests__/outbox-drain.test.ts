import { describe, it, expect, beforeAll } from "vitest";
import { query, withTransaction } from "../db";
import { reset, ingest, detectDuplicates, createMove } from "../demo-orchestrator";
import { publish, backlog } from "../outbox";
import { runProjector } from "../projector";

/**
 * Draining without a write.
 *
 * The outbox has always had a dispatcher: `runProjector()` runs inline at the
 * end of every write path, which is why projections are never stale under
 * normal traffic. I described this repeatedly as "no dispatcher", and that was
 * wrong — worth recording, because the actual gap is narrower and more
 * interesting than the one I kept claiming.
 *
 * The real gap is that the drain only ever ran *because* something was written.
 * A process that commits and then dies before its inline drain leaves events
 * undelivered until somebody happens to write again, which on a quiet system
 * may be never. A delivery guarantee that depends on future traffic is not one.
 *
 * These tests reproduce exactly that: publish inside a transaction, deliberately
 * skip the inline drain the way a crash would, and assert the standalone drain
 * picks the event up. Then assert it is safe to run again, because a scheduled
 * job runs mostly when there is nothing to do and must not corrupt anything on
 * those calls.
 */

let org: string;
let moveId: string;

beforeAll(async () => {
  await reset();
  // A real move, because the projector resolves the aggregate it is told about.
  // My first attempt published against an invented uuid, the handler could not
  // find it and dead-lettered the event — which is the designed behaviour, and
  // exactly why `dispatch` returns the count it *processed* rather than the
  // count it claimed. The test was wrong and the system was right; using a real
  // aggregate is the fix, not loosening the assertion.
  await ingest();
  await detectDuplicates();
  await createMove();

  org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`)
  )[0]!.id;
  moveId = (
    await query<{ id: string }>(`SELECT id FROM moves ORDER BY created_at DESC LIMIT 1`)
  )[0]!.id;

  // Start from a drained queue so the assertions below measure this test's
  // events rather than whatever the setup left behind.
  await runProjector();
}, 180_000);

describe("the outbox drains without a write to trigger it", () => {
  it("picks up an event whose publisher never ran the inline drain", async () => {
    const before = await backlog("projector");

    // A commit that reaches the database and then goes no further — the shape
    // of a crash between COMMIT and the inline dispatch.
    await withTransaction(async (c) => {
      await publish(c, {
        organizationId: org,
        eventType: "move.canonical.approved",
        aggregateId: moveId,
        payload: { moveId, probe: "drain-test" },
      });
    });

    const stranded = await backlog("projector");
    expect(stranded).toBeGreaterThan(before);

    // The standalone drain is the thing under test: no write, just the timer.
    const dispatched = await runProjector();
    expect(dispatched).toBeGreaterThan(0);
    expect(await backlog("projector")).toBe(0);
  }, 60_000);

  it("is safe to run against an empty queue, which is most of the time", async () => {
    // A scheduled drain fires on a cadence, not on demand, so the overwhelming
    // majority of its runs have nothing to do. Those runs must be free and must
    // not fail.
    expect(await runProjector()).toBe(0);
    expect(await runProjector()).toBe(0);
    expect(await backlog("projector")).toBe(0);
  }, 60_000);

  it("never delivers the same event to the same consumer twice", async () => {
    await withTransaction(async (c) => {
      await publish(c, {
        organizationId: org,
        eventType: "move.canonical.approved",
        aggregateId: moveId,
        payload: { moveId, probe: "once-only" },
      });
    });

    const first = await runProjector();
    expect(first).toBeGreaterThan(0);

    // The guarantee the whole design exists for. Exactly-once is enforced by a
    // unique constraint on (consumer, event_id), not by the caller being
    // careful — so a second drain, or two drains racing, cannot double-deliver.
    const second = await runProjector();
    expect(second).toBe(0);

    const marks = await query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM outbox_consumers c
         JOIN outbox_events e ON e.id = c.event_id
        WHERE c.consumer = 'projector'
          AND e.payload->>'probe' = 'once-only'`,
    );
    expect(marks[0]!.n).toBe(1);

    // And nothing quietly went to the dead-letter table instead of being
    // processed — the failure mode that produced a green-looking zero the
    // first time this test ran.
    const dead = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM dead_letter_events WHERE consumer = 'projector'`,
    );
    expect(dead[0]!.n).toBe(0);
  }, 60_000);
});
