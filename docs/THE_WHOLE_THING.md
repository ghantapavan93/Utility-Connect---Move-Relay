# Move Relay — the whole thing, explained

*A single document that explains what this is, what problem it solves, what
exists in the front end and the back end, every page and where its data comes
from, and how a request actually flows through the system.*

Written to be read start to finish by a person who has never seen the
repository — or loaded whole by an agent that needs the map before it touches
anything.

---

## Part I — What this is, and what it is not

### The one-sentence version

**A move arrives from three different places, no two of them agree, a provider
creates an order but the reply is lost — and the system never creates a second
order.**

Everything else in this repository exists to make that sentence true and to
make it *visible*.

### What it is

Proof-of-work for an application to the **AI-Assisted Full-Stack Software
Engineer** role at Utility Connect (The Colony, TX). It is a concept redesign of
their public marketing site with a **working platform underneath it** — real
Postgres, real transactions, real constraints, 364 tests, no mocks.

### What it is not

- Not affiliated with Utility Connect. Stated on the site, in the README, and in
  the LICENSE.
- Not a CRM, a dashboard, or "adding AI" to someone's business. Utility Connect
  has years of proprietary platform experience; nothing here assumes otherwise.
- Not a mockup. Every screen labelled **BUILT AND FUNCTIONING** reads from a
  live database.

### The problem it actually solves

When a household moves, their information arrives at a service company from
several directions at once: a realtor's API, a spreadsheet upload, and the
customer's own web form. These disagree — a transposed phone digit, a move date
that changed after the partner submitted it. Someone has to decide which value
is true, and that decision has consequences: an electricity account gets opened
at an address, on a date, for a person.

Then the harder problem. You send the enrolment to the provider. The connection
times out. **You do not know whether the order was created.** Retrying might
create a second one — a duplicate household enrolment, a real bill for a real
person. Not retrying might leave them with no electricity on move-in day.

Most systems guess. This one does not.

### The thesis

> Every move becomes a living digital twin. Every handoff becomes visible,
> attributable, reversible, and verifiable. AI accelerates the people operating
> the system, but **AI never becomes the source of truth**.

### The three labels

Every element on the site carries exactly one, and they are never blurred:

| Label | Meaning |
| --- | --- |
| **BUILT AND FUNCTIONING** | Real code, real database, covered by tests |
| **INTERACTIVE CONCEPT** | Explorable, not wired to a backend |
| **FUTURE HYPOTHESIS** | Reasoned about, not built |

---

## Part II — The story the system tells

This is the demo narrative. It is not a storyboard; `scenario.test.ts` executes
it against a real Postgres engine on every commit.

**Customer:** Maya Patel · **Partner:** North Texas Realty

1. **Partner API** submits her move — date **Aug 14**.
2. **CSV upload** submits the same customer — with **one wrong phone digit**.
3. **Customer web form** submits — date **Aug 16**, adds home security, confirms
   consent.

Then:

4. **Duplicate detected** — deterministically, by scoring. Not by a model.
5. **Conflict surfaced** — the dates disagree. The system does not pick.
6. **A named human decides** — and the choice is recorded with who made it.
7. **One canonical record** exists, every field still remembering its source.
8. **Concierge briefing** generated, every claim citing a specific field version.
9. **Provider submission** — the request goes out.
10. **The response times out.** State becomes `UNKNOWN`. Not "failed" — unknown.
11. **The blind retry is refused.** Structurally, by a unique constraint.
12. **Reconciliation** asks the provider what actually exists. It finds the order.
13. **Projections update** — customer, partner, and concierge each see their own
    truth.
14. **Every transition is in the audit trail**, append-only, undeletable.

**The timeout is the centrepiece.** One real failure, one real recovery, one
order, never two.

---

## Part III — The back end

### Is there a real architecture?

Yes. This is not a front end with a fake API. Here is what actually exists.

### The database — 23 tables

Postgres, running two ways from one schema file: a real server (`DATABASE_URL`)
or **PGlite**, Postgres compiled to WebAssembly, in-process. The embedded mode
means a reviewer can clone the repo and verify every claim with `npm install`
and one command — no Docker, no connection string, no cloud account.

| Group | Tables | What they do |
| --- | --- | --- |
| **Tenancy** | `organizations`, `partners` | Who the record belongs to, who referred it |
| **Provenance** | `raw_submissions`, `field_versions` | Every value ever supplied, with channel, verification level, confidence, what it superseded, and who selected it |
| **Canonical** | `moves`, `service_requests` | The one true record, with an optimistic-concurrency `version` |
| **Consent** | `consent_events` | Purpose, channel, and the exact wording version agreed to |
| **Provider** | `provider_submissions`, `reconciliation_jobs` | One row per intent, with `operation_key` and `provider_request_key` |
| **Idempotency** | `idempotency_records` | Persisted, never Redis-only |
| **Audit** | `audit_events` | Append-only, enforced by database rules |
| **Workflow** | `workflow_executions`, `workflow_steps` | Durable steps that survive restart |
| **CQRS** | `outbox_events`, `outbox_consumers`, `dead_letter_events`, `customer_timeline_entries` | Events → outbox → projections |
| **Authorization** | `auth_tuples` | Relationship-based; enforced on the projection and merge routes |
| **Quarantine** | `quarantined_submissions` | Malformed input is held, never silently dropped |
| **Observability** | `trace_spans` | Spans as rows, queryable |
| **AI** | `ai_runs` | One generation: model, cited field ids, grounded flag, what the human did |
| **Agent** | `agent_runs`, `agent_steps` | Many steps, each with an authority level and outcome |

### The eleven schema guarantees

The database refuses things. `npm run verify:db` runs 11 checks: six statements the database **must reject**, three positive controls proving the constraints are not over-broad, and two proving audit history survives update and delete.

The rejections include a canonical field with no actor, a second canonical value
for one field, a duplicate provider operation key, and an order id claimed in a
state where that is meaningless. These are not conventions. They are constraints.

### The service layer

| Module | Responsibility |
| --- | --- |
| `ingestion.ts` | Deterministic duplicate scoring, conflict detection |
| `provider-submission.ts` | Submit, hold `UNKNOWN`, block blind retry, reconcile |
| `provider-simulator.ts` | Six failure modes, its **own ledger** separate from ours |
| `workflow.ts` | Durable steps, parking and resuming |
| `outbox.ts` / `projector.ts` | Events out, read models rebuilt |
| `projections.ts` | Three audiences, three different truths |
| `authz.ts` / `actor.ts` | Relationship tuples; gates the audience projections and the canonical merge. Other routes are ungated in this demo |
| `consent.ts` | Recording and gating on consent |
| `audit.ts` | Append-only writes with redaction |
| `tracing.ts` / `observability.ts` / `slo.ts` | Spans, structured logs, error budgets |
| `ai-gateway.ts` | Model adapters, PII masking, citation-dropping, fallback |
| `ai-eval.ts` | Golden cases for the AI pipeline's defences |
| `agent/tools.ts` | The tool registry and its three authority tiers |
| `agent/case-agent.ts` | The concierge case agent |
| `agent/eval.ts` | Adversarial evaluation of the agent's boundary |

### The AI boundary — the hard line

**AI may:** suggest CSV column mappings · explain structured conflicts · draft an
editable briefing · summarise anomalies · propose tests.

**AI must never decide:** consent validity · customer identity · the final
duplicate merge · partner attribution · authorization · provider eligibility ·
pricing · availability · whether an order succeeded · **whether a retry is
safe** · financial outcomes · state transitions · deletion.

This is not a prompt instruction. It is enforced by a tool registry that checks
authority server-side before any model output is consulted.

---

## Part IV — The front end

Next.js 16 · React 19 · TypeScript strict · Tailwind 4 · Framer Motion (one
motion language) · React Three Fiber (exactly one signature 3D experience).

### The design language

The signature visual is **The Handoff Constellation** — sources converging into
one record. Line state carries meaning, and the same language recurs everywhere:

| State | Meaning |
| --- | --- |
| Solid | Verified |
| Dashed | Pending |
| Split | Conflicting |
| Pulsing | In transit |
| Red break | Failed |
| Rejoined | Recovered |
| **Locked node** | **Human approval required** |

**If it is decorative, it is wrong.**

Colour is measured from Utility Connect's live site, not approximated. `#0087B5`
carries exactly one meaning: **verified**. Conflict is **amber**, because a
conflict needs judgement — it is not a failure. Green is recovered. Red is a
genuine break. Purple is locked.

Motion is sub-280ms, `ease-out`, transform and opacity only, interruptible.
Mobile works with no 3D. Reduced motion is honoured for real — `useStillness()`
combines the OS preference with an in-page toggle, because CSS alone cannot stop
scroll-driven inline transforms.

---

## Part V — Every page, and where its data comes from

**13 pages.** Marketing surface first, then the operator console.

### The marketing surface

#### `/` — Home
A faithful reconstruction of Utility Connect's marketing site in their own light
theme, with the platform argument added on top. Opens with a **two-part
scroll-expansion film** (a photoreal architectural clip, then a brand
cinematic), which grows from a framed 16:9 card into the full viewport as you
scroll. Muted always, with an explicit **Unmute** control.

Below: the constellation given its own room, how-it-works, count-up statistics,
the provenance hook, the platform section, front-door modernization, industries,
a review wall, partners, and an About section that combines the explanation with
a closing film that ends on the two things a visitor can actually do.

**Data:** static copy plus `resolveMarketingVideo()` reading `public/videos/`
from disk at build time. Slots render **nothing at all** when a file is absent.

#### `/connect-flow` — Enrollment
The customer-facing service setup flow. **Writes real records** through
`/api/v1/move`.

#### `/industries/[slug]` — Nine industry pages
Brokers and agents, property management, mortgage and title, and six more.
Generated statically from `industries-data.ts`.

#### `/story` — The Living Move
A scroll-driven cinematic of one move's life. React Three Fiber. This is the
**one** signature 3D experience the rules permit.

#### `/future` — Future platform
**FUTURE HYPOTHESIS.** What the platform could become, labelled as unbuilt.

### The operator console

#### `/demo` — Live workflow ← *start here*
The nine-step demo, playable. Opens with a **nine-band film** of generated step
illustrations, sides alternating, scroll-coupled. Below it a console that plays
itself, with a live state band reading `moves.state` and
`provider_submissions.state` **from Postgres**.

**Data:** `POST /api/v1/demo/[step]` → `demo-orchestrator.ts` → real service
functions → real tables.

#### `/moves` — Move queue
Every move in the tenant, with open-conflict counts.
**Data:** `GET /api/v1/moves`.

#### `/moves/[id]` — Conflict workspace
Field-by-field provenance. Which channel supplied each value, what it
superseded, whether the customer confirmed it. Where a human resolves a conflict.
**Data:** `/api/v1/moves/[id]/conflicts`, `/api/v1/moves/[id]/merge`.

#### `/agent` — Concierge case agent ← *the newest*
Pick a case, ask **"What should happen next?"**, and watch the agent read the
record, read the provider state, check the audit history, **reach for
resubmission and be refused**, then propose reconciliation. Approve, and the
real `reconcile()` runs.

Three cyan hollow nodes for the reads, a filled **locked** node for the refusal,
and the connecting line goes dashed there — the run does not continue past a
refusal, so the line must not imply it did.

Below: the **published tool registry** in three authority tiers, and a
**guardrail evaluation** you can run from the page.

**Data:** `/api/v1/agent/runs`, `/api/v1/agent/runs/[id]`, `/api/v1/agent/evals`.

#### `/dashboard` — Overview
Operational state across the tenant. **Data:** `/api/v1/stats`.

#### `/views` — Audiences
The same move rendered three ways — customer, partner, concierge — to show that
a projection is a *decision about what someone should see*, not a filter.
**Data:** `/api/v1/views`.

#### `/theater` — Failure Theater
Run a chosen failure mode against the provider simulator and watch the invariant
hold. **Data:** `/api/v1/theater/[scenario]`.

#### `/reliability` — Reliability
SLOs, error budgets, the outbox drain, and the unknown-outcome sweep — as
buttons a reviewer can press. **Data:** `/api/v1/slo`, `/api/v1/ops/*`.

#### `/architecture` — Architecture
The system explained in its own visual language.

---

## Part VI — Every API route

| Route | Purpose |
| --- | --- |
| `POST /api/v1/move` | Create a move from the enrollment form |
| `GET /api/v1/moves` | The move queue |
| `GET /api/v1/moves/[id]/conflicts` | Competing values for one move |
| `POST /api/v1/moves/[id]/merge` | Human-approved canonical selection |
| `POST /api/v1/referrals` | Partner API intake |
| `POST /api/v1/upload/csv` | CSV channel |
| `GET /api/v1/provenance` | Field-level source history |
| `GET /api/v1/views` | Customer / partner / concierge projections |
| `POST /api/v1/demo/[step]` | Drive one demo step |
| `POST /api/v1/theater/[scenario]` | Run one failure mode |
| `POST /api/v1/ops/sweep` | Reconcile every open `UNKNOWN` |
| `POST /api/v1/ops/drain` | Drain the outbox |
| `GET /api/v1/slo` | Error budgets |
| `GET /api/v1/stats` | Tenant statistics |
| `GET /api/v1/engineering` | Build and test evidence |
| `GET /api/v1/health` | Liveness and database latency |
| `POST /api/v1/agent/runs` | Start an agent run |
| `GET /api/v1/agent/runs` | The published tool registry |
| `GET /api/v1/agent/runs/[id]` | Read a run back |
| `POST /api/v1/agent/runs/[id]` | Approve or reject its proposal |
| `POST /api/v1/agent/tools/[name]` | Invoke one read-only tool; anything else refused |
| `POST /api/v1/agent/evals` | Run the guardrail evaluation |

### One registry, three consumers

The tool registry in `src/lib/agent/tools.ts` decides what an AI may touch, and
it now answers to three callers:

```
agent/case-agent.ts  ──┐
                       ├──►  invokeTool()  ──►  authority check  ──►  run or refuse
POST /api/v1/agent/tools/[name]  ──┤
                       │
mcp/server.mjs  ───────┘   (JSON-RPC over stdio → HTTP)
```

A tool that is forbidden is forbidden identically through all three. That
matters because a boundary with one caller is not a boundary — it is a
convention that caller happens to observe. The test walks the registry rather
than naming tools, so a forbidden tool added later by someone not thinking about
HTTP or MCP is still checked.

### The MCP server

`mcp/server.mjs` — read-only Model Context Protocol access for Claude Desktop,
an IDE, or any MCP client. Six tools: `list_moves`, `get_move_record`,
`list_field_conflicts`, `get_provider_operation`, `get_audit_history`,
`get_consent_status`.

It is a **bridge, not a copy**. The process holds no database credentials and
knows no SQL; it speaks JSON-RPC on stdio and HTTP to the application. If the app
is down, every call fails with a connection error — which is the honest failure.
A second path into the data that works while the application does not is exactly
the thing worth not building.

No MCP SDK. MCP over stdio is line-delimited JSON-RPC 2.0 with three methods
that matter, and this project's rule is that no dependency arrives without an
ADR. See `docs/DECISIONS/ADR-011-mcp-read-only.md` and `mcp/README.md`.

```bash
npm run dev     # the application
npm run mcp     # the bridge
```

---

## Part VII — How a request actually flows

### Ingestion

```
Partner API / CSV / Web form
   ↓  raw_submissions          ← the original, never edited
   ↓  field_versions           ← one row per value, per source
   ↓  assessDuplicate()        ← deterministic scoring
   ↓  detectConflicts()        ← disagreements surfaced, not resolved
   ↓  [ human selects ]        ← recorded: who, when, why
   ↓  moves                    ← canonical, version bumped
```

### Provider submission and the timeout

```
submitToProvider()
   ↓  claim the intent          ← UNIQUE (organization_id, operation_key)
   ↓  call the provider
   ├─ responds        → confirmed, order id stored
   ├─ rejects         → failed
   └─ times out       → UNKNOWN          ← we do not know
                          ↓
                       blind retry BLOCKED — structurally, by the unique index
                          ↓
                       reconcile() asks the provider, using provider_request_key
                          ├─ order exists     → reconciled  (recovered)
                          └─ genuinely absent → pending     (now safe to resubmit)
```

That `provider_request_key` matters more than it looks. It is the identifier
**the provider** knows the request by. Ours (`operation_key`) is meaningless to
them. Ask with the wrong one and you get "no order found" — which is precisely
the answer that makes resubmission look safe. That bug existed here and is now
a column, a throw, and a test.

### Events and projections

```
service function → outbox_events (same transaction)
                      ↓ drain
                   projector → customer_timeline_entries
                      ↓ replayable: drop it, replay, get it back
```

### The agent

```
runCaseAgent()
   get_move_record        [read_only]        → ok
   get_provider_operation [read_only]        → ok, finds state 'unknown'
   get_audit_history      [read_only]        → ok
   submit_provider_enrollment [forbidden]    → REFUSED, recorded as a row
      ↓
   proposes request_provider_reconciliation
      ↓
   [ awaiting_approval ]
      ↓ named human approves
   reconcile() — the same function the concierge's own button calls
```

The agent's **plan is deterministic**. That is deliberate: a model choosing
between "reconcile" and "submit again" would be deciding retry safety, from
input that includes customer notes — text any stranger can write. The
evaluation suite plants exactly that attack and measures that it changes
nothing.

---

## Part VIII — What is honest about this

Stated everywhere, never hidden:

- **No authentication.** Identity is an `X-Actor` header, trivially forged, and
  labelled as such. Authorization is real where it is applied — the audience
  projections and the canonical merge are decided server-side against
  relationship tuples before any write. Ingestion, CSV upload, the operational
  sweeps and the agent's read tools are **ungated**: a deliberate trade for a
  public reviewer sandbox, not a finished access-control surface.
- **Provider integrations are simulated**, with a ledger deliberately separate
  from ours so reconciliation interrogates a system that does not share our state.
- **`valid_at` has a column and a reader but no producer.** Bitemporality is
  designed, not shipped.
- **The demo orchestrator bypasses two of the four instrumented paths.**
- **No performance numbers anywhere.** No invented metrics, ever.
- **Internal Utility Connect architecture is unknown** and is never assumed.
- **Not deployed.** `vercel.json` and `docs/DEPLOY.md` are ready.

---

## Part IX — Running it

```bash
npm install
npm run verify     # 12 schema checks + 364 tests, no Docker needed
npm run dev        # http://localhost:3000
```

Then open **`/demo`** and press play. Everything else follows from there.

---

## Appendix — For an agent reading this cold

- **Read `/CLAUDE.md` first.** It governs everything and must not be edited
  without explicit instruction.
- The database is the source of truth. Not XState, not frontend state.
- Idempotency is persisted, never Redis-only.
- Every claim gets tagged `[FACT]` / `[INFER]` / `[ASSUME]` / `[HYPO]`.
- No new dependency without an ADR in `docs/DECISIONS/`.
- Never use Utility Connect's own images, logos, reviews, or contact details.
- Write the test before the fix, so the failure is visible first.
- **Measure, do not assume.** `tsc` and the test suite do not parse CSS; a CSS
  edit that "passes" can still break every route. Screenshot the page.
