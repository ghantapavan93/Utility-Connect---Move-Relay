import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test configuration.
 *
 * `fileParallelism: false` is the load-bearing setting and it is deliberate.
 *
 * These suites do not run against mocks. They run against a real database —
 * embedded Postgres by default, a server when `RELAY_DB=pg` — and several of
 * them drive the same demo organization through reset, ingest and merge. Run in
 * parallel, two files race on one `organizations.slug` and the failure surfaces
 * as a unique-constraint violation in whichever suite lost, which reads like a
 * bug in the code under test rather than in the harness.
 *
 * The alternative is giving every suite its own tenant. That is the right
 * answer for a large codebase and the wrong trade here: the demo orchestrator
 * is a singleton *by design* — it is the thing a reviewer clicks through — and
 * testing it through a per-suite copy would mean the tests no longer exercise
 * the path that actually ships.
 *
 * The cost is a few seconds of wall clock on a suite that runs in well under a
 * minute. The benefit is that a red test means something.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    /*
      Isolation, made explicit rather than inherited.

      Under PGlite each test file gets its own in-memory database for free,
      because Vitest re-instantiates modules per file. The suite grew to depend
      on that without anyone deciding it should, and the dependency was
      invisible until the same tests ran against a real server and started
      seeing each other's rows.

      This hook gives every file its own PostgreSQL schema when `RELAY_DB=pg`,
      and does nothing under PGlite. It is a no-op for the zero-setup path and
      the thing that makes the real-server path trustworthy.
    */
    setupFiles: ["src/lib/__tests__/setup-pg-schema.ts"],
    // Vitest's default glob also matches the Playwright specs in `e2e/`. Left
    // alone it collects them, fails on the missing Playwright runtime, and
    // reports a broken unit suite for a browser test that was never its job.
    // The two runners share a repository, not a scope.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    fileParallelism: false,
    // Database work through a WASM Postgres is slower than an in-memory fake,
    // and a reset that drops and recreates a tenant is the slowest step here.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
