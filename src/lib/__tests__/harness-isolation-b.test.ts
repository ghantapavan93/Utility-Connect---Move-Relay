import { describe, it, expect } from "vitest";

import { query, dbBackend } from "../db";
import { MARKER_SLUG } from "./harness-marker";

/**
 * The other half of the isolation proof. See `harness-isolation-a.test.ts`.
 *
 * Two assertions, and they are the two the concurrency work depends on:
 * separate files cannot observe each other, while separate *clients* inside one
 * file can. Get the first wrong and every count in the suite becomes a function
 * of file ordering; get the second wrong and a "concurrency" test is two
 * processes talking to two different worlds and agreeing about nothing.
 */

describe("file B cannot see file A's data", () => {
  it("finds no trace of the marker planted in the other file", async () => {
    /*
      `fileParallelism: false` means file A has already run and committed when
      this executes. Under `RELAY_DB=pg` the row is genuinely in the database —
      in another schema, which this file's `search_path` does not include.
    */
    const rows = await query<{ slug: string }>(
      `SELECT slug FROM organizations WHERE slug = $1`,
      [MARKER_SLUG],
    );

    expect(
      rows,
      `file B observed file A's row — isolation is not holding on backend "${dbBackend}"`,
    ).toHaveLength(0);
  });

  it("starts from an empty organizations table", async () => {
    // The stronger statement: not merely that one marker is absent, but that
    // this file began with a database nobody else had written to.
    const rows = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM organizations`,
    );
    expect(rows[0]!.n).toBe(0);
  });
});

describe("the shared schema is unreachable", () => {
  it.skipIf(dbBackend !== "pg")("does not fall back to public", async () => {
    /*
      `search_path` is the test schema alone. With `public` appended as a
      fallback, a statement that failed to resolve inside the test schema would
      quietly succeed against the shared one — the test would pass while writing
      to a table no cleanup ever drops, and the leak would surface much later in
      someone else's run.

      Asserting the path directly is the cheap way to keep that true: a future
      edit that re-adds `,public` for convenience fails here rather than in
      three weeks.
    */
    const path = await query<{ search_path: string }>(`SHOW search_path`);
    expect(path[0]!.search_path).not.toMatch(/\bpublic\b/);
    expect(path[0]!.search_path).toContain(process.env.RELAY_PG_SCHEMA!);
  });

  it.skipIf(dbBackend !== "pg")("creates its tables in the test schema, not public", async () => {
    // The other half: not merely that `public` is off the path, but that the
    // production DDL actually landed where the harness intended.
    const here = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'moves'`,
      [process.env.RELAY_PG_SCHEMA!],
    );
    expect(here[0]!.n).toBe(1);
  });
});

describe("two clients inside one file share state", () => {
  it("sees an uncommitted-then-committed row across separate connections", async () => {
    /*
      The property a concurrency test needs. Under `pg` these are two real
      connections from the pool; the first writes and commits, the second must
      observe it. If schema isolation were done per *connection* rather than per
      file this would fail, and every concurrency test built on it would quietly
      be testing nothing.
    */
    if (dbBackend !== "pg") {
      // PGlite is single-connection: there is no second client to prove this
      // with, and pretending otherwise would be the kind of claim this project
      // exists to avoid.
      return;
    }

    const { Client } = await import("pg");
    const schema = process.env.RELAY_PG_SCHEMA;
    expect(schema, "the harness must have named a schema for this file").toBeTruthy();

    const writer = new Client({ connectionString: process.env.DATABASE_URL });
    const reader = new Client({ connectionString: process.env.DATABASE_URL });
    await writer.connect();
    await reader.connect();

    try {
      await writer.query(`SET search_path TO "${schema}"`);
      await reader.query(`SET search_path TO "${schema}"`);

      await writer.query(
        `INSERT INTO organizations (name, slug) VALUES ($1,$2)`,
        ["Shared state", "harness-shared-state"],
      );

      const seen = await reader.query<{ slug: string }>(
        `SELECT slug FROM organizations WHERE slug = $1`,
        ["harness-shared-state"],
      );
      expect(
        seen.rows,
        "a second client in the same file must observe the first client's commit",
      ).toHaveLength(1);
    } finally {
      await writer.end();
      await reader.end();
    }
  });
});
