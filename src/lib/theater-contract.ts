/**
 * What a Failure Theater scenario returns, and how it reports a breach.
 *
 * Separate from `theater.ts` because that module opens a database connection,
 * and the browser needs these two definitions. Sharing the constant is the
 * whole point — the scenarios write it and the scoreboard reads it, so a
 * rename propagates rather than silently turning the page green — but sharing
 * it through the module that imports `pg` pulled `dns` and `net` into the
 * client bundle and broke the production build.
 *
 * No imports here, deliberately. This file is the seam.
 */

export interface TheaterResult {
  scenario: string;
  invariant: string;
  outcome: string;
  evidence: Record<string, unknown>;
}

/**
 * The marker for an invariant that did not hold.
 *
 * A constant rather than six string literals, because the UI counts breaches by
 * matching this exact value. When the two are written independently, renaming
 * it turns the Failure Theater scoreboard permanently green — a page whose
 * entire purpose is to report the one result nobody wants to see would then be
 * structurally incapable of reporting it.
 */
export const VIOLATION = "VIOLATION";
