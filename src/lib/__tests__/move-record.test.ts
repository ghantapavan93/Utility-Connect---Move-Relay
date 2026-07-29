import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { reset } from "../demo-orchestrator";
import { ingestReferral } from "../intake";
import { moveRecord } from "../move-record";
import { approveMergeFor } from "../moves";
import { submitService } from "../fulfillment";
import { __simulator } from "../provider-simulator";

/**
 * The move record read model.
 *
 * The workspace could resolve conflicts and, once there were none, showed a
 * card saying so and a link away — on the screen whose entire purpose is to
 * prove where each value came from. This is the model that fixes that: one
 * move, by id, with every field's full history, its sources, services, consent
 * and audit trail.
 *
 * The assertions worth having here are about *provenance surviving*. A record
 * view that showed only current values would be indistinguishable from any CRM;
 * what makes this one worth building is that a superseded value, the person who
 * overruled it, and their stated reason are all still there afterwards.
 */

let org: string;
let seq = 0;

const referral = (over: Record<string, unknown> = {}) => {
  seq += 1;
  return {
    customer: {
      first_name: `Rina${seq}`,
      last_name: "Kapoor",
      email: `rina.kapoor.${seq}@example.com`,
      phone: `972-555-${String(2000 + seq).slice(-4)}`,
    },
    move: { date: "2026-10-14", to_address: `${100 + seq} Aster Ln, McKinney, TX 75070` },
    services: ["electric", "internet"],
    referral: { partner_slug: "north-texas-realty" },
    ...over,
  };
};

beforeAll(async () => {
  await reset();
  __simulator.reset();
  org = (await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`))[0]!.id;
});

async function land(payload: Record<string, unknown>, channel: "partner_api" | "customer_form") {
  return ingestReferral({
    organizationId: org,
    channel,
    payload,
    idempotencyKey: `rec:${crypto.randomUUID()}`,
  });
}

describe("a move's whole record, by id", () => {
  it("returns null for a move that does not exist", async () => {
    expect(await moveRecord("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("carries the fields, sources, services and audit trail together", async () => {
    const base = referral();
    const created = await land(base, "partner_api");
    const record = (await moveRecord(created.moveId!))!;

    expect(record.move.reference).toBe(created.reference);
    expect(record.fields.length).toBeGreaterThan(0);
    expect(record.sources.map((s) => s.channel)).toContain("partner_api");
    expect(record.services.map((s) => s.serviceType).sort()).toEqual(["electric", "internet"]);
    expect(record.audit.length).toBeGreaterThan(0);
  });

  it("keeps both clocks on every version", async () => {
    // "When we learned it" and "when it was true" answer different questions,
    // and a record that collapses them cannot answer either honestly.
    const created = await land(referral(), "partner_api");
    const record = (await moveRecord(created.moveId!))!;
    for (const f of record.fields) {
      for (const v of f.versions) expect(v.recordedAt).toBeTruthy();
    }
  });
});

describe("a contested field is visibly contested until a person settles it", () => {
  it("marks a field with two values and no canonical as needing a person", async () => {
    const base = referral();
    const created = await land(base, "partner_api");

    // The same household on another channel, with a different move date.
    const attached = await land(
      { ...base, move: { ...(base.move as object), date: "2026-10-18" } },
      "customer_form",
    );
    expect(attached.status).toBe("attached");

    const record = (await moveRecord(created.moveId!))!;
    const date = record.fields.find((f) => f.fieldPath === "move.date")!;
    expect(date.versions.length).toBeGreaterThan(1);
    expect(date.canonical).toBeNull();
    expect(date.contested).toBe(true);
  });

  it("stops being contested once a human chooses, and says who and why", async () => {
    const base = referral();
    const created = await land(base, "partner_api");
    await land({ ...base, move: { ...(base.move as object), date: "2026-10-18" } }, "customer_form");

    const before = (await moveRecord(created.moveId!))!;
    await approveMergeFor({
      organizationId: org,
      moveId: created.moveId!,
      expectedVersion: before.move.version,
      actor: "user:concierge-7",
      decisions: [
        {
          fieldPath: "move.date",
          value: "2026-10-18",
          reason: "Customer confirmed the later date on their own form.",
        },
      ],
    });

    const after = (await moveRecord(created.moveId!))!;
    const date = after.fields.find((f) => f.fieldPath === "move.date")!;

    expect(date.contested).toBe(false);
    expect(date.canonical).not.toBeNull();
    expect(date.canonical!.selectedBy).toBe("user:concierge-7");
    expect(date.canonical!.selectionReason).toMatch(/Customer confirmed/);
  });

  it("does not delete what it overruled", async () => {
    /*
      The point of the whole system. After a merge the losing value is still
      there with its channel and its trust tier, because "we chose the later
      date" is only a defensible sentence if the earlier one can still be seen.
    */
    const base = referral();
    const created = await land(base, "partner_api");
    await land({ ...base, move: { ...(base.move as object), date: "2026-10-18" } }, "customer_form");

    const before = (await moveRecord(created.moveId!))!;
    await approveMergeFor({
      organizationId: org,
      moveId: created.moveId!,
      expectedVersion: before.move.version,
      actor: "user:concierge-7",
      decisions: [{ fieldPath: "move.date", value: "2026-10-18", reason: "Customer confirmed." }],
    });

    const after = (await moveRecord(created.moveId!))!;
    const date = after.fields.find((f) => f.fieldPath === "move.date")!;
    const values = date.versions.map((v) => String(v.value).replace(/"/g, ""));

    expect(values).toContain("2026-10-14");
    expect(values).toContain("2026-10-18");
  });
});

describe("the record shows what the provider actually said", () => {
  it("reports an unknown outcome as unknown, not as a failure", async () => {
    const created = await land(referral(), "partner_api");
    const record = (await moveRecord(created.moveId!))!;
    const electric = record.services.find((s) => s.serviceType === "electric")!;
    expect(electric.submissionState).toBeNull();

    await submitService({
      organizationId: org,
      moveId: created.moveId!,
      serviceRequestId: electric.id,
      correlationId: crypto.randomUUID(),
      actor: "human:concierge-7",
    });

    const after = (await moveRecord(created.moveId!))!;
    const submitted = after.services.find((s) => s.serviceType === "electric")!;
    expect(submitted.submissionState).toBe("unknown");
  });
});

describe("consent is recorded with its scope, not as a boolean", () => {
  it("keeps purpose, channel and the wording version", async () => {
    const created = await land(
      referral({
        consent: {
          granted: true,
          channels: ["email"],
          purposes: ["customer_care"],
          text_version: "consent-2026-03",
        },
      }),
      "customer_form",
    );

    const record = (await moveRecord(created.moveId!))!;
    expect(record.consent.length).toBeGreaterThan(0);
    const grant = record.consent[0]!;
    expect(grant.granted).toBe(true);
    // "They agreed" is not an answer without "to what, exactly".
    expect(grant.purpose).toBeTruthy();
    expect(grant.channel).toBeTruthy();
    expect(grant.textVersion).toBe("consent-2026-03");
  });

  it("records it when the customer's form attaches to an existing move", async () => {
    /*
      The path that actually happens, and the one that dropped it.

      A partner refers a household, then the customer confirms on their own
      form — so the consent-carrying channel arrives second and *attaches*.
      Consent was only written on the create path, so the commonest way anyone
      grants it was the one path that discarded it, silently, while returning
      200 and listing the customer as a source.
    */
    const base = referral();
    const created = await land(base, "partner_api");

    const attached = await land(
      {
        ...base,
        move: { ...(base.move as object), date: "2026-10-21" },
        consent: {
          granted: true,
          channels: ["phone"],
          purposes: ["appointment_details"],
          text_version: "consent-2026-05",
        },
      },
      "customer_form",
    );
    expect(attached.status).toBe("attached");
    expect(attached.moveId).toBe(created.moveId);

    const record = (await moveRecord(created.moveId!))!;
    const grant = record.consent.find((c) => c.textVersion === "consent-2026-05");
    expect(grant, "consent granted on the attach path was discarded").toBeDefined();
    expect(grant!.purpose).toBe("appointment_details");
    expect(grant!.channel).toBe("phone");
  });

  it("writes one row per purpose and channel, not one per grant", async () => {
    // Agreeing to be phoned about an appointment is not agreeing to be emailed
    // about an account. A single boolean cannot answer whether *this* contact
    // was permitted, which is the only question ever asked of it.
    const created = await land(
      referral({
        consent: {
          granted: true,
          channels: ["email", "phone"],
          purposes: ["customer_care", "connection_status"],
          text_version: "consent-2026-06",
        },
      }),
      "customer_form",
    );

    const record = (await moveRecord(created.moveId!))!;
    const rows = record.consent.filter((c) => c.textVersion === "consent-2026-06");
    expect(rows.length).toBe(4);
  });
});
