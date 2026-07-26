import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { reset, ingest, detectDuplicates, createMove, getConflicts, approveMerge } from "../demo-orchestrator";

/**
 * Two write paths, one invariant.
 *
 * `moves.ts` guards its merge with an optimistic lock: the caller names the
 * version it read, the update matches on that version and increments it, and a
 * caller working from stale data is rejected instead of silently overwriting a
 * decision somebody else already made.
 *
 * `demo-orchestrator.approveMerge` writes the same canonical values and sets
 * the same state — and did not touch `moves.version`. Both are real, both are
 * reachable, and the second one defeats the first: a merge through the demo
 * path leaves the version unchanged, so a caller holding a version from before
 * that merge still matches, and their write lands on top of a decision they
 * never saw.
 *
 * That is precisely the failure this project exists to argue against, sitting
 * inside the project. An optimistic lock is only as strong as the writes that
 * respect it, so this asserts every path that changes the record moves the
 * version it is locked on.
 */

let move: { id: string; version: number };

beforeAll(async () => {
  await reset();
  await ingest();
  await detectDuplicates();
  await createMove();
  await getConflicts();

  const rows = await query<{ id: string; version: number }>(
    `SELECT id, version FROM moves ORDER BY created_at DESC LIMIT 1`,
  );
  move = rows[0]!;
}, 120_000);

describe("every path that changes a move moves its version", () => {
  it("starts at a known version", () => {
    expect(move).toBeDefined();
    expect(typeof move.version).toBe("number");
  });

  it("bumps the version when the demo path approves a merge", async () => {
    const before = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [move.id])
    )[0]!.version;

    await approveMerge(
      [{ fieldPath: "move.date", value: "2026-08-16", reason: "customer confirmed in writing" }],
      "user:concierge-7",
    );

    const after = (
      await query<{ version: number }>(`SELECT version FROM moves WHERE id = $1`, [move.id])
    )[0]!.version;

    // The load-bearing assertion. Without it the optimistic lock in moves.ts is
    // decorative: a stale caller would still match the unchanged version.
    expect(after).toBeGreaterThan(before);
  }, 60_000);

  it("leaves the record canonical and the decision attributed to a person", async () => {
    // The version bump must not have come at the cost of the thing it guards.
    const state = (
      await query<{ state: string }>(`SELECT state FROM moves WHERE id = $1`, [move.id])
    )[0]!.state;
    expect(state).toBe("canonical");

    const picked = await query<{ selected_by: string | null }>(
      `SELECT selected_by FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date' AND is_canonical`,
      [move.id],
    );
    expect(picked).toHaveLength(1);
    expect(picked[0]!.selected_by).toBe("user:concierge-7");
  }, 60_000);

  it("is still replayable — a second approval does not create a second canonical row", async () => {
    await approveMerge(
      [{ fieldPath: "move.date", value: "2026-08-16", reason: "re-confirmed" }],
      "user:concierge-7",
    );

    const canonical = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM field_versions
        WHERE move_id = $1 AND field_path = 'move.date' AND is_canonical`,
      [move.id],
    );
    // The partial unique index makes two canonical rows impossible at the
    // schema level; this proves the application path agrees rather than relying
    // on the constraint to catch it.
    expect(canonical[0]!.n).toBe(1);
  }, 60_000);
});
