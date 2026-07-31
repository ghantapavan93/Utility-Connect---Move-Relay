import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { liveReadOutcome } from "@/components/cinematic";
import { CONTINUUM, type ContinuumVisualKey } from "@/lib/continuum";

/**
 * The honesty apparatus, held to its own rule.
 *
 * The vision page's design system says a diagram that reads a real endpoint
 * names it, and a diagram that is an argument in SVG says CONCEPT · NOT WIRED.
 * That rule was written down, exported as `DataBadge`, imported by the visual
 * library — and then applied to nothing, because the entire library was
 * unreachable and every diagram wore a hardcoded LIVE chip driven by a timer.
 *
 * These tests are the part that cannot be written down and forgotten.
 */

describe("a read is 'live' only when the system actually answered", () => {
  const isPair = (b: unknown): b is { a: number } =>
    typeof b === "object" && b !== null && typeof (b as { a?: unknown }).a === "number";

  it("accepts a good status carrying the shape the diagram reads", () => {
    const outcome = liveReadOutcome(true, 200, { a: 1 }, isPair);
    expect(outcome.state).toBe("ready");
    // The validated body comes back through, not the raw one — the caller
    // renders `outcome.data`, so a widening bug here would be invisible.
    expect(outcome.state === "ready" && outcome.data.a).toBe(1);
  });

  /*
    The original defect, pinned. `fetch` does not reject on 5xx, and the old
    hook went straight to `r.json()`. Next's error responses are JSON, so the
    body parsed, the state became "ready", and the badge above an empty
    diagram read "live · /api/v1/stats".
  */
  it("refuses a 500 whose body happens to parse", () => {
    const outcome = liveReadOutcome(false, 500, { error: "boom" }, isPair);
    expect(outcome.state).toBe("error");
    expect(outcome.state === "error" && outcome.reason).toContain("500");
  });

  it("refuses a 200 carrying something the diagram cannot read", () => {
    // The subtler half: the endpoint is reachable and cheerful, and returns a
    // payload from a different version of itself. Status alone cannot catch
    // this, which is why the validator is required rather than optional.
    const outcome = liveReadOutcome(true, 200, { totallyDifferent: true }, isPair);
    expect(outcome.state).toBe("error");
    expect(outcome.state === "error" && outcome.reason).toBe("unrecognised response");
  });

  it("refuses a body that was not JSON at all", () => {
    // The hook passes `null` when parsing fails, rather than throwing — a
    // proxy's HTML error page must reach the badge as a stated failure.
    expect(liveReadOutcome(true, 200, null, isPair).state).toBe("error");
  });
});

describe("every module has a diagram and every diagram has a module", () => {
  const visualsSource = readFileSync(
    join(process.cwd(), "src/components/cinematic/FutureVisuals.tsx"),
    "utf8",
  );
  const registrySource = readFileSync(
    join(process.cwd(), "src/components/cinematic/ContinuumVisual.tsx"),
    "utf8",
  );

  it("assigns each Continuum module a distinct visual", () => {
    const keys = CONTINUUM.map((m) => m.visual);
    expect(keys).toHaveLength(CONTINUUM.length);
    // Distinct, because two modules sharing a diagram means one of them is
    // being illustrated by an argument about the other.
    expect(new Set(keys).size).toBe(CONTINUUM.length);
  });

  it("leaves no exported visual unreachable", () => {
    /*
      The finding this whole file exists for: FutureVisuals.tsx was 527 lines
      of components imported by nothing. Dead code is where claims go to stop
      being checked — its header asserted three diagrams read live endpoints
      while none of them rendered at all. So every exported visual must be a
      *value* in the registry the module pages route through.

      Matching the mapped value rather than the file text is deliberate, and
      the first version of this test got it wrong. Asserting the registry
      merely mentioned each name passed happily when a key was repointed at
      the wrong component, because the orphaned name still sat in the import
      list above. Presence in a file is not reachability.
    */
    const exported = [...visualsSource.matchAll(/^export function (\w+Visual)\(/gm)].map(
      (m) => m[1]!,
    );
    const rendered = new Set(
      [...registrySource.matchAll(/^\s+\w+:\s*(\w+Visual),$/gm)].map((m) => m[1]!),
    );

    expect(exported.length).toBeGreaterThan(0);
    for (const name of exported) {
      expect(rendered, `${name} is exported but no module renders it`).toContain(name);
    }
    // And the other direction: as many diagrams as modules, each used once.
    expect(exported).toHaveLength(CONTINUUM.length);
    expect(rendered.size).toBe(CONTINUUM.length);
  });

  it("names only endpoints this app actually serves", () => {
    /*
      A badge reading "live · /api/v1/stats" is a claim about a route. If the
      route is renamed the badge keeps its confident wording and starts lying
      again, one indirection further from anyone who would notice — so the
      claim is checked against the filesystem rather than against a list that
      would need the same maintenance.
    */
    const claimed = [
      ...visualsSource.matchAll(/endpoint="(\/api\/[^"]+)"/g),
      ...visualsSource.matchAll(/useLiveData<[^>]*>\("(\/api\/[^"]+)"/g),
    ].map((m) => m[1]!);

    expect(claimed.length).toBeGreaterThan(0);
    for (const endpoint of new Set(claimed)) {
      const dir = join(process.cwd(), "src/app", endpoint);
      expect(
        readdirSync(dir),
        `${endpoint} is named on a badge but has no route`,
      ).toContain("route.ts");
    }
  });

  it("keeps a visual key that no module claims from compiling", () => {
    // The registry is a Record over the key union, so an orphaned key is a
    // build error rather than a blank panel. Asserted here as documentation
    // of *why* it is a Record and not a switch with a default.
    const keys: ContinuumVisualKey[] = CONTINUUM.map((m) => m.visual);
    for (const k of keys) expect(registrySource).toContain(`${k}:`);
  });
});
