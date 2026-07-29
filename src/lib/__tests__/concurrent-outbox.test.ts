import { describe, it, expect, beforeAll } from "vitest";

import { query, withTransaction, dbBackend } from "../db";
import { publish, dispatch, deadLetters, replayDeadLetters } from "../outbox";
import { runProjector, timelineFor } from "../projector";

/**
 * Two workers competing for one outbox, against one real database.
 *
 * `durability.test.ts` already dispatches twice and asserts the handler ran
 * once. That proves the claim row works when the two deliveries are ordered.
 * It cannot prove anything about the case the claim exists for — two workers
 * inside the window together — because sequential calls never enter it.
 *
 * PostgreSQL only, and the file skips rather than pretending under PGlite: one
 * connection cannot host two competing workers, and a green result there would
 * be two sequential dispatches wearing a costume.
 *
 * The barrier is what makes it a race. Both workers select their pending events
 * first, then wait for each other, then attempt the claim — so both genuinely
 * believe the event is theirs at the moment they reach for it.
 */

const isPg = dbBackend === "pg";

let org: string;
let move: string;
let electric: string;

beforeAll(async () => {
  if (!isPg) return;

  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Concurrent outbox", `outbox-race-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-OUTBOX-RACE-${Date.now()}`],
    )
  )[0]!.id;

  electric = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant') RETURNING id`,
      [org, move],
    )
  )[0]!.id;
}, 60_000);

/** A rendezvous for exactly `parties` participants. */
function barrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await gate;
  };
}

/**
 * Publish one event and return its id.
 *
 * The id matters because a *new* consumer legitimately receives every unclaimed
 * event in the schema, not only the one the current test just wrote. That is
 * correct outbox behaviour and it broke the first version of these tests: a
 * fresh consumer in the third test dead-lettered the first two tests' events as
 * well, and the count assertions failed for a reason that had nothing to do
 * with the property under test.
 *
 * Every assertion below is therefore scoped to a specific event id. The
 * alternative — a private database per test — would remove the very condition
 * these tests exist to exercise.
 */
async function publishOne(
  eventType: string,
  payload: Record<string, unknown>,
): Promise<string> {
  await withTransaction((c) =>
    publish(c, { organizationId: org, eventType, aggregateId: move, payload }),
  );
  const rows = await query<{ id: string }>(
    `SELECT id FROM outbox_events WHERE event_type = $1 ORDER BY id DESC LIMIT 1`,
    [eventType],
  );
  return rows[0]!.id;
}

describe.skipIf(!isPg)("exclusive processing", () => {
  it("applies the handler once when two workers race for one event", async () => {
    const consumer = `race-${Date.now()}`;
    await publishOne("ops.race", { moveId: move });

    const arrive = barrier(2);
    let applications = 0;

    /*
      Each worker waits at the barrier *inside* its handler, so neither can
      finish and release its claim before the other has tried. Without this the
      first dispatch could complete entirely and the second would simply find
      nothing pending — a green test that never exercised the contention.
    */
    const worker = () =>
      dispatch(consumer, async () => {
        applications += 1;
        await arrive();
      });

    // One worker will claim and run the handler; the other finds the event
    // already claimed and never enters the handler, so it never arrives at the
    // barrier. Releasing it here keeps the winner from waiting forever.
    const race = Promise.all([worker(), worker()]);
    await arrive();
    const [a, b] = await race;

    expect(applications, "the handler ran more than once for one event").toBe(1);
    expect(a + b, "exactly one worker should report the event processed").toBe(1);

    const claims = await query<{ event_id: string }>(
      `SELECT event_id FROM outbox_consumers WHERE consumer = $1`,
      [consumer],
    );
    expect(claims, "exactly one completed consumer record").toHaveLength(1);
  }, 30_000);
});

describe.skipIf(!isPg)("rollback and takeover", () => {
  it("lets a second worker process an event the first abandoned", async () => {
    /*
      The crash window. A handler that throws stands in for a process that
      dies: in both cases the work did not complete, and the claim must not
      survive to make the event look handled.
    */
    const consumer = `takeover-${Date.now()}`;
    const mine = await publishOne("ops.takeover", { moveId: move });

    await dispatch(consumer, async () => {
      throw new Error("worker A dies mid-handle");
    });

    expect(
      await query(`SELECT event_id FROM outbox_consumers WHERE consumer = $1 AND event_id = $2`, [
        consumer,
        mine,
      ]),
      "an abandoned handle must leave no claim",
    ).toHaveLength(0);

    // Dead-lettered, so worker B does not pick it up on ordinary dispatch.
    const dead = await deadLetters(consumer);
    expect(dead.map((d) => String(d.event_id))).toContain(mine);

    let recovered = 0;
    await replayDeadLetters(consumer, async (event) => {
      if (String(event.id) === mine) recovered += 1;
    });
    expect(recovered, "an explicit replay must let a second worker succeed").toBe(1);
  }, 30_000);
});

describe.skipIf(!isPg)("dead-letter suppression and safe replay", () => {
  it("does not hot-retry a permanently failing event", async () => {
    const consumer = `poison-${Date.now()}`;
    const mine = await publishOne("ops.poison", { moveId: move });

    let attempts = 0;
    const failing = async (event: { id: number }) => {
      if (String(event.id) === mine) attempts += 1;
      throw new Error("permanently broken handler");
    };

    await dispatch(consumer, failing);
    expect(attempts).toBe(1);

    // Ordinary dispatch, repeatedly. The dead-letter row is what holds it back
    // — the claim was rolled back, so nothing else would.
    await dispatch(consumer, failing);
    await dispatch(consumer, failing);
    expect(attempts, "ordinary dispatch retried a dead letter").toBe(1);

    const dead = await deadLetters(consumer);
    expect(dead.filter((d) => String(d.event_id) === mine)).toHaveLength(1);
  }, 30_000);

  it("processes exactly once when the fixed handler is replayed", async () => {
    const consumer = `replay-${Date.now()}`;
    const mine = await publishOne("ops.replay", { moveId: move });

    await dispatch(consumer, async () => {
      throw new Error("broken");
    });

    let handled = 0;
    const count = async (event: { id: number }) => {
      if (String(event.id) === mine) handled += 1;
    };

    await replayDeadLetters(consumer, count);
    expect(handled).toBe(1);

    // And the replay left it genuinely done, not merely un-dead-lettered.
    const dead = await deadLetters(consumer);
    expect(dead.filter((d) => String(d.event_id) === mine)).toHaveLength(0);

    await dispatch(consumer, count);
    expect(handled, "a replayed event must not be delivered again").toBe(1);
  }, 30_000);
});

describe.skipIf(!isPg)("history and projection are deliberately different", () => {
  it("keeps two source events but one customer entry", async () => {
    /*
      The distinction the projection key exists for. `provider.confirmed` and
      `provider.reconciled` are separate facts and the audit trail must keep
      both — a reconciliation genuinely happened. To the customer they are one
      sentence, and hearing it twice would be a defect.
    */
    await publishOne("provider.confirmed", { moveId: move, serviceRequestId: electric });
    await publishOne("provider.reconciled", { moveId: move, serviceRequestId: electric });

    await runProjector();

    const sourceEvents = await query<{ event_type: string }>(
      `SELECT event_type FROM outbox_events
        WHERE aggregate_id = $1 AND event_type IN ('provider.confirmed','provider.reconciled')`,
      [move],
    );
    expect(sourceEvents, "both events must survive in history").toHaveLength(2);

    const entries = await query<{ projection_key: string }>(
      `SELECT projection_key FROM customer_timeline_entries
        WHERE move_id = $1 AND projection_key = $2`,
      [move, "customer:electric:scheduled"],
    );
    expect(entries, "the customer must be told once").toHaveLength(1);

    const timeline = await timelineFor(move);
    expect(
      timeline.filter((e) => /electric service is scheduled/i.test(e.headline)),
    ).toHaveLength(1);
  }, 30_000);
});
