import { describe, it, expect, beforeAll } from "vitest";
import { query, withTransaction } from "../db";
import {
  defineWorkflow,
  startWorkflow,
  runWorkflow,
  signal,
  history,
  load,
} from "../workflow";
import { publish, dispatch, backlog } from "../outbox";
import { writeTuple, deleteTuple, checkView } from "../authz";

/**
 * The durability suite — proves the three hardest backend properties:
 *
 *   1. A workflow survives a crash and resumes without doubling side effects.
 *   2. The outbox delivers exactly once per consumer under redelivery.
 *   3. Authorization follows relationships, denies by default, and revokes by
 *      deleting one tuple.
 *   4. A stale write cannot silently overwrite a newer one.
 */

let org: string;

beforeAll(async () => {
  org = (
    await query<{ id: string }>(
      `INSERT INTO organizations (name, slug) VALUES ('Durability','dura') RETURNING id`,
    )
  )[0]!.id;
});

// ---------------------------------------------------------------------------

describe("durable workflow execution", () => {
  // Side-effect counters. If resume were broken, these would exceed 1.
  const effects: { reserve: number; submit: number; finalize: number } = {
    reserve: 0,
    submit: 0,
    finalize: 0,
  };
  let crashOnce = true;

  defineWorkflow({
    type: "test_fulfillment",
    steps: [
      {
        name: "reserve",
        run: async () => {
          effects.reserve++;
          return { context: { reserved: true } };
        },
      },
      {
        name: "submit",
        run: async () => {
          effects.submit++;
          if (crashOnce) {
            crashOnce = false;
            // The worker dies mid-workflow. Nothing in memory survives this.
            throw new Error("simulated worker crash");
          }
          return { output: { orderId: "ORD-77" } };
        },
      },
      {
        name: "await_approval",
        run: async () => ({ wait: "human_approval" }),
      },
      {
        name: "finalize",
        run: async (ctx) => {
          effects.finalize++;
          return { output: { approvedBy: (ctx["signal:human_approval"] as { actor?: string })?.actor } };
        },
      },
    ],
  });

  let executionId: string;
  const subject = "aaaaaaaa-0000-4000-8000-000000000001";

  it("persists the execution and fails cleanly when the worker crashes", async () => {
    executionId = await startWorkflow(org, "test_fulfillment", subject);
    const afterCrash = await runWorkflow(executionId);

    expect(afterCrash.state).toBe("failed");
    // Step 1 completed before the crash; its side effect ran exactly once.
    expect(effects.reserve).toBe(1);
    expect(effects.submit).toBe(1);
  });

  it("resumes after the crash WITHOUT re-running the completed step", async () => {
    // "Restart the worker": mark runnable again and drive it forward.
    await query(`UPDATE workflow_executions SET state = 'running' WHERE id = $1`, [executionId]);
    const resumed = await runWorkflow(executionId);

    // reserve was already completed — the engine skipped it. Its counter must
    // still be 1. submit re-ran (it never completed) and now succeeds.
    expect(effects.reserve).toBe(1);
    expect(effects.submit).toBe(2);
    expect(resumed.state).toBe("waiting_signal");
    expect(resumed.waiting_for).toBe("human_approval");
  });

  it("parks until the human signal arrives, then completes", async () => {
    // Calling run again while parked is a no-op — it stays parked.
    const stillParked = await runWorkflow(executionId);
    expect(stillParked.state).toBe("waiting_signal");
    expect(effects.finalize).toBe(0);

    const done = await signal(executionId, "human_approval", { actor: "human:concierge-7" });
    expect(done.state).toBe("completed");
    expect(effects.finalize).toBe(1);
  });

  it("keeps the full step history as rows — the inspectable record", async () => {
    const steps = await history(executionId);
    const names = steps.map((s) => s.step_name);
    expect(names).toEqual(["reserve", "submit", "await_approval", "finalize"]);
    const finalize = steps[3] as { output: { approvedBy?: string } };
    expect(finalize.output.approvedBy).toBe("human:concierge-7");
  });

  it("rejects a signal the workflow is not waiting for", async () => {
    const id = await startWorkflow(org, "test_fulfillment", "aaaaaaaa-0000-4000-8000-000000000002");
    await expect(signal(id, "human_approval")).rejects.toThrow(/not waiting/);
    // And the execution is untouched by the bad signal.
    expect((await load(id)).state).toBe("running");
  });
});

// ---------------------------------------------------------------------------

describe("transactional outbox", () => {
  it("writes the event in the same transaction as the state change", async () => {
    await withTransaction(async (c) => {
      const move = (
        await c.query<{ id: string }>(
          `INSERT INTO moves (organization_id, reference) VALUES ($1,'MR-OBX-1') RETURNING id`,
          [org],
        )
      ).rows[0]!;
      await publish(c, {
        organizationId: org,
        eventType: "move.created",
        aggregateId: move.id,
        payload: { reference: "MR-OBX-1" },
      });
    });

    expect(await backlog("projector")).toBeGreaterThanOrEqual(1);
  });

  it("a rolled-back transaction leaves no orphan event", async () => {
    const before = await backlog("projector");
    await expect(
      withTransaction(async (c) => {
        await publish(c, {
          organizationId: org,
          eventType: "move.created",
          payload: { reference: "MR-NEVER" },
        });
        throw new Error("boom — roll it all back");
      }),
    ).rejects.toThrow("boom");

    // The event vanished with the transaction. No announcement of state that
    // never happened.
    expect(await backlog("projector")).toBe(before);
  });

  it("delivers exactly once per consumer, even when dispatched twice", async () => {
    let handled = 0;
    const first = await dispatch("projector", async () => {
      handled++;
    });
    const second = await dispatch("projector", async () => {
      handled++;
    });

    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0); // redelivery finds everything claimed
    expect(handled).toBe(first);
  });

  it("delivers independently to a second consumer", async () => {
    let notified = 0;
    const n = await dispatch("notifier", async () => {
      notified++;
    });
    expect(n).toBeGreaterThanOrEqual(1);
    expect(notified).toBe(n);
  });
});

// ---------------------------------------------------------------------------

describe("relationship-based authorization", () => {
  const referral = "referral:r-100";

  beforeAll(async () => {
    // network → brokerage → office-a, office-b
    await writeTuple("org:office-a", "parent", "org:brokerage-x");
    await writeTuple("org:office-b", "parent", "org:brokerage-x");
    await writeTuple("org:brokerage-x", "parent", "org:network-1");
    // people
    await writeTuple("user:amy", "member", "org:office-a");
    await writeTuple("user:bob", "member", "org:office-b");
    await writeTuple("user:root", "admin", "org:network-1");
    await writeTuple("user:rival", "admin", "org:brokerage-other");
    // the referral belongs to office A
    await writeTuple("org:office-a", "owner", referral);
  });

  it("grants the agent in the owning office", async () => {
    const r = await checkView("user:amy", referral);
    expect(r.allowed).toBe(true);
    expect(r.via).toContain("office-a");
  });

  it("denies the agent from a sibling office — same brokerage is not enough", async () => {
    expect((await checkView("user:bob", referral)).allowed).toBe(false);
  });

  it("grants the network admin through the ancestor walk", async () => {
    const r = await checkView("user:root", referral);
    expect(r.allowed).toBe(true);
    expect(r.via).toContain("ancestor");
  });

  it("denies a different tenant outright — deny is the default", async () => {
    expect((await checkView("user:rival", referral)).allowed).toBe(false);
    expect((await checkView("user:nobody", referral)).allowed).toBe(false);
  });

  it("revokes access by deleting one tuple — the former-agent case", async () => {
    await deleteTuple("user:amy", "member", "org:office-a");
    expect((await checkView("user:amy", referral)).allowed).toBe(false);
  });

  it("explains every grant — no unexplainable authorization decisions", async () => {
    const r = await checkView("user:root", referral);
    expect(typeof r.via).toBe("string");
    expect(r.via!.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------

describe("optimistic concurrency", () => {
  it("rejects a stale write instead of silently losing an update", async () => {
    const move = (
      await query<{ id: string; version: number }>(
        `INSERT INTO moves (organization_id, reference) VALUES ($1,'MR-CC-1')
         RETURNING id, version`,
        [org],
      )
    )[0]!;

    // Two concierges read version 1 at the same time.
    const readVersion = move.version;

    // Concierge 1 writes first — succeeds, bumps the version.
    const first = await query<{ version: number }>(
      `UPDATE moves SET state = 'conflict_pending', version = version + 1
        WHERE id = $1 AND version = $2 RETURNING version`,
      [move.id, readVersion],
    );
    expect(first).toHaveLength(1);
    expect(first[0]!.version).toBe(readVersion + 1);

    // Concierge 2 writes with the version they read — zero rows. The service
    // layer surfaces this as a conflict to re-read, never a silent overwrite.
    const second = await query(
      `UPDATE moves SET state = 'canonical', version = version + 1
        WHERE id = $1 AND version = $2 RETURNING version`,
      [move.id, readVersion],
    );
    expect(second).toHaveLength(0);

    // The first write survived untouched.
    const final = await query<{ state: string; version: number }>(
      `SELECT state, version FROM moves WHERE id = $1`,
      [move.id],
    );
    expect(final[0]!.state).toBe("conflict_pending");
    expect(final[0]!.version).toBe(readVersion + 1);
  });
});
