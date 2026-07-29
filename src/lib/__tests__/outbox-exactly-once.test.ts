import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";
import { publish, dispatch, deadLetters } from "../outbox";
import { runProjector, timelineFor } from "../projector";
import { withTransaction } from "../db";

/**
 * The two outbox guarantees that were asserted but never proven.
 *
 * `cqrs.test.ts` already shows that re-running the projector adds nothing, and
 * that the read model can be rebuilt from events. Neither test exercises the
 * case that actually produces a duplicate customer timeline entry, because both
 * either leave the claim in place or delete the claim and the timeline together.
 *
 * The failures these cover are the ones a reviewer would find by reading
 * `dispatch()`:
 *
 * 1. The claim was committed *before* the handler ran, in its own autocommit
 *    statement. A crash in between left the event claimed forever — skipped by
 *    dispatch, invisible to `backlog()`, absent from `deadLetters()`. The module
 *    documented itself as at-least-once; it was at-most-once.
 *
 * 2. `customer_timeline_entries` had no uniqueness on `source_event_id`, so
 *    idempotency rested entirely on that claim. Any path that releases a claim
 *    — dead-letter replay after a partial success — could write a second
 *    "Your electric service is scheduled".
 */

let org: string;
let move: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Outbox org", `outbox-once-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-OUTBOX-${Date.now()}`],
    )
  )[0]!.id;
});

describe("a handler that fails does not consume its event", () => {
  it("rolls the claim back so the event is redelivered", async () => {
    /*
      The crash window, made deterministic.

      A throwing handler stands in for a process that dies mid-handle: in both
      cases the work did not complete. The invariant is the same either way —
      an event that was not fully handled must remain eligible for redelivery.
      Before the fix the claim was already committed, so the event was skipped
      forever and no operator signal existed anywhere.
    */
    const consumer = `flaky-${Date.now()}`;
    await withTransaction((c) =>
      publish(c, {
        organizationId: org,
        eventType: "provider.reconciled",
        aggregateId: move,
        payload: { moveId: move },
      }),
    );

    let attempts = 0;
    await dispatch(consumer, async () => {
      attempts++;
      throw new Error("handler exploded");
    });
    expect(attempts).toBe(1);

    // Dead-lettered, so the failure is visible to an operator.
    expect(await deadLetters(consumer)).toHaveLength(1);

    // And still redeliverable once the handler is fixed — the claim must not
    // have survived the failed attempt.
    const claims = await query(
      `SELECT event_id FROM outbox_consumers WHERE consumer = $1`,
      [consumer],
    );
    expect(claims, "a failed handle must not leave a claim behind").toHaveLength(0);
  });
});

describe("one logical event produces one projection entry", () => {
  it("stays single when the same event is delivered twice", async () => {
    /*
      The reported symptom, as a test: "Your electric service is scheduled"
      appearing twice on a customer's timeline.

      This deletes the claim and re-dispatches — exactly what
      `replayDeadLetters` does after a partial success. Idempotency has to come
      from the database, not from the claim, or any path that releases a claim
      reintroduces the duplicate.
    */
    await withTransaction((c) =>
      publish(c, {
        organizationId: org,
        eventType: "provider.reconciled",
        aggregateId: move,
        payload: { moveId: move },
      }),
    );

    await runProjector();
    const afterFirst = await timelineFor(move);
    expect(afterFirst.length).toBeGreaterThan(0);

    /*
      The invariant, stated exactly: one row per source event, never more.

      Counting a headline would be the wrong assertion — two genuinely distinct
      reconciliation events *should* produce two entries, and a test that forbade
      that would be testing the wrong thing. What must never happen is one event
      producing two rows.
    */
    const distinctSources = await query<{ n: number }>(
      `SELECT count(DISTINCT source_event_id)::int AS n
         FROM customer_timeline_entries WHERE move_id = $1`,
      [move],
    );
    expect(afterFirst.length).toBe(distinctSources[0]!.n);

    // Release every claim and deliver the same events all over again.
    await query(`DELETE FROM outbox_consumers WHERE consumer = 'projector'`);
    await runProjector();

    const afterSecond = await timelineFor(move);
    expect(
      afterSecond.length,
      "redelivering every event must not add a single timeline row",
    ).toBe(afterFirst.length);

    const stillDistinct = await query<{ n: number }>(
      `SELECT count(DISTINCT source_event_id)::int AS n
         FROM customer_timeline_entries WHERE move_id = $1`,
      [move],
    );
    expect(afterSecond.length).toBe(stillDistinct[0]!.n);
  });
});
