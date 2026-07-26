import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { validateSubmission, quarantineSubmission, quarantineBacklog } from "../contracts";
import {
  duplicateCsv,
  webhookTwice,
  workerCrash,
  crossTenant,
  staleWrite,
  schemaDrift,
} from "../theater";

/**
 * Contract layer + Failure Theater suite. The theater scenarios are the same
 * functions the UI buttons call — testing them here means the buttons a
 * reviewer clicks are running code with proven behaviour, not stage props.
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Contracts','contracts') RETURNING id`,
    )
  )[0]!.id;
});

describe("integration contracts", () => {
  const valid = {
    customer: { first_name: "Maya", last_name: "Patel", email: "maya@example.com", phone: "469-555-0142" },
    move: { date: "2026-08-16", to_address: "1420 Windhaven Pkwy, Plano, TX" },
    services: ["electric"],
  };

  it("accepts a payload that satisfies its channel contract", () => {
    const result = validateSubmission("partner_api", valid);
    expect(result.ok).toBe(true);
    expect(result.version).toBe("partner-api-v1");
  });

  it("rejects drift with machine-readable paths, not a generic error", () => {
    // The classic unannounced change: date renamed, format changed, email gone.
    const drifted = {
      customer: { first_name: "Maya", last_name: "Patel", phone: "469-555-0142" },
      move: { moveDate: "08/16/2026", to_address: "1420 Windhaven Pkwy" },
    };
    const result = validateSubmission("partner_api", drifted);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path);
      expect(paths).toContain("customer.email");
      expect(paths).toContain("move.date");
    }
  });

  it("catches a malformed email and a bad date format", () => {
    const bad = {
      ...valid,
      customer: { ...valid.customer, email: "not-an-email" },
      move: { ...valid.move, date: "Aug 16" },
    };
    const result = validateSubmission("customer_form", bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("quarantines a failed payload with its reasons — visible and resolvable", async () => {
    const before = await quarantineBacklog(org);
    const failure = validateSubmission("partner_api", { junk: true });
    expect(failure.ok).toBe(false);
    if (!failure.ok) {
      const id = await quarantineSubmission(org, "partner_api", { junk: true }, failure);
      expect(id).toBeTruthy();
    }
    expect(await quarantineBacklog(org)).toBe(before + 1);
  });
});

describe("failure theater — every scenario upholds its invariant", () => {
  it("a re-uploaded CSV replays rather than creating a second set of referrals", async () => {
    const r = await duplicateCsv();
    expect(r.outcome).not.toBe("VIOLATION");

    // The assertion moved with the scenario. It used to check that a unique
    // index refused a byte-identical insert — true, but the card promised an
    // upload and nothing was ever parsed. The scenario now runs real CSV rows
    // through the real intake path, so the property to check is the one a
    // partner actually experiences: send yesterday's export again and every row
    // replays instead of enrolling anyone twice.
    expect(r.evidence.rowsParsed).toBe(2);
    expect(r.evidence.secondPass).toEqual(["replayed", "replayed"]);
  });

  it("webhook delivered twice, handled once", async () => {
    const r = await webhookTwice();
    expect(r.outcome).not.toBe("VIOLATION");
    expect(r.evidence.redeliveryProcessed).toBe(0);
  });

  it("worker crash resumes without re-running completed steps", async () => {
    const r = await workerCrash();
    expect(r.outcome).not.toBe("VIOLATION");
    expect(r.evidence.reserveCompletions).toBe(1);
    expect(r.evidence.stateAfterResume).toBe("completed");
  });

  it("cross-tenant access is denied by default, owner granted with explanation", async () => {
    const r = await crossTenant();
    expect(r.outcome).not.toBe("VIOLATION");
    const owner = r.evidence.owningAgent as { allowed: boolean; via: string };
    expect(owner.allowed).toBe(true);
    expect(owner.via).toBeTruthy();
  });

  it("stale write is rejected, never a silent overwrite", async () => {
    const r = await staleWrite();
    expect(r.outcome).not.toBe("VIOLATION");
    expect(r.evidence.secondWriteRows).toBe(0);
  });

  it("schema drift is quarantined with issues, never force-fed", async () => {
    const r = await schemaDrift();
    expect(r.outcome).not.toBe("VIOLATION");
    expect((r.evidence.issues as unknown[]).length).toBeGreaterThan(0);
    expect(r.evidence.quarantineId).toBeTruthy();
  });
});
