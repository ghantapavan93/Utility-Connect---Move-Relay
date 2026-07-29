import { describe, it, expect, beforeAll } from "vitest";

import { query, dbBackend } from "../db";
import { reset, ingest, createMove, demoConstants } from "../demo-orchestrator";
import { approveMergeFor, StaleMergeError } from "../moves";
import { POST as mergeRoute } from "@/app/api/v1/moves/[id]/merge/route";

/**
 * Two concierges resolving the same conflict at the same moment.
 *
 * The optimistic lock has been in the schema and in `approveMergeFor` from the
 * start, and until now it was only ever exercised sequentially: read, write,
 * read again, write again. That proves the *check* works. It does not prove the
 * check holds when two writers are genuinely inside the window together, which
 * is the only situation it exists for.
 *
 * PostgreSQL only. PGlite is single-connection, so two "concurrent" writers
 * there are two sequential ones wearing a costume — and presenting that as
 * concurrency evidence is exactly the kind of claim this project is built to
 * avoid. The file skips rather than pretending.
 *
 * The barrier matters as much as the connections. Two promises started near
 * each other are not a race: the first can finish entirely before the second
 * begins, and the test goes green having proven nothing. Both writers here read
 * the version, then *wait for each other*, and only then write.
 */

const isPg = dbBackend === "pg";

let moveId: string;
let orgId: string;

beforeAll(async () => {
  if (!isPg) return;
  await reset();
  await ingest();
  await createMove();

  orgId = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0]!.id;
  moveId = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [orgId, demoConstants.MOVE_REF],
    )
  )[0]!.id;
}, 60_000);

/**
 * A rendezvous for exactly `parties` participants.
 *
 * Everyone who calls `arrive()` blocks until the last one does, so no writer
 * can complete its transaction before the others have read.
 */
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

describe.skipIf(!isPg)("two concierges merge the same move simultaneously", () => {
  let outcomes: Array<{ actor: string; ok: boolean; error?: unknown }>;
  let startingVersion: number;

  beforeAll(async () => {
    startingVersion = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
    )[0]!.version;

    const arrive = barrier(2);

    const attempt = async (actor: string, value: string) => {
      // Both read the same version *before* the barrier, which is what makes
      // this the lost-update scenario rather than two ordered writes.
      const seen = (
        await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
      )[0]!.version;

      await arrive();

      try {
        await approveMergeFor({
          organizationId: orgId,
          moveId,
          expectedVersion: seen,
          actor,
          decisions: [{ fieldPath: "move.date", value, reason: `chosen by ${actor}` }],
        });
        return { actor, ok: true };
      } catch (error) {
        return { actor, ok: false, error };
      }
    };

    outcomes = await Promise.all([
      attempt("user:jordan", "2026-08-16"),
      attempt("user:alex", "2026-08-14"),
    ]);
  }, 60_000);

  it("has exactly one winner and one stale-version conflict", () => {
    const winners = outcomes.filter((o) => o.ok);
    const losers = outcomes.filter((o) => !o.ok);

    expect(winners, `outcomes: ${JSON.stringify(outcomes.map((o) => [o.actor, o.ok]))}`).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(
      losers[0]!.error,
      "the loser must fail with a stale-version conflict, not an arbitrary error",
    ).toBeInstanceOf(StaleMergeError);
  });

  it("increments the move version exactly once", async () => {
    const now = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
    )[0]!.version;
    expect(now).toBe(startingVersion + 1);
  });

  it("leaves exactly one canonical value for the contested field", async () => {
    /*
      The schema's partial unique index should make two canonical values
      impossible, but a lost update would produce one canonical value chosen by
      the *loser* — correct by the constraint and wrong by the story.
    */
    const canonical = await query<{ value: unknown; selected_by: string }>(
      `SELECT value, selected_by FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date' AND is_canonical`,
      [moveId],
    );
    expect(canonical).toHaveLength(1);

    const winner = outcomes.find((o) => o.ok)!.actor;
    expect(canonical[0]!.selected_by).toBe(winner);
  });

  it("records exactly one approval audit event, naming the winner", async () => {
    const approvals = await query<{ actor: string }>(
      `SELECT actor FROM audit_events
        WHERE move_id = $1 AND event_type = 'move.canonical.approved'`,
      [moveId],
    );
    expect(approvals).toHaveLength(1);

    const winner = outcomes.find((o) => o.ok)!.actor;
    const loser = outcomes.find((o) => !o.ok)!.actor;
    expect(approvals[0]!.actor).toBe(winner);
    expect(
      approvals.map((a) => a.actor),
      "the losing actor must never appear as an approver",
    ).not.toContain(loser);
  });
});

describe.skipIf(!isPg)("the route reports a stale merge as a conflict", () => {
  it("maps a stale version to 409 rather than 500", async () => {
    /*
      The service throws `StaleMergeError`; the route has to turn that into a
      conflict a client can act on. A 500 would tell the browser to treat a
      perfectly ordinary race as a server fault, and the resolution workspace
      re-reads on 409 specifically.
    */
    const current = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
    )[0]!.version;

    const response = await mergeRoute(
      new Request(`http://test.local/api/v1/moves/${moveId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-actor": "user:concierge-7" },
        body: JSON.stringify({
          expectedVersion: current - 1, // deliberately behind
          decisions: [{ fieldPath: "move.date", value: "2026-08-14", reason: "stale attempt" }],
        }),
      }),
      { params: Promise.resolve({ id: moveId }) },
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.currentVersion).toBe(current);
  });
});
