import { Pool, type PoolClient } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5433/move_relay";

declare global {
  // eslint-disable-next-line no-var
  var __relayPool: Pool | undefined;
}

export const pool =
  global.__relayPool ??
  new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });

if (process.env.NODE_ENV !== "production") global.__relayPool = pool;

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}

/**
 * Runs `fn` inside a single transaction, rolling back on any throw.
 *
 * Every consequential state change in Move Relay goes through here. The
 * alternative — writing the row, then writing the audit event, then updating the
 * projection, each on its own connection — allows a crash to leave state that no
 * audit row explains. An unexplained state change is precisely what this product
 * exists to make impossible.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
