import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { unsafeLastWriteWins } from "../theater-baseline";

const source = readFileSync(join(process.cwd(), "src/lib/theater-baseline.ts"), "utf8");

/**
 * The unsafe baseline must stay incapable, not merely be trusted to behave.
 *
 * Its whole purpose is to depict a system without the guarantee — which makes
 * it the one file in this project that must never be able to reach anything
 * real. A comment saying so is worth nothing the day someone adds an import to
 * "make the comparison more realistic". These assertions are what make the
 * isolation a property of the build rather than of anyone's memory.
 */

describe("the unsafe baseline cannot touch anything", () => {
  /*
    The load-bearing assertion. No imports means no database handle, no auth
    path, no outbox, and nothing that could acquire one transitively — the
    isolation holds no matter what the rest of the codebase does.
  */
  it("imports nothing at all", () => {
    const imports = source.match(/^\s*import\s.+$/gm) ?? [];
    expect(imports, `theater-baseline.ts must have no imports, found:\n${imports.join("\n")}`).toEqual([]);
  });

  it("names no module that could reach real data", () => {
    for (const forbidden of ["./db", "./authz", "./provider-submission", "./outbox", "./intake", "./fulfillment", "pg", "node:"]) {
      expect(source.includes(`from "${forbidden}`), forbidden).toBe(false);
    }
  });

  it("contains no SQL and no query call", () => {
    expect(source).not.toMatch(/\b(SELECT|INSERT|UPDATE|DELETE|TRUNCATE)\b/);
    expect(source).not.toMatch(/\bquery\s*\(|withTransaction\s*\(/);
  });

  it("is synchronous — it cannot await anything, so it cannot call out", () => {
    expect(source).not.toMatch(/\basync\b|\bawait\b/);
  });
});

describe("the unsafe baseline is never mistaken for evidence", () => {
  const run = unsafeLastWriteWins();

  it("returns no evidence object and no verdict", () => {
    expect(run).not.toHaveProperty("evidence");
    expect(run).not.toHaveProperty("outcome");
    expect(run).not.toHaveProperty("invariant");
    expect(JSON.stringify(run)).not.toContain("VIOLATION");
  });

  it("models the harm it exists to show", () => {
    // Two writes, the second one wins, and nothing recorded that A ever wrote.
    expect(run.steps).toHaveLength(2);
    expect(run.steps[1]!.recordAfter).toBe(run.steps[1]!.wrote);
    expect(run.steps.every((s) => s.conflictSurfaced === false)).toBe(true);
    expect(run.steps[0]!.wrote).not.toBe(run.steps[1]!.wrote);
  });

  it("is deterministic, so the comparison never shifts under the reader", () => {
    expect(unsafeLastWriteWins()).toEqual(unsafeLastWriteWins());
  });
});

describe("only the theater surface may import it", () => {
  /*
    Scoped by construction rather than by convention. If this ever appears in a
    route, a service, or a page outside the theater components, the comparison
    has escaped the one surface where it is labelled — and an unlabelled
    unsafe simulation is indistinguishable from a claim about the product.
  */
  it("is imported by nothing outside src/components/theater", async () => {
    const { globSync } = await import("node:fs");
    const files = globSync("src/**/*.{ts,tsx}", { cwd: process.cwd() }) as string[];

    const importers = files.filter((f) => {
      const norm = f.replace(/\\/g, "/");
      if (norm.endsWith("theater-baseline.ts") || norm.includes("__tests__")) return false;
      return readFileSync(join(process.cwd(), f), "utf8").includes("theater-baseline");
    });

    for (const f of importers) {
      expect(f.replace(/\\/g, "/"), `${f} imports the unsafe baseline`).toMatch(
        /^src\/components\/theater\//,
      );
    }
  });
});
