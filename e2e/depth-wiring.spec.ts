import { test, expect } from "@playwright/test";

/**
 * The cross-panel wiring, verified in a browser that actually composites.
 *
 * These interactions are scroll- and pointer-driven, and the development
 * environment this repository is sometimes driven from delivers neither —
 * a non-displayed pane dispatches no scroll events, no IntersectionObserver
 * callbacks and no animation frames, which is how the thesis scrollspy was
 * first "verified" dark: the geometry read once and froze, and every probe
 * saw the same stale pip. Real Chromium is the only honest referee for this
 * class of behaviour, which is exactly the boundary ADR-012 draws.
 */

test.describe("the thesis page's panels talk to each other", () => {
  test("the horizon pip follows scroll", async ({ page }) => {
    await page.goto("/future/thesis");
    const pip = page.locator('ol[aria-label="Current horizon"]');
    await expect(pip).toBeVisible({ timeout: 20_000 });

    /*
      Position each section deterministically inside the 30% reading band —
      `scrollIntoViewIfNeeded` refuses to move when the target is already
      visible, which made the first version of this spec test its own scroll
      position rather than the feature. Reading horizon 3 must light its pip,
      and returning to horizon 0 must hand the light back: a scrollspy that
      only ever advances is a scrollspy that read the page once.
    */
    const readAt = (id: string) =>
      page.evaluate((headingId) => {
        const sec = document.getElementById(headingId)!.closest("section")!;
        const r = sec.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + r.top - window.innerHeight * 0.15);
      }, id);

    await readAt("h3-heading");
    await expect(pip).toContainText(/platform expansion/i, { timeout: 5_000 });

    await readAt("h0-heading");
    await expect(pip).toContainText(/built now/i, { timeout: 5_000 });
  });

  test("selecting a failure lights exactly its containing layers", async ({ page }) => {
    await page.goto("/future/thesis");

    await page.getByRole("button", { name: "Cross-tenant request" }).click();

    const arch = page.locator("section", { has: page.locator("#arch-heading") });
    const lit = arch.locator("li", { hasText: "contains it" });
    /*
      Exactly one layer contains a cross-tenant request, and it is the
      authorization layer. More than one lit row means the name-matching
      widened; zero means it silently unwired — both are the defect this
      spec exists to catch.
    */
    await expect(lit).toHaveCount(1);
    await expect(lit).toContainText("Identity and relationship authorization");

    // And the others recede rather than compete.
    const dimmed = arch.locator('ol > li[style*="0.35"]');
    await expect(dimmed).toHaveCount(12);

    // Deselecting restores the stack.
    await page.getByRole("button", { name: "Cross-tenant request" }).click();
    await expect(lit).toHaveCount(0);
  });
});

test.describe("the agent's investigation and boundary are one surface", () => {
  test("hovering a stage spotlights its node in the boundary diagram", async ({ page }) => {
    await page.goto("/agent");
    await page
      .getByRole("button", { name: /investigate and prepare/i })
      .click({ timeout: 20_000 });

    const stages = page.locator('ol[aria-label="Investigation steps"] li');
    await expect(stages.first()).toBeVisible({ timeout: 30_000 });

    const svg = page.locator('svg[aria-label^="Authority boundary"]');
    await expect(svg).toBeVisible();

    // Hover the first read stage: its node grows to r=7 and the others fade.
    await stages.first().hover();
    await expect(svg.locator('circle[r="7"]').first()).toBeVisible({ timeout: 3_000 });
    await expect(svg.locator('g[opacity="0.3"]').first()).toBeVisible();

    // Leaving restores every node — the spotlight is a conversation, not a state.
    await page.mouse.move(0, 0);
    await expect(svg.locator('g[opacity="0.3"]')).toHaveCount(0, { timeout: 3_000 });
  });
});

test.describe("the investigation streams as it executes", () => {
  test("stages arrive incrementally, and the package only after the close", async ({ page }) => {
    await page.goto("/agent");
    await page
      .getByRole("button", { name: /investigate and prepare/i })
      .click({ timeout: 20_000 });

    /*
      The wire was proven to deliver five distinct chunks across ~800ms; this
      asserts the page honours them. Sampling the rendered stage count on a
      tight interval must observe at least three distinct values before the
      decision package exists — a page that buffered the stream and painted
      once would show zero, then everything, and this test would go red. The
      package must never precede the closing event: a conclusion drawn from a
      half-read investigation is the overstatement the whole layer refuses.
    */
    const stages = page.locator('ol[aria-label="Investigation steps"] li');
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const count = await stages.count();
      if (count > 0) seen.add(count);
      const packageUp = (await page.locator("#decision-heading").count()) > 0;
      if (packageUp) {
        expect(seen.size, `stage counts observed: ${[...seen].join(",")}`).toBeGreaterThanOrEqual(3);
        return;
      }
      await page.waitForTimeout(40);
    }
    throw new Error("investigation never completed");
  });
});
