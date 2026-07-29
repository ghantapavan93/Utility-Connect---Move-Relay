import type { Verdict } from "./theater-verdict";

/**
 * What each attack means before it means anything technical.
 *
 * The scenarios in `theater.ts` return an invariant and an outcome, both
 * written for an engineer. That is the right thing for them to return — it is
 * what the tests assert — but it left the page speaking only one language. A
 * reviewer who does not read `PRIMARY KEY (consumer, event_id)` as a sentence
 * learned nothing from six cards that each ended in one.
 *
 * So every scenario carries a second reading here, in the language of the
 * domain: what happened, what it would have cost, what the system refused, and
 * what proves the refusal. Held separately from `theater.ts` because that
 * module opens a database connection and this copy has to reach the browser —
 * the same seam `theater-contract.ts` exists for.
 *
 * ## Why `proves` is a function
 *
 * The first three fields are written prose. The fourth is computed from the
 * evidence the server actually returned, because it is the one that makes a
 * factual claim about a specific run. Written as prose it would be a sentence
 * asserting a number nobody re-checked — and it would keep asserting it after
 * the mechanism changed, which is the exact failure this whole page exists to
 * argue against. If the evidence does not contain what the sentence needs, the
 * sentence says so rather than inventing it.
 *
 * ## Truth tagging
 *
 * `happened`, `refused` and `proves` describe this system and are `[FACT]`
 * relative to a run that held. `atRisk` is `[HYPO]` — a reasoned consequence in
 * scaled home-service coordination, not an observed incident and not a claim
 * about anyone's internal operations.
 */

/** Narrowing helpers. Evidence is `Record<string, unknown>` at the seam. */
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
const arr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const allowed = (v: unknown): boolean | null =>
  v && typeof v === "object" && "allowed" in v ? bool((v as { allowed: unknown }).allowed) : null;

/** Said when the evidence cannot support a computed sentence. */
const UNSTATED = "The server returned no evidence for this claim.";

export interface ScenarioNarrative {
  /** The event, in the partner's or customer's terms. `[FACT]` */
  happened: string;
  /** What it would have cost downstream. `[HYPO]` — reasoned, not observed. */
  atRisk: string;
  /** The unsafe behaviour that did not occur. `[FACT]` */
  /**
   * The unsafe outcome that did not occur, named in this attack's own terms.
   *
   * One shared label — "What Move Relay refused" — covered all six, which
   * described the system's posture rather than the harm avoided and read the
   * same whether the thing prevented was a duplicate enrolment or a
   * cross-tenant disclosure. Each now names its own.
   *
   * Shown only for a verdict of `held`. On a breach it is false; on an
   * inconclusive run it is unestablished. `resultLayers` enforces both.
   */
  prevented: string;
  /** Computed from the returned evidence, never asserted independently. */
  proves: (evidence: Record<string, unknown>) => string;
}

export const NARRATIVE: Record<string, ScenarioNarrative> = {
  duplicate_csv: {
    happened: "A partner delivered the same export a second time — the same households, the same bytes.",
    atRisk:
      "Two sets of referrals for one batch: a household enrolled twice, and two concierges working the same move from two records.",
    prevented:
      "Duplicate referrals were prevented. The second delivery could not create a second set of referrals.",
    proves: (e) => {
      const rows = num(e.rowsParsed);
      const second = arr(e.secondPass);
      if (rows === null || !second) return UNSTATED;
      const replayed = second.filter((s) => s === "replayed").length;
      return `${rows} rows delivered twice. ${replayed} of ${second.length} replayed on the second pass.`;
    },
  },

  webhook_twice: {
    happened: "The same event arrived twice, as an at-least-once transport is entitled to send it.",
    atRisk:
      "The business action behind the event repeating — a second order, a second notification, a second charge against one intent.",
    prevented:
      "Repeated business execution was prevented. The redelivery was accepted at the door and stopped before it could act again.",
    proves: (e) => {
      const handled = num(e.handlerInvocations);
      const redelivery = num(e.redeliveryProcessed);
      if (handled === null || redelivery === null) return UNSTATED;
      return `Two deliveries reached the consumer. The handler ran ${handled}×; the redelivery processed ${redelivery}.`;
    },
  },

  worker_crash: {
    happened: "The worker died part-way through a move's fulfilment, after some steps had already completed.",
    atRisk:
      "A restart re-running work that already happened, or the move stalling silently with no one aware it stopped.",
    prevented:
      "Completed workflow steps were preserved. The restart did not re-run work that had already happened.",
    proves: (e) => {
      const after = typeof e.stateAfterResume === "string" ? e.stateAfterResume : null;
      const reserve = num(e.reserveCompletions);
      if (!after || reserve === null) return UNSTATED;
      return `Crashed mid-workflow, resumed to ${after}. The first step completed ${reserve}×.`;
    },
  },

  cross_tenant: {
    happened: "An account outside the owning organisation asked to read one of its referrals.",
    atRisk: "One partner seeing another partner's pipeline — the disclosure that ends a partnership.",
    prevented:
      "Unauthorized access was denied. There was no relationship path, so the read was refused rather than filtered.",
    proves: (e) => {
      const owner = allowed(e.owningAgent);
      const rival = allowed(e.rivalTenantAdmin);
      const anon = allowed(e.anonymous);
      if (owner === null || rival === null || anon === null) return UNSTATED;
      return `Owning agent ${owner ? "allowed" : "denied"}; rival tenant ${rival ? "allowed" : "denied"}; anonymous ${anon ? "allowed" : "denied"}.`;
    },
  },

  stale_write: {
    happened: "Two concierges opened one move record and both saved, each working from what they had read.",
    atRisk:
      "The second save silently overwriting the first — a corrected phone number replaced by the number it corrected, with nothing recording that it happened.",
    prevented:
      "The stale update was rejected. It surfaced as a conflict instead of overwriting the write it was made without seeing.",
    proves: (e) => {
      const first = num(e.firstWriteRows);
      const second = num(e.secondWriteRows);
      if (first === null || second === null) return UNSTATED;
      return `The first write updated ${first} row. The stale write updated ${second}.`;
    },
  },

  schema_drift: {
    happened: "A partner renamed a field and dropped another without telling anyone — the ordinary integration change.",
    atRisk:
      "A payload accepted with a missing move date, or silently dropped so that neither side knows a referral went nowhere.",
    prevented:
      "The incompatible payload was quarantined. It was neither coerced into the old shape nor discarded.",
    proves: (e) => {
      const issues = arr(e.issues);
      const version = typeof e.contractVersion === "string" ? e.contractVersion : null;
      const quarantined = typeof e.quarantineId === "string" && e.quarantineId.length > 0;
      if (!issues || !version) return UNSTATED;
      return `Failed contract ${version} with ${issues.length} machine-readable issues; ${quarantined ? "quarantined and resolvable" : "not quarantined"}.`;
    },
  },
};

/**
 * Whether the returned evidence can establish this scenario's invariant.
 *
 * `proves` already answers this: it declines to speak when the evidence is
 * absent or the wrong shape. Reusing that answer means the verdict and the
 * sentence beneath it can never disagree — a panel reading HELD above a line
 * saying nothing was established would be the page contradicting itself in the
 * space of two rows.
 */
export function establishesInvariant(scenario: string, evidence: Record<string, unknown>): boolean {
  const n = NARRATIVE[scenario];
  return n ? n.proves(evidence) !== UNSTATED : false;
}

/**
 * The four sentences a finished attack is read as.
 *
 * A function rather than markup because one of its branches is a correctness
 * decision, not a layout one. `prevented` asserts that an unsafe outcome did
 * not occur — true of a run that held, false about a run that breached, and
 * unestablished about a run that never reported. Deciding that inside a
 * component put the page's most consequential sentence somewhere no test could
 * reach, on a page whose whole argument is that claims should be checkable.
 *
 * Three verdicts, three third layers:
 *
 *   held          Unsafe outcome prevented — named per attack
 *   violated      Unsafe outcome occurred — in the server's own words
 *   inconclusive  No verdict, and why. No prevention or breach language at all,
 *                 because neither has been shown.
 */
export interface ResultLayer {
  label: string;
  body: string;
  tone?: "conflict" | "recovered" | "failed" | "verified" | "unknown";
  mono?: boolean;
}

export function resultLayers(scenario: string, verdict: Verdict): ResultLayer[] {
  const n = NARRATIVE[scenario];
  if (!n) return [];
  if (verdict.kind === "idle" || verdict.kind === "running") return [];

  const context: ResultLayer[] = [
    { label: "What happened", body: n.happened },
    { label: "What was at risk", body: n.atRisk, tone: "conflict" },
  ];

  /*
    An inconclusive run gets the context and then stops. It has no evidence
    sentence, because there is no evidence to read — printing "what proves it"
    beneath a run that established nothing would be the strongest claim on the
    panel sitting under the weakest result.
  */
  if (verdict.kind === "inconclusive") {
    return [
      ...context,
      { label: "No verdict was reached", body: verdict.detail, tone: "unknown" },
    ];
  }

  if (verdict.kind === "held") {
    return [
      ...context,
      { label: "Unsafe outcome prevented", body: n.prevented, tone: "recovered" },
      { label: "What proves it", body: n.proves(verdict.result.evidence), tone: "verified", mono: true },
    ];
  }

  /*
    A breach is always stated. Whether it is *proven* depends on what came back.

    With complete evidence the panel reads the numbers, exactly as a held run
    does — including the unflattering ones. With partial or missing evidence
    there is no "what proves it", because there is nothing to prove it with, and
    a sentence there would lend the strongest claim on the panel to the weakest
    payload. The breach still shows; only the proof is withheld.
  */
  const breach: ResultLayer = {
    label: "Unsafe outcome occurred",
    body: verdict.result.invariant,
    tone: "failed",
  };

  if (verdict.evidenceState === "complete") {
    return [
      ...context,
      breach,
      { label: "What proves it", body: n.proves(verdict.result.evidence), tone: "failed", mono: true },
    ];
  }

  return [
    ...context,
    breach,
    {
      label: "Evidence incomplete",
      body: "Violation reported. Supporting evidence was incomplete.",
      tone: "unknown",
    },
  ];
}

/**
 * The three-beat frame every scenario on this page follows.
 *
 * This replaced Purpose / Proof / Code. Those named the artefact — a purpose, a
 * proof, some code — which is what an engineer calls the parts of their own
 * work. None of the three said what any of it was *for*, so the page opened by
 * describing itself rather than the problem, and a reader who did not already
 * care about invariants had no reason to start.
 */
export interface RailStage {
  n: string;
  title: string;
  body: string;
}

export const RAIL: RailStage[] = [
  {
    n: "01",
    title: "Business risk",
    body: "Duplicate orders, silent overwrites, lost work, and one partner reading another's pipeline.",
  },
  {
    n: "02",
    title: "Domain invariant",
    body: "One logical operation stays one order. Uncertainty stays visible. Denial is the default.",
  },
  {
    n: "03",
    title: "Persisted evidence",
    body: "Database rows, state transitions, operation identity, and audit history prove what occurred.",
  },
];
