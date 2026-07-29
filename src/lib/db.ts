import type { PoolClient } from "pg";

/**
 * Database adapter with two backends behind one interface.
 *
 *   RELAY_DB=pg       → a real Postgres server (Docker Compose, Neon, RDS)
 *   RELAY_DB=embedded → PGlite, Postgres compiled to WASM, in-process
 *
 * Both are genuinely Postgres, so the same schema, the same constraints and the
 * same SQL run against either. The embedded mode exists so that a reviewer can
 * clone this repository and verify every claim with `npm install` and one
 * command — no Docker daemon, no connection string, no cloud account.
 *
 * That is a deliberate trade. Embedded mode is single-process and unsuitable for
 * production; it is a demonstration and test substrate, not a deployment target.
 * The deployed application runs `RELAY_DB=pg`.
 */

export interface QueryResult<T> {
  rows: T[];
}

export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
}

/**
 * A backend, plus how it pins a transaction to one connection.
 *
 * `transact` exists because `withTransaction` used to issue `BEGIN`, the work,
 * and `COMMIT` as three independent calls on the shared handle. Against PGlite
 * that is correct — there is one connection and nothing else can interleave.
 * Against a real server behind a pool it is not a transaction at all: each call
 * may be served by a different connection, so `BEGIN` can open on one, the
 * writes land on others with autocommit, and `COMMIT` closes an empty
 * transaction somewhere else entirely.
 *
 * Sequentially the pool usually hands back the same idle connection, which is
 * why the suite passed and why nothing surfaced until two writers ran at once.
 * A backend that can pin a connection must say so here.
 */
interface DbHandle extends Queryable {
  transact?<T>(fn: (client: Queryable) => Promise<T>): Promise<T>;
  /** Release every connection. Only the pooled backend has anything to do. */
  close?(): Promise<void>;
}

type Backend = "pg" | "embedded";

const backend: Backend =
  (process.env.RELAY_DB as Backend | undefined) ??
  (process.env.DATABASE_URL ? "pg" : "embedded");

declare global {
  // eslint-disable-next-line no-var
  var __relayDb: Promise<DbHandle> | undefined;
}

async function createEmbedded(): Promise<DbHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  const db = new PGlite();
  await db.exec(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));

  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const res = await db.query(text, params);
      return { rows: res.rows as T[] };
    },
  };
}

async function createPg(): Promise<DbHandle> {
  const { Pool } = await import("pg");

  /*
    `RELAY_PG_SCHEMA` gives a test file its own namespace inside one database.

    Vitest isolates modules per file, so under PGlite every file silently got a
    brand-new in-memory database — and the whole suite came to depend on that
    without anyone deciding it should. On a real server the files share one
    database and start seeing each other's rows: a fresh outbox consumer
    legitimately receives every unclaimed event in it, so a test that publishes
    one event and expects one dead letter gets however many the earlier files
    left behind.

    A schema per file restores the property the tests were written against
    without a shared-database truncate, which would be a loaded gun pointed at
    whatever database the connection string happened to name.
  */
  const schema = process.env.RELAY_PG_SCHEMA;

  /*
    Pool size is per *process*, and on a serverless host there are many
    processes.

    Ten is right for one long-lived server on a local Postgres and wrong
    everywhere else: each Vercel lambda instance opens its own pool, so ten
    becomes ten times however many instances happen to be warm, and a Neon free
    project runs out of connections long before the traffic justifies it. The
    symptom is not a clean error either — it is intermittent
    "remaining connection slots are reserved" under exactly the concurrency the
    deployment was meant to handle.

    Two on a serverless host, ten otherwise, and `RELAY_PG_MAX` overrides both
    for anyone whose situation is neither. Neon's *pooled* endpoint is what
    actually makes this safe — it multiplexes these onto far fewer Postgres
    backends — so the connection string matters as much as this number.
  */
  const serverless = Boolean(process.env.VERCEL);
  const max = Number(process.env.RELAY_PG_MAX ?? (serverless ? 2 : 10));

  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5433/move_relay",
    max,
    /*
      Short idle timeout on serverless: an instance that is about to be frozen
      should not be holding a connection open against a free-tier limit. Neon
      also suspends a project after five idle minutes, so a connection held
      across that boundary is dead anyway and only discovered on the next query.
    */
    idleTimeoutMillis: serverless ? 10_000 : 30_000,
    // Fail fast rather than hanging a request behind a cold Neon compute that
    // is still waking up. Neon's own guidance is that resume takes a few
    // hundred milliseconds; ten seconds is generous and still bounded.
    connectionTimeoutMillis: 10_000,
    /*
      Applied by the server at connection start, so it holds for every
      connection this pool opens — including ones created later under load.

      Deliberately *not* `<schema>,public`. With `public` on the path a
      statement that fails to resolve inside the test schema silently succeeds
      against the shared one, and the test passes while writing to a table no
      cleanup will ever drop. Excluding it turns that class of mistake into an
      immediate "relation does not exist" rather than a leak nobody notices.

      Safe because the schema depends only on `gen_random_uuid()`, which has
      been built into `pg_catalog` since PostgreSQL 13 and needs no extension
      on the search path.
    */
    ...(schema ? { options: `-c search_path=${schema}` } : {}),
  });

  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const res = await pool.query(text, params);
      return { rows: res.rows as T[] };
    },
    /*
      A transaction has to own its connection for its whole life. Checking one
      out and returning it in `finally` is the only way to guarantee that the
      statements between BEGIN and COMMIT ran on the connection that opened the
      transaction.
    */
    transact: async <T>(fn: (client: Queryable) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      /*
        Set only if `ROLLBACK` itself fails. Its presence is what tells the
        `finally` block to destroy this connection rather than recycle it — a
        client whose rollback failed may still be inside a transaction, and the
        next caller would inherit it.
      */
      let rollbackFailure: unknown = null;
      try {
        await client.query("BEGIN");
        const result = await fn({
          query: async <R>(text: string, params: unknown[] = []) => {
            const res = await client.query(text, params);
            return { rows: res.rows as R[] };
          },
        });
        await client.query("COMMIT");
        return result;
      } catch (err) {
        /*
          Three separate obligations when the callback fails, and they are easy
          to collapse into each other.

          The application's error stays primary. It is the reason the
          transaction was abandoned, and it is what the caller is equipped to
          handle. An earlier version attached a rollback failure to `err.cause`,
          which is wrong in a subtler way than it looks: `cause` is where the
          *application* records why its own error happened, and overwriting it —
          even only when empty — means a caller that later starts populating it
          silently loses that context to a plumbing detail. The rollback failure
          gets its own non-enumerable property instead, so it is observable
          without being mistaken for the cause and without changing how the
          error serialises.

          And a connection whose `ROLLBACK` failed is in an unknown
          transactional state. Returning it to the pool means the next caller
          inherits an open transaction, or a session with an aborted one. It is
          destroyed rather than reused.
        */
        try {
          await client.query("ROLLBACK");
        } catch (rollbackErr) {
          rollbackFailure = rollbackErr;
          if (err instanceof Error) {
            Object.defineProperty(err, "rollbackError", {
              value: rollbackErr,
              enumerable: false,
              configurable: true,
              writable: true,
            });
          }
        }
        throw err;
      } finally {
        /*
          Unconditional, because a client that is never released is a connection
          the pool never gets back — and the symptom is the application hanging
          on the eleventh transaction rather than anything legible.

          Passing the error to `release` is how node-postgres is told to
          destroy the connection instead of recycling it.
        */
        client.release(rollbackFailure ? (rollbackFailure as Error) : undefined);
      }
    },
    close: async () => {
      await pool.end();
    },
  };
}

export function getDb(): Promise<DbHandle> {
  global.__relayDb ??= backend === "embedded" ? createEmbedded() : createPg();
  return global.__relayDb;
}

/**
 * Close the backend and forget it.
 *
 * Exists for the test harness, which drops the schema its pool is pointed at.
 * Dropping a schema while connections are still open against it is a race: the
 * `DROP` blocks behind them, or succeeds and leaves live connections addressing
 * objects that no longer exist. Neither failure is loud, and the second one
 * surfaces later as an unrelated error in whichever file runs next.
 *
 * Resetting the global matters as much as ending the pool. A later `getDb()`
 * must build a fresh handle rather than hand back one whose connections are
 * gone.
 */
export async function closeDb(): Promise<void> {
  const pending = global.__relayDb;
  global.__relayDb = undefined;
  if (!pending) return;

  const db = await pending;
  await db.close?.();
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDb();
  const res = await db.query<T>(text, params);
  return res.rows;
}

/**
 * Runs `fn` inside a single transaction, rolling back on any throw.
 *
 * Every consequential state change goes through here. The alternative — writing
 * the row, then the audit event, then the projection, each independently —
 * allows a crash to leave state that no audit row explains. An unexplained state
 * change is exactly what this product exists to make impossible, so it must not
 * be reachable by accident.
 */
export async function withTransaction<T>(
  fn: (client: Queryable) => Promise<T>,
): Promise<T> {
  const db = await getDb();

  /*
    Where the backend can pin a connection, it must.

    This function used to issue BEGIN, the work, and COMMIT as three separate
    calls on the shared handle. Against PGlite that is a transaction, because
    there is exactly one connection and nothing can interleave. Against a real
    server behind a pool it is not: each call can be served by a different
    connection, so BEGIN opens a transaction on one, the writes commit
    individually on others, and COMMIT closes an empty transaction elsewhere.

    Sequentially the pool tends to return the same idle connection, so it
    looked correct and the suite passed. It would have stopped looking correct
    the moment two writers ran at once — which is precisely what the
    concurrency tests are for, so this had to be fixed before they could mean
    anything.
  */
  if (db.transact) return db.transact(fn);

  await db.query("BEGIN");
  try {
    const result = await fn(db);
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}

export const dbBackend = backend;
export type { PoolClient };
