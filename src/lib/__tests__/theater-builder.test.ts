import { describe, it, expect } from "vitest";
import { BUILDER, MUTATIONS, VALID_HANDOFF } from "../theater-builder";
import { MUTATION_COPY, MUTATION_ORDER, builderEstablishes } from "../theater-builder-narrative";
import { validateSubmission } from "../contracts";
import { verdictOf } from "../theater-verdict";
import { VIOLATION } from "../theater-contract";
import { query } from "../db";
import { theaterOrg } from "../theater";

/**
 * Every mutation the builder offers, run against the real backend.
 *
 * The builder's claim is narrower than the six attacks' and harder to keep: not
 * "these guarantees hold" but "whatever fault you choose from this list, the
 * guarantee named beside it holds". That only means something if every option
 * maps to a mechanism that exists — an option whose backend was aspirational
 * would be the page inventing a capability at exactly the moment a reviewer
 * decided to trust it.
 */

describe("the starting point is genuinely valid", () => {
  /*
    The baseline has to pass its own contract before any mutation is applied.
    A "valid" payload that never validated would make every quarantine below
    meaningless — the fault would be the baseline, not the mutation.
  */
  it("passes the partner contract untouched", () => {
    const v = validateSubmission("partner_api", VALID_HANDOFF);
    expect(v.ok, v.ok ? "" : JSON.stringify(v.issues)).toBe(true);
  });

  it("carries no real customer data", () => {
    const json = JSON.stringify(VALID_HANDOFF);
    expect(json).toContain("example.com");
    expect(json).toMatch(/469-555-\d{4}/); // reserved fictional range
  });
});

describe("every offered mutation is backed by a real mechanism", () => {
  it("offers exactly what it can run, and orders all of it", () => {
    expect(Object.keys(BUILDER).sort()).toEqual([...MUTATIONS].sort());
    expect(MUTATION_ORDER.sort()).toEqual([...MUTATIONS].sort());
    expect(Object.keys(MUTATION_COPY).sort()).toEqual([...MUTATIONS].sort());
  });

  it("holds its invariant and returns evidence that establishes it", async () => {
    for (const mutation of MUTATIONS) {
      const result = await BUILDER[mutation]();

      expect(result.mutation, mutation).toBe(mutation);
      expect(result.outcome, `${mutation} reported a breach`).not.toBe(VIOLATION);
      expect(result.expected.length, mutation).toBeGreaterThan(20);

      // The verdict the UI will show, computed the same way.
      const v = verdictOf(
        { scenario: mutation, invariant: result.invariant, outcome: result.outcome, evidence: result.evidence },
        (e) => builderEstablishes(mutation, e),
      );
      expect(v.kind, `${mutation} did not reach a verdict`).toBe("held");
    }
  }, 120_000);
});

describe("the checkpoint is the one the workflow actually supports", () => {
  it("names the crash point, and proves reserve did not re-run", async () => {
    const r = await BUILDER.crash_at_submit();

    expect(r.evidence.lastCommittedStep).toBe("reserve");
    expect(r.evidence.injectedCrashPoint).toBe("submit");
    expect(r.evidence.resumePoint).toBe("submit");
    expect(r.evidence.stepsThatDidNotRerun).toEqual(["reserve"]);
    // The claim above, in rows: step one completed exactly once across both runs.
    expect(r.evidence.reserveCompletions).toBe(1);
    expect(r.evidence.stateAfterCrash).toBe("failed");
    expect(r.evidence.stateAfterResume).toBe("completed");
  }, 30_000);
});

describe("isolation", () => {
  it("writes only inside the theater tenant", async () => {
    const org = await theaterOrg();
    const before = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug <> 'theater'`,
    );

    await BUILDER.stale_version();
    await BUILDER.drop_provider_response();
    await BUILDER.replay_batch();

    const after = await query<{ n: string }>(
      `SELECT count(*) AS n FROM moves m JOIN organizations o ON o.id = m.organization_id
        WHERE o.slug <> 'theater'`,
    );
    expect(after[0]!.n).toBe(before[0]!.n);
    expect(org).toBeTruthy();
  }, 60_000);

  /*
    The reason the route accepts a choice and nothing else. If a payload or a
    tenant id could arrive from the client, this surface would be a public write
    path into a real database wearing a demonstration's clothes.
  */
  it("takes no input beyond the choice itself", async () => {
    for (const mutation of MUTATIONS) {
      expect(BUILDER[mutation].length, `${mutation} accepts an argument`).toBe(0);
    }
  });

  it("is re-runnable — a second press does not depend on the first", async () => {
    const a = await BUILDER.stale_version();
    const b = await BUILDER.stale_version();
    expect(a.outcome).not.toBe(VIOLATION);
    expect(b.outcome).toBe(a.outcome);
    // Different rows each time, so neither run can be reading the other's state.
    expect(a.evidence.survivingState).not.toBe(b.evidence.survivingState);
  }, 30_000);
});

describe("the evidence sentence is computed, never asserted", () => {
  it("declines to speak when the evidence is empty", () => {
    for (const mutation of MUTATIONS) {
      expect(MUTATION_COPY[mutation].proves({}), mutation).toBe(
        "The server returned no evidence for this claim.",
      );
      expect(builderEstablishes(mutation, {}), mutation).toBe(false);
    }
  });

  it("declines when the evidence is plausible but insufficient", () => {
    // Non-empty, real-looking keys, none of them the ones the claim needs.
    const insufficient: Record<string, Record<string, unknown>> = {
      replay_batch: { idempotencyKey: "builder-batch:abc" },
      replay_webhook: { firstDeliveryProcessed: 1 },
      remove_required_field: { quarantineId: "q-1" },
      rename_partner_field: { renamed: { from: "move.date", to: "move.moveDate" } },
      stale_version: { readVersion: 1 },
      other_tenant: { referral: "referral:builder-abc" },
      drop_provider_response: { operationKey: "provider_submit:abc" },
      crash_at_submit: { lastCommittedStep: "reserve" },
    };

    for (const mutation of MUTATIONS) {
      const ev = insufficient[mutation]!;
      expect(Object.keys(ev).length, mutation).toBeGreaterThan(0);
      expect(builderEstablishes(mutation, ev), mutation).toBe(false);
    }
  });
});
