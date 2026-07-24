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

type Backend = "pg" | "embedded";

const backend: Backend =
  (process.env.RELAY_DB as Backend | undefined) ??
  (process.env.DATABASE_URL ? "pg" : "embedded");

declare global {
  // eslint-disable-next-line no-var
  var __relayDb: Promise<Queryable> | undefined;
}

async function createEmbedded(): Promise<Queryable> {
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

async function createPg(): Promise<Queryable> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5433/move_relay",
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  return {
    query: async <T>(text: string, params: unknown[] = []) => {
      const res = await pool.query(text, params);
      return { rows: res.rows as T[] };
    },
  };
}

export function getDb(): Promise<Queryable> {
  global.__relayDb ??= backend === "embedded" ? createEmbedded() : createPg();
  return global.__relayDb;
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
