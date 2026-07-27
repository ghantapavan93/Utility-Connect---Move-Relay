/**
 * Where a step's illustration lives, and why it is keyed the way it is.
 *
 * The nine images arrived named `Step-1.png`, `Step-2 Detect Duplicates.png`,
 * `3 · Create Move Record.png`, `Step 4 · Surface conflicts.png`, `Step-9.png`
 * — five different conventions across nine files, with numbers, titles, and
 * separators all drifting. Wiring the page to any of that would mean the next
 * image either collides with an existing name or attaches to the wrong step,
 * and nothing would fail loudly when it did.
 *
 * So the filename is the **step key** the application already uses, and nothing
 * else: `public/steps/<key>.webp`. Those keys are the same strings the demo API
 * routes on, so an image cannot drift from its step without the step itself
 * being renamed — and if that happens, `missingStepImages()` says so in a test
 * rather than a blank panel saying it on the page.
 *
 * Adding a tenth step is: add the step, drop `public/steps/<its-key>.webp`.
 * There is no index to renumber and no title to keep in sync.
 */

/** Every step key that currently has an illustration on disk. */
export const STEP_IMAGE_KEYS = [
  "ingest",
  "detect",
  "create_move",
  "conflicts",
  "merge",
  "briefing",
  "submit",
  "retry",
  "reconcile",
] as const;

export type StepImageKey = (typeof STEP_IMAGE_KEYS)[number];

const KEYS = new Set<string>(STEP_IMAGE_KEYS);

/**
 * The public path for a step's illustration, or null when it has none.
 *
 * Returning null rather than a placeholder path is deliberate: a step without
 * an image should render without one, not render a broken image box. The demo
 * is about not guessing when you do not know something.
 */
export function stepImage(stepKey: string): string | null {
  return KEYS.has(stepKey) ? `/steps/${stepKey}.webp` : null;
}

/**
 * Which of the given steps have no illustration.
 *
 * Exists so a test can assert the set on disk still matches the set of steps
 * the demo actually walks. Without it, adding a step is silently a step with a
 * blank stage, and the failure surfaces to a reviewer instead of to CI.
 */
export function missingStepImages(stepKeys: readonly string[]): string[] {
  return stepKeys.filter((k) => !KEYS.has(k));
}

/** Keys with an image on disk that no longer correspond to a real step. */
export function orphanStepImages(stepKeys: readonly string[]): string[] {
  const live = new Set(stepKeys);
  return STEP_IMAGE_KEYS.filter((k) => !live.has(k));
}
