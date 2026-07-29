import { test, expect } from "@playwright/test";

/**
 * The control room, and the two things it must never say.
 *
 * A failed read rendered as a calm shift turns "we could not ask" into "nothing
 * needs attention". A consequential decision filed under automation claims the
 * system settled something on the never-automate list. Both are reachable by
 * ordinary implementations — the first by defaulting to zero, the second by
 * sorting items for visual balance — and neither shows in a screenshot.
 *
 * Routes are stubbed rather than waited for, because the states that matter are
 * the ones a healthy backend will not produce on demand.
 */

const STATS = (over: Record<string, number> = {}) => ({
  hasData: true,
  stats: {
    activeMoves: 1,
    canonicalMoves: 0,
    duplicatesPrevented: 0,
    openConflicts: 0,
    auditEvents: 3,
    aiBriefings: 0,
    ordersRecovered: 0,
    providerSubmissions: 0,
    ...over,
  },
});

const MOVE = (over: Record<string, unknown> = {}) => ({
  id: "m1",
  reference: "MR-TEST-0001",
  state: "canonical",
  version: 1,
  createdAt: new Date(0).toISOString(),
  sources: 3,
  openConflicts: 0,
  ...over,
});

const json = (body: unknown) => ({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify(body),
});

test.describe("the headline reports what the server returned", () => {
  test("a failed read is never an empty shift", async ({ page }) => {
    /*
      The unsafe implementation this catches is a `catch` that only logs: the
      page keeps its previous state, still looks calm, and the operator never
      learns the tenant became unreachable.
    */
    await page.route("**/api/v1/stats", (r) => r.fulfill({ status: 500, body: "{}" }));
    await page.goto("/dashboard");

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toContainText(/could not read the tenant/i);
    await expect(h1).not.toContainText(/no moves are active/i);
    await expect(page.getByText(/unanswered question/i)).toBeVisible();

    // And no lane may claim an emptiness it cannot know.
    await expect(page.getByText("Could not read this lane. Nothing here is known.").first()).toBeVisible();
  });

  test("metrics show a dash, not a zero, before the server answers", async ({ page }) => {
    await page.route("**/api/v1/stats", (r) => r.fulfill({ status: 500, body: "{}" }));
    await page.goto("/dashboard");
    /*
      A dashboard printing 0 while it is still asking has told the operator
      there is nothing to do, which it does not know.
    */
    await expect(page.locator("header p.font-mono").first()).toHaveText("—");
  });

  test("an empty tenant says it is empty", async ({ page }) => {
    await page.route("**/api/v1/stats", (r) => r.fulfill(json({ hasData: false, stats: null })));
    await page.route("**/api/v1/moves", (r) => r.fulfill(json({ moves: [] })));
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/no moves are active/i);
  });
});

test.describe("the batch is read from the response", () => {
  test("counts come from the server, not from the fixture", async ({ page }) => {
    /*
      The sample file has five rows and normally lands 4/1/0/0. Returning
      2/1/1/1 proves the tiles read the response: an implementation rendering
      the known fixture shape would show 4 and 1 here, and would pass any test
      that only ever ran the real batch.
    */
    await page.route("**/api/v1/upload/csv", (r) =>
      r.fulfill(
        json({
          ok: true,
          rows: { total: 5, accepted: 2, quarantined: 1, replayed: 1, unmappable: 1 },
          results: [{ line: 3, status: "quarantined", issues: [{ path: "customer.email", message: "invalid email" }] }],
        }),
      ),
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Process the sample partner batch/i }).click();

    const section = page.locator('[aria-labelledby="batch-heading"]');
    await expect(section.getByText("Held for review")).toBeVisible({ timeout: 30_000 });

    const counts = await section.locator("p.font-mono").allTextContents();
    const numeric = counts.filter((c) => /^\d+$/.test(c.trim()));
    expect(numeric, "the tiles did not read the returned counts").toEqual(["2", "1", "1", "1"]);
  });

  test("one result feeds every surface", async ({ page }) => {
    await page.route("**/api/v1/upload/csv", (r) =>
      r.fulfill(
        json({
          ok: true,
          rows: { total: 5, accepted: 3, quarantined: 2, replayed: 0, unmappable: 0 },
          results: [
            { line: 4, status: "quarantined", issues: [{ path: "customer.email", message: "invalid email" }] },
            { line: 5, status: "quarantined", issues: [{ path: "move.date", message: "expected YYYY-MM-DD" }] },
          ],
        }),
      ),
    );

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /Process the sample partner batch/i }).click();
    await expect(page.locator('[aria-labelledby="batch-heading"]').getByText("Held for review")).toBeVisible({
      timeout: 30_000,
    });

    // The lanes read the same numbers rather than counting for themselves.
    const lanes = page.locator('[aria-labelledby="lanes-heading"]');
    await expect(lanes.getByText("3 rows accepted and committed")).toBeVisible();
    await expect(lanes.getByText("2 rows held at the contract")).toBeVisible();
    // And the brief quotes the contract's own words rather than paraphrasing.
    await expect(page.getByText(/customer\.email did not satisfy the declared contract/i)).toBeVisible();
  });
});

test.describe("authority is not automation", () => {
  test("a contested field is never filed as handled", async ({ page }) => {
    await page.route("**/api/v1/moves", (r) => r.fulfill(json({ moves: [MOVE({ openConflicts: 2, state: "conflict_pending" })] })));
    await page.route("**/api/v1/stats", (r) => r.fulfill(json(STATS({ openConflicts: 2 }))));

    await page.goto("/dashboard");
    const lanes = page.locator('[aria-labelledby="lanes-heading"]');

    await expect(lanes.getByText(/Two sources disagree/i)).toBeVisible();
    /*
      The exact boundary from CLAUDE.md. An implementation that sorted items for
      visual balance could land this in automation and look tidier doing it.
    */
    await expect(lanes.getByText(/may not perform the merge/i)).toBeVisible();

    // Targeted by `data-lane` rather than by text. Filtering a container by the
    // words it contains matched the grid holding all three lanes, so the
    // assertion passed against the wrong element.
    await expect(lanes.locator('[data-lane="automation"]').getByText(/Two sources disagree/i)).toHaveCount(0);
    await expect(lanes.locator('[data-lane="authority"]').getByText(/Two sources disagree/i)).toBeVisible();
  });

  test("the AI boundary travels with the brief", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("AI recommendation only. No record was changed by the AI.")).toBeVisible();
  });
});

test.describe("the map is drawn from data", () => {
  test("no selected move draws no channels", async ({ page }) => {
    await page.route("**/api/v1/moves", (r) => r.fulfill(json({ moves: [] })));
    await page.goto("/dashboard");
    /*
      The version this replaced drew Partner API, CSV, Customer form, Microsite
      and Concierge whatever the tenant contained, four of them with a state
      that never changed. With no move selected there is nothing to draw.
    */
    // Present in both the map header and the mobile path list.
    await expect(page.getByText("no move selected").first()).toBeVisible();
  });

  test("there is no WebGL canvas on this page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    // The project permits one signature 3D surface and it belongs to /story.
    expect(await page.locator("canvas").count()).toBe(0);
  });
});

test.describe("the merge is a human decision, not a click-through", () => {
  const CONFLICT = {
    move: { id: "m1", reference: "MR-TEST-0001", state: "conflict_pending", version: 2 },
    conflicts: [
      {
        fieldPath: "move.date",
        candidates: [
          { fieldPath: "move.date", value: "2026-12-01", channel: "partner_api", verification: "unverified", confidence: 0.5, recordedAt: new Date(0).toISOString() },
          { fieldPath: "move.date", value: "2026-12-05", channel: "customer_form", verification: "customer_confirmed", confidence: 0.9, recordedAt: new Date(1).toISOString() },
        ],
        recommended: { fieldPath: "move.date", value: "2026-12-05", channel: "customer_form", verification: "customer_confirmed", confidence: 0.9, recordedAt: new Date(1).toISOString() },
        reason: "Highest verification, then most recent.",
      },
    ],
  };

  const withConflict = async (page: import("@playwright/test").Page) => {
    await page.route("**/api/v1/moves", (r) => r.fulfill(json({ moves: [MOVE({ openConflicts: 1, state: "conflict_pending" })] })));
    await page.route("**/api/v1/stats", (r) => r.fulfill(json(STATS({ openConflicts: 1 }))));
    await page.route("**/api/v1/moves/*/conflicts", (r) => r.fulfill(json(CONFLICT)));
  };

  test("nothing is preselected, not even the suggestion", async ({ page }) => {
    await withConflict(page);
    await page.goto("/dashboard");

    const merge = page.locator("[data-merge-approval]");
    await expect(merge.getByText("Suggested")).toBeVisible({ timeout: 20_000 });

    /*
      The load-bearing assertion. Defaulting to the recommendation turns one
      click into approval of a machine's choice — the operator would commit a
      decision they never made, which is precisely what the never-automate list
      exists to prevent. A tidier implementation reaches for that default.
    */
    const radios = merge.locator("fieldset input[type=radio]");
    for (let i = 0; i < (await radios.count()); i++) {
      await expect(radios.nth(i)).not.toBeChecked();
    }

    // And the control refuses to commit while nothing has been decided.
    await expect(merge.getByRole("button", { name: /Commit as concierge/i })).toBeDisabled();
    await expect(merge.getByText(/Choose a value and give a reason/i)).toBeVisible();
  });

  test("a reason is required before anything can be committed", async ({ page }) => {
    await withConflict(page);
    await page.goto("/dashboard");

    const merge = page.locator("[data-merge-approval]");
    await merge.locator("fieldset input[type=radio]").first().check();
    /*
      A value alone is not enough. `selection_reason` is stored beside the actor,
      and a canonical value whose justification is blank is a decision nobody can
      review — so the button stays disabled until one is given.
    */
    await expect(merge.getByRole("button", { name: /Commit as concierge/i })).toBeDisabled();

    await merge.locator('input[placeholder*="Recorded beside"]').fill("Partner feed confirmed by phone.");
    await expect(merge.getByRole("button", { name: /Commit as concierge/i })).toBeEnabled();
  });

  test("a stale merge is reported as someone else's commit, never as an error", async ({ page }) => {
    await withConflict(page);
    await page.route("**/api/v1/moves/*/merge", (r) =>
      r.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "move was modified since it was read", currentVersion: 3 }),
      }),
    );

    await page.goto("/dashboard");
    const merge = page.locator("[data-merge-approval]");
    await merge.locator("fieldset input[type=radio]").first().check();
    await merge.locator('input[placeholder*="Recorded beside"]').fill("Partner feed is authoritative.");
    await merge.getByRole("button", { name: /Commit as concierge/i }).click();

    /*
      The version check firing is the system working. Rendering it as a failure
      would teach an operator to retry over a colleague's decision, which is the
      silent overwrite the check exists to prevent.
    */
    await expect(merge.getByText("Someone else resolved this first.")).toBeVisible({ timeout: 20_000 });
    await expect(merge.getByText(/is now at version 3/)).toBeVisible();
    await expect(merge.getByText(/Nothing was written/)).toBeVisible();
    await expect(merge.getByRole("button", { name: /Re-read the conflicts/i })).toBeVisible();
  });

  test("the authority boundary is stated on the control itself", async ({ page }) => {
    await withConflict(page);
    await page.goto("/dashboard");
    await expect(
      page.locator("[data-merge-approval]").getByText(/AI may explain this conflict\. It may not perform the merge\./),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("no merge control appears on a move with nothing contested", async ({ page }) => {
    await page.route("**/api/v1/moves", (r) => r.fulfill(json({ moves: [MOVE({ openConflicts: 0 })] })));
    await page.route("**/api/v1/stats", (r) => r.fulfill(json(STATS())));
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-merge-approval]")).toHaveCount(0);
  });
});
