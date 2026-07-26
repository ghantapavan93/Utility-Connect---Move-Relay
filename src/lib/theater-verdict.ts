import { VIOLATION, type TheaterResult } from "./theater-contract";

/**
 * Reading a Failure Theater outcome.
 *
 * This lived inside the page component, which meant the one piece of logic on
 * that screen capable of being wrong in a dangerous direction — reporting a
 * breach as a pass — was the only piece no test could reach. It is here so it
 * can be tested, and it imports `VIOLATION` from the same contract module the
 * scenarios write it from rather than re-declaring the string, so the two
 * cannot drift apart.
 *
 * The asymmetry is deliberate. `held` requires a completed run with a non-
 * violating outcome; anything else — still running, network error, unparsed —
 * is not a pass. A scoreboard that treats "we don't know" as "it held" is the
 * exact failure this whole project argues against.
 */

/** What a scenario slot can be at any moment on the page. */
export type Slot = TheaterResult | "running" | { error: string } | undefined;

function settled(r: Slot): r is TheaterResult {
  return !!r && r !== "running" && !("error" in r);
}

/** The invariant held: the run completed and did not report a violation. */
export function held(r: Slot): boolean {
  return settled(r) && r.outcome !== VIOLATION;
}

/** The invariant did not hold. Distinct from "errored" and from "unknown". */
export function violated(r: Slot): boolean {
  return settled(r) && r.outcome === VIOLATION;
}

/** How many slots have a result at all, violation or not. */
export function completedCount(slots: Slot[]): number {
  return slots.filter(settled).length;
}
