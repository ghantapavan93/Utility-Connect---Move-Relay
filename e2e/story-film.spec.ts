import { test, expect } from "@playwright/test";

/**
 * The film, held together in a real browser.
 *
 * This spec exists because its probe ancestor caught a broken frame the type
 * checker could not: drei's PCSS injection referenced a GLSL function three
 * r185 no longer defines, every standard material failed to compile, and the
 * only witness was a console error during a real render. So the film's
 * regression net is exactly that — drive the whole scroll, listen to the
 * console, and check the beats that carry the story.
 *
 * The GPU flags matter: under SwiftShader this scene composites at ~40s per
 * frame and the suite would spend its entire budget waiting. ANGLE-on-D3D11
 * uses the real GPU on Windows; elsewhere the flags are ignored and the
 * timeouts absorb the difference.
 */

test.use({
  launchOptions: {
    args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"],
  },
});

test("the walk renders without a shader failure, and the beats land", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => errors.push(`PAGEERROR ${e.message.slice(0, 300)}`));

  await page.setViewportSize({ width: 1440, height: 810 });
  await page.goto("/story");
  await page.waitForTimeout(4000);

  // The letterbox is part of the film's grammar, present from the first frame.
  await expect(page.locator("[data-letterbox]")).toHaveCount(2);

  // Walk the film. The rig is critically damped, so each stop gets time to
  // arrive before the next — scrubbing instantly would test a camera state
  // no viewer ever sees.
  for (const p of [0.08, 0.14, 0.22, 0.3, 0.4, 0.5, 0.62, 0.72]) {
    await page.evaluate((v) => {
      const total = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo(0, total * v);
    }, p);
    await page.waitForTimeout(1400);
  }

  /*
    At the garage beat the caption must exist and carry the chapter's words —
    the anchored placement and the lower-third fallback render the same
    CardBody, so this passes wherever the card happens to sit, and fails if
    the caption system as a whole comes apart.
  */
  await page.evaluate(() => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo(0, total * 0.14);
  });
  await page.waitForTimeout(2200);
  await expect(page.getByText(/one move can begin in several places/i)).toBeVisible();

  /*
    Zero console errors across the whole walk. A WebGL scene fails by logging
    and drawing garbage, not by throwing — this assertion is the only place
    the suite would ever see a broken shader, a lost context, or a texture
    that failed to upload.
  */
  expect(errors, `console errors during the film:\n${errors.join("\n")}`).toEqual([]);
});
