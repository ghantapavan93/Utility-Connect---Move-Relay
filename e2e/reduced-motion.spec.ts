import { test, expect, type Page } from "@playwright/test";

/**
 * What a visitor who asked for stillness must still receive.
 *
 * The wrong reading of `prefers-reduced-motion` is "show less". These pages
 * carry their argument *in* the motion — a diagram draws to say a thing was
 * built, a capsule travels to say a request was made — so an implementation
 * that simply disabled the animation would leave a reviewer with an unbuilt
 * diagram and no information at all. Twice during development that is exactly
 * what happened: a `draw()` helper with two identical branches left seven
 * scenes frozen at their initial state, and nobody could see it in a
 * screenshot.
 *
 * So the rule is: stillness collapses pacing, never content. Every fact that
 * arrives with motion arrives without it, immediately, and nothing loops.
 *
 * Playwright sets the real media query, so these run the same code path a real
 * visitor with the OS setting gets — not a page-level toggle standing in for it.
 */

/*
  Set through `contextOptions`, which is where this Playwright version accepts
  it. Written as a bare `reducedMotion` option it type-checks as an unknown
  fixture and is silently ignored — every assertion below then measures the
  ordinary animated page and fails for reasons that have nothing to do with
  stillness, which is exactly what happened first time.
*/
test.use({ contextOptions: { reducedMotion: "reduce" } });

/** Fail loudly if the preference never reached the page. */
test.beforeEach(async ({ page }) => {
  await page.goto("about:blank");
  const applied = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  expect(applied, "the reduced-motion preference did not reach the browser").toBe(true);
});

/**
 * Diagrams must render *finished*, not unstarted.
 *
 * Framer draws a path by animating `pathLength`, which it implements by writing
 * `stroke-dasharray`. At rest that reads `1 1`; before the animation runs it
 * reads `0 1`. A still frame stuck at `0 1` is an empty diagram — the precise
 * failure that hid in this codebase for weeks.
 */
async function unstartedPaths(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("svg path")]
      .filter((p) => (p.getAttribute("stroke-dasharray") ?? "").trim() === "0 1")
      .map((p) => ({
        d: (p.getAttribute("d") ?? "").slice(0, 24),
        parent: p.closest("svg")?.getAttribute("aria-label")?.slice(0, 40) ?? "unlabelled",
      })),
  );
}

/**
 * Anything that is still moving.
 *
 * The first version of this asked `document.getAnimations()` for effects with
 * infinite iterations, which reads well and proves almost nothing here: Framer
 * animates `offsetDistance` — what every travelling pulse on these pages uses —
 * through requestAnimationFrame, so those animations never appear in that list
 * at all. Installing the defect it was written to catch left it green.
 *
 * So it measures movement instead. Sample the geometry of every candidate,
 * wait, sample again, and report whatever changed. That is the actual
 * requirement — a visitor who asked for stillness should find the page still —
 * and it is indifferent to which technology is doing the moving.
 */
async function movingElements(page: Page, settleMs = 700) {
  const sample = () =>
    page.evaluate(() =>
      [...document.querySelectorAll("svg circle, svg path, svg rect, [data-motion]")].map((el) => {
        const r = el.getBoundingClientRect();
        return [
          Math.round(r.x * 10) / 10,
          Math.round(r.y * 10) / 10,
          Math.round(r.width * 10) / 10,
          Math.round(r.height * 10) / 10,
          el.getAttribute("stroke-dasharray") ?? "",
          el.getAttribute("stroke-dashoffset") ?? "",
          getComputedStyle(el).opacity,
        ].join("|");
      }),
    );

  const before = await sample();
  await page.waitForTimeout(settleMs);
  const after = await sample();

  const moved: number[] = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (before[i] !== after[i]) moved.push(i);
  }
  // Report the count, not the indices — a diff of positions is unreadable.
  return { movedCount: moved.length, sampled: before.length };
}

/** CSS animations that never end. Caught by the WAAPI timeline; kept for those. */
async function endlessCssAnimations(page: Page) {
  return page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => a.playState === "running" && a.effect?.getTiming()?.iterations === Infinity)
      .map((a) => {
        const target = (a.effect as KeyframeEffect | undefined)?.target as Element | undefined;
        return {
          tag: target?.tagName.toLowerCase() ?? "unknown",
          cls: String((target as HTMLElement | undefined)?.className ?? "").slice(0, 40),
        };
      }),
  );
}

test.describe("the failure theater keeps its argument without moving", () => {
  test("diagrams render finished, and nothing orbits", async ({ page }) => {
    await page.goto("/theater");
    await page.waitForLoadState("networkidle");

    // Scroll the whole page so every scene has had its chance to be in view.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);

    expect.soft(await unstartedPaths(page), "diagrams left at their unstarted state").toEqual([]);
    expect.soft(await endlessCssAnimations(page), "a CSS animation is still looping").toEqual([]);

    const motion = await movingElements(page);
    expect.soft(motion.sampled, "nothing was sampled — the probe found no elements").toBeGreaterThan(20);
    expect.soft(motion.movedCount, "elements are still moving under reduced motion").toBe(0);
  });

  test("an attack still delivers all four sentences", async ({ page }) => {
    await page.goto("/theater");
    const panel = page.locator("#attack-stage-panel");

    await panel.getByRole("button", { name: /^Break it/ }).click();

    /*
      The whole result, not a reduced one. A visitor who asked for stillness is
      asking about motion, not about evidence — withholding the reasoning would
      answer a question they did not ask.
    */
    await expect(panel.getByText("What happened")).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByText("What was at risk")).toBeVisible();
    await expect(panel.getByText("Unsafe outcome prevented")).toBeVisible();
    await expect(panel.getByText("What proves it")).toBeVisible();

    await panel.getByRole("button", { name: "Inspect returned evidence" }).click();
    await expect(page.locator("#attack-evidence pre")).toBeVisible();
  });

  /*
    The signature incident is the sharpest case. Its facts are revealed on
    timers, and `beat()` collapses every one of them to zero under stillness —
    so the sequence has to complete, not be skipped.
  */
  test("the signature incident reaches all eight stages", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "The signature incident" });

    await section.getByRole("button", { name: /^Break the signature handoff/ }).click();

    /*
      Wait for the closing sentence, not for the word "Confirmed".

      All eight stage chips are in the DOM from the start and only change
      colour, so `getByText("Confirmed")` is visible before anything has run —
      the wait passed instantly and the count that followed was taken
      mid-sequence. The closing copy renders only once the run completes, so it
      is the only honest signal that the sequence finished.
    */
    await expect(section.getByText(/It recovered because it preserved enough identity/)).toBeVisible({
      timeout: 60_000,
    });

    const lit = await section.locator("ol li").evaluateAll((els) =>
      els.filter((e) => {
        const c = (e as HTMLElement).style.color;
        return c && !c.includes("0.3");
      }).length,
    );
    expect(lit, "not every stage was reached").toBe(8);

    // And a note that only appears mid-sequence still arrived on the way.
    await expect(section.getByText(/duplicate orders created: 0/)).toBeVisible();
  });

  test("the builder still states expected, then observed", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "Mutate a synthetic handoff" });

    await expect(section.getByText("Expected — stated before the run")).toBeVisible();
    await section.getByRole("button", { name: /^Stage this failure/ }).click();
    await expect(section.getByText("Invariant held")).toBeVisible({ timeout: 60_000 });
  });
});

test.describe("the audience lens keeps its argument without moving", () => {
  test("diagrams render finished, and nothing orbits", async ({ page }) => {
    await page.goto("/views");
    await page.waitForLoadState("networkidle");

    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(600);

    expect.soft(await unstartedPaths(page), "diagrams left at their unstarted state").toEqual([]);
    expect.soft(await endlessCssAnimations(page), "a CSS animation is still looping").toEqual([]);

    const motion = await movingElements(page);
    expect.soft(motion.sampled, "nothing was sampled — the probe found no elements").toBeGreaterThan(20);
    expect.soft(motion.movedCount, "elements are still moving under reduced motion").toBe(0);
  });

  test("switching audience still reconstructs the projection", async ({ page }) => {
    await page.goto("/views");
    await page.waitForLoadState("networkidle");

    const tabs = page.getByRole("tab");
    await tabs.nth(1).click();

    const panel = page.locator("#audience-panel");
    await expect(panel).toBeVisible();
    await expect(page.getByText("Projection manifest, as returned")).toBeVisible();

    // The lens reports real counts, which is the fact the motion was carrying.
    const label = await page
      .locator('svg[aria-label*="crossed the server boundary"]')
      .first()
      .getAttribute("aria-label");
    expect(label).toMatch(/\d+ fields crossed the server boundary, \d+ stayed behind it/);
  });

  test("field lineage still opens with its content", async ({ page }) => {
    await page.goto("/views");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "move.date" }).click();

    /*
      The drawer animates its height open. Under stillness it must be open and
      populated immediately — an `overflow-hidden` element stuck at height zero
      is content that exists in the DOM and reaches nobody.
    */
    await expect(page.getByText("Where this value came from")).toBeVisible();
    await expect(page.getByText("2026-08-16").first()).toBeVisible({ timeout: 15_000 });
  });

  test("a refusal still reads as a refusal", async ({ page }) => {
    await page.goto("/views");
    await page.waitForLoadState("networkidle");

    const section = page.getByRole("region", { name: "A forbidden view" });
    await section.getByRole("button", { name: /^Try a forbidden view/ }).click();

    await expect(section.getByText("No relationship. No view.")).toBeVisible({ timeout: 30_000 });
    await section.getByRole("button", { name: "Inspect denial evidence" }).click();
    await expect(page.locator("#denial-evidence")).toContainText("Projection generated");
  });
});
