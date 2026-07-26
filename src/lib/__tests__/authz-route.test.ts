import { describe, it, expect, beforeAll } from "vitest";
import { reset, ingest, createMove, demoConstants } from "../demo-orchestrator";
import { query } from "../db";
import { isDenial, requireView, actorFrom, DEMO_ACTORS } from "../actor";

/**
 * Authorization on the request path.
 *
 * An audit found that `checkView` — correct, graph-walking, well tested —
 * authorized nothing at all. No route called it, and `/api/v1/views` chose what
 * to return from an `?audience=` query parameter the caller wrote themselves.
 * A partner projection that carefully withholds the provider account number is
 * worth very little when anyone can ask for the concierge projection instead.
 *
 * These tests cover the gate rather than the graph: that an unknown actor is
 * refused, that a known actor with no relationship to the resource is refused,
 * and that the ones who should get through do — with the granting path
 * attached, because a decision the system cannot explain is a decision nobody
 * can review.
 */

let moveObject: string;

beforeAll(async () => {
  await reset();
  await ingest();
  await createMove();
  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0]!;
  const move = (
    await query<{ id: string }>(
      `SELECT id FROM moves WHERE organization_id = $1 AND reference = $2`,
      [org.id, demoConstants.MOVE_REF],
    )
  )[0]!;
  moveObject = `move:${move.id}`;
});

const req = (actor?: string) =>
  new Request("http://localhost/api/v1/views", {
    headers: actor ? { "x-actor": actor } : {},
  });

describe("the gate refuses before any projection runs", () => {
  it("401s a request with no actor rather than defaulting to one", async () => {
    // The dangerous version of this is a default that happens to be the
    // concierge. An absent actor must be absent, not privileged.
    const gate = await requireView(req(), moveObject);
    expect(isDenial(gate)).toBe(true);
    if (isDenial(gate)) expect(gate.response.status).toBe(401);
  });

  it("401s an actor it does not recognise", async () => {
    expect(actorFrom(req("user:made-up"))).toBeNull();
    const gate = await requireView(req("user:made-up"), moveObject);
    expect(isDenial(gate)).toBe(true);
    if (isDenial(gate)) expect(gate.response.status).toBe(401);
  });

  it("403s a known actor with no relationship to this move", async () => {
    // The rival agent is a real, recognised identity. It simply owns no path
    // to this resource — deny by construction rather than by filter.
    const gate = await requireView(req("user:rival-agent"), moveObject);
    expect(isDenial(gate)).toBe(true);
    if (isDenial(gate)) {
      expect(gate.response.status).toBe(403);
      const body = (await gate.response.json()) as { error: string };
      expect(body.error).toBe("forbidden");
    }
  });
});

describe("the gate admits the actors who hold a relationship", () => {
  // Written out rather than with it.each, because the fitness guard that keeps
  // stated test counts honest counts `it(` blocks — and a parameterised block
  // reports as one while running as three. A guard that miscounts is worse than
  // no guard.
  const admits = async (subject: string, audience: string) => {
    const gate = await requireView(req(subject), moveObject);
    expect(isDenial(gate)).toBe(false);
    if (!isDenial(gate)) {
      expect(gate.actor.audience).toBe(audience);
      // Not merely allowed — allowed *because of* something nameable.
      expect(gate.via).toMatch(/viewer|member|admin/);
    }
  };

  it("admits the concierge as a member of the owning organization", () =>
    admits("user:concierge-7", "concierge"));

  it("admits the customer as a direct viewer of their own move", () =>
    admits("user:maya-patel", "customer"));

  it("admits the referring agent through their partner organization", () =>
    admits("user:ntr-agent", "partner"));

  it("derives the audience from identity, never from the request", async () => {
    // The whole point of the change: there is no input a caller can supply that
    // makes them a concierge. Every demo actor has exactly one audience.
    for (const actor of Object.values(DEMO_ACTORS)) {
      const gate = await requireView(req(actor.subject), moveObject);
      if (!isDenial(gate)) expect(gate.actor.audience).toBe(actor.audience);
    }
  });

  it("revokes access when the relationship tuple is deleted", async () => {
    const before = await requireView(req("user:ntr-agent"), moveObject);
    expect(isDenial(before)).toBe(false);

    await query(`DELETE FROM auth_tuples WHERE subject = 'user:ntr-agent' AND relation = 'member'`);
    const after = await requireView(req("user:ntr-agent"), moveObject);
    // Access is a relationship, so removing the relationship removes access —
    // no cache to bust, no session to expire.
    expect(isDenial(after)).toBe(true);

    await query(
      `INSERT INTO auth_tuples (subject, relation, object) VALUES ('user:ntr-agent','member','org:ntr')
       ON CONFLICT DO NOTHING`,
    );
  });
});
