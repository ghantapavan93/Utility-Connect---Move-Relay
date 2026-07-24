import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { submitToProvider, reconcile, operationKey } from "../provider-submission";
import { callProvider, lookupOrder, __simulator } from "../provider-simulator";
import { runProjector, timelineFor } from "../projector";

/**
 * CQRS suite: domain events flow through the outbox into the customer-timeline
 * read model, and the projection boundary holds — internal vocabulary never
 * reaches customer language, and machinery events produce no entry at all.
 */

let org: string;
let move: string;
let sr: string;
const requestKey = "cqrs-electric";
const correlation = "44444444-4444-4444-8444-444444444444";

beforeAll(async () => {
  __simulator.reset();
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('CQRS','cqrs') RETURNING id`,
    )
  )[0]!.id;
  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference) VALUES ($1,'MR-CQRS-1') RETURNING id`,
      [org],
    )
  )[0]!.id;
  sr = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant') RETURNING id`,
      [org, move],
    )
  )[0]!.id;
});

const submitInput = () => ({
  organizationId: org,
  moveId: move,
  serviceRequestId: sr,
  payload: { service: "electric" },
  correlationId: correlation,
  actor: "human:concierge-7",
});

describe("events → outbox → customer timeline", () => {
  it("a timed-out submission projects as 'confirming', never as UNKNOWN", async () => {
    const result = await submitToProvider(submitInput(), (p) =>
      callProvider(p, {
        scenario: "timeout_after_create",
        requestKey,
        serviceType: "electric",
        now: "2026-07-24T12:00:00.000Z",
      }),
    );
    expect(result.state).toBe("unknown");

    const projected = await runProjector();
    expect(projected).toBeGreaterThanOrEqual(2); // submitted + unknown

    const timeline = await timelineFor(move);
    const text = JSON.stringify(timeline).toLowerCase();

    // The internal state is UNKNOWN; the customer reads "confirming".
    expect(text).toContain("confirming your electric service");
    expect(text).not.toContain("unknown");
    expect(text).not.toContain("failed");
  });

  it("a blocked retry produces NO timeline entry — machinery is not news", async () => {
    const before = (await timelineFor(move)).length;

    const retry = await submitToProvider(submitInput(), () => {
      throw new Error("provider must not be called while UNKNOWN");
    });
    expect(retry.state).toBe("unknown");

    await runProjector();
    const after = (await timelineFor(move)).length;

    // The retry-blocked audit event exists; the customer timeline is silent.
    expect(after).toBe(before);
    const text = JSON.stringify(await timelineFor(move)).toLowerCase();
    expect(text).not.toContain("retry");
    expect(text).not.toContain("blocked");
  });

  it("reconciliation projects as 'scheduled' — recovery reads as plain progress", async () => {
    const sub = (
      await query<{ id: string }>(
        `SELECT id FROM provider_submissions WHERE operation_key = $1`,
        [operationKey(sr)],
      )
    )[0]!;

    const outcome = await reconcile(
      { organizationId: org, moveId: move, submissionId: sub.id, correlationId: correlation },
      () => lookupOrder(requestKey),
    );
    expect(outcome.outcome).toBe("found_existing");

    await runProjector();
    const timeline = await timelineFor(move);
    const text = JSON.stringify(timeline).toLowerCase();

    expect(text).toContain("electric service is scheduled");
    expect(text).not.toContain("reconcil"); // the mechanism stays internal
  });

  it("each timeline row carries the id of the event that produced it", async () => {
    const rows = await query<{ source_event_id: number | null }>(
      `SELECT source_event_id FROM customer_timeline_entries WHERE move_id = $1`,
      [move],
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.source_event_id !== null)).toBe(true);
  });

  it("re-running the projector adds nothing — projection is idempotent", async () => {
    const before = (await timelineFor(move)).length;
    const projected = await runProjector();
    expect(projected).toBe(0);
    expect((await timelineFor(move)).length).toBe(before);
  });

  it("the read model is rebuildable: drop it, replay the outbox, get it back", async () => {
    const original = await timelineFor(move);
    expect(original.length).toBeGreaterThan(0);

    // Drop the projection and the consumer's processed set — as if the read
    // model were lost entirely.
    await query(`DELETE FROM customer_timeline_entries WHERE move_id = $1`, [move]);
    await query(`DELETE FROM outbox_consumers WHERE consumer = 'projector'`);

    const replayed = await runProjector();
    expect(replayed).toBeGreaterThanOrEqual(original.length);

    const rebuilt = await timelineFor(move);
    expect(rebuilt.map((r) => r.headline)).toEqual(original.map((r) => r.headline));
  });
});
