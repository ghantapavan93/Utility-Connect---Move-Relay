import { describe, it, expect } from "vitest";
import { verdictOf, type Slot } from "../theater-verdict";
import { establishesInvariant, resultLayers, NARRATIVE } from "../theater-narrative";
import { VIOLATION, type TheaterResult } from "../theater-contract";

/**
 * Evidence sufficiency, one fixture set per attack.
 *
 * The risk this closes is that `establishesInvariant` quietly degrades into a
 * presence check — "evidence is not null" wearing a longer name. That would pass
 * every test written with empty objects while letting a payload full of
 * irrelevant fields be read as proof, which is worse than no check at all
 * because it looks like one.
 *
 * So every `insufficient` fixture below is deliberately **non-empty and
 * plausible**: real keys a real run of that scenario returns, minus the ones the
 * invariant is actually established by. A presence check passes all six. The
 * field-level check fails all six, which is the property being proven.
 */

const res = (scenario: string, outcome: string, evidence: Record<string, unknown>): TheaterResult => ({
  scenario,
  invariant: `the invariant of ${scenario}`,
  outcome,
  evidence,
});

const OK = "held by this run";

interface Fixture {
  /** Establishes the invariant. */
  complete: Record<string, unknown>;
  /** Non-empty, plausible, and unable to establish anything. */
  insufficient: Record<string, unknown>;
  /** A real breach, with evidence that supports the breach. */
  breach: Record<string, unknown>;
}

const FIXTURES: Record<string, Fixture> = {
  duplicate_csv: {
    complete: { rowsParsed: 2, batchId: "e5c2ffb84895", secondPass: ["replayed", "replayed"] },
    // Batch id and mechanism, but nothing about what the second pass did.
    insufficient: { batchId: "e5c2ffb84895", mechanism: "persisted idempotency_records" },
    breach: { rowsParsed: 2, batchId: "e5c2ffb84895", secondPass: ["accepted", "accepted"] },
  },
  webhook_twice: {
    complete: { firstDeliveryProcessed: 1, redeliveryProcessed: 0, handlerInvocations: 1 },
    // Says a delivery happened; says nothing about how often the handler ran.
    insufficient: { firstDeliveryProcessed: 1, mechanism: "PRIMARY KEY (consumer, event_id)" },
    breach: { firstDeliveryProcessed: 1, redeliveryProcessed: 1, handlerInvocations: 2 },
  },
  worker_crash: {
    complete: { stateAfterCrash: "failed", stateAfterResume: "completed", reserveCompletions: 1 },
    // Records the crash, but not the resume or whether step one re-ran.
    insufficient: { stateAfterCrash: "failed", stepHistory: [{ step: "reserve", status: "completed" }] },
    breach: { stateAfterCrash: "failed", stateAfterResume: "completed", reserveCompletions: 2 },
  },
  cross_tenant: {
    complete: {
      owningAgent: { allowed: true },
      rivalTenantAdmin: { allowed: false },
      anonymous: { allowed: false },
    },
    // Only the owner was checked. The rival is the entire question.
    insufficient: { owningAgent: { allowed: true } },
    breach: {
      owningAgent: { allowed: true },
      rivalTenantAdmin: { allowed: true },
      anonymous: { allowed: false },
    },
  },
  stale_write: {
    complete: { firstWriteRows: 1, secondWriteRows: 0, survivingState: { state: "conflict_pending" } },
    // The surviving row, without either write's row count.
    insufficient: { survivingState: { state: "conflict_pending", version: 1 } },
    breach: { firstWriteRows: 1, secondWriteRows: 1, survivingState: { state: "canonical" } },
  },
  schema_drift: {
    complete: { contractVersion: "partner_api@v1", issues: [{ path: "move.date" }], quarantineId: "q-1" },
    // Quarantined, but neither the contract version nor the reasons came back.
    insufficient: { quarantineId: "q-1" },
    breach: { contractVersion: "partner_api@v1", issues: [], quarantineId: null },
  },
};

const verdict = (scenario: string, slot: Slot) =>
  verdictOf(slot, (e) => establishesInvariant(scenario, e));

describe("evidence sufficiency is a field check, not a presence check", () => {
  it("covers every scenario the page can run", () => {
    expect(Object.keys(FIXTURES).sort()).toEqual(Object.keys(NARRATIVE).sort());
  });

  it("reads complete evidence as held", () => {
    for (const [scenario, f] of Object.entries(FIXTURES)) {
      expect(verdict(scenario, res(scenario, OK, f.complete)).kind, scenario).toBe("held");
    }
  });

  /*
    The load-bearing case. Every fixture here is non-empty, so a check that only
    asked "is there evidence?" would call all six of these proven.
  */
  it("reads plausible but insufficient evidence as inconclusive, not held", () => {
    for (const [scenario, f] of Object.entries(FIXTURES)) {
      expect(Object.keys(f.insufficient).length, `${scenario} fixture must be non-empty`).toBeGreaterThan(0);

      const v = verdict(scenario, res(scenario, OK, f.insufficient));
      expect(v.kind, scenario).toBe("inconclusive");
      if (v.kind === "inconclusive") expect(v.reason, scenario).toBe("partial_evidence");

      // And the sufficiency check itself disagrees with mere presence.
      expect(establishesInvariant(scenario, f.insufficient), scenario).toBe(false);
      expect(establishesInvariant(scenario, f.complete), scenario).toBe(true);
    }
  });

  it("reads a breach as violated, with its evidence complete", () => {
    for (const [scenario, f] of Object.entries(FIXTURES)) {
      const v = verdict(scenario, res(scenario, VIOLATION, f.breach));
      expect(v.kind, scenario).toBe("violated");
      if (v.kind === "violated") expect(v.evidenceState, scenario).toBe("complete");
    }
  });
});

describe("a breach stays visible even when its evidence does not", () => {
  const scenario = "stale_write";

  it("shows the proof when the breach evidence is complete", () => {
    const v = verdict(scenario, res(scenario, VIOLATION, FIXTURES.stale_write!.breach));
    const layers = resultLayers(scenario, v);

    expect(layers.map((l) => l.label)).toContain("Unsafe outcome occurred");
    expect(layers.map((l) => l.label)).toContain("What proves it");
    expect(layers.find((l) => l.label === "What proves it")!.body).toContain("The stale write updated 1.");
  });

  it("still reports the breach when evidence is missing, without claiming proof", () => {
    const v = verdict(scenario, res(scenario, VIOLATION, {}));
    expect(v.kind).toBe("violated");
    if (v.kind === "violated") expect(v.evidenceState).toBe("missing");

    const labels = resultLayers(scenario, v).map((l) => l.label);
    expect(labels).toContain("Unsafe outcome occurred");
    expect(labels).not.toContain("What proves it");
    expect(labels).toContain("Evidence incomplete");
  });

  it("still reports the breach when evidence is partial, without claiming proof", () => {
    const v = verdict(scenario, res(scenario, VIOLATION, FIXTURES.stale_write!.insufficient));
    expect(v.kind).toBe("violated");
    if (v.kind === "violated") expect(v.evidenceState).toBe("partial");

    const layers = resultLayers(scenario, v);
    expect(layers.map((l) => l.label)).toContain("Unsafe outcome occurred");
    expect(layers.map((l) => l.label)).not.toContain("What proves it");
    expect(layers.find((l) => l.label === "Evidence incomplete")!.body).toBe(
      "Violation reported. Supporting evidence was incomplete.",
    );
  });

  it("never uses prevention language on any breach, whatever its evidence", () => {
    for (const [scenario, f] of Object.entries(FIXTURES)) {
      for (const ev of [f.breach, f.insufficient, {}]) {
        const layers = resultLayers(scenario, verdict(scenario, res(scenario, VIOLATION, ev)));
        expect(layers.map((l) => l.label)).not.toContain("Unsafe outcome prevented");
        expect(layers.map((l) => l.body)).not.toContain(NARRATIVE[scenario]!.prevented);
      }
    }
  });
});
