/**
 * What the control room says, derived from what the backend returned.
 *
 * The dashboard used to open with the word "Operator console" — a label, not a
 * state — above a graph whose node states were hardcoded literals. A reviewer
 * could read the whole header without learning anything about the tenant in
 * front of them.
 *
 * Everything here is a function of real rows. Nothing takes a default that
 * reads as reassuring: an empty tenant says it is empty, a failed load says it
 * failed, and neither is allowed to render as "nothing needs attention".
 *
 * ## The operating model
 *
 * Not every exception belongs to a person. Three lanes, and the boundary
 * between them is a policy question rather than a UI one:
 *
 *   automation   deterministic, authorized, replay-safe, already done
 *   recommend    evidence-grounded, but should not execute silently
 *   authority    consequential — identity, consent, final merge, retry safety,
 *                provider success, authorization, irreversible transitions
 *
 * The third list is CLAUDE.md's "AI must never decide" list, applied. A
 * quarantined row is a recommendation because correcting a partner's data is
 * reversible and evidenced; a contested canonical field is authority because
 * the final merge is not.
 */

export interface Stats {
  activeMoves: number;
  canonicalMoves: number;
  duplicatesPrevented: number;
  openConflicts: number;
  auditEvents: number;
  aiBriefings: number;
  ordersRecovered: number;
  providerSubmissions: number;
}

export interface MoveRow {
  id: string;
  reference: string;
  state: string;
  sources: number;
  openConflicts: number;
}

/** The four counts `/api/v1/upload/csv` returns, plus its per-row detail. */
export interface BatchResult {
  rows: { total: number; accepted: number; quarantined: number; replayed: number; unmappable: number };
  results: Array<{ line: number; status: string; issues?: Array<{ path: string; message: string }> }>;
}

/** One service request and whatever the provider has said about it. */
export interface ServiceRow {
  id: string;
  serviceType: string;
  state: string | null;
  providerOrderId?: string | null;
}

/**
 * Every distinguishable condition the page can be in.
 *
 * `failed` exists because the alternative is a page that renders an empty
 * tenant when the request died — turning "we could not ask" into "nothing needs
 * attention", which is the single most dangerous thing an operations screen can
 * say.
 */
export type LoadState = "loading" | "ready" | "failed" | "empty";

export interface Headline {
  lead: string;
  follow: string;
  tone: "neutral" | "verified" | "conflict" | "failed" | "recovered" | "security";
}

/**
 * The headline, computed in priority order.
 *
 * Ordered by what an operator most needs to know, not by what is most recent.
 * A lost provider reply outranks a good batch, because one is a loss of
 * certainty and the other is a number.
 */
export function headlineFor(input: {
  load: LoadState;
  stats: Stats | null;
  moves: MoveRow[];
  batch?: BatchResult | null;
  services?: ServiceRow[];
}): Headline {
  const { load, stats, moves, batch, services = [] } = input;

  if (load === "loading") {
    return { lead: "Reading the tenant.", follow: "Nothing is claimed until the server answers.", tone: "neutral" };
  }
  if (load === "failed") {
    return {
      lead: "The console could not read the tenant.",
      follow: "This is not an empty shift. It is an unanswered question.",
      tone: "failed",
    };
  }
  if (load === "empty" || !stats || stats.activeMoves === 0) {
    return { lead: "No moves are active.", follow: "Start the synthetic shift.", tone: "neutral" };
  }

  const unknown = services.filter((s) => s.state === "unknown").length;
  if (unknown > 0) {
    return {
      lead: "The provider may have acted.",
      follow: "Move Relay is holding the outcome as unknown rather than guessing.",
      tone: "conflict",
    };
  }

  const recovered = services.filter((s) => s.state === "reconciled").length;
  if (recovered > 0 && stats.ordersRecovered > 0) {
    return {
      lead: `${recovered === 1 ? "The order was" : `${recovered} orders were`} recovered.`,
      follow: "No duplicate was created.",
      tone: "recovered",
    };
  }

  if (batch && batch.rows.quarantined > 0) {
    return {
      lead: `${plural(batch.rows.accepted, "move")} entered.`,
      follow: `${plural(batch.rows.quarantined, "input")} could not be safely accepted.`,
      tone: "conflict",
    };
  }

  if (stats.openConflicts > 0) {
    return {
      lead: `${plural(stats.openConflicts, "field")} disagree.`,
      follow: "A named operator has to choose which value stands.",
      tone: "security",
    };
  }

  return { lead: "The shift is moving.", follow: "No operator action is required.", tone: "verified" };
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/* ------------------------------------------------------------------ */

export type Lane = "automation" | "recommend" | "authority";

export interface LaneItem {
  id: string;
  lane: Lane;
  /** What happened, in operator language. */
  headline: string;
  /** Which record it concerns, where one applies. */
  subject?: string;
  /** What the system did, or what it is asking for. */
  detail: string;
  /** Named rows or counts this rests on. Never prose alone. */
  evidence: string;
  /** For `recommend` and `authority`: what to do next. */
  action?: string;
  /**
   * Who may commit the result.
   *
   * Present on every non-automation item, because a recommendation whose
   * authority is unstated reads as an instruction.
   */
  authority?: string;
}

/**
 * The three lanes, from real state.
 *
 * Returns `[]` for an unloaded or failed page rather than an encouraging empty
 * lane. A caller that cannot distinguish "nothing to do" from "we did not ask"
 * will show the wrong one, so this refuses to make that ambiguous.
 */
export function lanesFor(input: {
  load: LoadState;
  stats: Stats | null;
  moves: MoveRow[];
  batch?: BatchResult | null;
  services?: ServiceRow[];
  selected?: MoveRow | null;
}): LaneItem[] {
  const { load, stats, moves, batch, services = [], selected } = input;
  if (load !== "ready" || !stats) return [];

  const items: LaneItem[] = [];

  /* ---------- automation: already done, deterministically ---------- */

  if (batch) {
    if (batch.rows.accepted > 0) {
      items.push({
        id: "batch-accepted",
        lane: "automation",
        headline: `${plural(batch.rows.accepted, "row")} accepted and committed`,
        detail: "Each row passed its channel contract and was persisted with its source and trust tier.",
        evidence: `${batch.rows.total} rows submitted · ${batch.rows.accepted} accepted`,
      });
    }
    if (batch.rows.replayed > 0) {
      items.push({
        id: "batch-replayed",
        lane: "automation",
        headline: `${plural(batch.rows.replayed, "row")} replayed safely`,
        detail: "A row already seen under this operation key returned its first result instead of enrolling anyone twice.",
        evidence: `${batch.rows.replayed} replayed on persisted idempotency records`,
      });
    }
    if (batch.rows.quarantined > 0) {
      items.push({
        id: "batch-quarantined",
        lane: "automation",
        headline: `${plural(batch.rows.quarantined, "row")} held at the contract`,
        detail: "Neither coerced into the expected shape nor discarded. Held with machine-readable reasons.",
        evidence: quarantineEvidence(batch),
      });
    }
  }

  if (stats.duplicatesPrevented > 0) {
    items.push({
      id: "retry-blocked",
      lane: "automation",
      headline: `${plural(stats.duplicatesPrevented, "blind retry")} refused`,
      detail: "The provider was not contacted again while an outcome was unknown, so no second order exists.",
      evidence: `${stats.duplicatesPrevented} provider.retry.blocked audit events`,
    });
  }

  if (stats.ordersRecovered > 0) {
    items.push({
      id: "reconciled",
      lane: "automation",
      headline: `${plural(stats.ordersRecovered, "provider order")} recovered`,
      detail: "Reconciliation asked the provider using the original operation identity and adopted what already existed.",
      evidence: `${stats.ordersRecovered} submissions in state reconciled`,
    });
  }

  /* ---------- recommend: evidenced, reversible, should not run silently ---------- */

  if (batch && batch.rows.quarantined > 0) {
    const first = batch.results.find((r) => r.status === "quarantined");
    items.push({
      id: "review-quarantine",
      lane: "recommend",
      headline: "Review the row the contract held",
      subject: first ? `Row ${first.line}` : undefined,
      detail: firstIssueText(batch) ?? "The row did not satisfy its channel contract.",
      evidence: quarantineEvidence(batch),
      action: "Review quarantined row",
      authority: "AI may recommend. A named operator corrects or rejects the row.",
    });
  }

  const unknownServices = services.filter((s) => s.state === "unknown");
  if (unknownServices.length > 0) {
    items.push({
      id: "propose-reconcile",
      lane: "recommend",
      headline: "Ask the provider what it actually has",
      subject: selected?.reference,
      detail:
        "Reconciliation reuses the original operation identity, so it can adopt an existing order without risking a second one.",
      evidence: `${plural(unknownServices.length, "operation")} in state unknown`,
      action: "Run reconciliation",
      authority: "AI may recommend. Reconciliation is deterministic and runs against the provider's own ledger.",
    });
  }

  /* ---------- authority: consequential, never automated ---------- */

  const contested = moves.filter((m) => m.openConflicts > 0);
  if (contested.length > 0) {
    const m = contested[0]!;
    items.push({
      id: "resolve-conflict",
      lane: "authority",
      headline: "Two sources disagree about a canonical field",
      subject: m.reference,
      detail:
        "Selecting the surviving value is a final merge. The schema refuses a canonical value that does not name the human who chose it.",
      evidence: `${plural(m.openConflicts, "field")} contested on ${m.reference} · ${plural(m.sources, "source")} attached`,
      action: "Resolve the conflict",
      authority: "A named concierge only. AI may explain the conflict; it may not perform the merge.",
    });
  }

  if (unknownServices.length > 0) {
    items.push({
      id: "retry-safety",
      lane: "authority",
      headline: "Whether a retry is safe is not the system's call",
      subject: selected?.reference,
      detail:
        "The provider may already hold an order. Resubmitting without evidence is what creates a duplicate at a real utility.",
      evidence: `${plural(unknownServices.length, "operation")} unresolved · retry refused deterministically`,
      action: "Review before any resubmission",
      authority: "A named operator, after reconciliation returns evidence.",
    });
  }

  return items;
}

/** The reasons the contract gave, counted — never invented. */
function quarantineEvidence(batch: BatchResult): string {
  const held = batch.results.filter((r) => r.status === "quarantined");
  const issues = held.reduce((n, r) => n + (r.issues?.length ?? 0), 0);
  return `${plural(held.length, "row")} held · ${plural(issues, "machine-readable issue")} returned`;
}

/** The first issue's own words, so the page never paraphrases a contract. */
function firstIssueText(batch: BatchResult): string | null {
  const held = batch.results.find((r) => r.status === "quarantined" && (r.issues?.length ?? 0) > 0);
  const issue = held?.issues?.[0];
  if (!issue) return null;
  return `${issue.path} — ${issue.message}`;
}

/**
 * The metric row, with its scope attached.
 *
 * A number without a scope is a number nobody can check. Every tile carries
 * where it came from, so "4" is never just "4".
 */
export interface Metric {
  label: string;
  /**
   * `null` when the tenant could not be read.
   *
   * The tiles used to disappear entirely on a failed load, which is honest but
   * unhelpful: the operator loses the shape of the shift as well as its
   * numbers. Keeping the tile and showing a dash says "this exists and I do not
   * know it", which is the actual situation — and is not the same as `0`.
   */
  value: number | null;
  scope: string;
  /** Actionable metrics lead; evidence counters follow. */
  kind: "action" | "evidence";
}

export function metricsFor(stats: Stats | null, moves: MoveRow[], services: ServiceRow[]): Metric[] {
  const known = !!stats;
  const v = (n: number) => (known ? n : null);
  const needsDecision = moves.filter((m) => m.openConflicts > 0).length;
  const unknown = services.filter((s) => s.state === "unknown").length;

  return [
    { label: "Needs a human decision", value: v(needsDecision), scope: "moves with a contested canonical field", kind: "action" },
    { label: "Provider outcome unknown", value: v(unknown), scope: "service operations on the selected move", kind: "action" },
    { label: "Orders recovered", value: v(stats?.ordersRecovered ?? 0), scope: "submissions reconciled against the provider", kind: "action" },
    { label: "Moves confirmed", value: v(stats?.canonicalMoves ?? 0), scope: "moves in state canonical", kind: "action" },

    { label: "Moves total", value: v(stats?.activeMoves ?? 0), scope: "rows in moves", kind: "evidence" },
    { label: "Blind retries refused", value: v(stats?.duplicatesPrevented ?? 0), scope: "provider.retry.blocked audit events", kind: "evidence" },
    { label: "Audit events", value: v(stats?.auditEvents ?? 0), scope: "append-only audit rows", kind: "evidence" },
    { label: "AI runs recorded", value: v(stats?.aiBriefings ?? 0), scope: "rows in ai_runs", kind: "evidence" },
  ];
}

/* ------------------------------------------------------------------ */

export type EvidenceState = "fully" | "partially" | "conflicting" | "insufficient";

export interface ShiftBrief {
  /** One sentence per observation, each traceable to a named source below. */
  observations: string[];
  /** The endpoints actually read to produce this. */
  sourcesInspected: string[];
  /** One operational consequence, in plain language. */
  whyItMatters: string | null;
  /** One safe next action, or null when none is warranted. */
  recommendation: string | null;
  evidenceState: EvidenceState;
}

/**
 * The shift brief, assembled deterministically from returned rows.
 *
 * Not a model call. `buildBriefing` takes the same position for a single move
 * and says why: every sentence traceable to a row, no step at which a model
 * could introduce a fact no source supports. That reasoning does not weaken at
 * tenant scope, so this is assembly too, and the page says so rather than
 * implying a model produced it.
 *
 * `evidenceState` is computed from what was actually read, never asserted. A
 * brief written before the endpoints answered is `insufficient` — which is the
 * honest word for it, and the one an implementation defaulting to a confident
 * label would never reach.
 */
export function shiftBriefFor(input: {
  load: LoadState;
  stats: Stats | null;
  moves: MoveRow[];
  batch?: BatchResult | null;
  services?: ServiceRow[];
}): ShiftBrief {
  const { load, stats, moves, batch, services = [] } = input;

  if (load !== "ready" || !stats) {
    return {
      observations: [],
      sourcesInspected: [],
      whyItMatters: null,
      recommendation: null,
      evidenceState: "insufficient",
    };
  }

  const sources = ["GET /api/v1/stats", "GET /api/v1/moves"];
  if (batch) sources.push("POST /api/v1/upload/csv");
  if (services.length) sources.push("GET /api/v1/moves/:id/fulfillment");

  const observations: string[] = [];

  if (batch) {
    if (batch.rows.accepted > 0) {
      observations.push(`${batch.rows.accepted} of ${batch.rows.total} rows created or joined a Move Record.`);
    }
    if (batch.rows.quarantined > 0) {
      const issue = batch.results.find((r) => r.status === "quarantined")?.issues?.[0];
      observations.push(
        issue
          ? `One row was held because ${issue.path} did not satisfy the declared contract: ${issue.message}.`
          : `${batch.rows.quarantined} rows were held at the contract with machine-readable reasons.`,
      );
    }
    if (batch.rows.replayed > 0) {
      /*
        A fully-replayed batch used to produce no observation at all: the brief
        only spoke when rows were accepted, so re-submitting the same file
        returned five replays and a silent summary. Idempotency working is a
        result, and a brief that reports nothing after a real operation is
        indistinguishable from one that failed to run.
      */
      observations.push(
        `${batch.rows.replayed} of ${batch.rows.total} rows were already known and replayed rather than enrolling anyone twice.`,
      );
    }
    if (batch.rows.replayed === 0 && batch.rows.unmappable === 0) {
      observations.push("No duplicate referrals were created and no row was unmappable.");
    }
  }

  if (stats.duplicatesPrevented > 0) {
    observations.push(`${stats.duplicatesPrevented} blind provider retries were refused while an outcome was unknown.`);
  }
  const unknown = services.filter((s) => s.state === "unknown").length;
  if (unknown > 0) {
    observations.push(`${unknown} provider operation${unknown === 1 ? " is" : "s are"} in state unknown.`);
  }
  if (stats.ordersRecovered > 0) {
    observations.push(`${stats.ordersRecovered} provider order${stats.ordersRecovered === 1 ? " was" : "s were"} recovered by reconciliation.`);
  }
  const contested = moves.filter((m) => m.openConflicts > 0).length;
  if (contested > 0) {
    observations.push(`${contested} move${contested === 1 ? " has" : "s have"} a canonical field two sources disagree about.`);
  }

  /*
    Priority, deliberately. The unknown outcome outranks the quarantined row
    because it is a loss of certainty about work that may already have happened
    at a provider; a held row is a correction waiting to be made.
  */
  const recommendation =
    unknown > 0
      ? "Reconcile the unknown provider operation before anything else touches it."
      : contested > 0
        ? "Resolve the contested field so the record has one canonical value."
        : batch && batch.rows.quarantined > 0
          ? "Review the held row and ask the partner for a corrected value."
          : null;

  const whyItMatters =
    unknown > 0
      ? "A resubmission now could create a second order for a household that may already be scheduled."
      : contested > 0
        ? "Downstream projections and provider submissions read the canonical value, so the disagreement propagates until someone resolves it."
        : batch && batch.rows.quarantined > 0
          ? "The held row is a referral that has not reached anyone. It stays invisible to the customer until it is corrected."
          : observations.length > 0
            ? "Nothing in this shift is waiting on an operator."
            : null;

  /*
    Conflicting outranks partial. A tenant with both an unknown outcome and a
    contested field is not a shift with gaps — it is a shift where two pieces of
    evidence point different ways, and saying "partially supported" would make
    that sound like a completeness problem.
  */
  const evidenceState: EvidenceState =
    observations.length === 0
      ? "insufficient"
      : unknown > 0 && contested > 0
        ? "conflicting"
        : batch || services.length > 0
          ? "fully"
          : "partially";

  return { observations, sourcesInspected: sources, whyItMatters, recommendation, evidenceState };
}
