import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";
import { submitToProvider, operationKey } from "../provider-submission";
import { callProvider, __simulator, ProviderTimeoutError } from "../provider-simulator";

import { POST as startRun, GET as toolCatalogue } from "@/app/api/v1/agent/runs/route";
import { GET as readRun, POST as decide } from "@/app/api/v1/agent/runs/[id]/route";

/**
 * The agent's HTTP surface, exercised as HTTP.
 *
 * The service layer is covered by `case-agent.test.ts`. This file covers the
 * things only a route can get wrong: which fields it trusts from the caller,
 * what it does without an actor, and whether the JSON the inspector renders is
 * actually the JSON the route returns.
 *
 * The route handlers are imported and called directly rather than through a
 * running server. That is not a shortcut around the network — it is the only
 * way to run them against the same embedded database the rest of the suite
 * uses. A server would have its own process and its own in-memory Postgres,
 * and the fixture below would be invisible to it.
 */

const CORRELATION = "44444444-4444-4444-8444-444444444444";
const REQUEST_KEY = "agent-route-electric";

let org: string;
let move: string;
let submissionId: string;

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://test.local/api/v1/agent/runs", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  __simulator.reset();

  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Agent route org", `agent-route-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-ROUTE-${Date.now()}`],
    )
  )[0]!.id;

  const serviceRequest = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant') RETURNING id`,
      [org, move],
    )
  )[0]!.id;

  await submitToProvider(
    {
      organizationId: org,
      moveId: move,
      serviceRequestId: serviceRequest,
      correlationId: CORRELATION,
      actor: "system",
      providerRequestKey: REQUEST_KEY,
      payload: { requestKey: REQUEST_KEY, service: "electric" },
    },
    async (payload) =>
      callProvider(payload, {
        scenario: "timeout_after_create",
        requestKey: REQUEST_KEY,
        serviceType: "electric",
        now: "2026-07-26T20:00:00.000Z",
      }),
  ).catch((error) => {
    if (!(error instanceof ProviderTimeoutError)) throw error;
  });

  submissionId = (
    await query<{ id: string }>(`SELECT id FROM provider_submissions WHERE operation_key = $1`, [
      operationKey(serviceRequest),
    ])
  )[0]!.id;
});

describe("POST /api/v1/agent/runs", () => {
  it("rejects a body without a move", async () => {
    const response = await startRun(json({}));
    expect(response.status).toBe(400);
  });

  it("will not run against a move that does not exist", async () => {
    const response = await startRun(json({ moveId: "00000000-0000-4000-8000-000000000000" }));
    expect(response.status).toBe(404);
  });

  it("ignores an organizationId supplied by the caller", async () => {
    /*
      The tenant is derived from the move, never accepted from the request. If
      the route trusted this field, anyone could run an agent against any move
      while claiming a tenant they have nothing to do with — and every audit row
      the run produced would carry the attacker's chosen organization.
    */
    const attacker = (
      await query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
        ["Someone else", `attacker-${Date.now()}`],
      )
    )[0]!.id;

    const response = await startRun(json({ moveId: move, organizationId: attacker }));
    expect(response.status).toBe(200);
    const run = await response.json();

    const stored = (
      await query<{ organization_id: string }>(
        `SELECT organization_id FROM agent_runs WHERE id = $1`,
        [run.id],
      )
    )[0]!;
    expect(stored.organization_id).toBe(org);
    expect(stored.organization_id).not.toBe(attacker);
  });

  it("returns the whole path, refusal included, in the shape the inspector renders", async () => {
    const response = await startRun(json({ moveId: move }));
    expect(response.status).toBe(200);
    const run = await response.json();

    // These field names are the contract with src/app/agent/page.tsx. A rename
    // here without a rename there is a blank panel, and nothing else would say so.
    expect(run).toMatchObject({
      state: "awaiting_approval",
      proposal: { tool: "request_provider_reconciliation" },
      refusal: { tool: "submit_provider_enrollment" },
    });
    expect(typeof run.summary).toBe("string");
    expect(run.summary.length).toBeGreaterThan(0);
    expect(typeof run.proposal.why).toBe("string");
    expect(run.proposal.why.length).toBeGreaterThan(0);

    const refusedStep = run.steps.find((s: { outcome: string }) => s.outcome === "refused");
    expect(refusedStep.authority).toBe("forbidden");
    expect(refusedStep.note.length).toBeGreaterThan(20);
  });
});

describe("GET /api/v1/agent/runs — the tool catalogue", () => {
  it("publishes the forbidden tools and their reasons", async () => {
    // Publishing what the agent may *not* do is the point: a reviewer can read
    // the boundary without reading the source.
    const body = await (await toolCatalogue()).json();
    const forbidden = body.tools.filter((t: { authority: string }) => t.authority === "forbidden");

    expect(forbidden.length).toBeGreaterThanOrEqual(5);
    for (const tool of forbidden) {
      expect(tool.refusal, `${tool.name} must publish why it is forbidden`).toBeTruthy();
    }
    expect(body.advertisedToModel.map((t: { name: string }) => t.name)).not.toContain(
      "submit_provider_enrollment",
    );
  });
});

describe("POST /api/v1/agent/runs/:id — the decision", () => {
  let runId: string;

  beforeAll(async () => {
    const run = await (await startRun(json({ moveId: move }))).json();
    runId = run.id;
  });

  it("refuses an unattributed approval", async () => {
    /*
      An approval with no actor is worse than no approval: the audit row would
      record that a human authorised a provider call without recording which
      human. The route requires the header rather than defaulting it.
    */
    const response = await decide(json({ decision: "approved" }), {
      params: Promise.resolve({ id: runId }),
    });
    expect(response.status).toBe(400);

    const state = (
      await query<{ state: string }>(`SELECT state FROM agent_runs WHERE id = $1`, [runId])
    )[0]!.state;
    expect(state, "a rejected request must not have moved the run").toBe("awaiting_approval");
  });

  it("rejects a decision it does not understand", async () => {
    const response = await decide(json({ decision: "maybe" }, { "X-Actor": "concierge:dana" }), {
      params: Promise.resolve({ id: runId }),
    });
    expect(response.status).toBe(400);
  });

  it("runs the real reconciliation on approval and reports the recovered order", async () => {
    const response = await decide(
      json({ decision: "approved" }, { "X-Actor": "concierge:dana" }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.state).toBe("completed");
    expect(body.outcome).toBe("found_existing");

    const submission = (
      await query<{ state: string }>(`SELECT state FROM provider_submissions WHERE id = $1`, [
        submissionId,
      ])
    )[0]!;
    expect(submission.state).toBe("reconciled");
  });

  it("answers 409 to a second approval instead of reconciling twice", async () => {
    const response = await decide(
      json({ decision: "approved" }, { "X-Actor": "concierge:dana" }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(response.status).toBe(409);
  });

  it("serves the finished run back for the inspector to re-render", async () => {
    const response = await readRun(new Request("http://test.local/"), {
      params: Promise.resolve({ id: runId }),
    });
    expect(response.status).toBe(200);

    const run = await response.json();
    expect(run.state).toBe("completed");
    // The stored reasoning survives the round trip — the inspector shows what
    // the run said when it ran, not what today's code would say.
    expect(run.refusal.reason).toBeTruthy();
    expect(run.proposal.why).toBeTruthy();
  });

  it("refuses to reconcile a submission whose provider key was never recorded", async () => {
    /*
      The bug this exists to prevent, stated as a test.

      If a submission has no `provider_request_key`, there is no way to ask the
      provider about it. Returning "no order found" in that situation would be a
      lie with the worst possible consequence: `not_found` is exactly the
      outcome that marks resubmission as safe, so a missing key would present a
      duplicate household enrolment as the correct next step.

      "We never recorded how to ask" and "we asked and there is nothing there"
      must stay distinguishable. The run fails and a human is told.
    */
    const orphan = (
      await query<{ id: string }>(
        `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
         VALUES ($1,$2,'internet','Spectrum') RETURNING id`,
        [org, move],
      )
    )[0]!.id;

    await query(
      `INSERT INTO provider_submissions
         (organization_id, service_request_id, operation_key, request_fingerprint,
          state, request_payload, provider_request_key)
       VALUES ($1,$2,$3,'fp','unknown','{}', NULL)`,
      [org, orphan, `op-orphan-${Date.now()}`],
    );

    const run = await (await startRun(json({ moveId: move }))).json();
    expect(run.state).toBe("awaiting_approval");

    const response = await decide(
      json({ decision: "approved" }, { "X-Actor": "concierge:dana" }),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toMatch(/no recorded provider request key/i);

    // And crucially: the submission is untouched. It must not have been
    // reported as reconciled, and it must not be sitting in a state that
    // makes resubmission look safe.
    const state = (
      await query<{ state: string }>(
        `SELECT state FROM provider_submissions WHERE service_request_id = $1`,
        [orphan],
      )
    )[0]!.state;
    expect(state).toBe("unknown");
  });

  it("says the run is gone when its move was deleted underneath it", async () => {
    /*
      Found by resetting the demo with the inspector open.

      `agent_runs` cascade-deletes with its move, so a reset destroys any run
      the browser is still holding. The page went on offering an Approve button
      for it and then displayed the raw string "No agent run <uuid>" — an
      internal identifier presented to a reviewer as an explanation.

      The route's job is to be unambiguous about which failure this is, so the
      client can tell "already decided" (the work happened, the page is stale)
      apart from "no longer exists" (the case was reset). They need different
      sentences and only one of them should clear the run.
    */
    const doomedMove = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1,$2,'in_service') RETURNING id`,
        [org, `MR-DOOMED-${Date.now()}`],
      )
    )[0]!.id;

    const run = await (await startRun(json({ moveId: doomedMove }))).json();
    await query(`DELETE FROM moves WHERE id = $1`, [doomedMove]);

    // The cascade must actually have taken the run with it.
    const remaining = await query(`SELECT id FROM agent_runs WHERE id = $1`, [run.id]);
    expect(remaining).toHaveLength(0);

    const response = await decide(
      json({ decision: "approved" }, { "X-Actor": "concierge:dana" }),
      { params: Promise.resolve({ id: run.id }) },
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/no agent run/i);
  });

  it("404s for a run that does not exist", async () => {
    const response = await readRun(new Request("http://test.local/"), {
      params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000000" }),
    });
    expect(response.status).toBe(404);
  });
});

describe("the streamed run is the persisted run, event for event", () => {
  /*
    `?stream=1` promises two things worth holding: every step event is written
    AFTER its row exists, and the final `run` event equals what a later GET
    reads back. A stream that got ahead of the database — or a final event
    assembled differently from the read path — would be the page showing an
    investigation the server cannot corroborate.
  */
  it("emits one step event per persisted step, then the complete run", async () => {
    const response = await startRun(
      new Request("http://test.local/api/v1/agent/runs?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId: move }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/x-ndjson");

    const text = await response.text();
    const events = text
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as { type: string; step?: { seq: number; tool: string }; run?: { id: string; steps: unknown[]; state: string } });

    const steps = events.filter((e) => e.type === "step");
    const finals = events.filter((e) => e.type === "run");

    // Exactly one closing event, and it arrives last.
    expect(finals).toHaveLength(1);
    expect(events[events.length - 1]!.type).toBe("run");

    const finalRun = finals[0]!.run!;
    // Every streamed step is in the final run, in the same order.
    expect(steps.map((e) => e.step!.seq)).toEqual(
      finalRun.steps.map((s) => (s as { seq: number }).seq),
    );
    expect(steps.map((e) => e.step!.tool)).toEqual(
      finalRun.steps.map((s) => (s as { tool: string }).tool),
    );

    // And the final event matches the database's own read of the run.
    const readback = await readRun(new Request("http://test.local"), {
      params: Promise.resolve({ id: finalRun.id }),
    });
    const stored = (await readback.json()) as { state: string; steps: unknown[] };
    expect(stored.state).toBe(finalRun.state);
    expect(stored.steps.length).toBe(finalRun.steps.length);
  });

  it("keeps the plain POST byte-compatible for existing callers", async () => {
    const response = await startRun(json({ moveId: move }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    const run = (await response.json()) as { id: string; steps: unknown[] };
    expect(run.steps.length).toBeGreaterThan(0);
  });
});
