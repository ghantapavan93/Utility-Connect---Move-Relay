#!/usr/bin/env node
/**
 * Seeds the demo tenant and the three referral payloads for the Maya Patel
 * scenario.
 *
 * It deliberately stops at raw_submissions. The whole point of the demo is that
 * ingestion, duplicate detection, conflict surfacing and human merge are things
 * the *running system* does — not things a seed script pre-baked. Seeding a
 * finished Move Record would make the demo a mockup.
 *
 * All data is synthetic.
 */
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import pg from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://relay:relay@localhost:5433/move_relay";

const client = new pg.Client({ connectionString });
await client.connect();

const hash = (o) =>
  createHash("sha256").update(JSON.stringify(o, Object.keys(o).sort())).digest("hex");

await client.query("BEGIN");

// --- tenant ---------------------------------------------------------------
const org = (
  await client.query(
    `INSERT INTO organizations (name, slug) VALUES ($1, $2)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    ["Utility Connect (demo tenant)", "utility-connect-demo"],
  )
).rows[0].id;

// Partner signup on utilityconnect.net collects Domain Name, Theme Color and
// Company Logo — i.e. a white-label microsite. Modelled here.
const partner = (
  await client.query(
    `INSERT INTO partners (organization_id, name, slug, domain, theme_color)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [org, "North Texas Realty", "north-texas-realty", "move.northtexasrealty.com", "#1F4E79"],
  )
).rows[0].id;

// --- the three referral payloads -----------------------------------------
// One human. Three doors. No two agree completely.
const correlation = randomUUID();

const submissions = [
  {
    channel: "partner_api",
    partner_id: partner,
    // The partner's CRM pushes what it knows. It has never spoken to Maya about
    // her move date; it holds whatever was captured at listing time.
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
      services: ["electric", "internet"],
      referral: { partner_slug: "north-texas-realty", agent: "D. Okafor" },
    },
  },
  {
    channel: "csv_upload",
    partner_id: partner,
    // Same customer, exported by hand from the brokerage's back office.
    // One digit of the phone number is wrong: 0142 became 0143.
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0143" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
      services: ["electric"],
      referral: { partner_slug: "north-texas-realty" },
    },
  },
  {
    channel: "customer_form",
    partner_id: null,
    // Maya fills the form herself, three days later. Her closing moved. She also
    // decides she wants home security. This is the only source where the customer
    // speaks for herself — which is why its verification level differs.
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
      services: ["electric", "internet", "security"],
      consent: {
        granted: true,
        channels: ["phone", "sms", "email"],
        purposes: ["customer_care", "connection_status", "account_information", "appointment_details"],
        text_version: "uc-2026-07",
      },
    },
  },
];

for (const s of submissions) {
  await client.query(
    `INSERT INTO raw_submissions
       (organization_id, partner_id, channel, payload, payload_hash, correlation_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (organization_id, channel, payload_hash) DO NOTHING`,
    [org, s.partner_id, s.channel, JSON.stringify(s.payload), hash(s.payload), correlation],
  );
}

await client.query("COMMIT");

console.log("✓ seeded");
console.log(`  organization  ${org}`);
console.log(`  partner       ${partner} (North Texas Realty)`);
console.log(`  correlation   ${correlation}`);
console.log(`  submissions   ${submissions.length} raw, unprocessed`);
console.log("");
console.log("  Nothing is resolved yet. Run the demo to watch the system");
console.log("  detect the duplicate and surface the conflicts.");

await client.end();
