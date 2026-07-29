import type { Accent } from "./accents";

/**
 * The Continuum: one verified handoff becoming a living home relationship.
 *
 * Restructured from eight parallel modules into a sequence. The eight read as a
 * catalogue — each card arguing for itself, several of them arguing the same
 * thing twice. Network Launchpad and the intake story were one idea about
 * getting in; the Provider Reliability Graph, the Service Continuity Graph and
 * the Scenario Compiler were three views of *what needs attention and why*.
 * Merged, each section now says something the one before it did not.
 *
 * The order is the argument. Everything enters through one door, a human is
 * helped rather than replaced, what needs attention is explained rather than
 * scored, the partner who referred it can see it, the relationship outlives the
 * move, and only then — last, and most restricted — an external agent is let
 * near any of it.
 *
 * `label` is load-bearing and never softened. One of these is built and covered
 * by tests; four are explorable concepts; two have been reasoned about and not
 * written. `line` is the one sentence each section is allowed to make bold,
 * because a page of emphasis is a page with none.
 *
 * Competitor names appear nowhere here. The market reasoning behind these
 * sections is in `research/competitive-landscape.md`, with sources — a
 * portfolio piece that ranks a prospective employer's competitors on the
 * employer's own behalf is presuming a relationship that does not exist.
 */

export type ContinuumLabel =
  | "BUILT AND FUNCTIONING"
  | "INTERACTIVE CONCEPT"
  | "FUTURE HYPOTHESIS";

export interface ContinuumModule {
  slug: string;
  title: string;
  kicker: string;
  /** The one sentence this section is allowed to say loudly. */
  line: string;
  /** One paragraph, as it appears on the index. */
  body: string;
  bullets: string[];
  accent: Accent;
  label: ContinuumLabel;

  /** The situation this exists to change, stated without the product in it. */
  problem: string;
  /** How it would work. Numbered because order is the design. */
  mechanism: { step: string; detail: string }[];
  /** What it borrows from the kernel that already exists and is tested. */
  reuses: { primitive: string; why: string }[];
  /** What would have to be true. The honest part. */
  openQuestions: string[];
  /** Where the AI is permitted, and where it is not. Never blurred. */
  aiBoundary: { may: string[]; mayNot: string[] };
  /** Only present where something real can be opened. */
  proof?: { label: string; href: string };
}

export const CONTINUUM: ContinuumModule[] = [
  {
    slug: "move-relay",
    title: "Move Relay",
    kicker: "THE SPINE EVERYTHING ELSE STANDS ON",
    line: "One household, three channels, no two agreeing — and one record that survives it.",
    body: "Multi-channel ingestion, deterministic duplicate detection, a canonical record no machine may write alone, a grounded briefing, a provider timeout that resolves to UNKNOWN rather than a guess, and reconciliation that finds the order which existed all along.",
    bullets: [
      "Real code over real Postgres, not a mock",
      "Every field carries who supplied it, through which channel, and when",
      "A blind retry is refused, and the count of retries not attempted is the headline metric",
    ],
    accent: "verified",
    label: "BUILT AND FUNCTIONING",
    problem:
      "One household announces a move through three channels within a week: a partner API, a spreadsheet export, and the customer's own form. No two agree. Whoever resolves that disagreement is making a decision about a real person's electricity, and in most systems that decision is made by whichever write happened last.",
    mechanism: [
      {
        step: "Every submission passes one gauntlet",
        detail:
          "Idempotency against a persisted record, then the channel's versioned contract, then exact-payload collapse, then cross-move duplicate scoring, then provenance persistence. No channel has a shortcut in — a channel that bypasses the pipeline to land its data is a channel whose data nobody can trust.",
      },
      {
        step: "A probable duplicate attaches rather than minting a move",
        detail:
          "Scoring is deterministic and inspectable, not a model. Above the threshold the payload becomes a second source on the existing move and its disagreements are surfaced as conflicts; it does not become a second household.",
      },
      {
        step: "A named person resolves the conflict",
        detail:
          "The merge endpoint requires an actor with a relationship to the case and takes the move's version, so two concierges resolving the same record cannot both win. The stale write surfaces as a conflict rather than silently overwriting.",
      },
      {
        step: "A lost provider reply becomes UNKNOWN, not failed",
        detail:
          "The order may exist. Retrying blindly enrols a household twice, and marking it failed loses an order that was created. So the state is UNKNOWN, the retry is refused, and reconciliation asks the provider what it actually knows.",
      },
    ],
    reuses: [
      { primitive: "This is the kernel", why: "Everything after it extends this rather than replacing it." },
    ],
    openQuestions: [
      "Provider integrations are simulated. No real utility API access has been available, so the timeout, the refusal and the reconciliation are exercised against a simulator with its own ledger.",
      "The duplicate threshold is tuned against a synthetic cohort. Real referral data would move it, and the number it should be is a question for data nobody outside the company has.",
      "A crash between reserving an operation key and writing its result leaves a reservation with no recovery policy. It is recorded, not solved.",
    ],
    aiBoundary: {
      may: [
        "Draft the concierge briefing from structured rows, with every claim citing a source field",
        "Explain why two sources disagree",
        "Propose a CSV column mapping for a human to accept or reject",
      ],
      mayNot: [
        "Perform the merge",
        "Decide consent validity or customer identity",
        "Decide whether a retry is safe",
      ],
    },
    proof: { label: "Run the live workflow", href: "/demo" },
  },

  {
    slug: "adaptive-front-door",
    title: "Adaptive Front Door",
    kicker: "EVERY MOVER ARRIVES DIFFERENTLY",
    line: "Six ways in. One record out. Nothing loses its source on the way.",
    body: "A customer, an agent, a property manager, a builder, a mortgage partner and an approved assistant all start a move differently. Each keeps its own front door and its own branding; all of them land in the same provenance-preserving intake.",
    bullets: [
      "Partner-branded microsites, an API, a CSV drop, a customer form — one pipeline behind all of them",
      "A new partner is onboarded from a sample file, not from a fortnight of integration work",
      "Drift after launch is surfaced rather than absorbed by a tolerant parser",
    ],
    accent: "internet",
    label: "INTERACTIVE CONCEPT",
    problem:
      "Onboarding one partner integration is weeks of an engineer reading someone else's spreadsheet. That cost is why networks with hundreds of member firms integrate a handful and email the rest — and the emailed ones are exactly where the data-quality problems live. Meanwhile every channel that gets special-cased to make its data land is a channel nobody can audit afterwards.",
    mechanism: [
      {
        step: "A sample file becomes a proposed mapping",
        detail:
          "A model reads twenty rows and proposes column-to-field mappings with a confidence per column. This is the one job in this system a language model is genuinely good at and where being wrong is cheap, because nothing is live yet.",
      },
      {
        step: "The mapping compiles to a deterministic contract",
        detail:
          "Once accepted it is a versioned schema like any other channel, with no model in the request path. What the AI produced was a draft; what runs in production is generated code with tests.",
      },
      {
        step: "Synthetic referrals run the whole gauntlet before launch",
        detail:
          "Generated payloads exercise idempotency, duplicate detection and quarantine against the proposed contract, so the partner sees the failures their real data would have caused — on data that costs nothing.",
      },
      {
        step: "A human activates it, and drift is watched afterwards",
        detail:
          "Activation is an approval with an actor and an audit row. After launch, a rising quarantine rate against a stable contract means the partner's export changed, and that is surfaced rather than silently tolerated.",
      },
    ],
    reuses: [
      { primitive: "The contract layer", why: "Versioned schemas with quarantine-and-reasons already exist; a new partner is a new entry, not a new mechanism." },
      { primitive: "The CSV mapper", why: "Column aliasing and date normalisation are already implemented against the formats spreadsheets actually produce." },
      { primitive: "quarantine_records", why: "Drift monitoring is a query over rows the system already writes." },
    ],
    openQuestions: [
      "Whether partners will supply a sample file before signing is the real gating problem, and it is commercial rather than technical.",
      "Generated contract code needs a review path. Nobody should merge a schema a model wrote without reading it.",
      "Branded microsites imply hosting someone else's brand on our infrastructure, which is a support and liability question this project has not costed.",
    ],
    aiBoundary: {
      may: ["Propose column mappings with a confidence per column", "Explain why a row failed a proposed contract", "Draft the contract for review"],
      mayNot: ["Activate a channel", "Alter a live contract", "Decide that a low-confidence mapping is good enough"],
    },
    proof: { label: "Send a referral through it", href: "/dashboard" },
  },

  {
    slug: "concierge-copilot",
    title: "Verified Concierge Copilot",
    kicker: "BEFORE THE CALL, DURING IT, AND AFTER",
    line: "AI prepares the decision. A person owns it. The record keeps the evidence.",
    body: "Before the call it prepares the concierge from the canonical record. During the call it captures facts tied to the moment they were said. After the call it drafts the follow-up. At no point may it confirm consent, choose an identity, or declare a provider order successful.",
    bullets: [
      "Every extracted fact links back to its second in the transcript",
      "A preference is not a fact, and the copilot never merges one as though it were",
      "The dangerous question — “should we just send it again?” — is answered by the backend, not the model",
    ],
    accent: "security",
    label: "INTERACTIVE CONCEPT",
    problem:
      "The richest data in a move business is spoken and then lost. A concierge learns that the closing slipped a week, that the spouse handles the internet account, that the customer works nights — and what survives is a free-text note nobody can query and no downstream system can act on. Meanwhile the concierge is answering from memory about a record with unresolved conflicts in it.",
    mechanism: [
      {
        step: "Before: a briefing grounded in rows, not recollection",
        detail:
          "Canonical record, unresolved conflicts, service interests, consent status, partner context, provider state. Every sentence in the briefing cites the field version it came from, so a concierge can check any claim before repeating it to a customer.",
      },
      {
        step: "During: the transcript is the source, and it is kept",
        detail:
          "A fact carries the utterance it came from with its offset. “Where did this move date come from” resolves to a moment in a recording rather than to a note saying the customer mentioned it.",
      },
      {
        step: "The proposal stops at a human",
        detail:
          "Extractions enter as candidate field versions at the concierge trust tier and travel the same merge path a partner conflict does — inheriting optimistic concurrency, the actor requirement and the audit row without any new machinery.",
      },
      {
        step: "The refusal that matters",
        detail:
          "Asked whether to resend a timed-out request, the copilot reads the provider operation and refuses: the outcome is UNKNOWN, a second submission risks a duplicate enrolment, reconcile instead. The model is not making retry policy — the deterministic backend and the tool authority are.",
      },
    ],
    reuses: [
      { primitive: "field_versions", why: "A compiled fact is a field version with a channel and a trust tier, exactly like a partner's." },
      { primitive: "The merge approval path", why: "Human approval, optimistic concurrency and the audit row already exist and are tested." },
      { primitive: "ai_runs", why: "Every extraction is a recorded run with its model, prompt version and grounding result." },
      { primitive: "The tool authority tiers", why: "read_only / requires_approval / forbidden is already enforced before arguments are parsed." },
    ],
    openQuestions: [
      "Consent to record, per state, is a legal question this project has not answered and would not answer by itself.",
      "Diarisation quality on a two-party call over a poor line is the difference between this being useful and being noise. Unmeasured here.",
      "Whether concierges would accept a review queue or route around it is a workflow question that needs the actual team, not a prototype.",
      "A demonstration would replay a synthetic call. No telephony, no live voice infrastructure, and saying otherwise would be the fiction this project exists to avoid.",
    ],
    aiBoundary: {
      may: [
        "Propose facts with citations back to the utterance",
        "Suggest the next question worth asking",
        "Draft the customer follow-up for a human to edit and send",
        "Flag that something said contradicts the record",
      ],
      mayNot: [
        "Write a canonical field without human confirmation",
        "Infer consent from a conversation",
        "Decide that a preference is a fact",
        "Resubmit a provider order, or declare one successful",
      ],
    },
  },

  {
    slug: "move-intelligence",
    title: "Move Intelligence Center",
    kicker: "WHAT NEEDS ATTENTION, AND WHY",
    line: "No score. Every signal says which row produced it and who can act.",
    body: "Stalled cases, ageing unknown outcomes, missing consent, malformed partner input, unconfirmed installations. Each signal is clickable and explains the record that produced it, the evidence behind it, who may act, and what safe action exists.",
    bullets: [
      "Built from rows the system already writes, not from new instrumentation",
      "A provider with nine submissions gets a wide interval, not a bad rating",
      "Measures the integration, never the utility company's service quality",
    ],
    accent: "conflict",
    label: "INTERACTIVE CONCEPT",
    problem:
      "Everyone operating handoffs at volume knows which integrations are painful and which cases are stuck, and nobody can prove either. Routing, escalation and contract conversations all run on recollection, and recollection is biased toward whatever broke most recently. The usual answer is a dashboard with a number on it, which replaces one unfalsifiable opinion with another.",
    mechanism: [
      {
        step: "Aggregate what is already recorded",
        detail:
          "Submission outcomes, UNKNOWN rates, time-to-reconcile, blocked retries, quarantine rates per partner, conflicts per field path. All of it is rows this system writes today, so this is a query rather than a project — which is the only reason it is plausible.",
      },
      {
        step: "Every signal carries its own justification",
        detail:
          "Not a score. A signal states which record produced it, which rows are the evidence, who has the relationship to act, and what the safe action is. A number nobody can interrogate is a number that will eventually be wrong in someone's favour.",
      },
      {
        step: "Sample size is part of the answer",
        detail:
          "A provider with nine submissions does not have a reliability figure, it has an interval too wide to use, and the surface should say so rather than rank it. Confident numbers over thin data is how this kind of view becomes actively harmful.",
      },
      {
        step: "A described worry becomes an executable check",
        detail:
          "State a failure in plain language; the system generates synthetic referrals in an isolated tenant, injects it, and returns a verdict with the rows that justify it. The six hand-written scenarios already running are the seed of exactly this.",
      },
    ],
    reuses: [
      { primitive: "provider_submissions", why: "State, timing and reconciliation outcome are already columns." },
      { primitive: "audit_events", why: "Blocked retries are already counted, and that count is the headline operational metric." },
      { primitive: "The theater tenant isolation", why: "Running destructive scenarios in a separate tenant is already how the built ones work." },
    ],
    openQuestions: [
      "Every number would be measured against a simulator until real provider integrations exist. Until then this is arithmetic over synthetic data and is labelled as such.",
      "Whether integration reliability can be published internally without becoming a commercial weapon is a governance question, not an engineering one.",
      "A model that generates a check risks generating one that passes trivially. Adversarial verification of a generated scenario is unsolved here.",
      "Regional variation may be an artefact of volume rather than a real difference, and separating the two needs more data than a demonstration has.",
    ],
    aiBoundary: {
      may: ["Summarise a trend", "Explain what drove a change in a rate", "Draft a scenario specification from a description"],
      mayNot: ["Score a provider", "Route an order", "Assert a cause for a failure", "Decide that a scenario passed"],
    },
    proof: { label: "See the six built scenarios", href: "/theater" },
  },

  {
    slug: "partner-growth",
    title: "Partner Growth & Move Wallet",
    kicker: "ATTRIBUTION THAT SURVIVES THE HANDOFF",
    line: "The partner sees their referral. The customer sees everything about their own.",
    body: "A referral keeps its attribution through every step, so a partner can see the progress of what they sent without seeing anyone else's. The customer sees the other side of the same record: what was selected, what a provider confirmed, and what is still outstanding.",
    bullets: [
      "Attribution is a queryable chain, not a figure on a dashboard",
      "A partner sees engagement, never provider internals or another partner's pipeline",
      "No invented revenue model — what anyone is paid is not this project's business",
    ],
    accent: "electricity",
    label: "INTERACTIVE CONCEPT",
    problem:
      "Referrals in this industry disappear into a black box. The partner who sent one cannot tell what happened to it, and the customer cannot tell why they were shown one plan and not another. Opacity in both directions is not a side effect; it is usually how the model works. The fix is not a portal — it is that the underlying record can answer the question at all.",
    mechanism: [
      {
        step: "Attribution is recorded at intake, on every field",
        detail:
          "The referring partner is resolved when the referral lands and travels on the field versions themselves. Attribution that lives only on a parent record cannot answer which partner supplied which value once a second source attaches.",
      },
      {
        step: "The partner projection is computed, not filtered",
        detail:
          "What a partner may see is a server-side read model derived from relationship tuples. Withheld fields are absent from the response rather than hidden by the interface, which is the difference between least privilege and a class name on a div.",
      },
      {
        step: "Eligibility carries its justification, and withholding is legible",
        detail:
          "Where an offer applies, the rule id and the field versions it read are stored with the verdict. A customer who did not qualify can be told that they did not and why — the part most implementations omit, and omitting it is what makes an offer engine indistinguishable from a sales funnel.",
      },
      {
        step: "The wallet is the customer's copy of the evidence",
        detail:
          "Selected services, installation windows, provider confirmations, account references, outstanding actions and the consent history — with unresolved items stated rather than quietly left out.",
      },
    ],
    reuses: [
      { primitive: "The three audience projections", why: "Concierge, customer and partner read models already exist and are enforced server-side." },
      { primitive: "auth_tuples", why: "Relationship-based access already decides who may read a move; a partner portal is a consumer of it." },
      { primitive: "consent_events", why: "Marketing purposes are scoped by consent; an offer surfaced outside that scope is a compliance failure, not a feature." },
    ],
    openQuestions: [
      "Whether a real campaign feed can be verified at all, or arrives as a spreadsheet nobody will vouch for, decides how much of this is honest.",
      "The regulatory position on telling a customer why they were excluded varies by product and by state.",
      "Whether a business wants withholding to be legible is a commercial decision. This project can only show that it is possible.",
    ],
    aiBoundary: {
      may: ["Explain an eligibility outcome in plain language", "Summarise which benefits apply to a move"],
      mayNot: ["Decide eligibility", "Invent, extend or approximate a discount", "Reorder providers by anything other than the declared inputs"],
    },
    proof: { label: "Read one move as three audiences", href: "/views" },
  },

  {
    slug: "home-continuum",
    title: "Home Continuum",
    kicker: "THE MOVE IS THE ACQUISITION, NOT THE PRODUCT",
    line: "The record does not close when the electricity comes on.",
    body: "Installation verification, first-bill review, warranty tracking, renewal windows, and eventually the next move. Every later event is an event against the same record, under the same provenance rules — and consent is re-checked rather than assumed to persist.",
    bullets: [
      "One record with a lifetime, not a transaction that closes",
      "Consent granted for setting up service is not consent to be contacted eighteen months later",
      "The prior record is the strongest deduplication signal that exists for the next move",
    ],
    accent: "solar",
    label: "FUTURE HYPOTHESIS",
    problem:
      "A business that treats the move as the product has one revenue event per household every several years. The household continues to have utilities, contracts, renewals and failures throughout, and nobody holds a verified record of any of it. The relationship ends precisely where the useful data begins.",
    mechanism: [
      {
        step: "The move record gains a lifecycle",
        detail:
          "A renewal, a rate change, an outage and a second move become events against the same canonical entity, each with its own provenance and its own actor. Nothing about the provenance rules changes; only the time horizon does.",
      },
      {
        step: "Consent is time-bounded and re-checked",
        detail:
          "The consent record already carries scope, channel and wording version. A continuum is what makes re-checking it unavoidable rather than optional, because the alternative is a system quietly relying on a grant given for something else.",
      },
      {
        step: "Dependencies between services become explicit",
        detail:
          "An internet install waits on power; monitoring waits on internet. Declared as edges, a slipped date propagates visibly instead of being discovered by a technician arriving at a house with no power.",
      },
      {
        step: "A second move knows about the first",
        detail:
          "Not an edit — a new move with the strongest possible deduplication signal attached. Which is exactly the signal a system that closed the file has thrown away.",
      },
    ],
    reuses: [
      { primitive: "consent_events", why: "Scope, channel and wording version are already stored per grant." },
      { primitive: "The projector", why: "Audience-scoped projections already exist; a longer lifetime is more events, not a new mechanism." },
      { primitive: "service_requests", why: "Per-service state already exists per move; dependency edges are a new table over existing rows." },
    ],
    openQuestions: [
      "Data retention over years is a policy question with legal weight, and the honest default — keep less — is in direct tension with the deduplication value.",
      "Whether a household wants an ongoing relationship, or wants the lights on and to be left alone, is a product assumption that should be tested before it is built.",
      "Propagation needs provider date changes to arrive as events. Most arrive as a person noticing.",
    ],
    aiBoundary: {
      may: ["Summarise a household's history for a concierge", "Flag that a consent grant has expired", "Draft the customer sentence explaining a propagated delay"],
      mayNot: ["Decide that consent persists", "Initiate contact", "Reschedule an order", "Merge a second move into a first"],
    },
  },

  {
    slug: "agent-gateway",
    title: "Agent-Accessible Infrastructure",
    kicker: "LET THEM READ. NEVER LET THEM DECIDE.",
    line: "READ allowed. DRAFT allowed. PROPOSE needs approval. DECIDE is blocked.",
    body: "An approved assistant could inspect verified move state without receiving authority to change it. The tools are the easy part; the authority model is the product, and it is the part an unauthenticated tool server cannot retrofit.",
    bullets: [
      "Every tool declares its authority tier, checked before arguments are parsed",
      "Reads are scoped by the same relationship graph a human is scoped by",
      "Any consequential action still requires an actor, current-state validation and a human",
    ],
    accent: "recovered",
    label: "FUTURE HYPOTHESIS",
    problem:
      "AI clients are becoming a distribution channel, and the fastest way to reach them is to expose tools with no authentication and no actor. That is excellent for adoption and it removes the only thing that makes a write safe. Comparing plans is a read. Enrolling a household is a write, and writes are where consent, identity, duplication and authorisation all bite at once.",
    mechanism: [
      {
        step: "Tools declare authority, not just a schema",
        detail:
          "read_only, requires_approval, forbidden — checked before the arguments are even parsed, so a forbidden tool cannot be reached by a well-formed call. The refusal is recorded as a step, because a refusal is a result.",
      },
      {
        step: "An agent reads exactly what its actor may read",
        detail:
          "No separate agent permission model. The same relationship graph that decides whether a concierge may open a case decides what an assistant acting on someone's behalf may retrieve, which means there is one place to get it wrong instead of two.",
      },
      {
        step: "Proposals travel the human path",
        detail:
          "An agent may draft a briefing, surface a conflict, or propose a field confirmation. Every one of those lands as a proposal on the same approval path a partner conflict uses.",
      },
      {
        step: "The dangerous verbs are simply absent",
        detail:
          "No tool exists to approve consent, resolve identity, merge without a human, resubmit an unknown operation, or mark a provider order successful. Absence is a stronger guarantee than a permission check, because there is nothing to misconfigure.",
      },
    ],
    reuses: [
      { primitive: "The tool registry", why: "Authority tiers are already data rather than prompt instructions, and already enforced." },
      { primitive: "auth_tuples", why: "Relationship-based access already answers who may read what." },
      { primitive: "agent_runs / agent_steps", why: "Every call and every refusal is already a recorded row." },
    ],
    openQuestions: [
      "Delegated authority is unsolved here. An assistant acting for a customer needs a way to prove it, and a header is not that.",
      "Rate limiting and abuse of a public read surface are real operational costs this project has not costed.",
      "Whether exposing read access is commercially wise at all is a business decision, not a technical one.",
    ],
    aiBoundary: {
      may: ["Inspect a move it is entitled to read", "Retrieve open conflicts and required customer actions", "Draft, and propose"],
      mayNot: ["Approve identity or consent", "Merge without a human", "Resubmit an unknown operation", "Mark a provider order successful"],
    },
    proof: { label: "Inspect the tool registry", href: "/agent" },
  },
];

export const continuumModule = (slug: string) => CONTINUUM.find((m) => m.slug === slug);

/** The declared ratio the beams background and the index both state. */
export const labelCounts = () =>
  CONTINUUM.reduce<Record<ContinuumLabel, number>>(
    (acc, m) => ({ ...acc, [m.label]: (acc[m.label] ?? 0) + 1 }),
    {} as Record<ContinuumLabel, number>,
  );
