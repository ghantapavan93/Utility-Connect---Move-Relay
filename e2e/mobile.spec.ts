import { test, expect, type Page } from "@playwright/test";

/**
 * The four ways this project has actually broken on a phone.
 *
 * Every check here corresponds to a defect that was found by measuring a real
 * page during development, not to a rule someone thought sounded prudent:
 *
 *   Content clipped and unreachable   a scenario card rendered 579px wide inside
 *                                     a 320px column, so the button on its right
 *                                     was off-screen behind `overflow-x-hidden`
 *   Labels collapsed to nothing       six instruments shrank to 40px with labels
 *                                     measuring zero, leaving identical squares
 *   Type scaled below reading         an SVG hero rendered its labels at 2.8px,
 *                                     and a diagram at 6.7px, because an SVG
 *                                     scales instead of reflowing
 *   Targets too small to hit          primary controls at 28px and 36px
 *
 * None produced a type error. None failed a unit test. All four are invisible
 * in a screenshot unless you already suspect them, which is why they survived as
 * long as they did — and why they are worth the cost of a browser test.
 *
 * 320 is included deliberately. Every one of these was either introduced or
 * made materially worse below 375, and a suite that only checks the common
 * phone width would have passed while the narrow case was broken.
 */

const WIDTHS = [320, 375] as const;

/** Routes that carry the drawings and controls the checks above are about. */
const ROUTES = [
  { path: "/theater", name: "failure theater" },
  { path: "/reliability", name: "reliability" },
  { path: "/industries/transaction-coordinators", name: "industries (longest name)" },
  { path: "/connect-flow", name: "connect flow" },
  { path: "/views", name: "audience lens" },
  { path: "/dashboard", name: "control room" },
] as const;

/**
 * Elements that carry text and extend past the viewport.
 *
 * Text-free decoration is excluded on purpose: several backdrops overscan by
 * design and are contained by an `overflow-x-hidden` ancestor, which is correct
 * and not what this is looking for. A *readable* thing past the right edge is
 * either clipped or forcing a scrollbar, and both are defects.
 */
async function clippedContent(page: Page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;

    /*
      Content inside a horizontal scroller is reachable, not clipped.

      A bounding rect reports an element's full extent even when an ancestor
      scrolls it, so a table deliberately placed in an `overflow-x-auto`
      container measures as 161px past the viewport while being perfectly
      usable — swipe it and the rest arrives. Reporting that as a defect sent me
      looking for a fault in a fix that was working.

      The distinction that matters is reachability: past the edge with no way to
      get there is a defect, past the edge inside a scroller is a design choice
      for content that does not wrap.
    */
    const insideScroller = (el: Element) => {
      let p = el.parentElement;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
        p = p.parentElement;
      }
      return false;
    };

    return [...document.querySelectorAll("main *")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.right <= vw + 1) return false;
        if (!(e.textContent ?? "").trim()) return false;
        return !insideScroller(e);
      })
      .slice(0, 6)
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        cls: String((e as HTMLElement).className ?? "").slice(0, 60),
        overflowPx: Math.round(e.getBoundingClientRect().right - vw),
        text: (e.textContent ?? "").trim().slice(0, 40),
      }));
  });
}

/**
 * Standalone controls under the 44px touch target.
 *
 * Inline links inside a sentence are exempt — WCAG 2.5.8 says so explicitly,
 * and padding one would break the line box it sits in. The exemption is by
 * computed display rather than by name, so it cannot quietly widen.
 */
async function smallTargets(page: Page) {
  return page.evaluate(() => {
    return [...document.querySelectorAll("main a, main button, main [role='tab'], main [role='radio']")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.height === 0) return false;
        if (getComputedStyle(e).display.startsWith("inline") && e.tagName === "A") return false;
        return r.height < 44;
      })
      .map((e) => ({
        text: (e.textContent ?? "").trim().slice(0, 30),
        height: Math.round(e.getBoundingClientRect().height),
      }));
  });
}

/**
 * SVG text below ten physical pixels.
 *
 * An SVG scales rather than reflows, so a viewBox wider than its container
 * shrinks every label inside it. Measuring the declared `font-size` would miss
 * this entirely — the number in the source was always 13, and what reached the
 * screen was 2.8. Rendered size is `fontSize × (renderedWidth ÷ viewBoxWidth)`.
 */
async function tinySvgText(page: Page) {
  return page.evaluate(() => {
    const out: Array<{ label: string; text: string; px: number }> = [];
    for (const svg of document.querySelectorAll("svg")) {
      const box = svg.getBoundingClientRect();
      const vb = svg.getAttribute("viewBox");
      if (!vb || box.width === 0) continue;
      const scale = box.width / Number(vb.split(/\s+/)[2]);
      for (const t of svg.querySelectorAll("text")) {
        const content = (t.textContent ?? "").trim();
        if (!content) continue;
        const px = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (px < 10) {
          out.push({
            label: (svg.getAttribute("aria-label") ?? "unlabelled").slice(0, 40),
            text: content.slice(0, 30),
            px: Number(px.toFixed(1)),
          });
        }
      }
    }
    return out;
  });
}

for (const width of WIDTHS) {
  test.describe(`at ${width}px`, () => {
    test.use({ viewport: { width, height: 812 } });

    for (const route of ROUTES) {
      test(`${route.name} — nothing is clipped, small or unreachable`, async ({ page }) => {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        /*
          Soft assertions, so one failure does not hide the other three.

          Checked sequentially, a page with both a small control and unreadable
          SVG text reported only the first — which is how a fix can look
          complete while a second defect on the same page is still there. All
          four run, all four report, and the test still fails.
        */
        const sideways = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        );
        expect.soft(sideways, "the page scrolls horizontally").toBe(false);
        expect.soft(await clippedContent(page), "readable content past the right edge").toEqual([]);
        expect.soft(await smallTargets(page), "standalone controls under 44px").toEqual([]);
        expect.soft(await tinySvgText(page), "SVG text under 10px").toEqual([]);
      });
    }
  });
}

/**
 * The regression that hid a button off-screen.
 *
 * A grid item defaults to `min-width: auto`, so a card was floored at its widest
 * descendant's min-content — an unwrapped block of JSON — and rendered nearly
 * twice the viewport width. The page clips overflow, so the right-hand side of
 * every scenario, including its control, was simply unreachable. The fix is
 * `min-w-0` on the grid and flex items; this is the assertion that keeps it.
 */
test.describe("expanded evidence cannot widen its column", () => {
  test.use({ viewport: { width: 320, height: 812 } });

  test("the evidence block scrolls itself instead of pushing the card open", async ({ page }) => {
    await page.goto("/theater");

    const panel = page.locator("#attack-stage-panel");
    await panel.getByRole("button", { name: /^Break it/ }).click();
    await expect(panel.getByText("What happened")).toBeVisible({ timeout: 30_000 });
    await panel.getByRole("button", { name: "Inspect returned evidence" }).click();

    /*
      The `<pre>` inside the disclosed region, not the region itself.

      `aria-controls` points at the whole region — heading and all — which is
      what a disclosure should reveal. The scroller is the `<pre>` within it, so
      that is what carries `overflow-x` and what has to be measured. Asserting
      against the wrapper reported `visible` and looked like a broken fix.
    */
    const pre = page.locator("#attack-evidence pre");
    await expect(pre).toBeVisible();

    const measured = await pre.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));

    // Wider content than box, contained by its own scroller — not by the card.
    expect(measured.overflowX).toBe("auto");
    expect(measured.scrollWidth).toBeGreaterThan(measured.clientWidth);
    expect(measured.clientWidth).toBeLessThanOrEqual(320);

    // And the control beside it stayed reachable.
    const button = panel.getByRole("button", { name: "Hide returned evidence" });
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  });
});

/**
 * The regression that made six controls indistinguishable.
 *
 * With `flex-1` the instruments shrank rather than wrapped: 40px wide, labels
 * measuring zero, so the only way to tell them apart was to press one. A
 * truncated label on a control is a control you cannot identify.
 */
test.describe("every control can be read, not just tapped", () => {
  for (const width of WIDTHS) {
    test.describe(`at ${width}px`, () => {
      test.use({ viewport: { width, height: 812 } });

      test("attack and mutation labels are never truncated", async ({ page }) => {
        await page.goto("/theater");

        const truncated = await page.evaluate(() => {
          const bad: Array<{ role: string; text: string; labelWidth: number }> = [];
          for (const el of document.querySelectorAll("[role='tab'], [role='radio']")) {
            const label = el.querySelector("span:not([aria-hidden])");
            if (!label) continue;
            const w = label.getBoundingClientRect().width;
            // Zero-width, or clipped by its own box.
            if (w < 60 || label.scrollWidth > label.clientWidth + 1) {
              bad.push({
                role: el.getAttribute("role") ?? "",
                text: (label.textContent ?? "").trim().slice(0, 30),
                labelWidth: Math.round(w),
              });
            }
          }
          return bad;
        });

        expect(truncated, "labels collapsed or clipped").toEqual([]);
      });
    });
  }
});
