#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const connectionString =
  process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5433/move_relay";

const reset = process.argv.includes("--reset");

const client = new pg.Client({ connectionString });
await client.connect();

if (reset) {
  // Demo database. Drops everything and rebuilds from schema.sql so the demo
  // always starts from a known state.
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  console.log("• schema dropped");
}

const sql = readFileSync(join(root, "db", "schema.sql"), "utf8");
await client.query(sql);

const { rows } = await client.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name`,
);

console.log(`✓ migrated — ${rows.length} tables`);
console.log(rows.map((r) => `  · ${r.table_name}`).join("\n"));

await client.end();
