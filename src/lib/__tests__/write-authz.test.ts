import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";
import { reset, ingest, createMove, demoConstants } from "../demo-orchestrator";
import { POST as merge } from "@/app/api/v1/moves/[id]/merge/route";

/**
 * Authorization on the paths that change something.
 *
 * `authz-route.test.ts` covers the read gate on `/api/v1/views`, and it exists
 * because an audit found that `checkView` — correct, graph-walking, well tested
 * — authorized nothing at all. A second audit found the same shape one layer
 * further in: the gate had been fitted to the projection route and to nothing
 * else.
 *
 * `POST /api/v1/moves/:id/merge` is the most consequential write in the system.
 * It selects the surviving value for a contested field, bumps the canonical
 * version, writes audit, and publishes an event. It took an actor name from the
 * request body, looked the organization up *from the move being written to*,
 * and proceeded — so any caller who knew a move id could resolve a stranger's
 * conflict under any name they chose.
 *
 * A relationship-based authorization model that is never consulted before a
 * write is a diagram, not a control. These tests are the difference.
 */

let moveId: string;

beforeAll(async () => {
  await reset();
  await ingest();
  await createMove();

  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0]!;
  moveId = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, demoConstants.MOVE_REF],
    )
  )[0]!.id;
});

const mergeRequest = (actor: string | null) =>
  merge(
    new Request(`http://localhost/api/v1/moves/${moveId}/merge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(actor ? { "x-actor": actor } : {}),
      },
      body: JSON.stringify({
        actor: actor ?? "human:anyone",
        expectedVersion: 1,
        decisions: [{ fieldPath: "move.date", value: "2026-08-16", reason: "test" }],
      }),
    }),
    { params: Promise.resolve({ id: moveId }) },
  );

describe("the merge endpoint is gated", () => {
  it("refuses a caller with no actor", async () => {
    const response = await mergeRequest(null);
    expect(response.status).toBe(401);
  });

  it("refuses a known actor with no relationship to this move", async () => {
    /*
      The real attack, and the cheap one: a valid-looking identity that simply
      has nothing to do with this record. Before the gate existed this returned
      200 and rewrote a stranger's canonical field.
    */
    const response = await mergeRequest("user:rival-agent");
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.error).toBe("forbidden");
  });

  it("leaves the record untouched when it refuses", async () => {
    // A refused write that still moved the version would be worse than no gate,
    // because the next legitimate merge would fail as stale.
    const version = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
    )[0]!.version;
    expect(version).toBe(1);
  });

  it("admits the concierge who owns the case", async () => {
    const response = await mergeRequest("user:concierge-7");
    expect(response.status, await response.text()).toBe(200);

    const version = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [moveId])
    )[0]!.version;
    expect(version).toBe(2);
  });
});
