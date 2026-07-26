import { describe, it, expect } from "vitest";
import { held, violated, completedCount, type Slot } from "../theater-verdict";
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
  evidence: {},
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
    ).toBe(2);
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
