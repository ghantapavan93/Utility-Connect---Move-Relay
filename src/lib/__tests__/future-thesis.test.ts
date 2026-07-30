import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  CAPABILITIES,
  HORIZONS,
  ARCHITECTURE_STACK,
  FAILURE_MATRIX,
  BUILD_NEXT,
  LABEL_META,
} from "../future-thesis";

/**
 * The thesis is held to its own honesty gradient.
 *
 * A roadmap drifts one adjective at a time: a hypothesis picks up a present-
 * tense verb, a "planned" turns into an "offers", and six months later the
 * page describes a product nobody built. These tests make that drift a red
 * suite instead of a discovery — the same treatment `continuum.test.ts` gives
 * the original /future page, extended to the deeper claims this one makes.
 */

describe("every capability carries an honest label", () => {
  it("uses only the four defined labels, matched to its horizon", () => {
    const expected = { 0: "built", 1: "validation", 2: "hypothesis", 3: "expansion" } as const;
    for (const c of CAPABILITIES) {
      expect(c.label, `${c.id} label`).toBe(expected[c.horizon]);
      expect(LABEL_META[c.label]).toBeDefined();
    }
  });

  it("gives every built capability a live proof route, and only built ones", () => {
    for (const c of CAPABILITIES) {
      if (c.label === "built") {
        /*
          "Built" is a checkable claim or it is marketing. Each one must name
          the route where a visitor can watch it work.
        */
        expect(c.proof, `${c.id} must prove itself somewhere`).toBeDefined();
        const page = join(
          process.cwd(),
          "src/app",
          c.proof!.href.replace(/^\//, ""),
          "page.tsx",
        );
        expect(existsSync(page), `${c.id} points at ${c.proof!.href}, which has no page`).toBe(true);
      } else {
        // A hypothesis with a proof link is claiming to be more than it is.
        expect(c.proof, `${c.id} is not built and may not link proof`).toBeUndefined();
      }
    }
  });

  it("keeps unbuilt capabilities out of the present tense where it matters most", () => {
    /*
      Scenario prose may narrate ("the copilot identifies…") because it is
      framed as a scenario. The one field that must never slip is the
      experiment: for anything unbuilt it describes work to be done, so it may
      not open with the phrase reserved for horizon 0.
    */
    for (const c of CAPABILITIES.filter((c) => c.label !== "built")) {
      expect(c.smallestExperiment, `${c.id} experiment claims it already ran`).not.toMatch(
        /^Already run/i,
      );
    }
    for (const c of CAPABILITIES.filter((c) => c.label === "built")) {
      expect(c.smallestExperiment, `${c.id} is built; its experiment is history`).toMatch(
        /^Already run/i,
      );
    }
  });

  it("gives every capability the full explorer contract", () => {
    for (const c of CAPABILITIES) {
      expect(c.problem.length, `${c.id} problem`).toBeGreaterThan(20);
      expect(c.scenario.length, `${c.id} scenario`).toBeGreaterThan(40);
      expect(c.failureModes.length, `${c.id} needs failure modes`).toBeGreaterThan(0);
      expect(c.observability.length, `${c.id} needs observability`).toBeGreaterThan(0);
      expect(c.successMeasures.length, `${c.id} needs success measures`).toBeGreaterThan(0);
      // The strongest argument against building it. A thesis without one is a
      // pitch, and every entry here must survive being argued with.
      expect(c.reasonNotToBuild.length, `${c.id} needs its counter-argument`).toBeGreaterThan(10);
      expect(c.roles.length, `${c.id} serves nobody`).toBeGreaterThan(0);
    }
  });

  it("covers all four horizons, with the built one non-empty", () => {
    for (const h of HORIZONS) {
      expect(
        CAPABILITIES.some((c) => c.horizon === h.horizon),
        `horizon ${h.horizon} is empty`,
      ).toBe(true);
    }
    expect(CAPABILITIES.filter((c) => c.label === "built").length).toBeGreaterThanOrEqual(4);
  });
});

describe("the architecture stack tells the truth about what exists", () => {
  it("marks the layers this repository actually has, and only those", () => {
    /*
      The `exists` flags are claims about this codebase. The three unbuilt
      layers are exactly the roadmap: the role-aware experience, the streaming
      experience API, and the multi-provider router. If someone builds one,
      this test forces the page to start saying so.
    */
    const missing = ARCHITECTURE_STACK.filter((l) => !l.exists).map((l) => l.layer);
    expect(missing).toEqual(["Role-aware experience", "AI experience API", "Model router"]);
  });
});

describe("failure is enumerated, not implied", () => {
  it("keeps the failure matrix substantial and fully specified", () => {
    expect(FAILURE_MATRIX.length).toBeGreaterThanOrEqual(15);
    for (const f of FAILURE_MATRIX) {
      expect(f.interfaceShows.length, f.failure).toBeGreaterThan(3);
      expect(f.systemResponse.length, f.failure).toBeGreaterThan(3);
    }
  });

  it("never lets a failure row promise success language", () => {
    for (const f of FAILURE_MATRIX) {
      expect(f.interfaceShows, f.failure).not.toMatch(/verified|committed successfully|all good/i);
    }
  });
});

describe("interactivity stays rationed", () => {
  it("names exactly three next builds", () => {
    // An unlimited number of ideas may appear as hypotheses; "this works" is a
    // claim, and the thesis commits to earning it three times, not thirteen.
    expect(BUILD_NEXT).toHaveLength(3);
  });
});

describe("the existing /future page is untouched by the thesis", () => {
  it("still renders the continuum and now links onward", () => {
    /*
      The user's constraint, made structural: this feature is an addition. The
      original page keeps its FuturePage render, and gains exactly one thing —
      a route to the thesis.
    */
    const src = readFileSync(join(process.cwd(), "src/app/future/page.tsx"), "utf8");
    expect(src).toContain("<FuturePage");
    expect(src).toContain("/future/thesis");
  });
});
