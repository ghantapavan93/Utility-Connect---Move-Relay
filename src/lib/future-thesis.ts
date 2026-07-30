/**
 * The product thesis behind /future/thesis: from utility concierge to move
 * intelligence platform.
 *
 * This module is data, deliberately. The page that renders it makes claims
 * about what exists, what is next, and what is hypothesis — and claims that
 * live in JSX cannot be asserted on. Here every capability carries a reality
 * label, every built item names the live route that proves it, and a test
 * holds both, so the thesis cannot quietly promote a hypothesis to a feature
 * the way marketing copy always eventually does.
 *
 * ## The honesty gradient
 *
 * `built`        — running in this repository, provable at the named route.
 * `validation`   — the next 90 days: designed against the current
 *                  architecture, buildable without new infrastructure, not built.
 * `hypothesis`   — six to twelve months: a product bet that needs Utility
 *                  Connect's own validation before a line is written.
 * `expansion`    — one to three years: platform direction, stated to show
 *                  where the architecture leads, explicitly speculative.
 *
 * Nothing in horizons 1–3 is interactive anywhere on the site, and the page
 * says so. The one thing this file must never do is describe an unbuilt
 * capability in the present tense.
 */

export type RealityLabel = "built" | "validation" | "hypothesis" | "expansion";

export type Role = "customer" | "concierge" | "partner" | "leadership" | "engineering";

export interface Capability {
  id: string;
  title: string;
  horizon: 0 | 1 | 2 | 3;
  label: RealityLabel;
  /** Which roles this capability primarily serves — drives the role selector. */
  roles: Role[];
  /** The user problem, in one sentence. */
  problem: string;
  /** A concrete scenario in the domain's own language. */
  scenario: string;
  /** The smallest experiment that would validate or kill it. */
  smallestExperiment: string;
  /** What the model is allowed to own. */
  aiResponsibility: string;
  /** What stays deterministic, always. */
  deterministicResponsibility: string;
  requiredData: string[];
  failureModes: string[];
  observability: string[];
  successMeasures: string[];
  /** The strongest argument against building it. Every honest thesis has one. */
  reasonNotToBuild: string;
  /** For built capabilities only: where to see it running. */
  proof?: { label: string; href: string };
}

/* ────────────────────────────────────────────────────────────────────────────
   Horizon 0 — built and functioning. Every entry must carry a proof route;
   the test enforces it.
   ──────────────────────────────────────────────────────────────────────── */

const HORIZON_0: Capability[] = [
  {
    id: "living-move-record",
    title: "Living Move Record",
    horizon: 0,
    label: "built",
    roles: ["concierge", "engineering", "customer", "partner"],
    problem: "A move described by three sources is three stories until something holds the canonical one.",
    scenario:
      "Partner API, CSV and the customer's own form each describe Maya's move. One record holds the verified state, every value keeps its source and verification tier, conflicts stay visible until a named person resolves them, and each audience sees only its own projection.",
    smallestExperiment: "Already run: 575 tests against a real Postgres, three audience projections diffed live on /views.",
    aiResponsibility: "None. The record is deterministic ground truth the AI reads through tools.",
    deterministicResponsibility: "Provenance, conflict detection, consent, projections, the append-only audit trail.",
    requiredData: ["field_versions with channel and verification", "auth_tuples", "consent_events", "audit_events"],
    failureModes: ["A failed read rendering as an empty record — fixed and tested against"],
    observability: ["Every write audited in the same transaction", "projection manifests computed, not asserted"],
    successMeasures: ["Zero restricted fields reaching the wrong audience — enforced server-side"],
    reasonNotToBuild:
      "There was one: a simpler flat record would have shipped weeks earlier. It would also have made every conflict invisible, which is the product.",
    proof: { label: "Three audiences, one record", href: "/views" },
  },
  {
    id: "move-operations-copilot",
    title: "Move Operations Copilot",
    horizon: 0,
    label: "built",
    roles: ["concierge", "engineering"],
    problem: "Reconstructing what happened on a case takes an operator longer than deciding what to do about it.",
    scenario:
      "The copilot reads the case through governed tools, shows the competing values and the operation identity, refuses the unsafe shortcut with the refusal recorded, prepares a decision package and a customer draft, and stops at the authority boundary. Reload reconstructs the run from its persisted steps.",
    smallestExperiment: "Already run: the adversarial lab seeds five attacks and reports per-case verdicts from executed runs.",
    aiResponsibility: "Assembling evidence into business language; drafting communication held for review.",
    deterministicResponsibility: "The plan, tool authority, refusals, the merge, reconciliation, every consequential action.",
    requiredData: ["agent_runs and agent_steps", "the tool registry", "stored observations"],
    failureModes: ["An unreadable case must never say 'nothing requires action' — tested from both sides"],
    observability: ["Every step persisted with authority, outcome and duration", "refusals are rows, not absences"],
    successMeasures: ["Forbidden attempts blocked: measured per evaluation run, not asserted"],
    reasonNotToBuild:
      "The honest argument against it was that a good operator with a good dashboard needs no copilot — which is why the dashboard was built first, and why the copilot's value is measured in acceptance rates rather than assumed.",
    proof: { label: "Investigate a live case", href: "/agent" },
  },
  {
    id: "provider-uncertainty",
    title: "Provider uncertainty and recovery",
    horizon: 0,
    label: "built",
    roles: ["concierge", "engineering", "leadership"],
    problem: "A lost provider response leaves two possible realities, and guessing between them creates duplicate enrolments.",
    scenario:
      "A submission's reply never arrives. The state holds OUTCOME_UNKNOWN, the blind retry is refused at the policy layer, and reconciliation looks the order up by the identity the original request carried — recovering RLNT-1001 without creating a second order.",
    smallestExperiment: "Already run: the demo's retry step returns the refusal, and reconciliation adopts the existing order live.",
    aiResponsibility: "Explaining the uncertainty. Never resolving it.",
    deterministicResponsibility: "The unknown state, retry refusal, operation identity, reconciliation.",
    requiredData: ["provider_submissions with operation_key", "the provider's own ledger"],
    failureModes: ["Unknown collapsing into failed or confirmed — the exact collapse the state machine forbids"],
    observability: ["provider.retry.blocked audit events", "reconciliation outcomes recorded per submission"],
    successMeasures: ["Duplicate orders created under uncertainty: zero, by construction and by test"],
    reasonNotToBuild:
      "Blind retry with dedupe on the provider side would be less code — if every provider deduplicated reliably. The invariant exists because that assumption is not one this system gets to make.",
    proof: { label: "Watch the refusal live", href: "/theater" },
  },
  {
    id: "reliability-adversarial",
    title: "Reliability and adversarial testing",
    horizon: 0,
    label: "built",
    roles: ["engineering", "leadership"],
    problem: "A safety claim that has never been attacked is a hope with a heading.",
    scenario:
      "Replay protection, stale-write handling, authorization boundaries, prompt-injection resistance and evidence grounding are each exercised by seeded attacks — in the suite and interactively — and each check was proven to discriminate by restoring the defect it exists to catch.",
    smallestExperiment: "Already run: 575 tests, 54 browser specs, live SLOs computed from rows on /reliability.",
    aiResponsibility: "Being the subject under attack.",
    deterministicResponsibility: "Every verdict, every metric, every refusal being counted.",
    requiredData: ["seeded eval tenants", "the audit trail the attacks leave behind"],
    failureModes: ["A check that passes with the defect installed — caught three times, each rewritten"],
    observability: ["Per-case verdicts with executed tool paths", "failures named, never aggregated away"],
    successMeasures: ["Injection influence: zero, measured on every evaluation run"],
    reasonNotToBuild:
      "Adversarial suites cost maintenance forever. The alternative — trusting the happy path — was rejected the first time a check passed with its defect installed.",
    proof: { label: "Break the agent yourself", href: "/agent" },
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Horizon 1 — the next 90 days. Designed, not built.
   ──────────────────────────────────────────────────────────────────────── */

const HORIZON_1: Capability[] = [
  {
    id: "uc-intelligence",
    title: "Utility Connect Intelligence",
    horizon: 1,
    label: "validation",
    roles: ["concierge", "partner", "leadership"],
    problem: "Every role asks the operation different questions, and today each answer means a person reading rows.",
    scenario:
      "One AI workspace, role-aware rather than a floating chatbot. A concierge asks what changed on this move and gets the safest next action. A partner asks why a referral was rejected and gets the failing columns in business language. Leadership asks what automation handled today and what keeps recurring. Same foundation, different behaviour by role, authorization and objective.",
    smallestExperiment:
      "Wire the existing copilot's decision-package pattern to three role-scoped prompt-and-tool sets over the projections that already exist. No new domain services.",
    aiResponsibility:
      "Answering in five layers: operational answer, supporting evidence, recommended next action, authority boundary, and the model-and-tool execution record.",
    deterministicResponsibility: "Which tools each role may call, what each projection contains, every consequential action.",
    requiredData: ["audience projections (built)", "agent tool registry (built)", "role-scoped tool grants (new)"],
    failureModes: [
      "A role reading another role's evidence — the authorization gate must precede context assembly",
      "An answer without its evidence layer — rejected by the output validator, not by hope",
    ],
    observability: ["Per-role acceptance and override rates", "evidence coverage per answer", "policy blocks by role"],
    successMeasures: ["Operators accept or usefully edit the recommendation more often than they dismiss it"],
    reasonNotToBuild:
      "If concierges answer these questions faster from the dashboard than from a conversation, the workspace is ceremony.",
  },
  {
    id: "ai-gateway",
    title: "Provider-agnostic AI Gateway",
    horizon: 1,
    label: "validation",
    roles: ["engineering", "leadership"],
    problem: "A product wired to one model provider inherits that provider's outages, pricing and ceilings as its own.",
    scenario:
      "One gateway, several adapters — deterministic baseline, Ollama, OpenAI, Anthropic, Gemini — with the task choosing the path: identity and consent never touch a model; summaries take the small local model; customer drafts require structured validation; consequential actions are proposals into deterministic policy; an unavailable model degrades to the deterministic floor, visibly.",
    smallestExperiment:
      "The seam already exists: ai-gateway.ts resolves deterministic-vs-Ollama today. Add one cloud adapter and a task-type routing table, and measure the same seeded tasks through both.",
    aiResponsibility: "Nothing new — the gateway is plumbing that decides which model, if any, gets the task.",
    deterministicResponsibility: "The routing table, the fallback order, and the list of tasks no model ever receives.",
    requiredData: ["task-type registry", "per-provider cost and latency budgets", "regional data policy per provider"],
    failureModes: [
      "Silent cross-provider fallback changing answer quality without anyone noticing — every fallback is a recorded event",
      "A cloud key in a repo — configuration stays in the environment, absence stays a first-class state",
    ],
    observability: ["Provider and model per run", "fallback activations", "cost and latency per task type"],
    successMeasures: ["Any provider can be turned off in one config change with the product degrading, not breaking"],
    reasonNotToBuild: "If one model serves every task acceptably for a year, the abstraction was premature generality.",
  },
  {
    id: "eval-lab",
    title: "Model Evaluation and Release Lab",
    horizon: 1,
    label: "validation",
    roles: ["engineering", "leadership"],
    problem: "Models get adopted because their demo sounded smart, and regressions arrive silently with the next version.",
    scenario:
      "The same seeded Utility Connect tasks run through the deterministic baseline, the local model and a configured cloud model. The lab compares structured-output validity, evidence completeness, unsupported claims, tool-selection correctness, policy adherence, refusal usefulness, latency, tokens, cost and human acceptance — and a provider without a key renders NOT CONFIGURED, never a fabricated column.",
    smallestExperiment:
      "The eval harness already runs seeded cases and returns per-case verdicts. Parameterise it over the gateway's adapters and render the comparison.",
    aiResponsibility: "Being measured.",
    deterministicResponsibility: "The task set, the scoring, and the decision to adopt — which stays with a person.",
    requiredData: ["the existing seeded eval cases", "per-run token, latency and cost capture"],
    failureModes: [
      "An incomplete evaluation must render NO VERDICT — an aggregate over missing runs is a lie with an average",
    ],
    observability: ["Every compared run persisted with its full execution record"],
    successMeasures: ["A model change ships with a comparison attached, or it does not ship"],
    reasonNotToBuild:
      "If the model roster never changes, the lab is a museum. The bet is that it will change, repeatedly.",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Horizon 2 — six to twelve months. Hypotheses needing their validation.
   ──────────────────────────────────────────────────────────────────────── */

const HORIZON_2: Capability[] = [
  {
    id: "adaptive-front-door",
    title: "Adaptive Move Front Door",
    horizon: 2,
    label: "hypothesis",
    roles: ["customer", "concierge"],
    problem: "Structured intake asks every customer every question, including the ones their first sentence answered.",
    scenario:
      "“I’m moving from Denton to Frisco on August 16. I need electricity and internet, but I’m keeping my security provider.” The assistant extracts proposed fields, asks only what is missing, shows the customer what it understood, and requests confirmation before anything becomes a record. It may not establish identity, infer consent, invent availability, confirm pricing or promise installation.",
    smallestExperiment:
      "Extraction-only behind the existing form: propose pre-filled fields from one free-text box, measure correction rates, commit nothing without explicit confirmation.",
    aiResponsibility: "Extraction, clarifying questions, a preliminary checklist, the handoff summary.",
    deterministicResponsibility: "Identity, consent, the record write, the service catalogue, every commitment.",
    requiredData: ["the intake contract (built)", "a proposal-vs-committed staging state (new)"],
    failureModes: [
      "Ambiguous date → explicit confirmation, never a guess",
      "Conflicting address → both values presented",
      "Extraction failure → the structured form, unchanged",
      "Injection in customer text → data, never instruction",
      "Interrupted session → an incomplete draft persists, never a confirmed move",
    ],
    observability: ["Field-level correction rates", "abandonment vs the structured form", "injection attempts in intake text"],
    successMeasures: ["Fewer questions asked per completed intake without a rise in downstream corrections"],
    reasonNotToBuild: "If correction rates exceed the form's, the assistant is a costlier way to be wrong.",
  },
  {
    id: "shift-copilot",
    title: "Concierge Shift Copilot",
    horizon: 2,
    label: "hypothesis",
    roles: ["concierge", "leadership"],
    problem: "An operator's morning starts with reconstructing what happened overnight, case by case.",
    scenario:
      "“Twelve moves changed since your previous shift. Seven were handled automatically. Two need customer clarification. One provider outcome is unknown.” Each item carries why it matters, the evidence, what automation already completed, the recommended action and its required authority. Prioritisation uses explicit operational criteria only — never inferred financial value, demographics, or unsupported conversion likelihood.",
    smallestExperiment:
      "A since-timestamp diff over the existing projections, briefed through the shift-brief pattern the dashboard already renders.",
    aiResponsibility: "Ordering by declared criteria and explaining each item from returned evidence.",
    deterministicResponsibility: "The criteria themselves, every action, and what counts as changed.",
    requiredData: ["per-move change feed (new)", "the existing lanes and brief derivations (built)"],
    failureModes: ["Quiet deprioritisation on inferred value — the ranking criteria are published and auditable, or there is no ranking"],
    observability: ["Which briefed items get acted on, in what order, versus the copilot's ordering"],
    successMeasures: ["Time from shift start to first correct action, measured against the current dashboard"],
    reasonNotToBuild: "A tenant with a dozen daily cases fits on one screen — the briefing earns nothing until scale arrives.",
  },
  {
    id: "partner-integration-copilot",
    title: "Partner Integration Copilot",
    horizon: 2,
    label: "hypothesis",
    roles: ["partner", "engineering"],
    problem: "Partner CSV onboarding is a correction loop conducted over email, one rejected batch at a time.",
    scenario:
      "A partner uploads a sample. The copilot identifies the apparent schema, compares it to the declared contract, maps the safe fields, flags the ambiguous ones, validates examples, explains rejected rows in business language, and produces an integration-readiness checklist. No live data flows until an authorized person approves the mapping.",
    smallestExperiment:
      "Schema-similarity over the existing quarantine contract: when a batch quarantines, propose the three most likely column mappings and measure how often the partner's fix matches.",
    aiResponsibility: "Mapping proposals, explanations, corrected sample payloads, the checklist.",
    deterministicResponsibility: "The contract itself, validation, quarantine, replay protection, the approval gate.",
    requiredData: ["the channel contracts (built)", "quarantine reasons (built)", "schema signatures per partner (new)"],
    failureModes: [
      "Duplicate headers, renamed columns, date formats, embedded delimiters, Unicode names, formula injection",
      "The same batch under a new filename — replay protection already refuses it",
      "A schema change after approval — the signature no longer matches and the mapping re-enters review",
    ],
    observability: ["Mapping accepted vs overridden", "rejected-row reasons", "partner correction cycle length", "injection attempts inside uploads"],
    successMeasures: ["Batches to first clean import, per partner, before and after"],
    reasonNotToBuild: "If partners are few and stable, a human integration engineer stays cheaper than the maintenance.",
  },
  {
    id: "voice-intelligence",
    title: "Voice and Call Intelligence",
    horizon: 2,
    label: "hypothesis",
    roles: ["concierge", "customer"],
    problem: "What a customer said on a call lives in the operator's memory, and memory does not survive handoffs.",
    scenario:
      "A call yields a summary, confirmed statements, unresolved questions, promised follow-ups and proposed record changes — each linked to its transcript segment with timestamps. The transcript is evidence; nothing in it becomes canonical without the same review every other source gets. Consent is checked before recording, sensitive content is redacted, and low-quality audio yields an inconclusive result rather than a confident one.",
    smallestExperiment: "Summaries-with-citations on recorded synthetic calls, scored for unsupported claims before any real audio.",
    aiResponsibility: "Transcription, summarisation, proposals, sentiment as a low-authority signal.",
    deterministicResponsibility: "Consent gating, redaction policy, the review that promotes a proposal to a field.",
    requiredData: ["call consent records", "transcript storage with segment addressing (new)"],
    failureModes: ["A summary asserting what the customer did not say — every claim links to its segment or is dropped"],
    observability: ["Proposal acceptance rates", "unsupported-claim rate per model version", "inconclusive-audio rate"],
    successMeasures: ["Follow-ups kept because the promise was captured, measured against the pre-voice baseline"],
    reasonNotToBuild: "Voice adds consent, privacy and accuracy obligations that dwarf the transcription — the bar for value is high.",
  },
  {
    id: "customer-companion",
    title: "Customer Move Companion",
    horizon: 2,
    label: "hypothesis",
    roles: ["customer"],
    problem: "The customer's view of their own move is whatever the last phone call left them with.",
    scenario:
      "A customer-facing view translating operational state into calm language: what is done, what is pending, what needs them, why a provider status is still uncertain, and when a concierge will step in. It cannot convert “unknown” into “scheduled” to be reassuring — the customer projection already refuses to carry what the customer may not see, and the language layer inherits that refusal.",
    smallestExperiment: "The existing customer projection, rephrased by the gateway with citation checking, shown to synthetic-move testers.",
    aiResponsibility: "Tone and clarity over a projection that already decided the facts.",
    deterministicResponsibility: "The projection, the uncertainty, every status.",
    requiredData: ["customer projection (built)", "notification preferences (new)"],
    failureModes: ["Reassurance drift: 'unknown' softening toward 'on track' — the same grounding gate that drops uncited claims"],
    observability: ["Support-call reduction on companion-enabled moves", "customer confirmations completed in-product"],
    successMeasures: ["Fewer 'what is happening with my move' calls, without a rise in misunderstood states"],
    reasonNotToBuild: "A customer who gets one clear SMS at the right moment may need no companion at all.",
  },
];

/* ────────────────────────────────────────────────────────────────────────────
   Horizon 3 — one to three years. Platform expansion, explicitly speculative.
   ──────────────────────────────────────────────────────────────────────── */

const HORIZON_3: Capability[] = [
  {
    id: "move-intelligence-center",
    title: "Move Intelligence Center",
    horizon: 3,
    label: "expansion",
    roles: ["leadership", "engineering"],
    problem: "Leadership sees totals; the patterns that explain them live across thousands of individual audit trails.",
    scenario:
      "Recurring partner intake problems, provider uncertainty clusters, workflow states where work accumulates, automations with high override rates, model versions producing weaker recommendations — every aggregate opening to its drill-down evidence. No anonymous 'AI found a trend' cards.",
    smallestExperiment: "One pattern, fully evidenced: cluster quarantine reasons by partner and let leadership open every underlying row.",
    aiResponsibility: "Surfacing candidate patterns and explaining them from the rows.",
    deterministicResponsibility: "The aggregations, the drill-down paths, what counts as evidence.",
    requiredData: ["everything the audit trail already records, at retention"],
    failureModes: ["A trend nobody can open — unsupported aggregates are the leadership-scale version of uncited claims"],
    observability: ["Which surfaced patterns led to a process change, and which were dismissed"],
    successMeasures: ["Decisions that cite the center's evidence, counted"],
    reasonNotToBuild: "Below a few hundred moves a month, a good operator's intuition beats the dashboard.",
  },
  {
    id: "partner-growth",
    title: "Partner Growth Intelligence",
    horizon: 3,
    label: "expansion",
    roles: ["partner", "leadership"],
    problem: "Partners learn whether their referrals thrive from anecdotes, and the operation learns where handoffs fray the same way.",
    scenario:
      "Referral completeness, onboarding friction, correction patterns, attribution quality and branded-experience adoption — framed as 'where can the handoff become clearer, faster, and more measurable', never as speculative profitability rankings of partners.",
    smallestExperiment: "One partner-facing quality report generated from rows they are already entitled to see.",
    aiResponsibility: "Explaining friction from evidence and drafting improvement recommendations.",
    deterministicResponsibility: "Attribution, entitlement, and what a partner may see — the tuple graph already decides this.",
    requiredData: ["partner-scoped projections (built)", "longitudinal referral outcomes (new)"],
    failureModes: ["Ranking partners by inferred value — explicitly refused; the product is clarity, not a leaderboard"],
    observability: ["Partner corrections made after a report, versus before"],
    successMeasures: ["Referral completeness rising per partner after their first report"],
    reasonNotToBuild: "If partners ignore the reports, this is analytics theatre with a relationship cost.",
  },
  {
    id: "provider-reliability",
    title: "Provider Reliability Intelligence",
    horizon: 3,
    label: "expansion",
    roles: ["leadership", "engineering"],
    problem: "Provider behaviour is known anecdotally: who times out after creating, who sends malformed callbacks, who needs manual verification.",
    scenario:
      "Across operations: timeouts after likely creation, recurring malformed responses, delayed callbacks, reconciliation-heavy providers, frequently missing contract fields. It informs routing and operational policy; provider selection and commercial decisions stay governed by business agreements and verified data.",
    smallestExperiment: "The reconciliation outcomes already recorded, grouped by provider, with drill-down.",
    aiResponsibility: "Narrating the clusters.",
    deterministicResponsibility: "The counts, the routing policy, every commercial decision.",
    requiredData: ["provider_submissions history (built)", "callback timing (partially new)"],
    failureModes: ["A reliability score quietly becoming a commercial verdict — the boundary is stated on the surface itself"],
    observability: ["Reconciliation rate per provider over time"],
    successMeasures: ["Unknown-outcome dwell time falling for the providers the policy adapted around"],
    reasonNotToBuild: "With few providers, the operations team already knows — the system would be documenting their knowledge late.",
  },
  {
    id: "home-continuum",
    title: "Home Continuum",
    horizon: 3,
    label: "expansion",
    roles: ["customer", "leadership"],
    problem: "The relationship ends at connection day, and every later service need starts from zero.",
    scenario:
      "Renewal reminders, maintenance coordination, warranty interactions, service changes, future relocation readiness — one trusted record of a household's service relationships, extending the Move Record's provenance discipline past the move.",
    smallestExperiment: "A single renewal reminder generated from an existing record's own dates, opt-in, measured on action taken.",
    aiResponsibility: "Timing and phrasing of suggestions from real record state.",
    deterministicResponsibility: "Consent per purpose, retention policy, every commitment.",
    requiredData: ["long-retention consent (new)", "service lifecycle dates (partially built)"],
    failureModes: ["A 'trusted household record' becoming surveillance-shaped — purpose-scoped consent is the product, not a checkbox"],
    observability: ["Opt-in and opt-out rates as first-class product metrics"],
    successMeasures: ["Customers returning for their next move because the record was worth keeping"],
    reasonNotToBuild: "This is a second business. Building it early would starve the first.",
  },
  {
    id: "ai-product-factory",
    title: "AI Product Factory",
    horizon: 3,
    label: "expansion",
    roles: ["engineering", "leadership"],
    problem: "Every new AI-assisted product rebuilds the same foundations, and each rebuild re-makes last year's safety mistakes.",
    scenario:
      "The reusable internal platform this repository already sketches: identity and tenant isolation, provider adapters, a prompt and policy registry, server-owned tools, structured-output validation, approval contracts, audit and tracing, evaluation datasets, cost controls, reusable agent UI, deployment templates, incident runbooks. Industry direction — controlled, observable agent infrastructure rather than unconstrained chat loops — points the same way.",
    smallestExperiment: "Extract the gateway, tool registry and eval harness into a package the second product consumes unchanged.",
    aiResponsibility: "None — the factory is the governance the models run inside.",
    deterministicResponsibility: "All of it. That is the point.",
    requiredData: ["a second product wanting the foundations"],
    failureModes: ["A platform built before its second consumer exists — the classic way internal platforms die"],
    observability: ["Time-to-first-safe-feature for the next product, measured against this one's"],
    successMeasures: ["The second product ships its first governed AI feature in weeks, not months"],
    reasonNotToBuild: "Until the second product is real, this is premature abstraction wearing a roadmap.",
  },
];

export const CAPABILITIES: Capability[] = [...HORIZON_0, ...HORIZON_1, ...HORIZON_2, ...HORIZON_3];

export const HORIZONS: Array<{ horizon: 0 | 1 | 2 | 3; name: string; window: string; labelHeading: string }> = [
  { horizon: 0, name: "Built now", window: "running in this repository", labelHeading: "BUILT AND FUNCTIONING" },
  { horizon: 1, name: "Next validation", window: "the next 90 days", labelHeading: "NEXT VALIDATION" },
  { horizon: 2, name: "Product hypotheses", window: "six to twelve months", labelHeading: "PRODUCT HYPOTHESES TO VALIDATE" },
  { horizon: 3, name: "Platform expansion", window: "one to three years", labelHeading: "PLATFORM EXPANSION HYPOTHESES" },
];

/* ────────────────────────────────────────────────────────────────────────────
   The architecture every horizon shares, the failure matrix, and what gets
   built versus shown. Rendered, and pinned by the same test as the labels.
   ──────────────────────────────────────────────────────────────────────── */

export const ARCHITECTURE_STACK: Array<{ layer: string; detail: string; exists: boolean }> = [
  { layer: "Role-aware experience", detail: "Customer · Concierge · Partner · Leadership", exists: false },
  { layer: "AI experience API", detail: "Streaming · run persistence · idempotency", exists: false },
  { layer: "Identity and relationship authorization", detail: "Tenant · actor · role · move relationship", exists: true },
  { layer: "Context assembler", detail: "Structured move data · audit · provider state · policies", exists: true },
  { layer: "Server-owned tool registry", detail: "Read tools · proposal tools · controlled actions", exists: true },
  { layer: "Policy engine", detail: "Allowed · approval required · prohibited", exists: true },
  { layer: "Model router", detail: "Deterministic · Ollama · OpenAI · Anthropic · Gemini", exists: false },
  { layer: "Structured output validator", detail: "Schema · citations · unsupported claims · action contract", exists: true },
  { layer: "Evidence verifier", detail: "Every important claim linked to admissible evidence", exists: true },
  { layer: "Action proposal", detail: "No direct consequential mutation", exists: true },
  { layer: "Named approval or automation policy", detail: "A person, or a published deterministic rule", exists: true },
  { layer: "Existing deterministic domain service", detail: "The same functions the console's buttons call", exists: true },
  { layer: "Backend verification", detail: "Audit · trace · projections · customer-visible state", exists: true },
];

export interface FailureCase {
  failure: string;
  interfaceShows: string;
  systemResponse: string;
}

export const FAILURE_MATRIX: FailureCase[] = [
  { failure: "Model provider unavailable", interfaceShows: "AI assistance unavailable; domain workflow intact", systemResponse: "Deterministic fallback" },
  { failure: "Model times out", interfaceShows: "No verdict reached", systemResponse: "Safe retry, or the briefing ships without generation" },
  { failure: "Tool times out", interfaceShows: "Evidence incomplete", systemResponse: "Inconclusive — no consequential action" },
  { failure: "Invalid structured output", interfaceShows: "Response could not be validated", systemResponse: "One repair attempt, then fallback" },
  { failure: "Prompt injection", interfaceShows: "Untrusted instruction detected", systemResponse: "Treated as evidence, never as direction" },
  { failure: "Cross-tenant request", interfaceShows: "Nothing — an indistinguishable denial", systemResponse: "No protected state disclosed" },
  { failure: "Stale recommendation", interfaceShows: "Evidence changed after generation", systemResponse: "Invalidate and rerun" },
  { failure: "Model recommends a forbidden action", interfaceShows: "Policy blocked, with the safe alternative", systemResponse: "Refusal recorded" },
  { failure: "Provider state conflicts", interfaceShows: "Conflicting evidence", systemResponse: "Unknown preserved; escalate or reconcile" },
  { failure: "Cost budget exceeded", interfaceShows: "Reduced model capability", systemResponse: "Smaller model or deterministic result" },
  { failure: "Context too large", interfaceShows: "Omissions disclosed", systemResponse: "Retrieve relevant evidence; never silent truncation" },
  { failure: "Local model unavailable", interfaceShows: "LOCAL PROVIDER UNAVAILABLE", systemResponse: "Deterministic or configured cloud provider" },
  { failure: "Cloud model unavailable", interfaceShows: "Provider degradation", systemResponse: "Route per the allowed fallback policy" },
  { failure: "Audit write fails", interfaceShows: "Result visible, evidence persistence failed", systemResponse: "Alert and retry; never falsely claim fully recorded" },
  { failure: "Trace export fails", interfaceShows: "Nothing — business operation continues", systemResponse: "Buffer or retry telemetry" },
  { failure: "Human approves an old version", interfaceShows: "Stale conflict", systemResponse: "Reject without overwriting newer state" },
  { failure: "Duplicate agent request", interfaceShows: "The existing run", systemResponse: "Idempotent reconstruction" },
  { failure: "Evaluation cannot complete", interfaceShows: "NO VERDICT", systemResponse: "Per-case inconclusive state, no aggregate score" },
];

export const OBSERVABILITY_SIGNALS: Array<{ signal: string; why: string }> = [
  { signal: "Run ID and trace ID", why: "Reconstruct the complete operation" },
  { signal: "Tenant and role", why: "Prove correct isolation" },
  { signal: "Task type", why: "Compare performance by workflow" },
  { signal: "Provider and model", why: "Understand model-specific behaviour" },
  { signal: "Prompt version", why: "Detect regressions after changes" },
  { signal: "Tool sequence", why: "Inspect what the agent actually requested" },
  { signal: "Tool latency and failure", why: "Find operational bottlenecks" },
  { signal: "Input, output and cached tokens", why: "Understand cost and context efficiency" },
  { signal: "Structured-output validity", why: "Detect unusable responses" },
  { signal: "Evidence coverage", why: "Detect unsupported claims" },
  { signal: "Policy blocks", why: "Understand attempted overreach" },
  { signal: "Human acceptance or override", why: "Measure usefulness, not eloquence" },
  { signal: "Final domain result", why: "Separate good prose from successful work" },
  { signal: "Fallback activation", why: "Know when models were unavailable" },
  { signal: "End-to-end latency", why: "Determine whether the experience is usable" },
];

/**
 * What gets built next versus what stays a labelled idea. Three, deliberately:
 * an unlimited number of ideas may appear as hypotheses, but interactivity is
 * the claim "this works", and that claim is rationed.
 */
export const BUILD_NEXT: Array<{ title: string; proves: string }> = [
  {
    title: "Provider-agnostic AI Gateway",
    proves: "SDK integration, structured outputs, model routing, fallback behaviour, full-stack ownership.",
  },
  {
    title: "Partner Integration Copilot",
    proves: "Direct relevance to Utility Connect's public API, CSV and partner-intake world.",
  },
  {
    title: "Model Evaluation Lab",
    proves: "That AI here is evaluated, monitored, constrained and operated — not merely integrated.",
  },
];

export const ROLES: Array<{ role: Role; label: string }> = [
  { role: "customer", label: "Customer" },
  { role: "concierge", label: "Concierge" },
  { role: "partner", label: "Partner" },
  { role: "leadership", label: "Leadership" },
  { role: "engineering", label: "Engineering" },
];

export const LABEL_META: Record<RealityLabel, { heading: string }> = {
  built: { heading: "BUILT AND FUNCTIONING" },
  validation: { heading: "NEXT VALIDATION" },
  hypothesis: { heading: "PRODUCT HYPOTHESIS" },
  expansion: { heading: "PLATFORM EXPANSION HYPOTHESIS" },
};
