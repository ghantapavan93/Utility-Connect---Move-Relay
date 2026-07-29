import { defineConfig, devices } from "@playwright/test";

/**
 * Browser-level regression coverage for the Failure Theater.
 *
 * Everything decidable in a pure function is already covered by Vitest —
 * `verdictOf`, `resultLayers`, `establishesInvariant` and the six scenarios all
 * have assertions that go red when the logic is wrong. What none of them can
 * reach is whether the component renders what those functions return, and
 * whether the ARIA wiring survives an edit. Those were verified by hand in a
 * browser, which is not a regression barrier: it proves the state of one
 * afternoon and nothing about the next change.
 *
 * Deliberately narrow. This is not a second test suite competing with Vitest —
 * it covers the four claims that can only be checked in a real document, and
 * stops. Every additional spec here is slower and more brittle than the unit
 * test that could have replaced it.
 */
export default defineConfig({
  testDir: "./e2e",
  /*
    One worker, and no retries. These specs drive a live database through the
    real API — parallel workers would run scenarios against shared provider and
    outbox state, and a retry that passes on the second attempt would hide
    exactly the flake worth knowing about.
  */
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /*
    Reuses a dev server if one is already listening, so running these locally
    while working does not fight the server already open. In CI it starts its
    own against a production build.
  */
  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000/theater",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
