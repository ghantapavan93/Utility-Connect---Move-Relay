#!/usr/bin/env node
/**
 * Proves the database enforces the product's guarantees, using an embedded
 * Postgres (PGlite) so it runs anywhere with no Docker and no server.
 *
 * These are not unit tests of application code. They attack the schema directly
 * with SQL that *should* be rejected. If any of these writes succeeds, a claim
 * made in the architecture docs is false.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const db = new PGlite();
await db.exec(readFileSync(join(root, "db", "schema.sql"), "utf8"));

let pass = 0;
let fail = 0;

const check = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`      ${err.message}`);
    fail++;
  }
};

/** Asserts that a statement is rejected by the database. */
const mustReject = async (sql, params = []) => {
  try {
    await db.query(sql, params);
  } catch {
    return; // rejected as required
  }
  throw new Error("statement was ACCEPTED but should have been rejected");
};

console.log("\nSchema guarantees\n");

const org = (
  await db.query(
    `INSERT INTO organizations (name, slug) VALUES ('Demo','demo') RETURNING id`,
  )
).rows[0].id;

const move = (
  await db.query(
    `INSERT INTO moves (organization_id, reference) VALUES ($1,'MR-0001') RETURNING id`,
    [org],
  )
).rows[0].id;

await check("a canonical field value requires a named actor", async () => {
  // canonical_requires_actor: "AI cannot merge records" as a CHECK constraint.
  await mustReject(
    `INSERT INTO field_versions
       (organization_id, move_id, field_path, value, channel, is_canonical)
     VALUES ($1,$2,'move.date','"2026-08-16"','customer_form',TRUE)`,
    [org, move],
  );
});

await check("a canonical value inserts when an actor is named", async () => {
  await db.query(
    `INSERT INTO field_versions
       (organization_id, move_id, field_path, value, channel,
        verification, is_canonical, selected_by, selection_reason)
     VALUES ($1,$2,'move.date','"2026-08-16"','customer_form',
             'customer_confirmed',TRUE,'human:concierge-7','customer confirmed directly')`,
    [org, move],
  );
});

await check("a second canonical value for the same field is impossible", async () => {
  // The partial unique index. Two concurrent approvals cannot produce two truths.
  await mustReject(
    `INSERT INTO field_versions
       (organization_id, move_id, field_path, value, channel,
        is_canonical, selected_by)
     VALUES ($1,$2,'move.date','"2026-08-14"','partner_api',TRUE,'human:concierge-9')`,
    [org, move],
  );
});

await check("non-canonical versions of the same field remain unlimited", async () => {
  // History must stay intact. The rejected value has to stay visible.
  await db.query(
    `INSERT INTO field_versions
       (organization_id, move_id, field_path, value, channel)
     VALUES ($1,$2,'move.date','"2026-08-14"','partner_api'),
            ($1,$2,'move.date','"2026-08-14"','csv_upload')`,
    [org, move],
  );
  const { rows } = await db.query(
    `SELECT count(*)::int AS n FROM field_versions
      WHERE move_id = $1 AND field_path = 'move.date'`,
    [move],
  );
  if (rows[0].n !== 3) throw new Error(`expected 3 versions, found ${rows[0].n}`);
});

const sr = (
  await db.query(
    `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
     VALUES ($1,$2,'electric','Reliant') RETURNING id`,
    [org, move],
  )
).rows[0].id;

await check("one provider submission per operation key", async () => {
  await db.query(
    `INSERT INTO provider_submissions
       (organization_id, service_request_id, operation_key,
        request_fingerprint, state, request_payload)
     VALUES ($1,$2,'provider_submit:e1','fp1','unknown','{}')`,
    [org, sr],
  );
  // The blind retry. Structurally impossible, and it survives restart and cache
  // eviction — which a Redis lock does not.
  await mustReject(
    `INSERT INTO provider_submissions
       (organization_id, service_request_id, operation_key,
        request_fingerprint, state, request_payload)
     VALUES ($1,$2,'provider_submit:e1','fp1','submitted','{}')`,
    [org, sr],
  );
});

await check("an UNKNOWN submission cannot claim a provider order id", async () => {
  // order_id_requires_settled_state. We may not record an order we have not
  // confirmed exists.
  await mustReject(
    `UPDATE provider_submissions SET provider_order_id = 'ORD-1'
      WHERE operation_key = 'provider_submit:e1' AND state = 'unknown'`,
  );
});

await check("reconciliation may record the order id it recovered", async () => {
  await db.query(
    `UPDATE provider_submissions
        SET state = 'reconciled', provider_order_id = 'ORD-1'
      WHERE operation_key = 'provider_submit:e1'`,
  );
});

await check("an UPDATE against the audit trail is rejected", async () => {
  // Previously these two statements were absorbed silently by a rule. They now
  // raise, because a caller that thinks it edited history and is never
  // contradicted stays wrong until somebody happens to look.
  await db.query(
    `INSERT INTO audit_events (organization_id, move_id, event_type, actor)
     VALUES ($1,$2,'provider.retry.blocked','system')`,
    [org, move],
  );
  await mustReject(`UPDATE audit_events SET actor = 'tampered'`);
  const { rows } = await db.query(
    `SELECT actor FROM audit_events WHERE event_type = 'provider.retry.blocked'`,
  );
  if (rows[0].actor !== "system") throw new Error("audit row was mutated");
});

await check("a DELETE against the audit trail is rejected", async () => {
  const before = (await db.query(`SELECT count(*)::int AS n FROM audit_events`)).rows[0].n;
  await mustReject(`DELETE FROM audit_events`);
  const after = (await db.query(`SELECT count(*)::int AS n FROM audit_events`)).rows[0].n;
  if (before !== after) throw new Error(`audit rows deleted: ${before} → ${after}`);
});

await check("a correcting event may still be appended", async () => {
  // The sanctioned path out. History is not editable; it is extendable.
  await db.query(
    `INSERT INTO audit_events (organization_id, move_id, event_type, actor, detail)
     VALUES ($1,$2,'audit.correction','human:concierge-7','{"corrects":"provider.retry.blocked"}')`,
    [org, move],
  );
});

await check("identical payloads on one channel collapse to a single submission", async () => {
  await db.query(
    `INSERT INTO raw_submissions
       (organization_id, channel, payload, payload_hash, correlation_id)
     VALUES ($1,'partner_api','{"a":1}','hash-x',gen_random_uuid())`,
    [org],
  );
  await mustReject(
    `INSERT INTO raw_submissions
       (organization_id, channel, payload, payload_hash, correlation_id)
     VALUES ($1,'partner_api','{"a":1}','hash-x',gen_random_uuid())`,
    [org],
  );
});

await check("consent records scope, channel and wording version", async () => {
  await db.query(
    `INSERT INTO consent_events
       (organization_id, move_id, purpose, channel, granted, consent_text_version)
     VALUES ($1,$2,'appointment_details','sms',TRUE,'uc-2026-07')`,
    [org, move],
  );
  // A purpose outside the four named in their public consent text is not
  // representable at all.
  await mustReject(
    `INSERT INTO consent_events
       (organization_id, move_id, purpose, channel, granted, consent_text_version)
     VALUES ($1,$2,'marketing','sms',TRUE,'uc-2026-07')`,
    [org, move],
  );
});

console.log(`\n${pass} passed, ${fail} failed\n`);
await db.close();
process.exit(fail === 0 ? 0 : 1);
