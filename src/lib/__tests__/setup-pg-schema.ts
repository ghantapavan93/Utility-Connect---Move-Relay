import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, afterAll } from "vitest";

/**
 * One PostgreSQL schema per test file.
 *
 * Vitest isolates modules per file, so under PGlite every test file quietly got
 * a brand-new in-memory database. The entire suite came to rely on that without
 * anyone choosing it. Point the same tests at a real server and they share one
 * database: a fresh outbox consumer legitimately receives every unclaimed event
 * in it, so a file that publishes one event and expects one dead letter
 * receives however many the earlier files left behind. Nothing is broken —
 * the assumption "I am the only publisher" simply stopped being true.
 *
 * The fix restores the property rather than working around it. Each file gets
 * its own schema, the production DDL is applied inside it, and `search_path`
 * points every connection this file opens at that schema. Two clients created
 * inside one test therefore *do* share state — which is what a concurrency test
 * needs — while two different files cannot see each other at all.
 *
 * Deliberately not a shared-database truncate hook. A hook that deletes rows
 * from whatever database the connection string happens to name is a loaded gun
 * aimed at a developer's local database the first time an environment variable
 * is wrong. A schema this process created and drops is destructive only to
 * itself.
 *
 * Under PGlite this file does nothing at all: isolation is already inherent.
 */

const isPg = (process.env.RELAY_DB ?? (process.env.DATABASE_URL ? "pg" : "embedded")) === "pg";

/** The schema this file owns, so teardown drops only what setup created. */
let owned: string | null = null;

beforeAll(async () => {
  if (!isPg) return;

  /*
    Named before anything imports the database module. `createPg` reads
    `RELAY_PG_SCHEMA` when it builds the pool, and the pool is built lazily on
    the first query — so setting it here, in a `beforeAll`, lands before any
    test can open a connection.
  */
  const schema = `t_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  process.env.RELAY_PG_SCHEMA = schema;
  owned = schema;

  const { Client } = await import("pg");
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    /*
      `search_path` is set on this admin connection too, so the unqualified
      CREATE TABLE statements in schema.sql land inside the new schema rather
      than in `public`. The production DDL is used verbatim: a test substrate
      built from a different schema would prove things about a database that
      does not exist.
    */
    await admin.query(`SET search_path TO "${schema}"`);
    await admin.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
  } finally {
    await admin.end();
  }
}, 60_000);

afterAll(async () => {
  if (!isPg || !owned) return;
  const schema = owned;
  owned = null;

  /*
    The pool goes first.

    Dropping a schema while connections are still open against it is a race:
    the `DROP` either blocks behind them or succeeds and leaves live
    connections addressing objects that no longer exist. Neither outcome is
    loud — the second surfaces later as an unrelated error in whichever file
    runs next, which is the worst possible place to learn about it.
  */
  const { closeDb } = await import("../db");
  await closeDb();

  const { Client } = await import("pg");
  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();
  try {
    // Only the schema this file created. Never `public`, never the database.
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);

    /*
      Verified, not assumed. `DROP ... IF EXISTS` reports success whether or not
      anything was there, so a cleanup that silently did nothing looks identical
      to one that worked — and the leak would only appear much later as an
      unexplained schema in someone's database.
    */
    const still = await admin.query(
      `SELECT 1 FROM information_schema.schemata WHERE schema_name = $1`,
      [schema],
    );
    if (still.rowCount) {
      throw new Error(`test schema "${schema}" survived cleanup`);
    }
  } finally {
    // Ends the admin connection whether or not the drop threw. The throw still
    // propagates, so a cleanup failure fails the file rather than being
    // swallowed here.
    await admin.end();
  }
}, 60_000);
