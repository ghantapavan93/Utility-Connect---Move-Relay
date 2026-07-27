import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  STEP_IMAGE_KEYS,
  stepImage,
  missingStepImages,
  orphanStepImages,
} from "../step-images";

/**
 * The step illustrations, and the convention that keeps them attached.
 *
 * Nine images arrived under five different naming schemes — `Step-1.png`,
 * `Step-2 Detect Duplicates.png`, `3 · Create Move Record.png`, `Step 4 ·
 * Surface conflicts.png`, `Step-9.png`. Numbers, titles and separators all
 * drifting. Any page wired to those filenames would eventually show the wrong
 * picture for the right step, and would do it silently.
 *
 * They are keyed by step key now, which makes the *convention* checkable. This
 * file is the check: the set on disk must equal the set of steps the demo
 * actually walks, in both directions. A step with no image, or an image with no
 * step, fails here rather than showing a reviewer a blank panel.
 *
 * The step list is parsed out of the page rather than restated, for the same
 * reason the service catalogue is parsed out of the route audit: two hardcoded
 * copies agree with each other forever and prove nothing.
 */

const root = process.cwd();

/** The step keys the demo page actually walks, read from its own STEPS array. */
function stepKeysFromPage(): string[] {
  const src = readFileSync(join(root, "src/app/demo/page.tsx"), "utf8").replace(/\r\n/g, "\n");
  const start = src.indexOf("const STEPS: StepDef[] = [");
  expect(start, "the demo page must still declare a STEPS array").toBeGreaterThan(-1);
  const end = src.indexOf("];", start);
  const block = src.slice(start, end);
  return [...block.matchAll(/\{\s*key:\s*"([a-z_]+)"/g)].map((m) => m[1]!);
}

describe("every demo step has an illustration, and every illustration has a step", () => {
  it("parses the step list from the page rather than restating it", () => {
    const keys = stepKeysFromPage();
    expect(keys.length).toBeGreaterThan(0);
    // `reset` is plumbing and deliberately not one of the narrative steps.
    expect(keys).not.toContain("reset");
  });

  it("has no step without an image", () => {
    expect(missingStepImages(stepKeysFromPage())).toEqual([]);
  });

  it("has no image left behind by a step that no longer exists", () => {
    expect(orphanStepImages(stepKeysFromPage())).toEqual([]);
  });

  it("resolves each key to a file that is actually on disk", () => {
    // The manifest could agree with the page perfectly and still point at
    // nothing. This is the half that catches a missing or misnamed file.
    for (const key of STEP_IMAGE_KEYS) {
      const path = stepImage(key);
      expect(path, `${key} should resolve to a path`).toBe(`/steps/${key}.webp`);
      expect(
        existsSync(join(root, "public", path!)),
        `public${path} is referenced but missing from disk`,
      ).toBe(true);
    }
  });

  it("returns null for an unknown step rather than a broken path", () => {
    // A step without an image must render without one. Handing back a
    // plausible-looking path would ship a broken image box, which is the page
    // guessing about something it does not know.
    expect(stepImage("not_a_step")).toBeNull();
    expect(stepImage("reset")).toBeNull();
  });
});
