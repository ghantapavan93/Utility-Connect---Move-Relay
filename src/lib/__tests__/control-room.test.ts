import { describe, it, expect } from "vitest";
import {
  headlineFor,
  lanesFor,
  metricsFor,
  type Stats,
  type MoveRow,
  type BatchResult,
  type ServiceRow,
} from "../control-room";

/**
 * The control room's language, and what it must never say.
 *
 * Two failures are far worse than the rest and shape every test below.
 *
 * A failed request rendered as an empty tenant turns "we could not ask" into
 * "nothing needs attention" — the most dangerous sentence an operations screen
 * can produce, and the one a naive implementation reaches by defaulting to
 * zero.
 *
 * A consequential decision filed under automation claims the system settled
 * something it must not: identity, consent, a final merge, or whether a retry
 * is safe. CLAUDE.md lists those; this is that list, enforced.
 */

const stats = (over: Partial<Stats> = {}): Stats => ({
  activeMoves: 5,
  canonicalMoves: 4,
  duplicatesPrevented: 0,
  openConflicts: 0,
  auditEvents: 12,
  aiBriefings: 1,
  ordersRecovered: 0,
  providerSubmissions: 1,
  ...over,
});

const move = (over: Partial<MoveRow> = {}): MoveRow => ({
  id: "m1",
  reference: "MR-2026-0001",
  state: "canonical",
  sources: 3,
  openConflicts: 0,
  ...over,
});

const batch = (over: Partial<BatchResult["rows"]> = {}, results: BatchResult["results"] = []): BatchResult => ({
  rows: { total: 5, accepted: 4, quarantined: 1, replayed: 0, unmappable: 0, ...over },
  results,
});

describe("the headline follows returned state", () => {
  it("never reports an empty shift when the read failed", () => {
    const h = headlineFor({ load: "failed", stats: null, moves: [] });
    /*
      The load-bearing case. An implementation that defaulted to zero would
      produce "No moves are active" here, which reads as a calm shift and is a
      lie about an unanswered question.
    */
    expect(h.lead).not.toMatch(/no moves are active/i);
    expect(h.tone).toBe("failed");
    expect(h.follow).toMatch(/unanswered/i);
  });

  it("does not claim anything while still reading", () => {
    const h = headlineFor({ load: "loading", stats: null, moves: [] });
    expect(h.tone).toBe("neutral");
    expect(h.follow).toMatch(/until the server answers/i);
  });

  it("says an empty tenant is empty", () => {
    expect(headlineFor({ load: "empty", stats: null, moves: [] }).lead).toMatch(/no moves are active/i);
    expect(headlineFor({ load: "ready", stats: stats({ activeMoves: 0 }), moves: [] }).lead).toMatch(/no moves/i);
  });

  /*
    Priority is the point. A lost provider reply outranks a good batch, because
    one is a loss of certainty and the other is a number — an implementation
    that reported the most recent event would bury it.
  */
  it("puts an unknown provider outcome above everything else", () => {
    const services: ServiceRow[] = [{ id: "s1", serviceType: "electric", state: "unknown" }];
    const h = headlineFor({ load: "ready", stats: stats({ openConflicts: 3 }), moves: [move()], batch: batch(), services });
    expect(h.lead).toMatch(/provider may have acted/i);
    expect(h.follow).toMatch(/rather than guessing/i);
  });

  it("reports recovery only when the backend says an order was recovered", () => {
    const services: ServiceRow[] = [{ id: "s1", serviceType: "electric", state: "reconciled" }];
    expect(headlineFor({ load: "ready", stats: stats({ ordersRecovered: 1 }), moves: [move()], services }).tone).toBe(
      "recovered",
    );
    // Same services, but the tenant has no reconciled submission: no such claim.
    expect(headlineFor({ load: "ready", stats: stats({ ordersRecovered: 0 }), moves: [move()], services }).tone).not.toBe(
      "recovered",
    );
  });

  it("builds batch language from the returned counts, not from constants", () => {
    const h = headlineFor({ load: "ready", stats: stats(), moves: [move()], batch: batch({ accepted: 2, quarantined: 3 }) });
    expect(h.lead).toContain("2 moves");
    expect(h.follow).toContain("3 inputs");
  });

  it("says the shift is calm only when it is", () => {
    const h = headlineFor({ load: "ready", stats: stats(), moves: [move()], batch: batch({ quarantined: 0 }) });
    expect(h.lead).toMatch(/shift is moving/i);
    expect(h.tone).toBe("verified");
  });
});

describe("the three lanes", () => {
  it("returns nothing at all when the page has not loaded or has failed", () => {
    /*
      Deliberately empty rather than encouraging. A caller that cannot tell
      "nothing to do" from "we did not ask" would show the wrong one, so this
      refuses to make it ambiguous.
    */
    expect(lanesFor({ load: "failed", stats: null, moves: [] })).toEqual([]);
    expect(lanesFor({ load: "loading", stats: null, moves: [] })).toEqual([]);
  });

  it("files a contested canonical field under authority, never automation", () => {
    const items = lanesFor({ load: "ready", stats: stats({ openConflicts: 2 }), moves: [move({ openConflicts: 2 })] });
    const conflict = items.find((i) => i.id === "resolve-conflict")!;

    expect(conflict, "a contested field produced no item").toBeDefined();
    expect(conflict.lane).toBe("authority");
    expect(conflict.authority).toMatch(/named concierge/i);
    // The exact boundary from CLAUDE.md: AI may explain, never merge.
    expect(conflict.authority).toMatch(/may not perform the merge/i);
    expect(items.filter((i) => i.lane === "automation").some((i) => /conflict/i.test(i.headline))).toBe(false);
  });

  it("files retry safety under authority, and reconciliation under recommendation", () => {
    const services: ServiceRow[] = [{ id: "s1", serviceType: "electric", state: "unknown" }];
    const items = lanesFor({ load: "ready", stats: stats(), moves: [move()], services });

    expect(items.find((i) => i.id === "retry-safety")!.lane).toBe("authority");
    /*
      The distinction that matters. Reconciliation is deterministic and asks the
      provider for evidence, so it is safe to recommend. Deciding a retry is
      safe is on the never-automate list, so it is not.
    */
    expect(items.find((i) => i.id === "propose-reconcile")!.lane).toBe("recommend");
  });

  it("files a quarantined row under automation and a review under recommendation", () => {
    const b = batch({ quarantined: 1 }, [
      { line: 3, status: "quarantined", issues: [{ path: "customer.email", message: "invalid email" }] },
    ]);
    const items = lanesFor({ load: "ready", stats: stats(), moves: [move()], batch: b });

    // The contract holding the row is automation: it already happened.
    expect(items.find((i) => i.id === "batch-quarantined")!.lane).toBe("automation");
    // Deciding what to do about it is a recommendation, and reversible.
    const review = items.find((i) => i.id === "review-quarantine")!;
    expect(review.lane).toBe("recommend");
    expect(review.detail).toContain("customer.email");
    expect(review.authority).toMatch(/named operator/i);
  });

  it("gives every non-automation item an authority boundary", () => {
    const services: ServiceRow[] = [{ id: "s1", serviceType: "electric", state: "unknown" }];
    const items = lanesFor({
      load: "ready",
      stats: stats({ openConflicts: 1, duplicatesPrevented: 1 }),
      moves: [move({ openConflicts: 1 })],
      batch: batch({ quarantined: 1 }, [{ line: 2, status: "quarantined", issues: [{ path: "move.date", message: "bad" }] }]),
      services,
    });

    /*
      A recommendation whose authority is unstated reads as an instruction —
      which is how an assistant quietly becomes the decision-maker.
    */
    for (const i of items.filter((x) => x.lane !== "automation")) {
      expect(i.authority, `${i.id} has no authority boundary`).toBeTruthy();
      expect(i.action, `${i.id} has no next action`).toBeTruthy();
    }
  });

  it("carries evidence on every item, never prose alone", () => {
    const items = lanesFor({
      load: "ready",
      stats: stats({ duplicatesPrevented: 2, ordersRecovered: 1 }),
      moves: [move()],
      batch: batch(),
    });
    expect(items.length).toBeGreaterThan(0);
    for (const i of items) {
      expect(i.evidence, `${i.id} cites nothing`).toBeTruthy();
      expect(i.evidence).toMatch(/\d/);
    }
  });

  it("says nothing about a batch it was not given", () => {
    const items = lanesFor({ load: "ready", stats: stats(), moves: [move()] });
    expect(items.some((i) => i.id.startsWith("batch-"))).toBe(false);
  });
});

describe("metrics carry their scope", () => {
  it("leads with actionable state and follows with evidence counters", () => {
    const m = metricsFor(stats(), [move({ openConflicts: 1 })], [{ id: "s", serviceType: "electric", state: "unknown" }]);
    expect(m[0]!.kind).toBe("action");
    expect(m.find((x) => x.label === "Needs a human decision")!.value).toBe(1);
    expect(m.find((x) => x.label === "Provider outcome unknown")!.value).toBe(1);
    // Every tile says where its number came from.
    for (const tile of m) expect(tile.scope.length, tile.label).toBeGreaterThan(8);
  });

  it("keeps its shape but not its numbers when stats are absent", () => {
    /*
      Null, never zero. The tiles used to disappear entirely on a failed read,
      which loses the shape of the shift as well as its figures — and the only
      other option a component reaches for is `0`, which asserts there is
      nothing to do. `null` is the one honest answer: this exists and we do not
      know it.
    */
    const m = metricsFor(null, [], []);
    expect(m.length).toBeGreaterThan(0);
    expect(m.every((t) => t.value === null)).toBe(true);
    expect(m.some((t) => t.value === 0)).toBe(false);
  });
});

describe("the shift brief", () => {
  it("says something after any real operation, including a full replay", async () => {
    const { shiftBriefFor } = await import("../control-room");
    /*
      Re-submitting the same file returns five replays and zero accepted. The
      first version only spoke when rows were accepted, so a real operation
      produced a silent brief — indistinguishable from one that never ran.
    */
    const b = shiftBriefFor({
      load: "ready",
      stats: stats(),
      moves: [move()],
      batch: batch({ accepted: 0, quarantined: 0, replayed: 5 }),
    });
    expect(b.observations.length).toBeGreaterThan(0);
    expect(b.observations.join(" ")).toMatch(/replayed rather than enrolling anyone twice/i);
  });

  it("is insufficient rather than confident before anything is read", async () => {
    const { shiftBriefFor } = await import("../control-room");
    for (const load of ["loading", "failed", "empty"] as const) {
      const b = shiftBriefFor({ load, stats: null, moves: [] });
      expect(b.evidenceState, load).toBe("insufficient");
      expect(b.recommendation, load).toBeNull();
    }
  });

  it("names the endpoints it actually read", async () => {
    const { shiftBriefFor } = await import("../control-room");
    const withBatch = shiftBriefFor({ load: "ready", stats: stats(), moves: [move()], batch: batch() });
    expect(withBatch.sourcesInspected).toContain("POST /api/v1/upload/csv");

    // No batch was run, so the endpoint is not claimed as a source.
    const without = shiftBriefFor({ load: "ready", stats: stats(), moves: [move()] });
    expect(without.sourcesInspected).not.toContain("POST /api/v1/upload/csv");
  });

  it("calls two opposing findings conflicting, not partial", async () => {
    const { shiftBriefFor } = await import("../control-room");
    const b = shiftBriefFor({
      load: "ready",
      stats: stats({ openConflicts: 1 }),
      moves: [move({ openConflicts: 1 })],
      services: [{ id: "s", serviceType: "electric", state: "unknown" }],
    });
    expect(b.evidenceState).toBe("conflicting");
    // The unknown outcome outranks the contested field in what it recommends.
    expect(b.recommendation).toMatch(/reconcile/i);
  });
});
