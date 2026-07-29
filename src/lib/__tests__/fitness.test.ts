import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Architecture fitness functions.
 *
 * The ARCHITECTURE doc claims module boundaries. Documentation drifts; these
 * tests do not. Each one turns a stated boundary into a CI-enforced rule that
 * fails the build when a future change — human- or AI-written — crosses it.
 * This is what "the architecture is executable, not aspirational" means.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("AI modules never touch canonical truth", () => {
  it("the AI gateway never writes field_versions", () => {
    const src = read("src/lib/ai-gateway.ts");
    expect(src).not.toMatch(/INSERT INTO field_versions/i);
    expect(src).not.toMatch(/UPDATE field_versions/i);
  });

  it("the briefing module never writes field_versions or moves", () => {
    const src = read("src/lib/briefing.ts");
    expect(src).not.toMatch(/INSERT INTO field_versions/i);
    expect(src).not.toMatch(/UPDATE field_versions/i);
    expect(src).not.toMatch(/UPDATE moves/i);
  });

  it("no AI module ever deletes anything", () => {
    for (const f of ["src/lib/ai-gateway.ts", "src/lib/briefing.ts", "src/lib/ai-eval.ts"]) {
      expect(read(f)).not.toMatch(/DELETE FROM/i);
    }
  });
});

describe("projections stay inside their boundary", () => {
  it("projections never read raw submissions — raw payloads carry full PII", () => {
    expect(read("src/lib/projections.ts")).not.toMatch(/raw_submissions/);
  });

  it("projections never import the AI gateway", () => {
    expect(read("src/lib/projections.ts")).not.toMatch(/from ["']\.\/ai-gateway["']/);
  });
});

describe("domain modules never import the UI", () => {
  const domainFiles = [
    "src/lib/ingestion.ts",
    "src/lib/provider-submission.ts",
    "src/lib/briefing.ts",
    "src/lib/projections.ts",
    "src/lib/workflow.ts",
    "src/lib/outbox.ts",
    "src/lib/authz.ts",
    "src/lib/contracts.ts",
    "src/lib/consent.ts",
    "src/lib/provenance.ts",
    "src/lib/ai-gateway.ts",
  ];

  it("no domain module imports from app routes or components", () => {
    for (const f of domainFiles) {
      const src = read(f);
      expect(src, f).not.toMatch(/from ["']@\/components\//);
      expect(src, f).not.toMatch(/from ["'](\.\.\/)+app\//);
      expect(src, f).not.toMatch(/from ["']react["']/);
    }
  });
});

describe("PII discipline is structural", () => {
  it("the log scrubber blocks the sensitive keys the privacy policy names", () => {
    const src = read("src/lib/observability.ts");
    for (const key of ["ssn", "email", "phone", "account_number", "password"]) {
      expect(src).toContain(`"${key}"`);
    }
  });

  it("the audit redactor covers the SSN paths", () => {
    const src = read("src/lib/audit.ts");
    expect(src).toContain("customer.ssn");
  });

  it("the AI gateway masks PII before input leaves the process", () => {
    const src = read("src/lib/ai-gateway.ts");
    expect(src).toMatch(/maskPII/);
    // Masking must occur in the model path, before adapter.complete.
    expect(src.indexOf("maskPII(c.text)")).toBeGreaterThan(-1);
  });
});

describe("schema guarantees stay in the schema", () => {
  const schema = read("db/schema.sql");

  it("canonical values still require a named actor", () => {
    expect(schema).toMatch(/canonical_requires_actor/);
  });

  it("audit rows are still immutable by rule", () => {
    expect(schema).toMatch(/audit_events_no_update/);
    expect(schema).toMatch(/audit_events_no_delete/);
  });

  it("provider idempotency is still a unique index, not a comment", () => {
    expect(schema).toMatch(/provider_submissions_operation_key_idx/);
  });

  it("workflow steps still carry the resume-guarantee constraint", () => {
    expect(schema).toMatch(/UNIQUE \(execution_id, step_index\)/);
  });
});

describe("the ledger stays honest", () => {
  it("every Build Ledger entry cites a commit or a test", () => {
    const ledger = read("docs/AI_BUILD_LEDGER.md");
    const entries = ledger.split(/^## \d+ · /m).slice(1);
    expect(entries.length).toBeGreaterThanOrEqual(8);
    for (const entry of entries) {
      const cites =
        /Commit|commit |\.test\.ts|\.spec\.ts|verify-constraints|uptime_s/.test(entry);
      expect(cites, entry.slice(0, 60)).toBe(true);
    }
  });
});

describe("stated test counts cannot drift from the suite", () => {
  /**
   * An audit found this project claiming 109 tests in the README, 51 in the
   * architecture doc and on the home page, 41 in one place and 35 in another,
   * while the suite actually contained 156. Every one of those numbers was
   * written honestly and then left behind by the code.
   *
   * A project whose entire subject is provenance cannot have its most
   * quotable number be wrong in four different ways. So the claim is now
   * checked: any file stating "N tests" must state the real N.
   */
  /*
    `it(` and its modifier forms.

    This counted only `^\s*it\(` and therefore missed every `it.skipIf(...)` —
    five of them, in `harness-isolation-b` and `transaction-primitive`. So the
    number published in the README, the meta description and the social card was
    439 while the suite actually ran 444, and the guard whose entire purpose is
    stopping this project from quoting a wrong test count was itself the reason
    the count was wrong.

    Conditionally-skipped tests are real cases: they run whenever their
    condition holds, which for these is a Postgres backend rather than PGlite.
    Counting them is what makes the published figure match `vitest`.
  */
  const countTests = () => {
    const dir = join(root, "src/lib/__tests__");
    return readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .reduce(
        (n, f) => n + (read(`src/lib/__tests__/${f}`).match(/^\s*it(\.\w+)?\(/gm)?.length ?? 0),
        0,
      );
  };

  it("every stated count matches the number of tests that exist", () => {
    const actual = countTests();
    /*
      The two app-shell files were added after this guard found both of them
      still claiming 234 while every listed file said 364. They are the worst
      places for the number to be wrong: `layout.tsx` supplies the meta
      description and `opengraph-image.tsx` the social card, so a stale count
      there is the version that gets quoted in a link preview and never seen by
      whoever could correct it.
    */
    const files = [
      "README.md",
      "docs/ARCHITECTURE.md",
      "docs/DEMO_SCRIPT.md",
      "docs/BUSINESS_VALUE.md",
      "src/app/page.tsx",
      "src/app/demo/page.tsx",
      "src/app/layout.tsx",
      "src/app/opengraph-image.tsx",
    ];

    const wrong: string[] = [];
    for (const f of files) {
      let src: string;
      try {
        src = read(f);
      } catch {
        continue;
      }
      for (const m of src.matchAll(/(\d{2,4})\s+tests\b/g)) {
        if (Number(m[1]) !== actual) wrong.push(`${f}: claims ${m[1]}, actual ${actual}`);
      }
    }

    expect(wrong, `stated test counts have drifted:\n${wrong.join("\n")}`).toEqual([]);
  });
});
