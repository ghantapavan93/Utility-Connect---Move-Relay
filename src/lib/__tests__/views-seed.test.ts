import { describe, it, expect } from "vitest";
import { seedViewsMove, seededMove, VIEWS_ORG_SLUG, VIEWS_ACTORS } from "../views-seed";
import { viewForActor } from "../audience-view";
import { DEMO_ACTORS } from "../actor";
import { checkView } from "../authz";
import { query } from "../db";

/**
 * The move the Views page seeds for itself.
 *
 * Its job is to make a direct link work: a reviewer should not have to leave,
 * run the nine-step console, remember to return, and reconstruct what changed.
 * That only holds if the seeded record actually drives all three projections
 * differently — a seed that satisfied one audience would leave the other two
 * looking empty rather than restrained, which argues the opposite of the page's
 * point.
 */

describe("the seed produces a move all three audiences can be shown", () => {
  it("creates once and is idempotent afterwards", async () => {
    const first = await seedViewsMove();
    const second = await seedViewsMove();

    expect(first.moveId).toBe(second.moveId);
    // A second press is a normal answer, not a failure and not a reset.
    expect(second.created).toBe(false);
    expect((await seededMove())?.moveId).toBe(first.moveId);
  }, 60_000);

  it("names every actor it seeds tuples for", () => {
    /*
      A subject with a tuple but no entry in `DEMO_ACTORS` is authorized by the
      graph and then rejected at the door with a 401, which reads as a broken
      page rather than as the deliberate refusal it is not.
    */
    for (const actor of Object.values(VIEWS_ACTORS)) {
      expect(DEMO_ACTORS[actor.subject], `${actor.subject} is not a known actor`).toBeDefined();
    }
  });

  it("grants the three related actors and nobody else", async () => {
    const { moveId } = await seedViewsMove();
    const object = `move:${moveId}`;

    for (const key of ["concierge", "customer", "partner"] as const) {
      const decision = await checkView(VIEWS_ACTORS[key].subject, object);
      expect(decision.allowed, `${key} was denied`).toBe(true);
    }

    /*
      The console's concierge identity too. The page has always sent
      `user:concierge-7`, and a tenant that granted only Jordan Lee returned
      three empty panels behind a 403 — correct authorization, useless page.
    */
    expect((await checkView("user:concierge-7", object)).allowed).toBe(true);

    // The forbidden view depends on this being a real absence, not a branch.
    const unrelated = await checkView(VIEWS_ACTORS.unrelated.subject, object);
    expect(unrelated.allowed, "the unrelated partner was granted access").toBe(false);
  }, 60_000);
});

describe("each audience receives a genuinely different projection", () => {
  it("gives the concierge the operational context", async () => {
    const { moveId } = await seedViewsMove();
    const view = await viewForActor(moveId, DEMO_ACTORS[VIEWS_ACTORS.concierge.subject]!, "test");
    expect(view.exists).toBe(true);
    if (!view.exists) return;

    // A resolved conflict, chosen by a named human — the schema insists on it.
    const verified = view.verified as Array<{ field: string; by: string | null }>;
    const date = verified.find((v) => v.field === "move.date");
    expect(date?.by).toBe("human:jordan-lee");

    // The recovered provider order, which only the concierge may see.
    const services = view.services as Array<{
      service_type: string;
      provider_order_id: string | null;
      submission_state: string;
    }>;
    const electric = services.find((s) => s.service_type === "electric")!;
    expect(electric.submission_state).toBe("reconciled");
    expect(electric.provider_order_id).toMatch(/^RLNT-\d+$/);
  }, 60_000);

  it("gives the customer plain language and no machinery", async () => {
    const { moveId } = await seedViewsMove();
    const view = await viewForActor(moveId, DEMO_ACTORS[VIEWS_ACTORS.customer.subject]!, "test");
    expect(view.exists).toBe(true);
    if (!view.exists) return;

    const blob = JSON.stringify(view);
    /*
      The asymmetry the whole project is about. The same submission the
      concierge reads as `reconciled` with an order id reaches Maya as
      "Scheduled", because `customerStatus` maps it on the server.
    */
    const services = view.services as Array<{ service: string; status: string }>;
    expect(services.find((s) => s.service === "electric")?.status).toBe("Scheduled");

    expect(blob).not.toContain("RLNT-");
    expect(blob).not.toContain("reconciled");
    expect(blob).not.toContain("unknown");
    expect(blob).not.toContain("human:jordan-lee");
  }, 60_000);

  it("gives the partner its attribution and nothing internal", async () => {
    const { moveId } = await seedViewsMove();
    const view = await viewForActor(moveId, DEMO_ACTORS[VIEWS_ACTORS.partner.subject]!, "test");
    expect(view.exists).toBe(true);
    if (!view.exists) return;

    // Attribution is earned by `partner_id` on the field versions it supplied.
    expect(view.attributed).toBe(true);
    expect(view.reference).toBe("MR-2026-0001");

    const blob = JSON.stringify(view);
    expect(blob).not.toContain("RLNT-");
    expect(blob).not.toContain("maya.patel@example.com");
    expect(blob).not.toContain("human:jordan-lee");
  }, 60_000);
});

describe("isolation from the console tenant", () => {
  /*
    The reason this module exists rather than a call to the demo orchestrator.
    `demo.reset()` runs `DELETE FROM organizations WHERE slug = 'uc-demo'`, so a
    load button wired to it would destroy the state of whoever had the console
    open in another tab.
  */
  it("never touches uc-demo", async () => {
    const before = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug = 'uc-demo'`,
    );

    await seedViewsMove();

    const after = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug = 'uc-demo'`,
    );
    expect(Number(after[0]!.n)).toBe(Number(before[0]!.n));
  }, 60_000);

  it("puts everything it creates in its own organisation", async () => {
    const { moveId, organizationId } = await seedViewsMove();

    const org = await query<{ slug: string }>(`SELECT slug FROM organizations WHERE id = $1`, [
      organizationId,
    ]);
    expect(org[0]?.slug).toBe(VIEWS_ORG_SLUG);

    const stray = await query<{ n: string }>(
      `SELECT count(*) AS n FROM field_versions WHERE move_id = $1 AND organization_id <> $2`,
      [moveId, organizationId],
    );
    expect(Number(stray[0]!.n)).toBe(0);
  }, 60_000);
});

describe("the refusal discloses nothing about what it withheld", () => {
  /*
    A denial is a disclosure surface. It is tempting to make it helpful — name
    the fields that would have been returned, hint at what the record holds —
    and each of those turns a refusal into a partial answer. The only safe
    contents are the caller's own input and facts about the refusal itself.
  */
  it("returns a 403 carrying no field name and no value", async () => {
    const { seedViewsMove } = await import("../views-seed");
    const { requireView, isDenial } = await import("../actor");
    const { moveId } = await seedViewsMove();

    const req = new Request("http://x", { headers: { "x-actor": "user:rival-agent" } });
    const gate = await requireView(req, `move:${moveId}`);

    expect(isDenial(gate)).toBe(true);
    if (!isDenial(gate)) return;
    expect(gate.response.status).toBe(403);

    const body = (await gate.response.json()) as Record<string, unknown>;
    const blob = JSON.stringify(body);

    // The server states these, so the page never has to infer them.
    expect(body.projectionGenerated).toBe(false);
    expect(body.returnedFields).toBe(0);
    expect(body.relationship).toBeNull();

    // Nothing about the record. Not a path, not a value, not a count of either.
    for (const path of ["move.date", "customer.phone", "customer.email", "move.to_address"]) {
      expect(blob, `denial leaked the field path ${path}`).not.toContain(path);
    }
    for (const value of ["2026-08-16", "469-555", "maya.patel@example.com", "RLNT-", "jordan-lee"]) {
      expect(blob, `denial leaked the value ${value}`).not.toContain(value);
    }
    // And no projection body smuggled in beside the error.
    expect(body.verified).toBeUndefined();
    expect(body.details).toBeUndefined();
    expect(body.services).toBeUndefined();
  }, 60_000);

  it("refuses identically whether or not the move exists", async () => {
    /*
      A 403 that differed from a 404 would let an unrelated actor probe which
      move ids are real — the classic enumeration leak, where the refusal
      itself is the oracle.
    */
    const { requireView, isDenial } = await import("../actor");
    const real = await (await import("../views-seed")).seedViewsMove();

    const ask = async (object: string) => {
      const gate = await requireView(
        new Request("http://x", { headers: { "x-actor": "user:rival-agent" } }),
        object,
      );
      if (!isDenial(gate)) throw new Error("expected a denial");
      return { status: gate.response.status, body: await gate.response.json() };
    };

    const existing = await ask(`move:${real.moveId}`);
    const fictional = await ask("move:11111111-1111-4111-8111-111111111111");

    expect(existing.status).toBe(fictional.status);
    expect(existing.body.detail).toBe(fictional.body.detail);
    expect(existing.body.relationship).toBe(fictional.body.relationship);
  }, 60_000);
});
