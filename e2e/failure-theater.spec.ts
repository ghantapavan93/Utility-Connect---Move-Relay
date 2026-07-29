import { test, expect, type Page } from "@playwright/test";

/**
 * The four claims that only a real document can settle.
 *
 * `resultLayers` and `verdictOf` are pure and covered by Vitest, which proves
 * the decisions are right. It cannot prove the component renders them, that the
 * ARIA wiring survives an edit, or that the evidence drawer stays out of the
 * live region — and those were checked by hand, which secures one afternoon and
 * nothing after it.
 *
 * ## Why the breach is stubbed
 *
 * A verdict of `violated` is unreachable against the hardened backend: every
 * invariant holds, which is the point. Reaching that branch honestly needs the
 * server to say VIOLATION, so these specs intercept the route and have it say
 * so. Nothing in the application changes, no safeguard is disabled, and no
 * production path exists that could produce this — the stub lives here, in the
 * test, where it cannot ship.
 */

const STALE_WRITE_TAB = 4;

/** What the server sends when an invariant genuinely did not hold. */
const breach = (evidence: Record<string, unknown>) => ({
  ok: true,
  scenario: "stale_write",
  invariant: "A stale write updates zero rows and surfaces as a conflict — never a silent overwrite.",
  outcome: "VIOLATION",
  evidence,
});

async function openTheater(page: Page) {
  await page.goto("/theater");
  await expect(page.getByRole("tablist", { name: "Six ways to break it" })).toBeVisible();
}

/** Select an attack and run it, returning the panel. */
async function runAttack(page: Page, index: number) {
  const tabs = page.getByRole("tab");
  await tabs.nth(index).click();
  const panel = page.locator("#attack-stage-panel");
  await panel.getByRole("button", { name: /^Break it/ }).click();
  return panel;
}

test.describe("a breach is reported as a breach", () => {
  test("shows the violation sentence and withholds every prevention claim", async ({ page }) => {
    await page.route("**/api/v1/theater/stale_write", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(breach({ firstWriteRows: 1, secondWriteRows: 1 })),
      }),
    );

    await openTheater(page);
    const panel = await runAttack(page, STALE_WRITE_TAB);

    // 1 — the success sentence is absent.
    await expect(panel.getByText("Unsafe outcome prevented")).toHaveCount(0);
    // The per-attack prevention copy must not appear anywhere either.
    await expect(panel.getByText(/The stale update was rejected/)).toHaveCount(0);

    // 2 — the violation sentence is rendered, in the server's own words.
    await expect(panel.getByText("Unsafe outcome occurred")).toBeVisible();
    await expect(panel.getByText(/never a silent overwrite/)).toBeVisible();
  });

  test("shows the breach evidence, reporting the unflattering numbers", async ({ page }) => {
    await page.route("**/api/v1/theater/stale_write", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(breach({ firstWriteRows: 1, secondWriteRows: 1 })),
      }),
    );

    await openTheater(page);
    const panel = await runAttack(page, STALE_WRITE_TAB);

    // 3 — the computed sentence reads the breach numbers, not reassuring ones.
    await expect(panel.getByText("What proves it")).toBeVisible();
    await expect(panel.getByText(/The stale write updated 1\./)).toBeVisible();

    // And the raw rows are reachable, showing the same value.
    await panel.getByRole("button", { name: "Inspect returned evidence" }).click();
    await expect(page.locator("#attack-evidence")).toContainText('"secondWriteRows": 1');
  });

  /*
    A breach whose evidence cannot support a claim still has to be reported. The
    difference between "a violation occurred" and "a violation occurred and here
    is the proof" is the whole reason `evidenceState` exists.
  */
  test("reports a breach with incomplete evidence, without claiming proof", async ({ page }) => {
    await page.route("**/api/v1/theater/stale_write", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        // Non-empty and plausible, but missing both row counts.
        body: JSON.stringify(breach({ survivingState: { state: "canonical", version: 2 } })),
      }),
    );

    await openTheater(page);
    const panel = await runAttack(page, STALE_WRITE_TAB);

    await expect(panel.getByText("Unsafe outcome occurred")).toBeVisible();
    await expect(panel.getByText("Evidence incomplete")).toBeVisible();
    await expect(panel.getByText("Violation reported. Supporting evidence was incomplete.")).toBeVisible();
    await expect(panel.getByText("What proves it")).toHaveCount(0);
    await expect(panel.getByText("Unsafe outcome prevented")).toHaveCount(0);
  });

  test("a dead server is inconclusive, never a breach", async ({ page }) => {
    await page.route("**/api/v1/theater/stale_write", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "simulated outage" }) }),
    );

    await openTheater(page);
    const panel = await runAttack(page, STALE_WRITE_TAB);

    await expect(panel.getByText("No verdict was reached")).toBeVisible();
    await expect(panel.getByText("Unsafe outcome occurred")).toHaveCount(0);
    await expect(panel.getByText("Unsafe outcome prevented")).toHaveCount(0);
    // Nothing to inspect, so nothing offered.
    await expect(panel.getByRole("button", { name: "Inspect returned evidence" })).toHaveCount(0);
  });
});

test.describe("selection and ARIA stay synchronised", () => {
  test("keyboard moves selection, focus and the panel together", async ({ page }) => {
    await openTheater(page);

    const tabs = page.getByRole("tab");
    const panel = page.locator("#attack-stage-panel");

    await tabs.first().focus();
    await expect(tabs.first()).toHaveAttribute("aria-selected", "true");

    for (const step of [1, 2]) {
      await page.keyboard.press("ArrowDown");

      const current = tabs.nth(step);
      await expect(current).toBeFocused();
      await expect(current).toHaveAttribute("aria-selected", "true");
      await expect(current).toHaveAttribute("tabindex", "0");

      // 4 — the panel names the tab that is actually selected.
      const id = await current.getAttribute("id");
      await expect(panel).toHaveAttribute("aria-labelledby", id!);
      await expect(panel.getByRole("heading", { level: 3 })).toHaveText(
        (await current.innerText()).trim(),
      );
    }

    // Exactly one tab stop and one selected tab, always.
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);

    await page.keyboard.press("End");
    await expect(tabs.last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.first()).toBeFocused();
  });

  test("the selected tab carries a cue that is not colour", async ({ page }) => {
    await openTheater(page);
    const tabs = page.getByRole("tab");

    const weight = (i: number) =>
      tabs.nth(i).locator("span:not([aria-hidden])").evaluate((el) => getComputedStyle(el).fontWeight);

    expect(await weight(0)).not.toBe(await weight(1));
  });
});

test.describe("raw evidence is never announced", () => {
  test("the evidence drawer sits outside the live region", async ({ page }) => {
    await openTheater(page);
    const panel = await runAttack(page, 0);

    await expect(panel.getByText("What happened")).toBeVisible();
    await panel.getByRole("button", { name: "Inspect returned evidence" }).click();

    const inside = await page.evaluate(() => {
      const live = document.querySelector('#attack-stage-panel [aria-live="polite"]');
      const pre = document.querySelector("#attack-evidence");
      return {
        contained: !!live && !!pre && live.contains(pre),
        preLive: pre?.closest("[aria-live]")?.getAttribute("aria-live") ?? null,
      };
    });

    expect(inside.contained).toBe(false);
    expect(inside.preLive).toBe("off");
  });
});

test.describe("the builder offers only what it can run", () => {
  test("is a radiogroup, and one choice at a time", async ({ page }) => {
    await page.goto("/theater");
    const group = page.getByRole("radiogroup", { name: "Which fault to introduce" });
    await expect(group).toBeVisible();

    const options = group.getByRole("radio");
    await expect(options).toHaveCount(8);
    await expect(group.locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
    await expect(group.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);

    await options.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toBeFocused();
    await expect(options.nth(1)).toHaveAttribute("aria-checked", "true");
  });

  /*
    The expectation has to be on screen before the run, or the comparison it
    invites is not a comparison — a page free to state the expectation after the
    fact can call any result the expected one.
  */
  test("states the expected outcome before anything is staged", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "Mutate a synthetic handoff" });

    await expect(section.getByText("Expected — stated before the run")).toBeVisible();
    await expect(section.getByText(/The second delivery replays/)).toBeVisible();
    await expect(section.getByRole("button", { name: "Inspect returned evidence" })).toHaveCount(0);
  });

  test("a dead server is inconclusive here too", async ({ page }) => {
    await page.route("**/api/v1/theater/builder", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "simulated outage" }) }),
    );

    await page.goto("/theater");
    const section = page.getByRole("region", { name: "Mutate a synthetic handoff" });
    await section.getByRole("button", { name: /^Stage this failure/ }).click();

    await expect(section.getByText("No verdict reached")).toBeVisible();
    await expect(section.getByText("Invariant violated")).toHaveCount(0);
    await expect(section.getByText("Invariant held")).toHaveCount(0);
  });
});

test.describe("the unsafe baseline stays labelled and scoped", () => {
  test("appears only after the stale-version run holds, and carries no verdict", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "Mutate a synthetic handoff" });

    await expect(section.getByText("Unsafe reference simulation")).toHaveCount(0);

    await section.getByRole("radio", { name: /stale record version/ }).click();
    // Selecting alone must not reveal it — only a completed, held run does.
    await expect(section.getByText("Unsafe reference simulation")).toHaveCount(0);

    await section.getByRole("button", { name: /^Stage/ }).click();
    await expect(section.getByText("Invariant held")).toBeVisible({ timeout: 30_000 });

    const label = section.getByText("Unsafe reference simulation");
    await expect(label).toBeVisible();
    await expect(section.getByText("not a backend · not evidence")).toBeVisible();

    // The simulation column offers no verdict, no evidence and no controls.
    const column = section.locator("div").filter({ hasText: "Unsafe reference simulation" }).last();
    await expect(column.getByRole("button")).toHaveCount(0);
    await expect(column.locator("pre")).toHaveCount(0);

    // Switching away removes it, so it can never sit beside another mechanism.
    await section.getByRole("radio", { name: /same intake batch/ }).click();
    await expect(section.getByText("Unsafe reference simulation")).toHaveCount(0);
  });
});
