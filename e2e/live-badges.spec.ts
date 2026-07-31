import { test, expect, type Page } from "@playwright/test";

/**
 * The diagram sits under "How it would work" and reads on first sight rather
 * than on mount — several of these pages carry one and none of them should
 * cost a request until someone is looking. Scrolling to the heading is what a
 * reader does; anything that skipped it would be testing a different app.
 */
async function revealDiagram(page: Page) {
  // "Step 01" is the first mechanism card, which sits directly *below* the
  // diagram — scrolling to it puts the whole stage in view rather than just
  // its top edge, which is what the observer's -15% margin asks for.
  await page.getByText(/^Step 01$/).scrollIntoViewIfNeeded();
}

/**
 * The word "live", verified in a real browser.
 *
 * A Continuum module page now opens with an operable diagram of its mechanism,
 * and each one carries a badge stating what it is. Two of them read a real
 * endpoint of the shipped system and name it; the rest say CONCEPT · NOT WIRED.
 *
 * That badge is the only thing standing between an honest diagram and a
 * persuasive animation, so it gets browser coverage rather than a unit test
 * alone: the failure that mattered — a 500 rendering as `live · /api/v1/stats`
 * — needed a real fetch, a real status code and a real intersection observer to
 * happen, and every one of those is absent from a simulated DOM (ADR-012).
 */

const RELAY = "/future/move-relay";

test.describe("a diagram may only say 'live' when the system answered", () => {
  test("names the endpoint and renders counts that came from it", async ({ page }) => {
    await page.goto(RELAY);
    await revealDiagram(page);

    const stage = page.locator("text=/live · \\/api\\/v1\\/stats/i");
    // The diagram reads on first sight, not on mount — so it has to be seen.
    await stage.scrollIntoViewIfNeeded().catch(() => {});
    await expect(stage).toBeVisible({ timeout: 20_000 });

    /*
      The badge alone would be satisfiable by a component that never used the
      response. These labels are interpolated from the validated body, so
      their presence is the proof that a real payload reached the drawing.
    */
    await expect(page.getByText(/\d+ SUBMISSIONS/)).toBeVisible();
    await expect(page.getByText(/\d+ OF \d+ CANONICAL/)).toBeVisible();
    await expect(page.getByText(/counted from the live tenant, not illustrated/i)).toBeVisible();
  });

  test("a 500 is reported as a failed read, never as live", async ({ page }) => {
    await page.route("**/api/v1/stats", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }),
    );
    await page.goto(RELAY);
    await revealDiagram(page);

    /*
      The exact defect. `fetch` does not reject on 5xx and Next's error bodies
      are JSON, so the old hook parsed it happily, set state to "ready", and
      the badge certified an empty diagram as live data.
    */
    await expect(page.getByText(/endpoint answered 500/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("text=/live · \\/api\\/v1\\/stats/i")).toHaveCount(0);
    // And no invented numbers underneath it.
    await expect(page.getByText(/counted from the live tenant/i)).toHaveCount(0);
  });

  test("a 200 carrying the wrong shape is refused too", async ({ page }) => {
    await page.route("**/api/v1/stats", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"stats":"soon"}' }),
    );
    await page.goto(RELAY);
    await revealDiagram(page);

    await expect(page.getByText(/unrecognised response/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("text=/live · \\/api\\/v1\\/stats/i")).toHaveCount(0);
  });

  test("an unwired module says so instead of implying a running system", async ({ page }) => {
    // Partner Growth is an interactive concept. Its diagram moves, which is
    // exactly why it has to admit that nothing is behind it.
    await page.goto("/future/partner-growth");

    await expect(page.getByText(/concept · not wired/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("text=/live · \\/api/i")).toHaveCount(0);
  });
});
