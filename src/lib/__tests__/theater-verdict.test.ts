import { describe, it, expect } from "vitest";
import {
  held,
  violated,
  completedCount,
  verdictAccent,
  verdictOf,
  reasonForRequestFailure,
  tally,
  type Slot,
} from "../theater-verdict";
import { SCENARIOS, VIOLATION, type TheaterResult } from "../theater";

/**
 * The Failure Theater scoreboard.
 *
 * The page counts refusals by comparing each scenario's `outcome` against the
 * violation marker. That comparison is the only thing standing between a real
 * breach and a screen reporting six-out-of-six — so it is worth more than a
 * glance, and it was previously inside a component where no test could reach
 * it at all.
 *
 * The direction of the risk is what matters here. Reporting a pass as a breach
 * is embarrassing; reporting a breach as a pass is the failure this entire
 * project exists to argue against, on a page whose whole purpose is to surface
 * the result nobody wants.
 */

const result = (outcome: string): TheaterResult => ({
  scenario: "stale_write",
  invariant: "A stale write updates zero rows.",
  outcome,
  /*
    Non-empty on purpose. Under the three-state model a completed run whose
    evidence establishes nothing is inconclusive rather than held, so a fixture
    with `evidence: {}` no longer describes a passing run — which is the whole
    point of the change, and these fixtures have to mean what they used to.
  */
  evidence: { firstWriteRows: 1, secondWriteRows: 0 },
});

describe("reading an outcome", () => {
  it("counts a described outcome as held", () => {
    expect(held(result("second upload replayed — no duplicate referrals"))).toBe(true);
    expect(violated(result("second upload replayed — no duplicate referrals"))).toBe(false);
  });

  it("counts the violation marker as a breach, not a pass", () => {
    expect(violated(result(VIOLATION))).toBe(true);
    expect(held(result(VIOLATION))).toBe(false);
  });

  it("never reports an unfinished or failed run as held", () => {
    // "We don't know yet" and "the request died" are both absence of evidence.
    // Neither is evidence that the invariant survived.
    const notPasses: Slot[] = [undefined, "running", { error: "network error" }];
    for (const slot of notPasses) {
      expect(held(slot)).toBe(false);
      expect(violated(slot)).toBe(false);
    }
  });

  it("counts completions independently of their verdict", () => {
    // The denominator has to include breaches, or a page showing "5 / 6" after
    // one violation would be indistinguishable from one still mid-sweep.
    expect(
      completedCount([result("ok"), result(VIOLATION), "running", undefined, { error: "x" }]),
      // Three: the pass, the breach, and the failed request — which reached a
      // verdict of inconclusive, which is a completed attempt.
    ).toBe(3);
  });
});

describe("the colour the whole page wears", () => {
  /**
   * The background wash is the largest surface on that screen, and red is the
   * state it must never fail to reach. Reaching it in the browser needs a real
   * invariant to actually break against a live database, which is to say it
   * would never be exercised — so the branch that matters most would be the one
   * nothing checked. These assertions are that check.
   */
  const six = (outcomes: string[]): Slot[] => outcomes.map(result);

  it("goes red on a single breach, however many refusals surround it", () => {
    const mostlyFine = six(["ok", "ok", "ok", "ok", "ok", VIOLATION]);
    expect(verdictAccent(mostlyFine)).toBe("failed");
    // And the breach still outranks a full sweep of passes elsewhere.
    expect(verdictAccent([result(VIOLATION), ...six(["ok", "ok"])])).toBe("failed");
  });

  it("stays amber until every attack has actually been refused", () => {
    // Five of six is not six. The wash carries no counter beside it, so a green
    // page is a claim about all of them.
    expect(verdictAccent([...six(["ok", "ok", "ok", "ok", "ok"]), undefined])).toBe("conflict");
    expect(verdictAccent([...six(["ok"]), "running"])).toBe("conflict");
    /*
      A failed request is its own colour now. Amber-as-untested and
      amber-as-unresolved were the same shade before, so a page with one dead
      request looked identical to one nobody had touched.
    */
    expect(verdictAccent([...six(["ok"]), { error: "network error" }])).toBe("unknown");
  });

  it("is amber before anything has run, never green", () => {
    // An untouched page has refused nothing. Empty must not read as "all held".
    expect(verdictAccent([])).toBe("conflict");
    expect(verdictAccent([undefined, undefined, undefined])).toBe("conflict");
  });

  it("goes green only on a clean sweep", () => {
    expect(verdictAccent(six(["ok", "ok", "ok", "ok", "ok", "ok"]))).toBe("recovered");
  });
});

describe("the marker cannot drift away from its producers", () => {
  it("is the value every scenario actually emits on failure", async () => {
    // Both sides import the marker from `theater-contract.ts`, so a rename
    // propagates by construction. This asserts the other half: that the
    // scenarios still *use* the shared symbol, rather than having quietly
    // grown their own failure wording the scoreboard would read as a pass.
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(new URL("../theater.ts", import.meta.url), "utf8");

    // One failure branch per scenario, each referencing the constant.
    const branches = source.match(/:\s*VIOLATION[,\n]/g) ?? [];
    expect(branches.length).toBe(Object.keys(SCENARIOS).length);

    // And nothing reintroduced the bare string alongside it.
    expect(source.match(/["'`]VIOLATION["'`]/g)).toBeNull();
  });

  it("is declared in a module the browser can import", async () => {
    // The contract module exists precisely so the client bundle can read the
    // marker without pulling in `pg` — importing it through `theater.ts` broke
    // the production build with "Can't resolve 'dns'". If anything lands an
    // import here, that regression is back.
    const fs = await import("node:fs/promises");
    const contract = await fs.readFile(new URL("../theater-contract.ts", import.meta.url), "utf8");

    expect(contract).toContain('export const VIOLATION = "VIOLATION"');
    expect(contract).not.toMatch(/^\s*import\s/m);
  });
});


describe("three states, and the two inferences that are never made", () => {
  const ok = result("first write won; second was rejected as stale");

  it("does not infer HELD from a successful response alone", () => {
    // A 200 whose evidence cannot establish the invariant is not a pass. The
    // claim is about the evidence, not about the transport.
    const thin: Slot = { ...ok, evidence: {} };
    expect(verdictOf(thin).kind).toBe("inconclusive");

    const wrongFields: Slot = { ...ok, evidence: { unrelated: 1 } };
    const establishes = (e: Record<string, unknown>) => typeof e.firstWriteRows === "number";
    expect(verdictOf(wrongFields, establishes).kind).toBe("inconclusive");
    expect(verdictOf(ok, establishes).kind).toBe("held");
  });

  it("does not infer VIOLATED from a failed request", () => {
    /*
      The mistake the signature incident is about, made by the page instead of
      the backend. A timeout says nothing about whether the invariant holds.
    */
    for (const slot of [
      { error: "connection reset", reason: "network" },
      { error: "deadline exceeded", reason: "timeout" },
      { error: "superseded", reason: "cancelled" },
      { error: "500", reason: "server_error" },
      { error: "not json", reason: "malformed_response" },
    ] as Slot[]) {
      const v = verdictOf(slot);
      expect(v.kind, JSON.stringify(slot)).toBe("inconclusive");
    }
  });

  it("names why, rather than reporting a generic failure", () => {
    const reasons = ([
      { error: "x", reason: "network" },
      { error: "x", reason: "timeout" },
      { error: "x", reason: "cancelled" },
      { error: "x", reason: "malformed_response" },
    ] as Slot[]).map((s) => {
      const v = verdictOf(s);
      return v.kind === "inconclusive" ? v.reason : null;
    });
    expect(reasons).toEqual(["network", "timeout", "cancelled", "malformed_response"]);
  });

  it("still reports a breach even when its evidence is thin", () => {
    /*
      A breach outranks the evidence check. Demoting VIOLATION to inconclusive
      because the payload looked sparse would let the page suppress the one
      result it exists to surface.
    */
    const v = verdictOf({ ...result(VIOLATION), evidence: {} });
    expect(v.kind).toBe("violated");
  });

  it("classifies a request failure without ever reaching for VIOLATED", () => {
    /*
      A deadline is recognised by the runtime's exception name, not by its
      message. This once asserted that `new Error("network timeout after 5s")`
      classified as a timeout, which only proved a regex matched a string this
      test wrote — nothing in the app produced such an error, and a real
      deadline would have arrived as an `AbortError` and been filed as a
      cancellation. The real mechanism is exercised in `theater-request.test.ts`.
    */
    expect(reasonForRequestFailure(new Error("network timeout after 5s"))).toBe("network");
    expect(reasonForRequestFailure(null, 500)).toBe("server_error");
    expect(reasonForRequestFailure(null, 404)).toBe("server_error");
    expect(reasonForRequestFailure(new TypeError("Failed to fetch"))).toBe("network");
  });

  it("tallies the three states separately", () => {
    const t = tally([
      ok,
      ok,
      result(VIOLATION),
      { error: "x", reason: "network" },
      "running",
      undefined,
    ]);
    expect(t).toEqual({ held: 2, violated: 1, inconclusive: 1, total: 6 });
  });

  it("blocks green while anything is unresolved", () => {
    // Five refusals and one unknown is not a clean sweep, and must not look
    // like one.
    expect(verdictAccent([ok, ok, ok, ok, ok, { error: "x", reason: "timeout" }])).toBe("unknown");
    expect(verdictAccent([ok, ok, ok])).toBe("recovered");
  });
});
