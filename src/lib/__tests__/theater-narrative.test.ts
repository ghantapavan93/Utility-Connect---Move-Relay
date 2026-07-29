import { describe, it, expect } from "vitest";
import { NARRATIVE, RAIL, resultLayers, establishesInvariant } from "../theater-narrative";
import { verdictOf, type Slot } from "../theater-verdict";
import { VIOLATION } from "../theater-contract";
import { SCENARIOS } from "../theater";

/**
 * The plain-language layer cannot say more than the evidence does.
 *
 * Every scenario now carries a second reading for someone who does not parse a
 * unique constraint as a sentence. That layer is prose, and prose on a page
 * about provenance is exactly where an unearned claim gets in: a sentence
 * asserting "no duplicate referrals were created" keeps asserting it after the
 * mechanism changes, because nothing re-checks a string.
 *
 * So the sentence that makes the factual claim is a function of the evidence
 * the server returned, and these tests hold that line from both directions —
 * it must reflect real numbers when they are present, and it must decline to
 * speak when they are not.
 */

describe("every scenario the page can run has a narrative", () => {
  it("covers each key in the scenario registry, with no orphans", () => {
    expect(Object.keys(NARRATIVE).sort()).toEqual(Object.keys(SCENARIOS).sort());
  });

  it("states a risk, a refusal and an event for each", () => {
    for (const [key, n] of Object.entries(NARRATIVE)) {
      expect(n.happened.length, `${key} happened`).toBeGreaterThan(20);
      expect(n.atRisk.length, `${key} atRisk`).toBeGreaterThan(20);
      expect(n.prevented.length, `${key} prevented`).toBeGreaterThan(20);
    }
  });
});

describe("the evidence sentence is computed, never asserted", () => {
  /*
    The load-bearing test. If `proves` were prose it would pass every check
    above and still be free to claim anything — so the property worth proving
    is that it goes silent when the evidence is absent rather than producing a
    confident sentence about a run that returned nothing.
  */
  it("refuses to make a claim when the evidence is empty", () => {
    for (const [key, n] of Object.entries(NARRATIVE)) {
      const said = n.proves({});
      expect(said, `${key} invented a claim from empty evidence`).toBe(
        "The server returned no evidence for this claim.",
      );
    }
  });

  it("refuses to make a claim when the evidence has the wrong shape", () => {
    const junk = { rowsParsed: "two", handlerInvocations: null, issues: "none", secondPass: 3 };
    for (const [key, n] of Object.entries(NARRATIVE)) {
      expect(n.proves(junk), `${key} accepted malformed evidence`).toBe(
        "The server returned no evidence for this claim.",
      );
    }
  });

  it("reports the numbers the server actually returned", () => {
    expect(
      NARRATIVE.duplicate_csv!.proves({
        rowsParsed: 2,
        secondPass: ["replayed", "replayed"],
      }),
    ).toBe("2 rows delivered twice. 2 of 2 replayed on the second pass.");

    expect(
      NARRATIVE.webhook_twice!.proves({ handlerInvocations: 1, redeliveryProcessed: 0 }),
    ).toBe("Two deliveries reached the consumer. The handler ran 1×; the redelivery processed 0.");

    expect(
      NARRATIVE.stale_write!.proves({ firstWriteRows: 1, secondWriteRows: 0 }),
    ).toBe("The first write updated 1 row. The stale write updated 0.");
  });

  /*
    A partial replay is a real outcome and the sentence has to be able to say
    so. If it reported "2 of 2" whenever any row replayed, the copy would be
    describing the invariant rather than the run — which is the failure mode
    this whole design is guarding against.
  */
  it("reports a partial result as partial, not as success", () => {
    const said = NARRATIVE.duplicate_csv!.proves({
      rowsParsed: 2,
      secondPass: ["replayed", "accepted"],
    });
    expect(said).toContain("1 of 2 replayed");
  });

  it("reports a denial as a denial", () => {
    const said = NARRATIVE.cross_tenant!.proves({
      owningAgent: { allowed: true },
      rivalTenantAdmin: { allowed: false },
      anonymous: { allowed: false },
    });
    expect(said).toBe("Owning agent allowed; rival tenant denied; anonymous denied.");
  });

  /*
    And it has to be able to report the bad news. A cross-tenant read that was
    allowed is the worst result this page can produce; the sentence that
    describes it must not be structurally incapable of saying so.
  */
  it("can report a breach — the sentence is not hard-wired to reassure", () => {
    const said = NARRATIVE.cross_tenant!.proves({
      owningAgent: { allowed: true },
      rivalTenantAdmin: { allowed: true },
      anonymous: { allowed: false },
    });
    expect(said).toContain("rival tenant allowed");
  });
});

describe("the three-beat frame", () => {
  it("runs risk, then invariant, then evidence", () => {
    expect(RAIL.map((s) => s.n)).toEqual(["01", "02", "03"]);
    expect(RAIL.map((s) => s.title)).toEqual([
      "Business risk",
      "Domain invariant",
      "Persisted evidence",
    ]);
  });
});

describe("prevention language is earned, never assumed", () => {
  const result = (outcome: string, evidence: Record<string, unknown>) => ({
    scenario: "stale_write",
    invariant: "A stale write updates zero rows and surfaces as a conflict — never a silent overwrite.",
    outcome,
    evidence,
  });
  const clean = result("first write won; second was rejected as stale", {
    firstWriteRows: 1,
    secondWriteRows: 0,
  });
  const breach = result(VIOLATION, { firstWriteRows: 1, secondWriteRows: 1 });

  const layersFor = (slot: Slot) =>
    resultLayers("stale_write", verdictOf(slot, (e) => establishesInvariant("stale_write", e)));

  it("names the prevented outcome per attack, not one shared phrase", () => {
    const bodies = Object.keys(NARRATIVE).map((k) => NARRATIVE[k]!.prevented);
    expect(new Set(bodies).size).toBe(bodies.length);
    expect(NARRATIVE.duplicate_csv!.prevented).toMatch(/^Duplicate referrals were prevented\./);
    expect(NARRATIVE.cross_tenant!.prevented).toMatch(/^Unauthorized access was denied\./);
    expect(NARRATIVE.schema_drift!.prevented).toMatch(/^The incompatible payload was quarantined\./);
  });

  it("claims prevention only when the invariant held", () => {
    const labels = layersFor(clean).map((l) => l.label);
    expect(labels).toContain("Unsafe outcome prevented");
    expect(labels).not.toContain("Unsafe outcome occurred");
  });

  /*
    The load-bearing case. Prevention language printed against a run where the
    unsafe outcome did occur is a false statement in the one place on the site
    that cannot afford one.
  */
  it("says the unsafe outcome occurred on a breach, with no prevention language", () => {
    const layers = layersFor(breach);
    const labels = layers.map((l) => l.label);
    expect(labels).toContain("Unsafe outcome occurred");
    expect(labels).not.toContain("Unsafe outcome prevented");
    expect(layers.map((l) => l.body)).not.toContain(NARRATIVE.stale_write!.prevented);
  });

  it("reports the breach numbers, not the reassuring ones", () => {
    const said = layersFor(breach).find((l) => l.label === "What proves it")!.body;
    expect(said).toContain("The stale write updated 1.");
  });

  /*
    An inconclusive run must not borrow either vocabulary. It has shown neither
    that the outcome was prevented nor that it occurred.
  */
  it("uses neither vocabulary when no verdict was reached", () => {
    for (const slot of [
      { error: "connection reset", reason: "network" } as Slot,
      { error: "deadline exceeded", reason: "timeout" } as Slot,
      result("first write won; second was rejected as stale", {}) as Slot,
      result("first write won; second was rejected as stale", { unrelated: true }) as Slot,
    ]) {
      const layers = layersFor(slot);
      const labels = layers.map((l) => l.label);
      expect(labels, JSON.stringify(slot)).toContain("No verdict was reached");
      expect(labels).not.toContain("Unsafe outcome prevented");
      expect(labels).not.toContain("Unsafe outcome occurred");
      // And no evidence sentence, because there is no evidence to read.
      expect(labels).not.toContain("What proves it");
      const joined = layers.map((l) => l.body).join(" ");
      expect(joined).not.toMatch(/prevented|refused|denied|rejected|quarantined/i);
    }
  });

  it("gives idle and running no layers at all", () => {
    expect(layersFor(undefined)).toHaveLength(0);
    expect(layersFor("running")).toHaveLength(0);
  });

  it("gives every scenario a full reading in both decided outcomes", () => {
    for (const key of Object.keys(NARRATIVE)) {
      const ok = resultLayers(key, { kind: "held", result: clean, evidenceState: "complete" });
      const bad = resultLayers(key, { kind: "violated", result: breach, evidenceState: "complete" });
      expect(ok, key).toHaveLength(4);
      expect(bad, key).toHaveLength(4);
    }
  });
});
