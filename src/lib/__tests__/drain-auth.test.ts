import { describe, it, expect, afterEach } from "vitest";

import { POST as drain, GET as probe } from "@/app/api/v1/ops/drain/route";

/**
 * Who is allowed to make the deployment do work.
 *
 * `POST /api/v1/ops/drain` exists so a scheduler can close the one gap the
 * inline dispatcher cannot: a process that commits and then dies before
 * draining leaves its events waiting for the next write. On a deployed free
 * tier that endpoint is a public URL, and an unauthenticated write on a public
 * URL is one somebody eventually finds. Draining is idempotent, so the risk is
 * not corruption — it is that anyone can make a metered database do work on
 * demand, indefinitely.
 *
 * The rule has two halves and both need holding:
 *
 * **Enforced when configured.** With `CRON_SECRET` set, a request without the
 * matching bearer token gets 401 and does not drain.
 *
 * **Absent when not.** With no secret set, the route works. That is not
 * laziness — the test suite and `npm run dev` call this with no configuration,
 * and a route that 401s on a developer's machine gets commented out rather than
 * understood. The response says which mode it is in, so the deployment question
 * "did my variable actually apply" is answered by a curl rather than assumed.
 *
 * The handlers are called directly rather than over HTTP, for the same reason
 * `agent-routes.test.ts` does: a real server would have its own process and its
 * own embedded database, and would not see this suite's fixture at all.
 */

const post = (headers?: Record<string, string>) =>
  drain(new Request("http://test.local/api/v1/ops/drain", { method: "POST", headers }));

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("the drain endpoint refuses work it cannot attribute", () => {
  it("drains for anyone when no secret is configured", async () => {
    const res = await post();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; protected: boolean };
    expect(body.ok).toBe(true);
    // Reported rather than implied. Reading `false` here on a deployment is how
    // you discover the variable never applied.
    expect(body.protected).toBe(false);
  });

  it("rejects a request with no token once a secret is configured", async () => {
    process.env.CRON_SECRET = "s3cr3t";

    const res = await post();
    expect(res.status).toBe(401);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(false);
  });

  it("rejects a wrong token, and a bare token without the scheme", async () => {
    process.env.CRON_SECRET = "s3cr3t";

    expect((await post({ authorization: "Bearer wrong" })).status).toBe(401);
    // `s3cr3t` alone is what someone writes when they forget the scheme. It
    // must not work, or the header format is decorative.
    expect((await post({ authorization: "s3cr3t" })).status).toBe(401);
  });

  it("accepts the matching bearer token", async () => {
    process.env.CRON_SECRET = "s3cr3t";

    const res = await post({ authorization: "Bearer s3cr3t" });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; protected: boolean };
    expect(body.ok).toBe(true);
    expect(body.protected).toBe(true);
  });

  it("leaves GET open, because it is a probe and changes nothing", async () => {
    /*
      Deliberate, and the asymmetry is the point. A scheduler or an operator
      should be able to ask "is anything stuck" without a credential and without
      causing a side effect. It is also why the Vercel cron was removed: Vercel
      issues GET, GET does not drain, and a schedule pointed at it would have
      returned 200 for ever while the backlog grew.
    */
    process.env.CRON_SECRET = "s3cr3t";

    const res = await probe();
    expect(res.status).toBe(200);

    const body = (await res.json()) as { ok: boolean; backlog: number };
    expect(body.ok).toBe(true);
    expect(typeof body.backlog).toBe("number");
  });
});
