import { describe, it, expect, beforeAll } from "vitest";

import { query } from "../db";
import { submitToProvider, operationKey } from "../provider-submission";
import { callProvider, lookupOrder, __simulator, ProviderTimeoutError } from "../provider-simulator";
import { runCaseAgent, decideAgentProposal, getAgentRun } from "../agent/case-agent";
import { invokeTool, advertisedTools, TOOLS } from "../agent/tools";

/**
 * The concierge case agent, against a real database.
 *
 * The claim under test is not "an agent exists". It is the specific, checkable
 * one: **the agent reached for the action that would have created a duplicate
 * household enrolment, and the system stopped it** — and there is a row saying
 * so, rather than a prompt that asked it nicely.
 *
 * Everything else here supports that. The refusal has to survive a hostile
 * caller, an invented tool name, and a second approval; and the approved path
 * has to run the same `reconcile()` the concierge's own button calls, not a
 * private one built for the agent.
 */

const CORRELATION = "22222222-2222-4222-8222-222222222222";
const REQUEST_KEY = "agent-test-electric";

let org: string;
let move: string;
let submissionId: string;

beforeAll(async () => {
  __simulator.reset();

  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ($1,$2) RETURNING id`,
      ["Agent test org", `agent-${Date.now()}`],
    )
  )[0]!.id;

  move = (
    await query<{ id: string }>(
      `INSERT INTO moves (organization_id, reference, state)
       VALUES ($1,$2,'in_service') RETURNING id`,
      [org, `MR-AGENT-${Date.now()}`],
    )
  )[0]!.id;

  const serviceRequest = (
    await query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1,$2,'electric','Reliant') RETURNING id`,
      [org, move],
    )
  )[0]!.id;

  /*
    Put the case into the state the whole product is about: the provider was
    asked, the response was lost, and nobody knows whether an order exists.
    Driven through the real submission path with the simulator timing out, so
    the row the agent reads is one the system actually produced.
  */
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
      /*
        `timeout_after_create` is the scenario the whole product exists for: the
        provider really does create the order, and the response never comes
        back. Anything else here would give the agent a case where resubmitting
        was harmless, and the refusal would prove nothing.
      */
      callProvider(payload, {
        scenario: "timeout_after_create",
        requestKey: REQUEST_KEY,
        serviceType: "electric",
        now: "2026-07-26T20:00:00.000Z",
      }),
  ).catch((error) => {
    // submitToProvider records UNKNOWN and rethrows; the persisted state is
    // what this fixture is after.
    if (!(error instanceof ProviderTimeoutError)) throw error;
  });

  submissionId = (
    await query<{ id: string }>(
      `SELECT id FROM provider_submissions WHERE operation_key = $1`,
      [operationKey(serviceRequest)],
    )
  )[0]!.id;

  const state = (
    await query<{ state: string }>(`SELECT state FROM provider_submissions WHERE id = $1`, [
      submissionId,
    ])
  )[0]!.state;
  expect(state, "the fixture must actually be in the unknown state").toBe("unknown");
});

describe("the tool registry is the control, not the prompt", () => {
  it("never advertises a forbidden tool to a model", () => {
    // A model cannot be tempted by a tool it was never shown. This is the
    // first layer; the refusal in invokeTool is the layer that matters when
    // something goes wrong anyway.
    const advertised = advertisedTools().map((t) => t.name);
    expect(advertised).not.toContain("submit_provider_enrollment");
    expect(advertised).not.toContain("merge_canonical_record");
    expect(advertised).not.toContain("delete_audit_history");
  });

  it("refuses every forbidden tool with a stated reason", async () => {
    const forbidden = TOOLS.filter((t) => t.authority === "forbidden");
    expect(forbidden.length).toBeGreaterThan(0);

    for (const tool of forbidden) {
      const call = await invokeTool(tool.name, {}, { organizationId: org, moveId: move });
      expect(call.outcome, `${tool.name} must be refused`).toBe("refused");
      expect(call.observation).toBeNull();
      // A refusal with no reason is indistinguishable from a crash.
      expect(call.note?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("refuses a tool name it has never heard of instead of ignoring it", async () => {
    /*
      The hallucination case. A model that invents `force_submit` must produce
      a recorded refusal — a silent no-op would look identical to the step
      never having been attempted, which is the one thing the audit must never
      be ambiguous about.
    */
    const call = await invokeTool("force_submit", {}, { organizationId: org, moveId: move });
    expect(call.outcome).toBe("refused");
    expect(call.note).toContain("force_submit");
  });

  it("will not execute an approval-gated tool even when asked directly", async () => {
    // invokeTool is the agent's hand. Approved actions run on the resume path
    // under the approving human's identity, and there is deliberately no
    // argument here that reaches them.
    const call = await invokeTool(
      "request_provider_reconciliation",
      { submissionId, reason: "timeout_unknown_outcome" },
      { organizationId: org, moveId: move },
    );
    expect(call.outcome).toBe("refused");
    expect(call.authority).toBe("requires_approval");
  });
});

describe("a case with an unknown provider outcome", () => {
  let runId: string;

  it("can actually read the provider state it depends on", async () => {
    /*
      Regression. The provider query originally ordered by a column that does
      not exist, so the tool errored, the agent read the error as "no rows",
      and it reported "nothing requires action" on a case with an unresolved
      unknown outcome — the most dangerous sentence it could say, delivered
      with complete confidence. This asserts the read itself works before any
      test relies on what the agent concluded from it.
    */
    const call = await invokeTool(
      "get_provider_operation",
      {},
      { organizationId: org, moveId: move },
    );
    expect(call.outcome, call.note ?? "").toBe("ok");
    expect(Array.isArray(call.observation)).toBe(true);
    expect((call.observation as unknown[]).length).toBeGreaterThan(0);
  });

  it("inspects the case, refuses to resubmit, and proposes reconciliation", async () => {
    const run = await runCaseAgent({ organizationId: org, moveId: move });
    runId = run.id;

    expect(run.state).toBe("awaiting_approval");
    expect(run.proposal?.tool).toBe("request_provider_reconciliation");
    expect(run.proposal?.args.submissionId).toBe(submissionId);
    expect(run.refusal?.tool).toBe("submit_provider_enrollment");
    expect(run.refusal?.reason).toMatch(/duplicate|unknown/i);
  });

  it("wrote the refusal to the database, where it can be queried", async () => {
    /*
      The load-bearing assertion of this file. "The agent was stopped from
      creating a duplicate order" has to be a row a reviewer can select, not a
      claim in a slide — so this reads it back out of `agent_steps` rather than
      trusting the return value it just checked.
    */
    const refused = await query<{ tool: string; authority: string; outcome: string; note: string }>(
      `SELECT tool, authority, outcome, note FROM agent_steps
        WHERE run_id = $1 AND outcome = 'refused'`,
      [runId],
    );

    expect(refused).toHaveLength(1);
    expect(refused[0]!.tool).toBe("submit_provider_enrollment");
    expect(refused[0]!.authority).toBe("forbidden");
    expect(refused[0]!.note).toBeTruthy();
  });

  it("read the state it was reasoning about, in order", async () => {
    const run = await getAgentRun(runId);
    const tools = run!.steps.map((s) => s.tool);

    // It must look before it concludes. A proposal formed without reading the
    // provider state would be a hardcoded answer wearing an agent's clothes.
    expect(tools[0]).toBe("get_move_record");
    expect(tools[1]).toBe("get_provider_operation");
    expect(tools).toContain("get_audit_history");
    expect(tools.indexOf("get_provider_operation")).toBeLessThan(
      tools.indexOf("submit_provider_enrollment"),
    );
  });

  it("survives being read back — the reasoning is stored, not recomputed", async () => {
    /*
      The inspector renders a run it did not start, and so will anyone opening
      this case next week. If the reason a refusal happened were rebuilt from
      today's code rather than stored, a run would quietly start saying
      something it never said — the exact failure this project spends its whole
      argument preventing in the data layer.
    */
    const reread = await getAgentRun(runId);
    expect(reread!.summary).toMatch(/reconciliation is proposed/i);
    expect(reread!.proposal?.why).toMatch(/never creates an order/i);
    expect(reread!.refusal?.reason).toMatch(/second household enrolment/i);
    expect(reread!.proposal?.args.submissionId).toBe(submissionId);
  });

  it("changed no domain state while proposing", async () => {
    // The whole run happened. The submission must be exactly where it was.
    const state = (
      await query<{ state: string }>(`SELECT state FROM provider_submissions WHERE id = $1`, [
        submissionId,
      ])
    )[0]!.state;
    expect(state).toBe("unknown");
  });

  it("executes the real reconciliation only once a named human approves", async () => {
    const decision = await decideAgentProposal({
      runId,
      actor: "concierge:dana",
      decision: "approved",
      correlationId: CORRELATION,
      lookupOrder: () => lookupOrder(REQUEST_KEY),
    });

    expect(decision.state).toBe("completed");
    // The order existed all along. We were never uncertain about the world,
    // only about our knowledge of it.
    expect(decision.outcome).toBe("found_existing");
    expect(decision.providerOrderId).toBeTruthy();

    const state = (
      await query<{ state: string; provider_order_id: string | null }>(
        `SELECT state, provider_order_id FROM provider_submissions WHERE id = $1`,
        [submissionId],
      )
    )[0]!;
    expect(state.state).toBe("reconciled");
    expect(state.provider_order_id).toBe(decision.providerOrderId);
  });

  it("records who approved it", async () => {
    const row = (
      await query<{ human_actor: string; human_decision: string; state: string }>(
        `SELECT human_actor, human_decision, state FROM agent_runs WHERE id = $1`,
        [runId],
      )
    )[0]!;
    expect(row.human_actor).toBe("concierge:dana");
    expect(row.human_decision).toBe("approved");
    expect(row.state).toBe("completed");
  });

  it("refuses a second approval rather than reconciling twice", async () => {
    /*
      Double-click safety, and the same lesson the provider path already
      learned: the guard is a conditional UPDATE inside a transaction, not a
      flag read before the write. A run that has left `awaiting_approval`
      cannot be approved again by anyone.
    */
    await expect(
      decideAgentProposal({
        runId,
        actor: "concierge:dana",
        decision: "approved",
        correlationId: CORRELATION,
        lookupOrder: () => lookupOrder(REQUEST_KEY),
      }),
    ).rejects.toThrow(/not awaiting approval|already decided/i);
  });
});

describe("a case with nothing unknown", () => {
  it("proposes nothing and says so, rather than inventing work", async () => {
    /*
      An agent that always finds something to recommend is an agent whose
      recommendations mean nothing. The best decision is sometimes not to act.
    */
    const quietMove = (
      await query<{ id: string }>(
        `INSERT INTO moves (organization_id, reference, state)
         VALUES ($1,$2,'intake') RETURNING id`,
        [org, `MR-QUIET-${Date.now()}`],
      )
    )[0]!.id;

    const run = await runCaseAgent({ organizationId: org, moveId: quietMove });

    expect(run.state).toBe("completed");
    expect(run.proposal).toBeNull();
    expect(run.summary).toMatch(/nothing requires action/i);
  });
});
