import { test, expect } from "@playwright/test";

/**
 * The two surfaces whose whole job is showing you the rows.
 *
 * A critique sweep found both of them reading without checking the status, on
 * the site whose central argument is that a failed read must never render as a
 * calm one. They are the worst two places in the app for that bug, because
 * both exist specifically to prove the system is inspectable — and both
 * answered a 500 by inventing a reassuring answer.
 */

test.describe("the engineering panel does not invent a clean queue", () => {
  test("a 500 is stated, and no queue depths are printed", async ({ page }) => {
    await page.route("**/api/v1/engineering", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }),
    );
    await page.goto("/demo");

    await page.getByRole("button", { name: /reveal system/i }).click();

    await expect(page.getByText(/the system could not be read/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/this panel does not currently know/i)).toBeVisible();

    /*
      The exact defect. Both lookups ended in `?? 0`, so an error body flowed
      straight into "outbox backlog: 0 · quarantine: 0" — the panel that
      exists to prove the system is inspectable, quietly making a number up.
    */
    await expect(page.getByText(/outbox backlog/i)).toHaveCount(0);
    await expect(page.getByText(/quarantine:/i)).toHaveCount(0);
  });

  test("a healthy read still shows the rows", async ({ page }) => {
    // The other direction, so the fix cannot be "always show the error".
    await page.goto("/demo");
    await page.getByRole("button", { name: /reveal system/i }).click();

    await expect(page.getByText(/outbox backlog/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/the system could not be read/i)).toHaveCount(0);
  });
});

test.describe("the provenance drawer distinguishes failed from empty", () => {
  test("a 500 is not reported as a field with no history", async ({ page }) => {
    await page.route("**/api/v1/provenance**", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }),
    );
    await page.goto("/demo");

    // The field table only exists once the tenant holds a move. Opening any
    // row is what a reviewer does; which row is not the point.
    const field = page.locator("[data-field-row]").first();
    await expect(field).toBeVisible({ timeout: 30_000 });
    await field.click();

    await expect(page.getByText(/history could not be read/i)).toBeVisible({ timeout: 20_000 });
    /*
      What it used to say instead: "No history for this field yet — run the
      demo first." An instruction that would not have helped, given to someone
      whose database had just stopped answering, by the component whose entire
      job is proving where a value came from.
    */
    await expect(page.getByText(/no history for this field yet/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /read it again/i })).toBeVisible();
  });
});
