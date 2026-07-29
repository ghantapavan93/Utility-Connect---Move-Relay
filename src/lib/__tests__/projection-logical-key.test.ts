import { describe, it, expect, beforeAll } from "vitest";

import { query, withTransaction } from "../db";
import { publish } from "../outbox";
import { runProjector, timelineFor } from "../projector";

/**
 * One *logical* timeline entry, however many events carry it.
 *
 * Deduplicating on `source_event_id` fixed the replay case and left a second
 * one open, which only shows up when you read the projector rather than the
 * dispatcher. Two different domain events map to the same customer sentence:
 *
 *   provider.confirmed   ─┐
 *                         ├─→  "Your electric service is scheduled"
 *   provider.reconciled  ─┘
 *
 * Those are distinct rows in `outbox_events` with distinct ids, so a uniqueness
 * rule keyed on the event cannot see that they say the same thing. The customer
 * sees the line twice and the system considers itself correct.
 *
 * The distinction matters beyond this one case. `source_event_id` answers
 * "which event produced this row" — provenance, and worth keeping. It is the
 * wrong key for "is this already on the timeline", because that question is
 * about the *meaning* of the entry, not its cause.
 */

let org: string;
let move: string;
let electric: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Logical key org", `logical-key-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-LOGICAL-${Date.now()}`],
    )
  )[0]!.id;

  electric = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant') RETURNING id`,
      [org, move],
    )
  )[0]!.id;
});

describe("two events that mean the same thing", () => {
  it("produce one timeline entry, not two", async () => {
    /*
      The real sequence this guards. A submission can be confirmed by a later
      reconciliation after an ambiguous outcome; both events legitimately exist
      in the audit trail, and both legitimately mean "it is scheduled" to the
      customer. The audit trail should keep both. The timeline should not.
    */
    for (const eventType of ["provider.confirmed", "provider.reconciled"]) {
      await withTransaction((c) =>
        publish(c, {
          organizationId: org,
          eventType,
          aggregateId: move,
          payload: { moveId: move, serviceRequestId: electric },
        }),
      );
    }

    await runProjector();

    const timeline = await timelineFor(move);
    const scheduled = timeline.filter((e) => /electric service is scheduled/i.test(e.headline));

    expect(
      scheduled.length,
      "confirmed and reconciled both say 'scheduled' — the customer must see it once",
    ).toBe(1);
  });

  it("still records which event produced the surviving row", async () => {
    // Deduplicating on meaning must not cost the provenance. Whichever event
    // won, the row has to say which one it was.
    const rows = await query<{ source_event_id: number | null }>(
      `SELECT source_event_id FROM customer_timeline_entries WHERE move_id = $1`,
      [move],
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.source_event_id).not.toBeNull();
    }
  });

  it("keeps distinct services distinct", async () => {
    /*
      The failure mode of a logical key that is too coarse: dedupe on
      "scheduled" alone and a household with electric and internet is told
      about one of them. The key has to carry the subject.
    */
    const internet = (
      await query<{ id: string }>(
        `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
         VALUES ($1,$2,'internet','Spectrum') RETURNING id`,
        [org, move],
      )
    )[0]!.id;

    await withTransaction((c) =>
      publish(c, {
        organizationId: org,
        eventType: "provider.confirmed",
        aggregateId: move,
        payload: { moveId: move, serviceRequestId: internet },
      }),
    );
    await runProjector();

    const timeline = await timelineFor(move);
    expect(timeline.filter((e) => /electric service is scheduled/i.test(e.headline))).toHaveLength(1);
    expect(timeline.filter((e) => /internet service is scheduled/i.test(e.headline))).toHaveLength(1);
  });
});
