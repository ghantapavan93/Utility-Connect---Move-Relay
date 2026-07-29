import { test, expect, type Page } from "@playwright/test";

/**
 * The drawings, and whether they actually say anything.
 *
 * Six glyphs and a travelling capsule are the most expensive thing on these
 * pages and the easiest to get silently wrong. Three failure modes have all
 * happened here:
 *
 *   Frozen        a `draw()` helper with two identical branches left every
 *                 scene at its unstarted state; the pages looked designed and
 *                 conveyed nothing
 *   Undifferentiated  one animation parameterised by colour, so a reviewer
 *                 learns six things happened and not what any of them was
 *   Overwritten   Framer animates `pathLength` by writing `stroke-dasharray`,
 *                 which silently clobbered a deliberately dashed conflict line
 *                 and rendered it identical to the verified ones
 *
 * None produces a type error, none fails a unit test, and none is visible in a
 * screenshot unless you already suspect it. So these assert difference: between
 * the six glyphs, between a glyph's states, and across the capsule's phases.
 * Difference is the only property that distinguishes a drawing from decoration.
 */

/**
 * A structural fingerprint of one drawing.
 *
 * Marks and their shape-defining attributes, not colours. Colour is the thing
 * an undifferentiated implementation *does* vary, so including it would let
 * exactly the failure this is looking for pass.
 */
async function signature(page: Page, ariaLabel: string) {
  return page.evaluate((label) => {
    const svg = [...document.querySelectorAll("svg")].find((s) =>
      (s.getAttribute("aria-label") ?? "").includes(label),
    );
    if (!svg) return null;
    return [...svg.querySelectorAll("path, circle, rect, line")]
      .map((el) =>
        [
          el.tagName,
          el.getAttribute("d") ?? "",
          el.getAttribute("cx") ?? "",
          el.getAttribute("cy") ?? "",
          el.getAttribute("r") ?? "",
          el.getAttribute("x") ?? "",
          el.getAttribute("width") ?? "",
          el.getAttribute("stroke-dasharray") ?? "",
        ].join(":"),
      )
      .join("|");
  }, ariaLabel);
}

/**
 * The capsule's *structure*, excluding anything animating per frame.
 *
 * The first version of the phase test used the full signature and passed with
 * the capsule hard-wired to ignore its phase — because a travelling dot rewrites
 * its own `cx` on every frame, so consecutive samples differed no matter what
 * the wire was doing. The check measured that an animation existed, which was
 * never in question.
 *
 * Paths and rects only: the two lanes, the severance marks, the gate leaves and
 * the record boxes. All of those change with phase and none of them moves on
 * its own, so a difference between samples means the drawing actually
 * responded.
 */
async function wireSignature(page: Page, ariaLabel: string) {
  return page.evaluate((label) => {
    const svg = [...document.querySelectorAll("svg")].find((s) =>
      (s.getAttribute("aria-label") ?? "").includes(label),
    );
    if (!svg) return null;
    return [...svg.querySelectorAll("path, rect")]
      .map((el) =>
        [
          el.tagName,
          el.getAttribute("d") ?? "",
          el.getAttribute("x") ?? "",
          el.getAttribute("width") ?? "",
          el.getAttribute("stroke-dasharray") ?? "",
        ].join(":"),
      )
      .join("|");
  }, ariaLabel);
}

const GLYPHS = [
  { tab: 0, label: "Two identical uploads collapsing" },
  { tab: 1, label: "One event delivered twice" },
  { tab: 2, label: "A workflow crashing after a checkpoint" },
  { tab: 3, label: "A cross-tenant read stopped" },
  { tab: 4, label: "Two concurrent writes" },
  { tab: 5, label: "A drifted payload separated" },
];

test.describe("six failures, six drawings", () => {
  test("each glyph is a different drawing, not one recoloured", async ({ page }) => {
    await page.goto("/theater");
    await expect(page.getByRole("tablist", { name: "Six ways to break it" })).toBeVisible();

    const seen = new Map<string, string>();
    for (const g of GLYPHS) {
      await page.getByRole("tab").nth(g.tab).click();
      const sig = await signature(page, g.label);
      expect(sig, `${g.label} did not render`).not.toBeNull();

      /*
        Structure only. Two glyphs differing solely in stroke colour would pass
        a naive check and still leave a reviewer unable to tell a duplicate
        batch from a cross-tenant read.
      */
      const clash = [...seen.entries()].find(([, s]) => s === sig);
      expect(clash, `${g.label} draws the same shapes as ${clash?.[0]}`).toBeUndefined();
      seen.set(g.label, sig!);
    }
    expect(seen.size).toBe(6);
  });

  test("a glyph changes when its attack returns", async ({ page }) => {
    await page.goto("/theater");
    const panel = page.locator("#attack-stage-panel");

    const before = await signature(page, GLYPHS[0]!.label);

    await panel.getByRole("button", { name: /^Break it/ }).click();
    await expect(panel.getByText("What happened")).toBeVisible({ timeout: 30_000 });
    // Let the settle animation finish so this compares two resting states.
    await page.waitForTimeout(1200);

    const after = await signature(page, GLYPHS[0]!.label);

    /*
      The load-bearing assertion. A glyph that looked the same before and after
      the server answered would be decoration — it would keep looking correct
      through any change to what the result actually was.
    */
    expect(after, "the glyph did not respond to the result").not.toBe(before);
  });

  test("a breach is drawn differently from a refusal", async ({ page }) => {
    await page.goto("/theater");
    const panel = page.locator("#attack-stage-panel");

    // stale_write, held.
    await page.getByRole("tab").nth(4).click();
    await panel.getByRole("button", { name: /^Break it/ }).click();
    await expect(panel.getByText("Unsafe outcome prevented")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    const held = await signature(page, GLYPHS[4]!.label);

    /*
      A breach cannot be produced against the hardened backend — every invariant
      holds, which is the point. Stubbing the route is the only honest way to
      reach the state, and the stub lives here where it cannot ship.
    */
    await page.route("**/api/v1/theater/stale_write", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          scenario: "stale_write",
          invariant: "A stale write updates zero rows.",
          outcome: "VIOLATION",
          evidence: { firstWriteRows: 1, secondWriteRows: 1 },
        }),
      }),
    );

    await panel.getByRole("button", { name: /^Break it again/ }).click();
    await expect(panel.getByText("Unsafe outcome occurred")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    const violated = await signature(page, GLYPHS[4]!.label);

    expect(violated, "a breach draws the same as a refusal").not.toBe(held);
  });
});

test.describe("the handoff capsule moves through its phases", () => {
  /*
    The per-stage drawing, which the sequence tests do not reach. They assert
    that eight facts arrive; this asserts the wire between us and the provider
    is drawn differently at each stage of arriving at them.
  */
  test("the wire is drawn differently at each stage", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "The signature incident" });
    const label = "The link between Move Relay and the provider";

    const idle = await wireSignature(page, label);
    expect(idle, "the capsule did not render").not.toBeNull();

    await section.getByRole("button", { name: /^Break the signature handoff/ }).click();

    /*
      Sampled while it runs. The states are transient by design — that is what
      makes them a sequence rather than a status field — so the only place to
      observe them is during the run.
    */
    const samples = new Set<string>();
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const s = await wireSignature(page, label);
      if (s) samples.add(s);
      if (await section.getByText(/It recovered because it preserved/).isVisible().catch(() => false)) break;
      await page.waitForTimeout(250);
    }

    await expect(section.getByText(/It recovered because it preserved/)).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(800);
    const confirmed = await wireSignature(page, label);

    // Idle, at least two states in between, and a settled end that is not idle.
    expect(samples.size, "the capsule looked the same throughout").toBeGreaterThanOrEqual(3);
    expect(confirmed, "the capsule ended where it started").not.toBe(idle);
  });

  test("the reply lane is broken while the outcome is unknown, and whole after", async ({ page }) => {
    await page.goto("/theater");
    const section = page.getByRole("region", { name: "The signature incident" });

    await section.getByRole("button", { name: /^Break the signature handoff/ }).click();

    /*
      The break marks exist only while the reply is lost. Two ticks pulling
      apart rather than a gap, so they are countable — a gap would be an absence
      and absences cannot be asserted from the DOM.
    */
    const brokenAtSomePoint = await (async () => {
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const marks = await page.evaluate(() => {
          const svg = [...document.querySelectorAll("svg")].find((s) =>
            (s.getAttribute("aria-label") ?? "").includes("The link between Move Relay"),
          );
          if (!svg) return 0;
          // The severance is drawn as two short diagonals near the mid-line.
          return [...svg.querySelectorAll("path")].filter((p) =>
            /^M\d+ 55 L\d+ 69$/.test((p.getAttribute("d") ?? "").trim()),
          ).length;
        });
        if (marks >= 2) return true;
        await page.waitForTimeout(200);
      }
      return false;
    })();

    expect(brokenAtSomePoint, "the reply lane never showed as severed").toBe(true);

    await expect(section.getByText(/It recovered because it preserved/)).toBeVisible({ timeout: 45_000 });
    await page.waitForTimeout(800);

    const stillBroken = await page.evaluate(() => {
      const svg = [...document.querySelectorAll("svg")].find((s) =>
        (s.getAttribute("aria-label") ?? "").includes("The link between Move Relay"),
      );
      if (!svg) return -1;
      return [...svg.querySelectorAll("path")].filter((p) =>
        /^M\d+ 55 L\d+ 69$/.test((p.getAttribute("d") ?? "").trim()),
      ).length;
    });
    expect(stillBroken, "the break survived reconciliation").toBe(0);
  });
});

test.describe("a conflicting line stays visibly conflicting", () => {
  /*
    Framer draws a path by animating `pathLength`, which it implements by
    writing `stroke-dasharray` — silently overwriting a dash set as a prop. The
    conflict line on the industries relay was rendered identical to the verified
    ones for exactly that reason, and it is invisible in review because the
    drawing still looks deliberate.
  */
  test("the conflicting channel is dashed, not drawn like the verified ones", async ({ page }) => {
    await page.goto("/industries/transaction-coordinators");

    const svg = page.locator('svg[aria-label*="Three sources converging"]').first();
    await svg.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);

    const lanes = await svg.evaluate((el) =>
      [...el.querySelectorAll("path")]
        .filter((p) => (p.getAttribute("d") ?? "").startsWith("M"))
        .map((p) => p.getAttribute("stroke-dasharray") ?? ""),
    );

    // Exactly one lane carries the deliberate 5 5 dash; the rest are drawn.
    const dashed = lanes.filter((d) => d.trim() === "5 5");
    expect(dashed.length, `expected one dashed lane, got ${JSON.stringify(lanes)}`).toBe(1);
  });
});
