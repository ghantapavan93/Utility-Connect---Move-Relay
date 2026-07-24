import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { query, withTransaction } from "../db";
import { publish, dispatch, deadLetters, replayDeadLetters, backlog } from "../outbox";
import { submitToProvider } from "../provider-submission";
import { callProvider, lookupOrder } from "../provider-simulator";
import { sweepUnknownOutcomes } from "../ops";

/**
 * Operational resilience suite: the dead-letter path (a failing handler is
 * visible and replayable, never silent) and the reconciliation sweep (UNKNOWN
 * outcomes drain without a human remembering to click).
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Ops','ops') RETURNING id`,
    )
  )[0]!.id;
});

describe("dead-letter path", () => {
  const consumer = `dlq-${randomUUID().slice(0, 8)}`;

  it("a throwing handler dead-letters the event instead of stranding it", async () => {
    await withTransaction((c) =>
      publish(c, { organizationId: org, eventType: "ops.test", payload: { n: 1 } }),
    );

    const processed = await dispatch(consumer, async () => {
      throw new Error("handler bug: cannot parse payload");
    });

    expect(processed).toBe(0);
    const dead = await deadLetters(consumer);
    expect(dead).toHaveLength(1);
    expect(dead[0]!.error).toContain("handler bug");
  });

  it("normal dispatch does not hot-retry a dead letter", async () => {
    let invoked = 0;
    await dispatch(consumer, async () => {
      invoked++;
    });
    // The claim is held by the dead letter; the failing event is not re-fed.
    expect(invoked).toBe(0);
    expect((await deadLetters(consumer)).length).toBe(1);
  });

  it("replay through a fixed handler processes the event and clears the queue", async () => {
    let handled = 0;
    const replayed = await replayDeadLetters(consumer, async () => {
      handled++;
    });

    expect(replayed).toBe(1);
    expect(handled).toBe(1);
    expect(await deadLetters(consumer)).toHaveLength(0);
    expect(await backlog(consumer)).toBe(0);
  });
});

describe("reconciliation sweep", () => {
  it("drains every open UNKNOWN through provider lookup, never resubmission", async () => {
    // Create two independent ambiguous outcomes.
    const keys: string[] = [];
    for (let i = 0; i < 2; i++) {
      const move = (
        await query<{ id: string }>(
          `INSERT INTO moves (organization_id, reference) VALUES ($1,$2) RETURNING id`,
          [org, `MR-SWEEP-${i}-${randomUUID().slice(0, 4)}`],
        )
      )[0]!.id;
      const sr = (
        await query<{ id: string }>(
          `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
           VALUES ($1,$2,'internet','AT&T-sim') RETURNING id`,
          [org, move],
        )
      )[0]!.id;

      const requestKey = `sweep-${i}-${randomUUID().slice(0, 6)}`;
      keys.push(requestKey);
      const result = await submitToProvider(
        {
          organizationId: org,
          moveId: move,
          serviceRequestId: sr,
          payload: { service: "internet" },
          correlationId: randomUUID(),
          actor: "system",
        },
        (p) =>
          callProvider(p, {
            scenario: "timeout_after_create",
            requestKey,
            serviceType: "internet",
            now: "2026-07-24T13:00:00.000Z",
          }),
      );
      expect(result.state).toBe("unknown");
    }

    // The sweep's resolver maps each submission to its provider lookup. The
    // orders DO exist — the provider created them before the responses died.
    let cursor = 0;
    const sweep = await sweepUnknownOutcomes(() => lookupOrder(keys[cursor++]!));

    expect(sweep.scanned).toBeGreaterThanOrEqual(2);
    expect(sweep.recovered).toBeGreaterThanOrEqual(2);

    const remaining = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM provider_submissions
        WHERE organization_id = $1 AND state = 'unknown'`,
      [org],
    );
    expect(remaining[0]!.n).toBe(0);
  });
});
