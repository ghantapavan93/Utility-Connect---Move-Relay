import { describe, it, expect, beforeAll } from "vitest";

import { query, dbBackend } from "../db";
import { submitToProvider, operationKey, fingerprint } from "../provider-submission";
import { callProvider, __simulator } from "../provider-simulator";

/**
 * Two callers submitting the same provider intent at the same instant.
 *
 * The unique index on `(organization_id, operation_key)` has always made a
 * second *row* impossible, and `scenario.test.ts` proves the sequential case.
 * Neither says anything about two callers inside the claim window together,
 * which is the only situation the index exists for — and the claim is a
 * `SELECT` followed by an `INSERT`, which under PostgreSQL's default READ
 * COMMITTED isolation is exactly the shape that races.
 *
 * PostgreSQL only. PGlite has one connection, so "concurrent" callers there are
 * sequential ones and the window never opens.
 *
 * What matters most is not that a second row is prevented — the database
 * guarantees that. It is what the *losing caller* experiences, and whether the
 * external system was touched more than once. A duplicate row is a database
 * problem; a duplicate provider order is somebody's electricity account.
 */

const isPg = dbBackend === "pg";

let org: string;
let move: string;

async function freshServiceRequest(serviceType: string): Promise<string> {
  return (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,$3,'Reliant') RETURNING id`,
      [org, move, serviceType],
    )
  )[0]!.id;
}

beforeAll(async () => {
  if (!isPg) return;
  __simulator.reset();

  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Concurrent provider", `provider-race-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-PROVIDER-RACE-${Date.now()}`],
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

describe.skipIf(!isPg)("same operation key, same fingerprint", () => {
  it("creates one intent and calls the provider at most once", async () => {
    const serviceRequest = await freshServiceRequest("electric");
    const requestKey = `race-same-${Date.now()}`;
    const payload = { requestKey, service: "electric", address: "1420 Windhaven Pkwy" };

    const before = __simulator.size();
    const arrive = barrier(2);

    /*
      Both callers meet at the barrier before either submits, so neither can
      complete its claim transaction before the other begins one. Two promises
      started near each other would not do this: the first can finish entirely,
      and the second would take the ordinary already-claimed path without the
      window ever opening.
    */
    const attempt = async (actor: string) => {
      await arrive();
      try {
        const result = await submitToProvider(
          {
            organizationId: org,
            moveId: move,
            serviceRequestId: serviceRequest,
            correlationId: "55555555-5555-4555-8555-555555555555",
            actor,
            providerRequestKey: requestKey,
            payload,
          },
          async (p) =>
            callProvider(p, {
              scenario: "ok",
              requestKey,
              serviceType: "electric",
              now: "2026-07-27T00:00:00.000Z",
            }),
        );
        return { actor, ok: true as const, result };
      } catch (error) {
        return { actor, ok: false as const, error };
      }
    };

    const outcomes = await Promise.all([attempt("system:a"), attempt("system:b")]);

    // One intent row, guaranteed by the unique index.
    const intents = await query<{ id: string }>(
      `SELECT id FROM provider_submissions WHERE operation_key = $1`,
      [operationKey(serviceRequest)],
    );
    expect(intents, "the unique operation key must permit exactly one intent").toHaveLength(1);

    // And at most one order in the provider's own ledger — the claim that
    // actually matters to a household.
    expect(
      __simulator.size() - before,
      "the provider was asked to create more than one order",
    ).toBeLessThanOrEqual(1);

    /*
      Neither caller may receive a raw database error. The loser of the claim
      race is in a completely ordinary situation — someone else got there first
      — and must be told so in the vocabulary of the domain.
    */
    const raw = outcomes.filter(
      (o) => !o.ok && !(o.error instanceof Error && /already|conflict|in progress/i.test(o.error.message)),
    );
    expect(
      raw.map((o) => String((o as { error: unknown }).error)),
      "a caller that lost the claim race received a raw error instead of a documented outcome",
    ).toEqual([]);

    /*
      Evidence that the two callers genuinely contended, rather than the second
      arriving long after the first had finished.

      This matters because the same lesson has now been learned twice in this
      project: three transaction proofs passed against the very defect they were
      written for, because nothing had created the condition the defect needed.
      A concurrency test that never opens its window is a green light with
      nothing behind it.

      `deduplicated` is the observable signal. Exactly one caller must have
      created the intent and exactly one must have found it already present —
      which is only possible if both reached for the same key.
    */
    const succeeded = outcomes.filter((o) => o.ok);
    expect(succeeded, "both callers should return a documented result").toHaveLength(2);

    const deduped = succeeded.filter((o) => o.result.deduplicated);
    expect(
      deduped,
      `both callers took the same path (deduplicated: ${succeeded.map((o) => o.result.deduplicated).join(", ")}) — they did not contend for one key`,
    ).toHaveLength(1);

    // And both are talking about the same intent row.
    expect(new Set(succeeded.map((o) => o.result.submissionId)).size).toBe(1);
  }, 60_000);
});

describe.skipIf(!isPg)("same operation key, different fingerprint", () => {
  it("refuses the second payload rather than silently accepting it", async () => {
    /*
      The dangerous case. The same logical operation, submitted twice with
      *different* content — a changed move date, a corrected address. Treating
      that as an ordinary duplicate would mean the second caller believes their
      change was accepted while the provider was asked for something else
      entirely, or never asked at all.

      `request_fingerprint` exists on the row for precisely this comparison.
    */
    const serviceRequest = await freshServiceRequest("internet");
    const requestKey = `race-diff-${Date.now()}`;

    const first = { requestKey, service: "internet", moveDate: "2026-08-16" };
    const second = { requestKey, service: "internet", moveDate: "2026-08-14" };
    expect(fingerprint(first)).not.toBe(fingerprint(second));

    const before = __simulator.size();

    const original = await submitToProvider(
      {
        organizationId: org,
        moveId: move,
        serviceRequestId: serviceRequest,
        correlationId: "66666666-6666-4666-8666-666666666666",
        actor: "system:first",
        providerRequestKey: requestKey,
        payload: first,
      },
      async (p) =>
        callProvider(p, {
          scenario: "ok",
          requestKey,
          serviceType: "internet",
          now: "2026-07-27T00:00:00.000Z",
        }),
    );
    expect(original.state).toBe("confirmed");

    let conflict: unknown = null;
    try {
      await submitToProvider(
        {
          organizationId: org,
          moveId: move,
          serviceRequestId: serviceRequest,
          correlationId: "66666666-6666-4666-8666-666666666666",
          actor: "system:second",
          providerRequestKey: requestKey,
          payload: second,
        },
        async () => {
          throw new Error("the provider must not be called for a conflicting payload");
        },
      );
    } catch (error) {
      conflict = error;
    }

    expect(
      conflict,
      "a different payload under the same operation key must be an explicit conflict",
    ).toBeInstanceOf(Error);
    expect(String(conflict)).toMatch(/fingerprint|conflict|differs/i);

    // The provider was asked exactly once, for the original intent.
    expect(__simulator.size() - before).toBe(1);

    // And the stored payload is still the first one.
    const stored = await query<{ request_payload: Record<string, unknown> }>(
      `SELECT request_payload FROM provider_submissions WHERE operation_key = $1`,
      [operationKey(serviceRequest)],
    );
    expect(
      stored[0]!.request_payload.moveDate,
      "the first caller's payload was silently replaced",
    ).toBe("2026-08-16");
  }, 60_000);
});

describe.skipIf(!isPg)("the abandoned reservation window", () => {
  it("documents what recovers an intent whose owner vanished before calling", async () => {
    /*
      The crash window the reserve-then-call design creates deliberately. The
      intent commits, then the process dies before `callProvider` begins. The
      row sits in `submitted` and no provider order exists.

      This test does not assert a recovery — it establishes what currently
      happens, so the gap is recorded rather than assumed. `sweepUnknownOutcomes`
      selects `state = 'unknown'` only, so a stranded `submitted` row is outside
      its reach.
    */
    const serviceRequest = await freshServiceRequest("water");

    await query(
      `INSERT INTO provider_submissions
         (organization_id, service_request_id, operation_key, request_fingerprint,
          state, request_payload, provider_request_key)
       VALUES ($1,$2,$3,'fp-abandoned','submitted','{}',$4)`,
      [org, serviceRequest, operationKey(serviceRequest), `abandoned-${Date.now()}`],
    );

    const stranded = await query<{ state: string; started_at: string }>(
      `SELECT state, started_at FROM provider_submissions WHERE operation_key = $1`,
      [operationKey(serviceRequest)],
    );
    expect(stranded[0]!.state).toBe("submitted");

    // Nothing in the operational surface selects this state.
    const sweepable = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM provider_submissions WHERE state = 'unknown'`,
    );
    expect(
      sweepable[0]!.n,
      "recorded for the review: the unknown-outcome sweep cannot see a stranded 'submitted' row",
    ).toBe(0);

    /*
      Recorded, not fixed. A lease column and a stale-reservation sweep are the
      obvious remedy, and both are design decisions rather than test fixes. The
      honest statement is that this window is currently unrecovered.
    */
  }, 60_000);
});
