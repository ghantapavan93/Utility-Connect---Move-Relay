/**
 * An unsafe reference simulation. Not a system, not a backend, not evidence.
 *
 * The builder can show that a guarantee held. It cannot show what the absence
 * of that guarantee would have cost, because the hardened backend has no path
 * that lets an unsafe outcome through — and building one would be the single
 * most destructive thing that could be done to this project. A "demo mode" that
 * disables a safeguard is exactly the pattern the whole system argues against,
 * and it would exist in the same codebase as the code that refuses to guess.
 *
 * So the comparison is drawn against arithmetic instead. What follows is a
 * fifteen-line model of last-write-wins: two updates, no version column, no
 * conflict. It is what most systems do, written out so the difference is
 * visible.
 *
 * ## What guarantees this is inert
 *
 * There are no imports. Not `db`, not `authz`, not `provider-submission`, not
 * `outbox`. It cannot open a connection, cannot reach a tenant, cannot write a
 * row, and cannot call anything that can. That is not a policy in a comment —
 * an import-graph test asserts this file's dependency list stays empty, so the
 * property survives whoever edits it next.
 *
 * ## What guarantees it is never mistaken for evidence
 *
 * It returns no `evidence` object and no verdict. The UI renders it in its own
 * column under an explicit label, with no proof sentence and no inspect
 * control. A reader who scans only the headings sees the word "simulated"
 * before they see any result.
 */

export interface BaselineStep {
  /** Who wrote, in the same vocabulary the live panel uses. */
  actor: string;
  /** What they set the field to. */
  wrote: string;
  /** The record's value immediately after, under last-write-wins. */
  recordAfter: string;
  /** Whether anything recorded that a second writer existed. */
  conflictSurfaced: boolean;
}

export interface BaselineRun {
  title: string;
  /** The rule being modelled, stated plainly. */
  rule: string;
  steps: BaselineStep[];
  /** The outcome in one sentence, in business terms. */
  consequence: string;
}

/**
 * Two concierges, one record, no version column.
 *
 * Deliberately the same scenario the live backend runs, so the two columns
 * differ in exactly one variable: whether the write is conditional on the
 * version that was read.
 */
export function unsafeLastWriteWins(): BaselineRun {
  const readValue = "469-555-0142";
  let record = readValue;

  const steps: BaselineStep[] = [];

  // Concierge A corrects a transposed digit.
  const a = "469-555-0142";
  record = a;
  steps.push({ actor: "Concierge A", wrote: a, recordAfter: record, conflictSurfaced: false });

  /*
    Concierge B saves from the same read, unaware of A's correction. With no
    version check there is nothing for the write to be conditional on, so it
    lands — and the correction is gone with no trace that it ever existed.
  */
  const b = "469-555-0124";
  record = b;
  steps.push({ actor: "Concierge B", wrote: b, recordAfter: record, conflictSurfaced: false });

  return {
    title: "Last write wins",
    rule: "The update is unconditional. There is no version to check, so there is nothing to reject.",
    steps,
    consequence:
      "The correction is overwritten and nobody is told. The household is called on a number that was already known to be wrong.",
  };
}
