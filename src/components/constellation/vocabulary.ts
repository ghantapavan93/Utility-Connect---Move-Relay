/**
 * The Handoff Constellation's line states, defined once.
 *
 * `CLAUDE.md` requires that the same visual language recur in the hero, the
 * demo, the audit timeline, conflict resolution and the architecture diagrams.
 * A rule stated in prose and re-implemented per page is a rule that quietly
 * becomes four dialects: the agent page's severed strand and the conflict
 * page's rejected candidate would drift apart by one shade and one dash length
 * until nobody could say whether the difference meant anything.
 *
 * So the vocabulary is data. A page composes geometry — what converges, what
 * diverges, what stops at a boundary — and asks this module what a line in a
 * given state looks like. Adding a state here is a deliberate act; inventing
 * one inside a component is caught by `constellation-vocabulary.test.ts`.
 *
 * Every colour is a semantic token, never a literal. `#0087B5` means *verified*
 * in this system and nothing else, so a line that is not making a claim about
 * verification must not be cyan.
 */

export type LineState =
  /** Confirmed, canonical, settled. Solid. */
  | "verified"
  /** Awaiting something — a decision, a response. Dashed. */
  | "pending"
  /** Sources disagree. Amber, because a conflict needs judgement, not alarm. */
  | "conflicting"
  /** In flight right now. Carries a travelling pulse where motion is allowed. */
  | "transit"
  /** A genuine break: the thing failed. */
  | "failed"
  /** Broken and then repaired — the recovery state. */
  | "recovered"
  /** Stopped, awaiting a human. The locked node. */
  | "locked"
  /**
   * Chosen in the browser and not yet committed anywhere.
   *
   * This state exists because its absence was a lie. A candidate a concierge
   * has clicked is not *verified* — it has not been authorized, accepted,
   * written to Postgres, or read back. Drawing it in `#0087B5` made the screen
   * assert a database fact on the strength of a local click, which is the one
   * thing this project's palette rule forbids: that colour carries exactly one
   * meaning and the meaning is not "I intend to".
   *
   * It borrows the locked token deliberately. An uncommitted selection is
   * precisely a thing waiting on human authorization, which is what a locked
   * node has always meant here.
   */
  | "proposed"
  /** Present but not participating: superseded history, an untaken path. */
  | "dormant";

export interface LineStyle {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  /** Opacity for the line and its endpoint. */
  opacity: number;
  /** Human-readable meaning, used for `aria-label` and legends. */
  meaning: string;
}

export const LINE: Record<LineState, LineStyle> = {
  verified: {
    stroke: "var(--color-state-verified)",
    strokeWidth: 2.2,
    opacity: 1,
    meaning: "verified",
  },
  pending: {
    stroke: "var(--color-state-pending)",
    strokeWidth: 1.6,
    strokeDasharray: "6 5",
    opacity: 0.9,
    meaning: "pending",
  },
  conflicting: {
    stroke: "var(--color-state-conflict)",
    strokeWidth: 2,
    strokeDasharray: "6 5",
    opacity: 1,
    meaning: "sources disagree",
  },
  transit: {
    stroke: "var(--color-state-transit)",
    strokeWidth: 2,
    opacity: 1,
    meaning: "in transit",
  },
  failed: {
    stroke: "var(--color-state-failed)",
    strokeWidth: 2.2,
    opacity: 1,
    meaning: "failed",
  },
  recovered: {
    stroke: "var(--color-state-recovered)",
    strokeWidth: 2.2,
    opacity: 1,
    meaning: "recovered",
  },
  locked: {
    stroke: "var(--color-state-locked)",
    strokeWidth: 2.2,
    opacity: 1,
    meaning: "human approval required",
  },
  proposed: {
    stroke: "var(--color-state-locked)",
    strokeWidth: 2.2,
    opacity: 1,
    meaning: "selected, not yet committed",
  },
  dormant: {
    stroke: "var(--color-ground-3)",
    strokeWidth: 1.4,
    strokeDasharray: "3 5",
    opacity: 0.75,
    meaning: "not participating",
  },
};

/**
 * The only states that may claim a value is real in the database.
 *
 * Exported so a test can assert the rule rather than a reviewer having to
 * remember it: a screen may not draw `verified` from frontend state alone.
 */
export const BACKEND_TRUTH_STATES: readonly LineState[] = ["verified", "recovered"];

/** Spread onto an SVG `<path>` or `<line>`. */
export function lineProps(state: LineState) {
  const s = LINE[state];
  return {
    stroke: s.stroke,
    strokeWidth: s.strokeWidth,
    strokeDasharray: s.strokeDasharray,
    opacity: s.opacity,
    fill: "none" as const,
  };
}

/**
 * A node's fill and border for the same state.
 *
 * Filled means *this one is real* — the canonical value, the step that ran, the
 * refusal that was recorded. Hollow means a candidate, a possibility, a path
 * not taken. The distinction does the work a legend would otherwise have to.
 */
export function nodeProps(state: LineState, filled: boolean) {
  const s = LINE[state];
  return {
    stroke: s.stroke,
    strokeWidth: 1.8,
    fill: filled ? s.stroke : "transparent",
    opacity: s.opacity,
  };
}

/**
 * A smooth converging path from a source to a destination.
 *
 * Both control points are pushed horizontally so every strand leaves its source
 * and arrives at its destination flat. The eye then reads the *bundle* first and
 * the individual strand second, which is the correct order for a diagram about
 * many things becoming one.
 */
export function convergePath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}
