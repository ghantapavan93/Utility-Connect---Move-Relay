import { test, expect } from "@playwright/test";

/**
 * The failure periphery, held to the same standard as the product.
 *
 * A critique found the three most reproducible failures a visitor can cause
 * were the least designed screens in the app: a dead route rendered Next's
 * stock 404, a dead move id offered a retry that would 404 forever, and the
 * /moves queue rendered a forced 500 as "No moves yet" — the calm-failure bug
 * this repository's own dashboard comments brag about fixing. Each spec here
 * fails against the pre-critique implementation.
 */

test.describe("the dead route is a designed page that reads the live tenant", () => {
  test("a typo'd URL offers the real records, not the framework default", async ({ page }) => {
    await page.goto("/definitely-not-a-route");

    // The stock page says "404 | This page could not be found." and nothing else.
    await expect(page.getByText(/the record you wanted probably does/i)).toBeVisible({
      timeout: 20_000,
    });

    /*
      The jaw-drop claim, verified: the 404 queried the database. The demo
      tenant always holds MR-referenced moves, so at least one real reference
      must be offered as a link — a hardcoded page cannot produce this.
    */
    await expect(page.locator('a[href^="/moves/"]').first()).toContainText(/MR-/, {
      timeout: 10_000,
    });

    // And the rooms are offered by name.
    await expect(page.getByRole("link", { name: /control room/i })).toBeVisible();
  });
});

test.describe("a dead move id is an existence answer, not a read failure", () => {
  test("offers the queue instead of a retry treadmill", async ({ page }) => {
    await page.goto("/moves/00000000-0000-4000-8000-000000000000");

    await expect(page.getByText(/no move lives at this id/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/read succeeded and the answer/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /current queue/i })).toBeVisible();

    // The old page offered "Read it again" here — a button that 404s forever.
    await expect(page.getByRole("button", { name: /read it again/i })).toHaveCount(0);
  });
});

test.describe("the move queue never renders a failed read as an empty one", () => {
  test("a 500 from the API produces the failure card, not 'No moves yet'", async ({ page }) => {
    await page.route("**/api/v1/moves", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/moves");

    await expect(page.getByText(/the queue could not be read/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/an unread queue is not an empty one/i)).toBeVisible();
    await expect(page.getByText(/no moves yet/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /read it again/i })).toBeVisible();
  });

  test("the work list holds only contested moves; Verified lives in Settled", async ({ page }) => {
    await page.route("**/api/v1/moves", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          moves: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              reference: "MR-SPEC-0001",
              state: "canonical",
              version: 2,
              openConflicts: 1,
              sources: 3,
              createdAt: new Date().toISOString(),
            },
            {
              id: "22222222-2222-4222-8222-222222222222",
              reference: "MR-SPEC-0002",
              state: "canonical",
              version: 3,
              openConflicts: 0,
              sources: 2,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      }),
    );
    await page.goto("/moves");

    /*
      The critique's provocative question, answered structurally and pinned:
      a Verified row cannot be *in* the work list, because the work list is a
      different list. The contested move sits under "Needs a decision" wearing
      the conflict badge; the settled canonical move sits under "Settled"
      wearing Verified — correct in both directions, in both sections.
    */
    const work = page.locator('[data-section="work"]');
    const settled = page.locator('[data-section="settled"]');

    const contested = work.locator("a", { hasText: "MR-SPEC-0001" });
    await expect(contested).toBeVisible({ timeout: 20_000 });
    await expect(contested).toContainText("Conflict");
    await expect(contested).not.toContainText("Verified");
    await expect(contested).toContainText("1 field needs a decision");

    const settledRow = settled.locator("a", { hasText: "MR-SPEC-0002" });
    await expect(settledRow).toBeVisible();
    await expect(settledRow).toContainText("Verified");

    // Neither move leaks into the other's section.
    await expect(work.locator("a", { hasText: "MR-SPEC-0002" })).toHaveCount(0);
    await expect(settled.locator("a", { hasText: "MR-SPEC-0001" })).toHaveCount(0);
  });
});
