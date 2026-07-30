import type { AgentRun, AgentStepRecord } from "./case-agent";

/**
 * The run, told as what happened to a move.
 *
 * The agent page used to render `AgentRun` almost directly: a list of tool
 * names, an authority tier, a refusal string. That is accurate and it is the
 * wrong altitude for the first thing a reader meets. `merge_canonical_record ·
 * forbidden · refused` is a true sentence about a function call; *"the move
 * record was not changed, because choosing between two customer-supplied dates
 * is a decision a named person owns"* is the same fact about a business.
 *
 * So this module sits between the run and the screen and answers, from stored
 * evidence only:
 *
 *   - what kind of trouble this move is in
 *   - what the agent looked at, in business language
 *   - what it established, and what it could not
 *   - what it recommends, why that is the safest available move, and what it
 *     deliberately did not do
 *   - whether the evidence actually supports any of that
 *
 * ## Why it is pure
 *
 * Every function here takes a run and returns a description. No fetching, no
 * dates, no randomness. That is not tidiness — it is what makes the interesting
 * claims testable. "A run with a failed read never produces a recommendation"
 * is a property you can assert in a unit test against a literal, and a defect
 * introduced in the page cannot hide behind a network call.
 *
 * ## The rule the whole file obeys
 *
 * **Nothing is asserted that the observations do not contain.** Where the
 * evidence is thin the output says so and stops. The failure mode this guards
 * against is the expensive one: a confident summary of a case the agent could
 * not actually read. That has happened here once already — a tool error was
 * treated as an empty result and the agent reported "nothing requires action"
 * on a move with an unresolved unknown outcome.
 */

export type CaseKind =
  | "provider_unknown"
  | "field_conflict"
  | "settled"
  | "unreadable";

export type EvidenceState =
  | "fully_supported"
  | "partially_supported"
  | "conflicting"
  | "insufficient";

export type StageState = "completed" | "refused" | "failed" | "running" | "queued";

/** One investigation stage, named for what it means rather than what it calls. */
export interface Stage {
  /** The business-language label. This is what a reader sees first. */
  label: string;
  /** The tool behind it, shown as secondary technical evidence. */
  tool: string;
  state: StageState;
  authority: string;
  /** The registry's own words when a step was refused. Never paraphrased. */
  note: string | null;
  durationMs: number | null;
}

/** A fact the agent established, with the observation it came from. */
export interface EvidenceItem {
  /** What was learned, in a sentence. */
  claim: string;
  /** Which returned observation supports it. */
  source: string;
  /** The raw observation, for the technical drawer. */
  payload: unknown;
}

export interface DecisionPackage {
  situation: string;
  observations: string[];
  recommendation: string | null;
  why: string | null;
  businessConsequence: string | null;
  authorityBoundary: string;
  /** The tool the agent reached for and was refused, in business language. */
  refusedInBusinessTerms: string | null;
  evidenceState: EvidenceState;
}

/**
 * Business names for the read-only tools.
 *
 * A map rather than a formatted tool name, because `get_provider_operation` →
 * "Get provider operation" is not translation, it is the same jargon with a
 * space in it. Each of these says what a reader gains from the step.
 */
const STAGE_LABELS: Record<string, string> = {
  get_move_record: "Load the canonical move record",
  get_provider_operation: "Check what the provider was asked to do",
  list_field_conflicts: "Compare the sources that disagree",
  get_audit_history: "Review what has already been attempted",
  get_consent_status: "Check what the customer agreed to",
  submit_provider_enrollment: "Attempt to submit the order again",
  merge_canonical_record: "Attempt to choose the surviving value",
  request_provider_reconciliation: "Ask the provider what order exists",
  mark_order_confirmed: "Attempt to declare the order confirmed",
  update_consent: "Attempt to change the consent record",
  delete_audit_history: "Attempt to remove audit history",
};

export function stageLabel(tool: string): string {
  return STAGE_LABELS[tool] ?? tool.replace(/_/g, " ");
}

const OUTCOME_TO_STATE: Record<string, StageState> = {
  ok: "completed",
  refused: "refused",
  error: "failed",
};

/** The steps as stages, in the order they ran. */
export function stagesFor(run: AgentRun): Stage[] {
  return run.steps.map((s) => ({
    label: stageLabel(s.tool),
    tool: s.tool,
    state: OUTCOME_TO_STATE[s.outcome] ?? "queued",
    authority: s.authority,
    note: s.note,
    durationMs: s.durationMs,
  }));
}

const stepFor = (run: AgentRun, tool: string): AgentStepRecord | undefined =>
  run.steps.find((s) => s.tool === tool);

const okObservation = (run: AgentRun, tool: string): unknown => {
  const step = stepFor(run, tool);
  return step && step.outcome === "ok" ? step.observation : undefined;
};

const asRows = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];

/**
 * What kind of case is this?
 *
 * Read from the run's own evidence rather than from its summary string. The
 * summary is prose written by the planner; deriving the page's structure from
 * prose would mean a wording change silently altering what a reader is shown.
 */
export function caseKindFor(run: AgentRun): CaseKind {
  if (run.state === "failed") return "unreadable";

  // A read that errored means the case was never seen. That outranks anything
  // else the run happens to contain, including a proposal.
  const readFailed = run.steps.some(
    (s) => s.authority === "read_only" && s.outcome === "error",
  );
  if (readFailed) return "unreadable";

  const submissions = asRows(okObservation(run, "get_provider_operation"));
  if (submissions.some((s) => s.state === "unknown")) return "provider_unknown";

  const record = okObservation(run, "get_move_record") as
    | { openConflicts?: unknown[] }
    | undefined;
  if (record?.openConflicts && record.openConflicts.length > 0) return "field_conflict";

  return "settled";
}

/**
 * The facts the agent established, each tied to the observation it came from.
 *
 * Only returned observations produce entries. A tool that refused or errored
 * contributes nothing here — its absence is what makes `evidenceStateFor` able
 * to say "insufficient" honestly rather than describing a gap it cannot see.
 */
export function evidenceFor(run: AgentRun): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  const record = okObservation(run, "get_move_record") as
    | { verified?: unknown[]; unconfirmed?: unknown[]; openConflicts?: unknown[] }
    | undefined;
  if (record) {
    const verified = record.verified?.length ?? 0;
    const conflicts = record.openConflicts?.length ?? 0;
    items.push({
      claim:
        conflicts > 0
          ? `The canonical record holds ${verified} verified field${verified === 1 ? "" : "s"} and ${conflicts} field${conflicts === 1 ? "" : "s"} where sources disagree.`
          : `The canonical record holds ${verified} verified field${verified === 1 ? "" : "s"} with no field in dispute.`,
      source: "Canonical move record",
      payload: record,
    });
  }

  const submissions = asRows(okObservation(run, "get_provider_operation"));
  if (submissions.length > 0) {
    const unknown = submissions.filter((s) => s.state === "unknown");
    const confirmed = submissions.filter((s) => s.state === "confirmed");
    if (unknown.length > 0) {
      items.push({
        claim:
          `${unknown.length} provider submission${unknown.length === 1 ? "" : "s"} reached the provider and the response was lost. ` +
          `No evidence proves the order was created, and none proves it was not.`,
        source: "Provider operations",
        payload: unknown,
      });
    }
    if (confirmed.length > 0) {
      items.push({
        claim: `${confirmed.length} provider order${confirmed.length === 1 ? " is" : "s are"} confirmed by the provider's own reply.`,
        source: "Provider operations",
        payload: confirmed,
      });
    }
  }

  /*
    Not `asRows`. The tool wraps `conflictsFor`, which returns `{ move,
    conflicts }` — an object, not a row array. The first version of this read
    it as rows, got `[]`, and silently dropped the conflict evidence from every
    real run while the unit tests passed against fixtures I had written in the
    wrong shape. The drift guard in the eval test now pins this to the shape
    the server actually stores.
  */
  const conflicts = conflictDetailFor(run);
  if (conflicts.length > 0) {
    const candidates = conflicts.reduce((n, c) => n + c.candidates.length, 0);
    items.push({
      claim: `${conflicts.length} field${conflicts.length === 1 ? "" : "s"} received ${candidates} competing values from different channels.`,
      source: "Field conflicts",
      payload: okObservation(run, "list_field_conflicts"),
    });
  }

  const audit = asRows(okObservation(run, "get_audit_history"));
  if (audit.length > 0) {
    items.push({
      claim: `${audit.length} recorded event${audit.length === 1 ? "" : "s"} describe what has already been attempted on this move.`,
      source: "Audit history",
      payload: audit,
    });
  }

  const consent = asRows(okObservation(run, "get_consent_status"));
  if (consent.length > 0) {
    const granted = consent.filter((c) => c.granted === true).length;
    items.push({
      claim: `${consent.length} consent record${consent.length === 1 ? "" : "s"} on file, ${granted} granted, each naming the exact wording agreed to.`,
      source: "Consent record",
      payload: consent,
    });
  }

  return items;
}

/**
 * How well does the evidence support what is being said?
 *
 * Deliberately not a percentage. A number invites a reader to treat a
 * qualitative judgement as a measurement, and there is nothing here to measure
 * — this is a statement about which observations came back, not a probability.
 */
export function evidenceStateFor(run: AgentRun): EvidenceState {
  if (run.state === "failed") return "insufficient";
  if (run.steps.some((s) => s.authority === "read_only" && s.outcome === "error")) {
    return "insufficient";
  }

  const kind = caseKindFor(run);
  if (kind === "field_conflict") {
    // Sources disagreeing is the definition of conflicting evidence. Calling
    // this "fully supported" because the reads succeeded would describe the
    // *retrieval* as healthy while saying nothing about the contradiction it
    // retrieved.
    return "conflicting";
  }

  if (kind === "provider_unknown") {
    // The whole case is an absence: the provider's answer never arrived. The
    // reads succeeded and the evidence is still, by construction, incomplete.
    return "partially_supported";
  }

  return evidenceFor(run).length > 0 ? "fully_supported" : "insufficient";
}

/** "move.date" → "Move date". The path grammar is storage, not language. */
export function fieldName(path: string): string {
  const last = path.split(".").pop() ?? path;
  const words = last.replace(/[_-]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The disagreement itself: every competing value, with the channel that
 * supplied it and how verified it was.
 *
 * This is the difference between "sources disagree" and *seeing* the partner
 * feed say one date while the customer confirmed another. The decision package
 * states the situation; this is the evidence a person actually weighs, read
 * from the same stored observation the agent reasoned over.
 */
export interface ConflictCandidateDetail {
  value: string;
  channel: string;
  verification: string;
  recordedAt: string | null;
}

export interface ConflictDetail {
  field: string;
  fieldPath: string;
  candidates: ConflictCandidateDetail[];
}

export function conflictDetailFor(run: AgentRun): ConflictDetail[] {
  const obs = okObservation(run, "list_field_conflicts") as
    | { conflicts?: Array<{ fieldPath: string; candidates?: Array<Record<string, unknown>> }> }
    | undefined;
  if (!obs?.conflicts) return [];

  return obs.conflicts.map((c) => ({
    field: fieldName(c.fieldPath),
    fieldPath: c.fieldPath,
    candidates: (c.candidates ?? []).map((cand) => ({
      value: String(cand.value ?? ""),
      channel: String(cand.channel ?? "unknown channel").replace(/_/g, " "),
      verification: String(cand.verification ?? "unverified").replace(/_/g, " "),
      recordedAt: cand.recordedAt ? String(cand.recordedAt) : null,
    })),
  }));
}

/**
 * The provider operations, with the identity that makes reconciliation
 * possible.
 *
 * The operation key is the load-bearing detail of the whole unknown-outcome
 * story: it is the idempotency identity the original request carried, and it
 * is why "ask the provider what exists" can find an order without creating
 * one. A page that recommends reconciliation without showing the identity it
 * will use is asking to be taken on faith.
 */
export interface ProviderOperationDetail {
  service: string;
  provider: string | null;
  state: string;
  operationKey: string | null;
  orderId: string | null;
  errorCategory: string | null;
}

export function providerDetailFor(run: AgentRun): ProviderOperationDetail[] {
  return asRows(okObservation(run, "get_provider_operation")).map((s) => ({
    service: String(s.service_type ?? "service"),
    provider: s.provider_name ? String(s.provider_name) : null,
    state: String(s.state ?? "unknown"),
    operationKey: s.operation_key ? String(s.operation_key) : null,
    orderId: s.provider_order_id ? String(s.provider_order_id) : null,
    errorCategory: s.error_category ? String(s.error_category) : null,
  }));
}

/**
 * Business names for the audit events this system writes.
 *
 * The fallback is the raw event type, visible rather than hidden — an event
 * this map does not know is better shown as `workflow.step.failed` than
 * flattened into something friendly and wrong.
 */
const AUDIT_LABELS: Record<string, string> = {
  "ingestion.referral.received": "A referral arrived",
  "referral.received": "A referral arrived",
  "ingestion.candidates.recorded": "Field values were recorded from a source",
  "ingestion.duplicate.attached": "A duplicate submission was attached to the existing record, not doubled",
  "move.canonical.approved": "A named person approved the canonical values",
  "provider.submission.started": "An order was sent to the provider",
  "provider.submitted": "An order was sent to the provider",
  "provider.unknown": "The provider's response was lost — outcome unknown",
  "provider.submission.unknown": "The provider's response was lost — outcome unknown",
  "provider.retry.blocked": "A blind retry was refused while the outcome was unknown",
  "provider.reconciled": "The provider was asked what exists, and answered",
  "provider.reconciliation.completed": "Reconciliation completed against the provider's ledger",
  "provider.confirmed": "The provider confirmed the order",
  "provider.submission.confirmed": "The provider confirmed the order",
  "ai.briefing.generated": "An AI briefing was assembled from cited fields",
  "agent.proposal.approved": "A person approved the copilot's proposal",
  "agent.proposal.rejected": "A person rejected the copilot's proposal",
};

/**
 * The business name for one audit event, exported on its own because three
 * surfaces render audit rows and only one of them holds an AgentRun. The
 * fallback is the raw event type, visibly technical rather than flattened
 * into something friendly and wrong.
 */
export function auditLabel(eventType: string): string {
  return AUDIT_LABELS[eventType] ?? eventType;
}

export interface AuditEntry {
  label: string;
  event: string;
  actor: string;
  at: string | null;
}

/** The move's own history, as the run read it — newest first, from the stored observation. */
export function auditTrailFor(run: AgentRun): AuditEntry[] {
  return asRows(okObservation(run, "get_audit_history")).map((e) => ({
    label: AUDIT_LABELS[String(e.event_type)] ?? String(e.event_type),
    event: String(e.event_type ?? ""),
    actor: String(e.actor ?? "system"),
    at: e.occurred_at ? String(e.occurred_at) : null,
  }));
}

/** What the customer agreed to, verbatim from the consent record. */
export interface ConsentDetail {
  purpose: string;
  channel: string;
  granted: boolean;
  wordingVersion: string;
  at: string | null;
}

export function consentDetailFor(run: AgentRun): ConsentDetail[] {
  return asRows(okObservation(run, "get_consent_status")).map((c) => ({
    purpose: String(c.purpose ?? "").replace(/_/g, " "),
    channel: String(c.channel ?? "").replace(/_/g, " "),
    granted: c.granted === true,
    wordingVersion: String(c.consent_text_version ?? "unversioned"),
    at: c.occurred_at ? String(c.occurred_at) : null,
  }));
}

/** Refusals, said as what did not happen to the business rather than to a function. */
const REFUSAL_IN_BUSINESS_TERMS: Record<string, string> = {
  submit_provider_enrollment:
    "No second order was sent. While the first outcome is unknown, another submission could create a duplicate enrolment the customer would have to unwind.",
  merge_canonical_record:
    "The move record was not changed. Choosing which conflicting value survives is a decision a named person owns.",
  mark_order_confirmed:
    "The order was not marked confirmed. Only the provider's own ledger can establish that.",
  update_consent: "No consent record was altered.",
  delete_audit_history: "No audit history was removed. It is append-only in the database.",
};

/**
 * The decision package.
 *
 * The structure is deliberately identical for every case kind, including the
 * ones with nothing to recommend. A shape that appears only when there is good
 * news teaches a reader to skim for it, and the cases worth reading carefully
 * are exactly the ones where `recommendation` is null.
 */
export function decisionFor(run: AgentRun): DecisionPackage {
  const kind = caseKindFor(run);
  const evidenceState = evidenceStateFor(run);
  const observations = evidenceFor(run).map((e) => e.claim);
  const refusedInBusinessTerms = run.refusal
    ? (REFUSAL_IN_BUSINESS_TERMS[run.refusal.tool] ?? run.refusal.reason)
    : null;

  if (kind === "unreadable") {
    return {
      situation:
        "The case could not be read. One of the reads the agent depends on returned an error.",
      observations,
      recommendation: null,
      why: null,
      businessConsequence: null,
      /*
        The most important sentence this module can produce. An agent that
        cannot see a case and says "nothing requires action" is worse than an
        agent that says nothing at all — it converts a failure into a
        reassurance, and reassurance is what stops anyone looking.
      */
      authorityBoundary:
        "No recommendation is offered, because none can be grounded. An unread case is not a quiet one.",
      refusedInBusinessTerms,
      evidenceState,
    };
  }

  if (kind === "provider_unknown") {
    return {
      situation:
        "A provider submission left this system and its reply never came back. The provider may have created the order, or may never have received the request. Both remain possible.",
      observations,
      recommendation: "Ask the provider what order already exists for this submission.",
      why:
        "Reconciliation reads the provider's ledger using the identity the original request carried, so it can find an order that already exists. It never creates one, which is exactly why it is safe here and why submitting again is not.",
      businessConsequence:
        "The customer's service is either already arranged or not arranged at all, and nobody can act on their behalf until that is settled. Reconciliation resolves it without risking a second enrolment the customer would have to unwind.",
      authorityBoundary:
        "The agent prepared this action and did not take it. Reconciliation runs under a named operator through the same service the console's own button calls.",
      refusedInBusinessTerms,
      evidenceState,
    };
  }

  if (kind === "field_conflict") {
    return {
      situation:
        "Two or more sources described the same move differently, and the record cannot hold both. Until one is chosen, every downstream projection is reading a field in dispute.",
      observations,
      recommendation: null,
      why: null,
      businessConsequence:
        "Service scheduling reads the canonical value. While it is disputed, an order can be placed against a date the customer never confirmed.",
      authorityBoundary:
        "The agent surfaced the disagreement and compared the sources. Selecting the surviving value is reserved for a named person, and the agent reached for that action and was refused.",
      refusedInBusinessTerms,
      evidenceState,
    };
  }

  return {
    situation: "Nothing on this move is waiting on a decision.",
    observations,
    recommendation: null,
    why: null,
    businessConsequence: null,
    authorityBoundary:
      "No action was proposed and none was taken. The agent read the case and found no unknown provider outcome and no field in dispute.",
    refusedInBusinessTerms,
    evidenceState,
  };
}

/**
 * A message to the customer, prepared and not sent.
 *
 * The one place on this page where language is generated rather than reported,
 * and the constraints are correspondingly tight. It is assembled from the case
 * kind by ordinary code — not by a model — because the failure mode of a
 * generated customer message is that it commits the business to something the
 * evidence does not support. "Your order is confirmed" is one plausible
 * sentence away from a case whose whole problem is that nobody knows.
 *
 * So the drafts below say only what the observations establish, and the
 * unknown-outcome draft is written specifically to communicate uncertainty
 * without inventing either outcome.
 *
 * Returns `null` when the case does not warrant contacting anyone. A draft
 * offered for every case would train an operator to send one.
 */
export interface CustomerDraft {
  subject: string;
  body: string;
  /** Which observations this draft is built from. Rendered beside it. */
  basedOn: string[];
  /** Commitments deliberately not made, and why. Rendered beside it. */
  withheld: string[];
}

export function customerDraftFor(run: AgentRun): CustomerDraft | null {
  const kind = caseKindFor(run);

  if (kind === "provider_unknown") {
    return {
      subject: "We are confirming your service setup",
      body:
        "We are checking with the provider to confirm the service request we already sent for you. " +
        "We are deliberately not sending another request while that confirmation is outstanding, because a second one could set up your service twice. " +
        "As soon as the provider confirms what is on file, we will update you.",
      basedOn: [
        "A provider submission exists for this move",
        "Its outcome is recorded as unknown",
        "No confirmation has been received",
      ],
      withheld: [
        "No claim that the service is active — the provider has not confirmed it",
        "No claim that the request failed — nothing establishes that either",
        "No date, because none has been confirmed by the provider",
      ],
    };
  }

  if (kind === "field_conflict") {
    return {
      subject: "Confirming one detail before we continue",
      body:
        "We have received more than one version of a detail on your move, and we want to confirm the right one with you before we schedule anything against it. " +
        "Your concierge will be in touch to check. Nothing has been booked using the detail in question.",
      basedOn: [
        "At least one field has values from more than one channel",
        "No canonical value has been selected",
      ],
      withheld: [
        "The competing values are not quoted — the customer supplied one of them and the other may be a partner error",
        "No commitment to a date or a schedule, because the disputed field is what a schedule would be built on",
      ],
    };
  }

  /*
    Settled and unreadable both return null, for different reasons that happen
    to point the same way. A settled case has nothing to tell anyone. An
    unreadable one has nothing that could be said honestly — and it is the case
    where a reassuring message would do the most damage.
  */
  return null;
}
