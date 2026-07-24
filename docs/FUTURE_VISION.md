# Future Vision — Utility Connect Continuum

Every element here is labelled. The labels are load-bearing and never blurred.

| Label | Meaning |
|---|---|
| **BUILT AND FUNCTIONING** | Real code, real database, covered by tests |
| **INTERACTIVE CONCEPT** | Explorable in the demo, not wired to a live backend |
| **FUTURE HYPOTHESIS** | Reasoned about and designed. Not built. |

The working proof — Move Relay — is the centre. Everything below amplifies it.
Nothing below is claimed as built unless it says so.

---

## The keystone insight

**The move is the acquisition moment. The home relationship is the long-term
product.**

Utility Connect's public model coordinates essential services around a move
`[FACT — utilityconnect.net]`. The larger opportunity is to stop treating the
relationship as finished when the electricity and internet are connected:

```
Move referral → service setup → home onboarding → bill and plan optimisation
→ maintenance and vendor services → renewal events → referrals → next move
```

Working name for the long-horizon platform: **Utility Connect Continuum** — the
AI-assisted operating system for the complete home-service relationship. Move
Relay is the trust and workflow foundation underneath it.

## Why this is commercially serious, not speculative

The market is already moving beyond one-time connection. This is the competitive
reality the vision must answer to, not a gap it invented:

- **LiveEasy** (formerly MoveEasy) publicly markets a *lifetime* home-management
  and concierge platform, white-labelled for real-estate partners, with
  complimentary concierge "for life". `[FACT — verified 2026-07-24]`
- **Updater** runs a moving marketplace and lets companies embed its commerce
  flows. `[FACT]`
- **Porch** combines checklists, concierge, memberships, and home-service offers.
  `[FACT]`
- **Move Concierge** advertises partner revenue-sharing and bill review outside a
  move. `[FACT]`

So the future cannot be a checklist, a marketplace, a coupon page, or a chatbot —
those exist. The defensible differentiation is narrower and harder to copy:

> **A verified, human-assisted home-service network** where every conversation
> becomes structured work, every offer is traceable, every partner receives
> attribution, and every relationship can continue — with permission — after the
> move.

That differentiation is not a new idea bolted on. It is the *same provenance,
consent, attribution, and audit kernel that Move Relay already implements*,
extended across time. The moat is the verification, and the verification is
`BUILT AND FUNCTIONING` today.

## The four growth engines

Every module maps to one of four measurable levers. Metrics use the discipline in
[BUSINESS_VALUE.md](BUSINESS_VALUE.md): no fabricated numbers, every baseline
unknown, each signal instrumented or explicitly not.

1. **More revenue per move** — legitimate related services surfaced without
   pressure. Measure: services connected per move, offer acceptance, attribution
   completeness.
2. **More moves per partner** — referring becomes the partner's default. Measure:
   active referring partners, referrals per partner, time to launch a partner.
3. **Longer customer lifetime** — continued help after move-in, with explicit
   permission. Measure: 6- and 12-month engagement, renewal interactions, repeat
   use at the next move.
4. **Lower operational cost and risk** — each concierge handles more without
   losing the human relationship. Measure: after-call work, duplicate actions
   prevented, unknown outcomes.

---

## Module 1 — Concierge Compiler `INTERACTIVE CONCEPT`

*Every customer conversation compiles into a verified move plan.*

Not "call transcription". A conversation, with disclosure and consent, becomes a
stream of **evidence-linked facts** — each tied to a transcript utterance id,
speaker, and timestamp:

```
live conversation → transcript segments → intent and entity extraction
→ evidence-linked facts → missing information → workflow tasks
→ human confirmation → provider-ready requests → follow-up
```

When Maya says *"I'm actually moving August 16, not 14,"* the compiler emits a
fact with `sourceType: CALL_TRANSCRIPT`, `verification: CUSTOMER_STATED`,
`requiresHumanConfirmation: true`. The concierge sees the date conflict against
the partner feed and a recommended next question. **The AI never updates the
canonical record** — the concierge clicks *confirm*, and only then does the merge
happen, through the exact same human-approval path Move Relay already enforces.

This is why it is credible rather than decorative: the extraction is new, but the
thing it feeds — human-gated canonical merge with full provenance — already
exists and is tested. Live-audio streaming and agent-assist are established
technology `[FACT]`; the differentiator is that every extracted fact is
source-linked and nothing consequential happens without a human.

**Deadline demo:** a synthetic call replay. Transcript animates, facts surface as
source-linked nodes, a conflict appears, AI proposes the next question, the human
confirms, the **real Move Record updates**, the audit event records it. No live
telephony.

## Module 2 — Move Wallet and Offer Graph `INTERACTIVE CONCEPT`

*One transparent place for every eligible move-in benefit.*

Not a coupon banner. An Offer Graph storing provider, campaign, service category,
geography, eligibility rules, dates, budget, partner restrictions, consent,
required disclosures, redemption state, and attribution. Eligibility is
determined by **rules and verified campaign data** — AI may explain an offer in
plain language but must never invent a discount, decide hidden eligibility, or
secretly rank providers by payment.

Any recurring charge must use clear consent and easy cancellation — the FTC
continues to emphasise informed consent and simple cancellation for recurring
charges `[FACT]`. No sneaky auto-subscription.

## Module 3 — Home Continuum `FUTURE HYPOTHESIS`

*Utility Connect stays useful after move-in.* An optional, customer-controlled
home profile: connected services, contract and promo periods, renewal windows,
approved vendors, warranty info, consent preferences. Lifecycle triggers at
7 days (activation check), 6 months (plan review), 11–12 months (renewal), and
life events (sale, remodel, new move). Each can create an opportunity; the
customer stays in control. This is the retention engine that turns a one-time
acquisition into a permissioned lifetime relationship — the direct answer to
LiveEasy's lifetime-concierge position.

## Module 4 — Partner Growth OS + Network Launchpad `INTERACTIVE CONCEPT`

Utility Connect joined the **LeadingRE** Solutions Group — a network publicly
described as ~550 firms and ~135,000 associates across 70+ countries `[FACT]`.
That scale makes repeatable enterprise onboarding a credible priority, not a
hypothetical one.

**Network Launchpad** `INTERACTIVE CONCEPT`: new brokerage → sample data →
AI-assisted field mapping → deterministic validation → contract tests → synthetic
referrals → white-label preview → **human approval** → launch → drift monitoring.
The value is not "AI mapping"; it is reducing the cost of launching and
maintaining large partner relationships. AI may suggest mappings and explain
errors; it may not activate an integration, set authorization rules, validate
consent, or modify production data.

## Module 5 — Provider Reliability Graph `FUTURE HYPOTHESIS`

Learn operationally from every handoff: submission latency, timeout rate,
unknown-outcome rate, reconciliation success, installation lead time. **No LLM
decides which provider is "best"** — the graph uses actual operational outcomes.
The prototype already emits the raw material: `provider_submissions`,
`reconciliation_jobs`, and the `provider.retry.blocked` count are all
`BUILT AND FUNCTIONING`.

## Module 6 — Service Continuity Graph `FUTURE HYPOTHESIS`

Utility Connect handles the transition into the home; authorized home-service
needs could later flow into a verified vendor workflow (need → permission →
attribution → vendor opportunity → job → completion → ROI visibility). Move Relay
and VendorHub **must not merge** into one product. They can share primitives:
provenance, consent, attribution, workflow state, human approval, external
actions, audit. That is portfolio-level thinking without pretending to know a
private roadmap.

## Module 7 — Scenario Compiler `INTERACTIVE CONCEPT`

*Test future workflows before customers experience them.* A leader describes a
scenario in plain language ("500 referrals, 10% missing consent timestamps, one
provider times out after creating the order, one partner tries to read another's
record"). The compiler turns it into synthetic referrals, workflow execution,
failure injection, permission tests, expected customer and partner state, audit
events, and a pass/fail replay. AI proposes the test definition; an engineer
approves before execution. This is genuine software-operations tooling, not
decorative AI — and the `scenario.test.ts` suite is a working seed of exactly
this idea.

## Module 8 — AI Operations Brain `FUTURE HYPOTHESIS`

Once enough properly-permissioned, anonymised operational data exists, AI answers
leadership questions by **citing operational records**, never by speculating:

> Not: "The AI believes customers prefer Provider A."
> Instead: "In this synthetic cohort, 18 records were delayed by missing
> apartment-unit information. Here are the corresponding workflow events."

AI as operational analyst, not fortune teller.

---

## The 3D treatment — one visual, the whole strategy

The Handoff Constellation first shows several sources converging into one verified
move. When the move completes it does not stop: the central home node expands into
a **lifecycle orbit** — utilities, internet, insurance, security, maintenance,
vendor services, partner relationship, renewal, next move. One visual carries the
entire business thesis: *a move begins as a point in time and becomes a long-term
network relationship.* Framer Motion handles interface state; Three.js handles the
one meaningful network visualization; Matter.js/Phaser, if used at all, belongs
only inside Scenario Compiler.

## The future-vision statement

> Utility Connect publicly demonstrates a strong acquisition moment: a customer is
> moving and needs multiple services. The hypothesis is to turn that moment into a
> permissioned, long-term home relationship. Move Relay makes the initial handoffs
> trustworthy. Concierge Compiler converts conversations into verified work. Move
> Wallet makes benefits transparent and attributable. Home Continuum keeps
> customers and partners engaged after move-in. Network Launchpad scales
> enterprise distribution. Scenario Compiler makes the whole system testable
> before real customers encounter it.

**The line to remember:**

> Utility Connect should not only connect the home. It can become the intelligence
> layer that keeps the home, customer, partner, concierge, provider, and vendor
> relationship connected over time — a compounding network powered by verified
> workflows, human trust, and carefully controlled intelligence.

---

## Scope boundary — what actually gets built by the deadline

**BUILT AND FUNCTIONING:** Move Relay end to end — ingestion, conflict
resolution, canonical Move Record, grounded briefing, provider failure and
reconciliation, customer and partner views, audit trail, Build Ledger.

**INTERACTIVE CONCEPT (if time permits, after the proof is solid):** Concierge
Compiler replay, Move Wallet eligibility, Network Launchpad preview, Scenario
Compiler replay, Continuum timeline.

**FUTURE HYPOTHESIS (described, not built):** live telephony, real benefits
marketplace, provider campaigns, memberships, lifecycle automation, Provider
Reliability Graph, Service Continuity Graph, VendorHub integration, portfolio
intelligence.

The functioning proof stays the centre. The future vision amplifies it. If the
two ever compete for time before the deadline, the proof wins — a smaller thing
that works beats a larger thing that only renders.
