import { describe, it, expect } from "vitest";

import { query, dbBackend } from "../db";

/**
 * Half of the isolation proof. Its partner is `harness-isolation-b.test.ts`.
 *
 * The harness has to deliver two properties that pull in opposite directions:
 *
 *   between files   complete blindness — file A must never see file B's rows,
 *                   because the whole suite was written assuming a private
 *                   database and only got one by accident of PGlite
 *
 *   within a file   full sharing — two clients opened inside one test must see
 *                   each other, or a concurrency test is two monologues rather
 *                   than a race
 *
 * A truncate hook would give the first and destroy the second. A schema per
 * file gives both. This file plants a uniquely named row; its partner asserts
 * it cannot see it, and separately proves two clients inside one file do.
 */

import { MARKER_SLUG } from "./harness-marker";

describe("file A plants a marker in its own schema", () => {
  it("writes a row nothing outside this file should observe", async () => {
    await query(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2)`,
      ["Isolation marker A", MARKER_SLUG],
    );

    const rows = await query<{ slug: string }>(
      `SELECT slug FROM organizations WHERE slug = $1`,
      [MARKER_SLUG],
    );
    expect(rows).toHaveLength(1);
  });

  it("reports which backend it proved this against", async () => {
    /*
      Recorded rather than assumed. Under PGlite the isolation is inherent and
      this pair proves little; under `pg` it is the harness doing the work, and
      the distinction belongs in the evidence rather than in someone's memory.
    */
    expect(["pg", "embedded"]).toContain(dbBackend);
  });
});
