import { describe, it, expect, beforeAll } from "vitest";
import { query } from "../db";
import { reset } from "../demo-orchestrator";
import { ingestReferral } from "../intake";
import { viewForActor } from "../audience-view";
import { writeTuple } from "../authz";
import { withheld } from "../projection-diff";
import type { Actor } from "../actor";

/**
 * Audience projections, for any move.
 *
 * `/api/v1/views` resolved the scripted move by reference, so the screen that
 * demonstrates least-privilege could only demonstrate it on the one fixture —
 * and a move created through the console had no way to be read through any
 * audience at all. The projections themselves were always move-scoped; the
 * route above them was not.
 *
 * The assertion that carries weight here is the negative one. A field the
 * partner must not see has to be *absent from the payload*, not merely unused
 * by the component that renders it, because a field present in a response has
 * already left the server.
 */

let org: string;
let seq = 0;

const actor = (subject: string, audience: Actor["audience"]): Actor => ({
  subject,
  audience,
  label: subject,
});

const referral = (over: Record<string, unknown> = {}) => {
  seq += 1;
  return {
    customer: {
      first_name: `Tess${seq}`,
      last_name: "Adeyemi",
      email: `tess.adeyemi.${seq}@example.com`,
      phone: `469-555-${String(3000 + seq).slice(-4)}`,
    },
    move: { date: "2026-11-11", to_address: `${200 + seq} Windmill Rd, Allen, TX 75013` },
    services: ["electric"],
    referral: { partner_slug: "ntr" },
    ...over,
  };
};

async function land(payload: Record<string, unknown>) {
  const r = await ingestReferral({
    organizationId: org,
    channel: "partner_api",
    payload,
    idempotencyKey: `view:${crypto.randomUUID()}`,
  });
  expect(r.status).toBe("created");
  return r.moveId!;
}

beforeAll(async () => {
  await reset();
  org = (await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`))[0]!.id;
});

describe("a move nobody scripted can be read through all three audiences", () => {
  it("returns a projection for each one", async () => {
    const moveId = await land(referral());

    for (const [subject, audience] of [
      ["user:concierge-7", "concierge"],
      ["user:maya-patel", "customer"],
      ["user:ntr-agent", "partner"],
    ] as const) {
      const view = await viewForActor(moveId, actor(subject, audience), "test");
      expect(view.exists, `${audience} got nothing`).toBe(true);
    }
  });

  it("reports a move that does not exist rather than throwing", async () => {
    const view = await viewForActor(
      "00000000-0000-4000-8000-000000000000",
      actor("user:concierge-7", "concierge"),
      "test",
    );
    expect(view.exists).toBe(false);
  });
});

describe("the audience comes from the actor, never from the request", () => {
  it("gives the same subject a different payload purely by audience", async () => {
    const moveId = await land(referral());

    const asConcierge = await viewForActor(moveId, actor("user:x", "concierge"), "test");
    const asCustomer = await viewForActor(moveId, actor("user:x", "customer"), "test");

    // Same subject string, different audience, materially different payload —
    // which is the whole point of deriving the projection from who you are.
    expect(JSON.stringify(asConcierge)).not.toBe(JSON.stringify(asCustomer));
  });

  it("withholds fields from the customer, by absence and not by omission in the UI", async () => {
    const moveId = await land(referral());
    const asConcierge = (await viewForActor(moveId, actor("user:c", "concierge"), "test")) as Record<
      string,
      unknown
    >;
    const asCustomer = (await viewForActor(moveId, actor("user:c", "customer"), "test")) as Record<
      string,
      unknown
    >;

    const missing = withheld(asConcierge, asCustomer);
    expect(missing.length, "the customer payload is identical to the operator's").toBeGreaterThan(0);
  });
});

describe("a partner is resolved from their own membership", () => {
  it("does not hand a second partner the first partner's projection", async () => {
    /*
      The route this replaces looked up the partner slug `'ntr'` unconditionally,
      whatever the actor's membership. A second partner would have been shown the
      first partner's projection — the exact cross-tenant leak the projection
      exists to prevent, occurring in the code that chooses which projection to
      run rather than in the projection itself.
    */
    const moveId = await land(referral());

    await query(
      `INSERT INTO partners (organization_id, name, slug, domain, theme_color)
       VALUES ($1,'Lone Star Realty','lsr','move.lonestar.example','#8A2B2B')
       ON CONFLICT DO NOTHING`,
      [org],
    );
    // A second brokerage with a real path to this organization's records.
    await writeTuple("user:lsr-agent", "member", "org:lsr");
    await writeTuple("org:lsr", "parent", "org:uc-demo");

    const asNtr = (await viewForActor(moveId, actor("user:ntr-agent", "partner"), "test")) as Record<
      string,
      unknown
    >;
    const asLsr = (await viewForActor(moveId, actor("user:lsr-agent", "partner"), "test")) as Record<
      string,
      unknown
    >;

    expect(asNtr.exists).toBe(true);
    expect(asLsr.exists).toBe(true);

    /*
      Compared with the authorization block removed.

      Comparing whole payloads looks stronger and is weaker: `authorization`
      carries the actor's own subject, so two responses differ by that alone
      even when the projection beneath them is byte-identical. Checked against a
      deliberately reintroduced hardcoded partner slug, the whole-payload
      version passed — it could not have caught the leak it was written for.
    */
    const projection = (v: Record<string, unknown>) => {
      const { authorization: _auth, ...rest } = v;
      return JSON.stringify(rest);
    };
    expect(projection(asNtr)).not.toBe(projection(asLsr));

    /*
      And named directly, not inferred from two blobs differing.

      The referring brokerage sees their engagement; the other brokerage is told
      there is none. Asserting `attributed` says what is meant — the comparison
      above would also pass if both were denied for unrelated reasons.
    */
    expect(asNtr.attributed, "the referring partner cannot see their own referral").toBe(true);
    expect(asLsr.attributed, "an unrelated partner can see this referral").toBe(false);
  });

  it("shows nothing to a partner actor who belongs to no partner", async () => {
    const moveId = await land(referral());
    const view = await viewForActor(moveId, actor("user:unaffiliated", "partner"), "test");
    // Not an empty projection rendered as though it were a legitimate view.
    expect(view.exists).toBe(false);
  });
});

describe("the granting path travels with the answer", () => {
  it("says which relationship allowed the read", async () => {
    // An authorization decision the system cannot explain is one nobody can
    // review. The engineering panel renders this directly.
    const moveId = await land(referral());
    const view = await viewForActor(moveId, actor("user:concierge-7", "concierge"), "org membership");
    expect(view.exists).toBe(true);
    if (view.exists) {
      expect(view.authorization.actor).toBe("user:concierge-7");
      expect(view.authorization.audience).toBe("concierge");
      expect(view.authorization.via).toBe("org membership");
    }
  });
});
