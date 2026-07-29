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
 * ## Three states, not two
 *
 * The first version had `held` and `violated` and treated everything else as
 * "not held", which collapsed two very different situations into one. A network
 * failure is not a passing invariant, and it is not a breach either — it is an
 * absence of information, and a page arguing that unknown outcomes must stay
 * visible cannot itself quietly file them under either heading.
 *
 * So a slot resolves to exactly one of five states, three of which are verdicts:
 *
 *   idle          nothing has been attempted
 *   running       a request is in flight
 *   held          the run completed and its evidence establishes the invariant
 *   violated      the run completed and reported a breach
 *   inconclusive  something prevented a verdict — named, never guessed
 *
 * Two rules follow, and both are the point:
 *
 *   HTTP success does not imply HELD. A 200 carrying evidence that cannot
 *   support the claim is inconclusive, because the claim is about the evidence
 *   and not about the transport.
 *
 *   Request failure does not imply VIOLATED. A timeout tells us nothing about
 *   whether the invariant holds; asserting a breach from it would be the same
 *   blind inference this page exists to refuse — and it is exactly the mistake
 *   the signature incident is about, made by the page instead of the backend.
 */

/** Why no verdict could be reached. Always named — never a generic failure. */
export type InconclusiveReason =
  /** The request never completed: DNS, offline, connection reset. */
  | "network"
  /** The request exceeded its deadline. */
  | "timeout"
  /** A newer run superseded this one, or the reviewer stopped the sweep. */
  | "cancelled"
  /** The server answered, but with an error rather than a result. */
  | "server_error"
  /** The body was not the shape the contract promises. */
  | "malformed_response"
  /** A well-formed result whose evidence object was absent or empty. */
  | "missing_evidence"
  /** Evidence present, but not the fields the invariant is established by. */
  | "partial_evidence";

/**
 * How much of the claim the returned evidence can carry.
 *
 * A breach is always shown — suppressing it for thin evidence would let the
 * page hide the one result it exists to surface. But "a violation was reported"
 * and "a violation was reported and here is what proves it" are different
 * statements, and printing an evidence sentence over a payload that cannot
 * support one would borrow authority the run never earned.
 */
export type EvidenceState = "complete" | "partial" | "missing";

export type Verdict =
  | { kind: "idle" }
  | { kind: "running" }
  /** Held is only ever reached with complete evidence — see `verdictOf`. */
  | { kind: "held"; result: TheaterResult; evidenceState: "complete" }
  | { kind: "violated"; result: TheaterResult; evidenceState: EvidenceState }
  | { kind: "inconclusive"; reason: InconclusiveReason; detail: string };

/** What a scenario slot can be at any moment on the page. */
export type Slot =
  | TheaterResult
  | "running"
  | { error: string; reason?: InconclusiveReason }
  | undefined;

/** Human-readable, and deliberately free of prevention or breach language. */
export const INCONCLUSIVE_TEXT: Record<InconclusiveReason, string> = {
  network: "The request did not reach the server, so nothing was established either way.",
  timeout: "The request exceeded its deadline. Whether the invariant holds is unknown.",
  cancelled: "The run was superseded before it completed.",
  server_error: "The server returned an error instead of a result.",
  malformed_response: "The response was not the shape this scenario's contract promises.",
  missing_evidence: "The run completed but returned no evidence, so nothing was established.",
  partial_evidence: "The evidence returned does not contain what this invariant is established by.",
};

function isResult(r: Slot): r is TheaterResult {
  return !!r && typeof r === "object" && !("error" in r) && typeof (r as TheaterResult).outcome === "string";
}

/**
 * The single mapping from a slot to a verdict.
 *
 * `establishes` is the scenario's own evidence check — in practice the same
 * `proves` function the result panel renders, which returns a fixed sentence
 * when it cannot speak. Passing it in keeps this module free of narrative copy
 * while still letting the verdict depend on whether the evidence is usable,
 * which is the only honest basis for saying an invariant held.
 */
export function verdictOf(
  slot: Slot,
  establishes?: (evidence: Record<string, unknown>) => boolean,
): Verdict {
  if (slot === undefined) return { kind: "idle" };
  if (slot === "running") return { kind: "running" };

  if (typeof slot === "object" && "error" in slot) {
    const reason: InconclusiveReason = slot.reason ?? "server_error";
    return { kind: "inconclusive", reason, detail: slot.error || INCONCLUSIVE_TEXT[reason] };
  }

  if (!isResult(slot)) {
    return {
      kind: "inconclusive",
      reason: "malformed_response",
      detail: INCONCLUSIVE_TEXT.malformed_response,
    };
  }

  /*
    A breach is read before the evidence is judged. A scenario reporting
    VIOLATION has told us what happened, and demoting that to "inconclusive"
    because its evidence looked thin would be the page suppressing the one
    result it exists to surface.
  */
  if (slot.outcome === VIOLATION) {
    const ev = slot.evidence;
    const evidenceState: EvidenceState =
      !ev || typeof ev !== "object" || Object.keys(ev).length === 0
        ? "missing"
        : establishes && !establishes(ev)
          ? "partial"
          : "complete";
    return { kind: "violated", result: slot, evidenceState };
  }

  const evidence = slot.evidence;
  if (!evidence || typeof evidence !== "object" || Object.keys(evidence).length === 0) {
    return { kind: "inconclusive", reason: "missing_evidence", detail: INCONCLUSIVE_TEXT.missing_evidence };
  }

  // The rule that stops HTTP 200 from meaning "it held".
  if (establishes && !establishes(evidence)) {
    return { kind: "inconclusive", reason: "partial_evidence", detail: INCONCLUSIVE_TEXT.partial_evidence };
  }

  return { kind: "held", result: slot, evidenceState: "complete" };
}

/**
 * Classify a failed request. Never returns a verdict of `violated`.
 *
 * The two aborts are distinguished by exception name, not by branch order and
 * not by reading a message. `AbortSignal.timeout()` rejects with a DOMException
 * named **TimeoutError**; `controller.abort()` rejects with one named
 * **AbortError**. Because the names are disjoint, neither can be misread as the
 * other however these branches are ordered — which is the property worth having,
 * since a deadline reported as a user cancellation would quietly hide that the
 * system stopped answering.
 *
 * This previously matched `/timeout/` against `Error.message`. Nothing in the
 * app set a deadline, so that branch described a state the system could not
 * produce, and any real deadline — had one existed — would have arrived as an
 * `AbortError` and been filed as a cancellation.
 */
export function reasonForRequestFailure(err: unknown, status?: number): InconclusiveReason {
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    if (err.name === "TimeoutError") return "timeout";
    if (err.name === "AbortError") return "cancelled";
  }
  // Node rejects with a plain object carrying the same names in some paths.
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as { name?: unknown }).name;
    if (name === "TimeoutError") return "timeout";
    if (name === "AbortError") return "cancelled";
  }
  if (typeof status === "number" && status >= 400) return "server_error";
  return "network";
}

/* ------------------------------------------------------------------ *
 * Convenience readers. Each is `verdictOf` narrowed to one kind, so   *
 * a caller can never accidentally treat inconclusive as either edge.  *
 * ------------------------------------------------------------------ */

export const isHeld = (v: Verdict) => v.kind === "held";
export const isViolated = (v: Verdict) => v.kind === "violated";
export const isInconclusive = (v: Verdict) => v.kind === "inconclusive";
/** Reached a verdict of any kind — held, violated or inconclusive. */
export const isSettled = (v: Verdict) => v.kind === "held" || v.kind === "violated" || v.kind === "inconclusive";

/** Kept for callers that still hold raw slots. */
export function held(r: Slot): boolean {
  return verdictOf(r).kind === "held";
}
export function violated(r: Slot): boolean {
  return verdictOf(r).kind === "violated";
}

/**
 * How many slots reached a verdict at all.
 *
 * Inconclusive counts as completed — the attempt finished — but it is not a
 * refusal and must never be added to the refused tally.
 */
export function completedCount(slots: Slot[]): number {
  return slots.filter((s) => isSettled(verdictOf(s))).length;
}

export interface Tally {
  held: number;
  violated: number;
  inconclusive: number;
  total: number;
}

export function tally(slots: Slot[]): Tally {
  const v = slots.map((s) => verdictOf(s));
  return {
    held: v.filter(isHeld).length,
    violated: v.filter(isViolated).length,
    inconclusive: v.filter(isInconclusive).length,
    total: slots.length,
  };
}

/**
 * The colour the whole page is currently wearing.
 *
 * Here rather than inline in the component for the same reason `held` is: the
 * background wash is the largest thing on that screen and red is the one state
 * it must never fail to reach. Inline, the branch that reports a breach could
 * only be exercised by actually breaching an invariant against a live database,
 * which is to say never — so the most consequential path on the page would have
 * been the one path nothing checked.
 *
 * Green is deliberately strict, and inconclusive now blocks it outright: a
 * screen that went green while one of six scenarios never reported would be
 * making precisely the inference this page argues is unsafe.
 */
export function verdictAccent(slots: Slot[]): "failed" | "recovered" | "conflict" | "unknown" {
  const t = tally(slots);
  if (t.violated > 0) return "failed";
  if (t.inconclusive > 0) return "unknown";
  return t.total > 0 && t.held === t.total ? "recovered" : "conflict";
}
