import { describe, it, expect, beforeAll } from "vitest";
import { query, withTransaction } from "../db";
import { persistCandidates, candidatesFromSubmission } from "../ingestion";
import { buildBriefing } from "../briefing";

/**
 * The briefing must be grounded: every substantive claim traces to a stored
 * field version, unknowns are stated as unknowns, and conflicts are shown rather
 * than silently resolved. These tests assert exactly that.
 */

let org: string;
let move: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Brief Co','brief-co') RETURNING id`,
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,'MR-BRIEF-1','conflict_pending') RETURNING id`,
      [org],
    )
  )[0]!.id;

  const partnerApi = candidatesFromSubmission({
    id: (await raw(org, "partner_api")).id,
    channel: "partner_api",
    partner_id: null,
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-14", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
      services: ["electric"],
    },
    received_at: "2026-07-17T09:00:00Z",
  });

  const customerForm = candidatesFromSubmission({
    id: (await raw(org, "customer_form")).id,
    channel: "customer_form",
    partner_id: null,
    payload: {
      customer: { first_name: "Maya", last_name: "Patel", email: "maya.patel@example.com", phone: "469-555-0142" },
      move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX 75093" },
      services: ["electric", "security"],
    },
    received_at: "2026-07-20T14:00:00Z",
  });

  await withTransaction((c) =>
    persistCandidates(
      c,
      { organizationId: org, moveId: move, correlationId: "22222222-2222-4222-8222-222222222222" },
      [...partnerApi, ...customerForm],
    ),
  );
});

async function raw(orgId: string, channel: string) {
  return (
    await query<{ id: string }>(
      `INSERT INTO raw_submissions (organization_id, channel, payload, payload_hash, correlation_id)
       VALUES ($1,$2,'{}',$3,gen_random_uuid()) RETURNING id`,
      [orgId, channel, `${channel}-brief`],
    )
  )[0]!;
}

describe("grounded briefing", () => {
  it("shows the unresolved move-date as a conflict, not a decision", async () => {
    const briefing = await buildBriefing(org, move);
    const dateClaim = briefing.claims.find((c) => c.text.startsWith("Move date"));
    expect(dateClaim?.kind).toBe("conflict");
    expect(dateClaim?.text).toContain("2026-08-14");
    expect(dateClaim?.text).toContain("2026-08-16");
  });

  it("raises an open question for every conflicted field", async () => {
    const briefing = await buildBriefing(org, move);
    expect(briefing.openQuestions.some((q) => q.toLowerCase().includes("move date"))).toBe(true);
  });

  it("flags missing consent and forbids contact", async () => {
    const briefing = await buildBriefing(org, move);
    const consent = briefing.claims.find((c) => c.text.toLowerCase().includes("consent"));
    expect(consent?.kind).toBe("unknown");
    expect(consent?.text.toLowerCase()).toContain("do not contact");
  });

  it("cites a source field id for every substantive claim", async () => {
    const briefing = await buildBriefing(org, move);
    const substantive = briefing.claims.filter(
      (c) => c.kind !== "unknown" && !c.text.startsWith("Consent"),
    );
    for (const claim of substantive) {
      expect(claim.sourceFieldIds.length).toBeGreaterThan(0);
    }
  });

  it("records an ai_run marked grounded, awaiting a human decision", async () => {
    await buildBriefing(org, move);
    const runs = await query<{ grounded: boolean; human_decision: string | null }>(
      `SELECT grounded, human_decision FROM ai_runs WHERE move_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [move],
    );
    expect(runs[0]!.grounded).toBe(true);
    expect(runs[0]!.human_decision).toBeNull();
  });

  it("never sets state — the briefing is advice, not an action", async () => {
    await buildBriefing(org, move);
    const m = await query<{ state: string }>(`SELECT state FROM moves WHERE id = $1`, [move]);
    // Still conflict_pending. Generating a briefing did not advance the move.
    expect(m[0]!.state).toBe("conflict_pending");
  });
});
