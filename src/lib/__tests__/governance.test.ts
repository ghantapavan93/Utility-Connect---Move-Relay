import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { canContact, recordConsent } from "../consent";
import { beliefAt, staleSince } from "../provenance";

/**
 * Governance suite: the consent gate resolved at send time, and bitemporal
 * provenance answering "what did we believe then vs now".
 */

let org: string;
let move: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Governance','gov') RETURNING id`,
    )
  )[0]!.id;
  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference) VALUES ($1,'MR-GOV-1') RETURNING id`,
      [org],
    )
  )[0]!.id;
});

describe("consent gate — resolved at send time, deny by default", () => {
  it("denies when nothing is on file", async () => {
    const d = await canContact(move, "sms", "appointment_details");
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("deny by default");
  });

  it("allows after a grant, carrying the wording version for the audit", async () => {
    await recordConsent(org, move, "appointment_details", "sms", true, "uc-2026-07");
    const d = await canContact(move, "sms", "appointment_details");
    expect(d.allowed).toBe(true);
    expect(d.consentTextVersion).toBe("uc-2026-07");
  });

  it("revocation is just a newer event — no special path, and it wins", async () => {
    await recordConsent(org, move, "appointment_details", "sms", false, "uc-2026-07");
    const d = await canContact(move, "sms", "appointment_details");
    expect(d.allowed).toBe(false);
    expect(d.reason).toContain("revoked");
  });

  it("revoking SMS does not touch email — consent is per-channel", async () => {
    await recordConsent(org, move, "appointment_details", "email", true, "uc-2026-07");
    const email = await canContact(move, "email", "appointment_details");
    const sms = await canContact(move, "sms", "appointment_details");
    expect(email.allowed).toBe(true);
    expect(sms.allowed).toBe(false);
  });

  it("scope is per-purpose too — appointment consent is not marketing consent", async () => {
    const other = await canContact(move, "email", "customer_care");
    expect(other.allowed).toBe(false);
  });
});

describe("bitemporal provenance — then-belief vs now-belief", () => {
  const t1 = "2026-07-17T09:00:00.000Z"; // partner reports Aug 14
  const t2 = "2026-07-20T14:00:00.000Z"; // customer corrects to Aug 16

  beforeAll(async () => {
    await query(
      `INSERT INTO field_versions
         (organization_id, move_id, field_path, value, channel, verification, recorded_at, valid_at)
       VALUES
         ($1,$2,'move.date','"2026-08-14"','partner_api','unverified',$3,$3),
         ($1,$2,'move.date','"2026-08-16"','customer_form','customer_confirmed',$4,$4)`,
      [org, move, t1, t2],
    );
  });

  it("answers what we believed BEFORE the correction", async () => {
    const belief = await beliefAt(move, "move.date", "2026-07-18T00:00:00.000Z");
    expect(belief?.value).toBe("2026-08-14");
    expect(belief?.channel).toBe("partner_api");
  });

  it("answers what we believe NOW", async () => {
    const belief = await beliefAt(move, "move.date", new Date().toISOString());
    expect(belief?.value).toBe("2026-08-16");
    expect(belief?.verification).toBe("customer_confirmed");
  });

  it("returns null before anything was known — no invented beliefs", async () => {
    expect(await beliefAt(move, "move.date", "2026-07-01T00:00:00.000Z")).toBeNull();
  });

  it("computes the compensation set: fields that changed after a submission went out", async () => {
    // A provider submission went out on the 18th, between report and correction.
    const findings = await staleSince(move, "2026-07-18T00:00:00.000Z");
    const dateFinding = findings.find((f) => f.fieldPath === "move.date");
    expect(dateFinding).toBeDefined();
    expect(dateFinding!.believedThen).toBe("2026-08-14");
    expect(dateFinding!.believedNow).toBe("2026-08-16");
  });
});
