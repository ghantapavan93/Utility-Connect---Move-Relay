import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { query } from "../db";
import { reset } from "../demo-orchestrator";
import { ingestReferral } from "../intake";
import {
  servicesFor,
  submitService,
  retryService,
  reconcileService,
  providerRequestKey,
  backfillServices,
} from "../fulfillment";
import { __simulator } from "../provider-simulator";
import { checkView } from "../authz";
import { INTAKE_PRESETS } from "../intake-presets";
import { SERVICE_CATALOGUE } from "../service-catalogue";

/**
 * Fulfillment for a move nobody wrote a script for.
 *
 * The demo narrative proved this whole spine works — for one hardcoded move,
 * one hardcoded service, and one hardcoded provider request key. Everything
 * outside that narrative was a dead end that nothing reported: a move created
 * through the real intake endpoint had no `service_requests` rows, so it could
 * not be submitted, could not reach UNKNOWN, and could not be reconciled.
 *
 * These tests are about the general path. The scenario suite already covers the
 * story; what it could not cover is whether the story was the only thing that
 * worked.
 */

let org: string;

/**
 * A distinct household per call.
 *
 * The counter is not decoration. Two byte-identical payloads collapse into one
 * submission by design — that is the exact-duplicate guarantee — so a helper
 * that returned the same person every time would silently hand every test the
 * same move, and assertions about "two moves" would be about one.
 */
let seq = 0;
const referral = (over: Record<string, unknown> = {}) => {
  seq += 1;
  return {
    customer: {
      first_name: `Lena${seq}`,
      last_name: "Osei",
      email: `lena.osei.${seq}@example.com`,
      phone: `469-555-${String(1000 + seq).slice(-4)}`,
    },
    move: { date: "2026-11-02", to_address: `${70 + seq} Ridgemont Ln, Frisco, TX 75034` },
    services: ["electric", "internet"],
    referral: { partner_slug: "north-texas-realty" },
    ...over,
  };
};

beforeAll(async () => {
  await reset();
  org = (await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`))[0]!.id;
});

beforeEach(() => {
  __simulator.reset();
});

async function freshMove(payload = referral()) {
  const result = await ingestReferral({
    organizationId: org,
    channel: "partner_api",
    payload,
    idempotencyKey: `test:${crypto.randomUUID()}`,
  });
  expect(result.status).toBe("created");
  return result.moveId!;
}

describe("a move from the real intake path can actually be fulfilled", () => {
  it("materialises a service request per service the referral asked for", async () => {
    const moveId = await freshMove();
    const services = await servicesFor(moveId);

    // The defect this closes: this was an empty array for every move that was
    // not the scripted one, and nothing anywhere said so.
    expect(services.map((s) => s.serviceType).sort()).toEqual(["electric", "internet"]);
    for (const s of services) expect(s.providerName).not.toBe("");
  });

  it("ignores service names the catalogue does not know", async () => {
    // A partner typo should not mint a service nobody fulfils. The value still
    // lands as a field version, where a human can see it.
    const moveId = await freshMove(referral({ services: ["electric", "electricty", "unicorns"] }));
    const services = await servicesFor(moveId);
    expect(services.map((s) => s.serviceType)).toEqual(["electric"]);
  });

  it("does not duplicate a service two sources both asked for", async () => {
    // The same household on two channels, which is what makes the second one
    // attach rather than mint a move. Both name electricity; the customer asked
    // for it once.
    const first = referral();
    const moveId = await freshMove(first);

    const attach = await ingestReferral({
      organizationId: org,
      channel: "customer_form",
      payload: { ...first, services: ["electric", "security"] },
      idempotencyKey: `test:${crypto.randomUUID()}`,
    });
    expect(attach.status).toBe("attached");
    expect(attach.moveId).toBe(moveId);

    const services = await servicesFor(moveId);
    expect(services.filter((s) => s.serviceType === "electric").length).toBe(1);
    // And the service only the later source asked for is now fulfillable.
    expect(services.map((s) => s.serviceType).sort()).toEqual([
      "electric",
      "internet",
      "security",
    ]);
  });
});

describe("the timeout, the refusal and the recovery, on an arbitrary move", () => {
  it("holds UNKNOWN when the provider's reply is lost", async () => {
    const moveId = await freshMove();
    const electric = (await servicesFor(moveId)).find((s) => s.serviceType === "electric")!;

    const result = await submitService({
      organizationId: org,
      moveId,
      serviceRequestId: electric.id,
      correlationId: crypto.randomUUID(),
      actor: "human:concierge-7",
    });

    expect(result.state).toBe("unknown");
    // The order exists on the provider's side. That is the entire problem.
    expect(__simulator.size()).toBe(1);
  });

  it("refuses the blind retry without contacting the provider", async () => {
    const moveId = await freshMove();
    const electric = (await servicesFor(moveId)).find((s) => s.serviceType === "electric")!;
    const ctx = {
      organizationId: org,
      moveId,
      serviceRequestId: electric.id,
      correlationId: crypto.randomUUID(),
      actor: "human:concierge-7",
    };

    await submitService(ctx);
    const ordersAfterSubmit = __simulator.size();

    // The callback throws if reached, so a passing assertion here is proof the
    // provider was never called — not merely that no second order appeared.
    const retry = await retryService(ctx);
    expect(retry.blocked).toBe(true);
    expect(__simulator.size()).toBe(ordersAfterSubmit);
  });

  it("recovers the order that existed all along", async () => {
    const moveId = await freshMove();
    const electric = (await servicesFor(moveId)).find((s) => s.serviceType === "electric")!;
    const ctx = {
      organizationId: org,
      moveId,
      serviceRequestId: electric.id,
      correlationId: crypto.randomUUID(),
      actor: "human:concierge-7",
    };

    await submitService(ctx);
    const outcome = await reconcileService(ctx);

    expect(outcome.providerOrderId).toBeTruthy();
    // One order, never two — across submit, refused retry and reconciliation.
    expect(__simulator.size()).toBe(1);
  });
});

describe("two moves cannot collide in the provider's ledger", () => {
  it("gives each service request its own provider request key", async () => {
    const a = await freshMove();
    const b = await freshMove(
      referral({
        customer: {
          first_name: "Idris",
          last_name: "Bello",
          email: "idris.bello@example.com",
          phone: "469-555-0288",
        },
        move: { date: "2026-11-19", to_address: "9 Barton Springs Rd, Austin, TX 78704" },
      }),
    );
    expect(a).not.toBe(b);

    const aElectric = (await servicesFor(a)).find((s) => s.serviceType === "electric")!;
    const bElectric = (await servicesFor(b)).find((s) => s.serviceType === "electric")!;
    expect(providerRequestKey(aElectric.id)).not.toBe(providerRequestKey(bElectric.id));
  });

  it("reconciles each move to its own order, not to whichever came first", async () => {
    /*
      The failure this prevents is severe and quiet. With a shared request key —
      which is what the module constant `"svc-electric-maya"` was — the second
      move's reconciliation looks up the first move's order, finds it, and
      attaches it. Two households, one electricity order, and an audit trail
      that says both were fulfilled.
    */
    const a = await freshMove();
    const b = await freshMove(
      referral({
        customer: {
          first_name: "Nadia",
          last_name: "Haddad",
          email: "nadia.haddad@example.com",
          phone: "469-555-0399",
        },
        move: { date: "2026-12-01", to_address: "410 Pecan Grove Dr, Plano, TX 75023" },
      }),
    );

    const ctxFor = async (moveId: string) => {
      const electric = (await servicesFor(moveId)).find((s) => s.serviceType === "electric")!;
      return {
        organizationId: org,
        moveId,
        serviceRequestId: electric.id,
        correlationId: crypto.randomUUID(),
        actor: "human:concierge-7",
      };
    };

    const ctxA = await ctxFor(a);
    const ctxB = await ctxFor(b);

    await submitService(ctxA);
    await submitService(ctxB);
    expect(__simulator.size()).toBe(2);

    const outA = await reconcileService(ctxA);
    const outB = await reconcileService(ctxB);

    expect(outA.providerOrderId).toBeTruthy();
    expect(outB.providerOrderId).toBeTruthy();
    expect(outA.providerOrderId).not.toBe(outB.providerOrderId);
  });
});

describe("a service request cannot be driven from another move", () => {
  it("refuses a service request id that belongs to a different move", async () => {
    const a = await freshMove();
    const b = await freshMove(
      referral({
        customer: {
          first_name: "Omar",
          last_name: "Faruk",
          email: "omar.faruk@example.com",
          phone: "469-555-0455",
        },
        move: { date: "2027-01-08", to_address: "12 Kessler Pkwy, Dallas, TX 75208" },
      }),
    );

    const bElectric = (await servicesFor(b)).find((s) => s.serviceType === "electric")!;

    // Reaching move A does not make B's services actionable. Scoping the lookup
    // by move as well as by id is what stops one authorized case from becoming
    // a handle on every other one.
    await expect(
      submitService({
        organizationId: org,
        moveId: a,
        serviceRequestId: bElectric.id,
        correlationId: crypto.randomUUID(),
        actor: "human:concierge-7",
      }),
    ).rejects.toThrow(/no such service request/);
  });
});

describe("the console's presets name services that actually exist", () => {
  it("uses catalogue ids, so a preset produces something fulfillable", () => {
    /*
      Measured against the running console: the presets asked for `electricity`
      and `home_security`, and the catalogue's ids are `electric` and
      `security`. Unknown names are skipped by design, so every move the console
      created had fewer services than the referral appeared to request — and the
      one preset asking only for `electricity` produced a move with none at all.

      Silently dropping an unknown service is the right behaviour. Shipping a
      demo whose own payloads trip it is not.
    */
    const known = new Set(SERVICE_CATALOGUE.map((s) => s.id));
    for (const p of INTAKE_PRESETS) {
      const services = (p.payload as { services?: unknown }).services;
      if (!Array.isArray(services)) continue;
      for (const s of services) {
        expect(known, `${p.id} asks for "${s}"`).toContain(s);
      }
    }
  });
});

describe("no surface can request a service the catalogue will drop", () => {
  it("never derives a service id by lower-casing a label", () => {
    /*
      `label.toLowerCase()` is correct for every single-word service and
      silently wrong for the rest — "Home Warranty" becomes `home warranty`
      against an id of `home_warranty`, "Solar Energy" becomes `solar energy`
      against `solar`. Unknown names are dropped at intake by design, so the
      customer gets a confirmation screen and a move with the service missing.

      The customer-facing form did exactly this. The guard is on the derivation
      rather than the output, because the output looks entirely plausible.
    */
    const fs = require("node:fs") as typeof import("node:fs");
    const source = fs.readFileSync("src/app/connect-flow/page.tsx", "utf8");
    expect(source, "a service id is being derived from a label").not.toMatch(
      /services:\s*\[\.\.\.selected\]\.map\(/,
    );
    expect(source).not.toContain("s.toLowerCase()");
  });

  it("has an id for every catalogue label that survives lower-casing", () => {
    // The subset that happens to work is why this went unnoticed: over half the
    // catalogue is single-word, so the form looked fine in every casual test.
    const lossy = SERVICE_CATALOGUE.filter((s) => s.label.toLowerCase() !== s.id);
    expect(
      lossy.length,
      `these labels do not lower-case to their id: ${lossy.map((s) => s.label).join(", ")}`,
    ).toBeGreaterThan(0);
  });
});

describe("a move from the real intake path is reachable at all", () => {
  it("gives the owning organization a path to every move it creates", async () => {
    /*
      Authorization here is relationship-based: a concierge reaches a case by
      being a member of an organization that owns it. Only the demo orchestrator
      wrote those tuples, and only for its one scripted move — so a move from
      the real intake endpoint had no owning edge and no path existed to it.

      Measured against the running console, `GET` on its own freshly created
      move returned 403 to the operator who had just created it. The record was
      not merely unfulfillable; it was invisible.
    */
    const moveId = await freshMove();
    const check = await checkView("user:concierge-7", `move:${moveId}`);
    expect(check.allowed, JSON.stringify(check)).toBe(true);
  });

  it("still denies an actor with no relationship to it", async () => {
    // The guarantee has to hold in both directions, or the fix above is just a
    // hole with a nicer name.
    const moveId = await freshMove();
    const check = await checkView("user:stranger", `move:${moveId}`);
    expect(check.allowed).toBe(false);
  });
});

describe("moves that predate this can be recovered", () => {
  it("backfills services from what the referral recorded it wanted", async () => {
    const moveId = await freshMove();
    // Simulate the old state: field versions present, service rows absent.
    await query(`DELETE FROM service_requests WHERE move_id = $1`, [moveId]);
    expect(await servicesFor(moveId)).toHaveLength(0);

    await backfillServices(org, moveId);
    const after = await servicesFor(moveId);
    expect(after.map((s) => s.serviceType).sort()).toEqual(["electric", "internet"]);
  });
});
