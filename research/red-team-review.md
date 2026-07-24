# Red-Team Review

A deliberately hostile read of this project, written to find the reasons a
skeptical founder or CTO could dismiss it. Nothing here is softened. Where a
weakness has since been addressed, it says so; where it stands, it stands.

The test each finding is held to: *would this survive thirty seconds of a
skeptical technical reviewer poking at it?*

## The thirty-second dismissal to beat

> "Impressive plumbing, but it's a scripted demo of one path, the AI isn't real,
> and it isn't even deployed."

That sentence is the adversary. Each clause is addressed below, honestly.

---

## Severe

### R1 — Not deployed
**Status: OPEN.** The single most damaging gap. "A deployed premium public
experience" is deliverable #1, and the project runs on localhost. Until there is a
URL a founder can open, this is a repository, not a proof of work. Blocked only on
external accounts (Vercel + a hosted Postgres); the code is deploy-ready
(`output: standalone`, dual pg/PGlite, `DATABASE_URL` switch).

### R2 — The running product contains no real LLM
**Status: OPEN, mitigated by framing.** For an *AI* engineering role this is the
sharpest critique. The concierge briefing is deterministic; the LLM seam
(`renderNarrative`) throws by design. The framing is honest and defensible
(ADR-004: grounded and testable over fluent and unverifiable), and it is genuinely
the right v1 engineering call — but a reviewer scanning for "did they use an LLM"
finds a template engine. The strongest possible answer is to add one gated,
grounded LLM call behind a key, so "AI-assisted" is literally true, not only
architecturally seamed.

### R3 — It is one hardcoded scenario
**Status: OPEN by design, a real limit.** The whole system only ever runs Maya
Patel through three fixed payloads. The duplicate detection, conflict logic, and
reconciliation are real and tested — but they have only executed on identical
input. There is no arbitrary ingestion, no form that submits a new move into the
engine. Off the golden path there is little there. Mitigation would be a single
"submit your own move" path feeding the same real pipeline.

---

## Serious

### R4 — The hard part is simulated
**Status: OPEN, disclosed (ADR-006).** The genuinely difficult real-world piece —
messy provider APIs — is the piece that is faked. The simulation is faithful and
honestly labelled, and an honest simulation of the *failure* is arguably the right
call for a proof. But it remains true that the happy-path integration nobody
doubts is absent, and the failure nobody builds is simulated.

### R5 — No authentication, no request-layer multi-tenancy
**Status: OPEN.** Tenancy is in the schema (`organization_id` everywhere) and the
projections are tested for isolation at the function level — but there is no login
and no authorization middleware. The "cross-tenant security tests" the brief lists
do not exist as request-level tests. The isolation is proven as pure functions,
not behind a real auth boundary.

### R6 — Observability is claimed more than built
**Status: PARTIALLY OPEN.** The audit trail is real, append-only, and complete.
But the wider observability the architecture gestures at — OpenTelemetry traces,
a `/health` endpoint, structured JSON logs — is not wired. The correlation and
causation ids exist in the schema; nothing exports them.

---

## Moderate

### R7 — Phantom ADR references
**Status: FIXED (this pass).** The docs and code referenced ADR-003/004/005/007
while `docs/DECISIONS/` was empty — the exact overclaiming the project condemns.
All seven ADRs are now written and cross-linked. Called out here because it was
real, and because catching it is the point.

### R8 — The future vision is mostly prose
**Status: OPEN, honestly labelled.** Concierge Compiler, Network Launchpad,
Scenario Compiler are described and labelled FUTURE / CONCEPT, not built as
interactive concepts. That is honest, but a reviewer hoping to click them finds a
static page and a sidebar marked "soon."

### R9 — Everything runs via `next dev`, not a production server
**Status: OPEN, understood.** PGlite's WASM is mangled by the standalone bundler,
so the local demo runs in dev mode. In a real deployment (`DATABASE_URL` → hosted
Postgres) the `pg` path is used and this vanishes — but as shipped, "it runs" means
"in dev."

---

## What the adversary cannot say

To be fair to the work, these dismissals do **not** survive contact:

- *"It's a mockup."* No — 51 tests, real Postgres, live HTTP verified end to end.
- *"The AI decides things it shouldn't."* No — critical decisions are deterministic
  or human-gated, enforced by constraints, not policy.
- *"It insults the company."* No — ADR-007 and on-page disclaimers hold the line.
- *"The guarantees are hand-waved."* No — 11 of them are executable SQL that must
  be rejected.
- *"The design is generic AI slop."* Partly defended — brand-anchored, motion that
  communicates state, though a reviewer may still find the dashboard aesthetically
  close to the genre.

## The honest one-line verdict

**Deep and narrow.** The correctness spine is genuinely strong and rare for a
take-home. The breadth around it — deployment, real AI, arbitrary ingestion,
request-layer security, the vision made interactive — is thin or open. The single
highest-leverage fix is deployment; the second is one real, gated LLM call.

## Priority order to close the gaps

1. **Deploy** (R1) — converts a repo into a URL. Needs accounts only.
2. **One grounded LLM call** (R2) — makes "AI-assisted" literal. Needs a key.
3. **Submit-your-own-move** (R3) — breaks the single-scenario limit.
4. **`/health` + structured logs** (R6) — cheap, kills an easy jab.
5. **Auth boundary** (R5) — larger; turns function-level isolation into real
   multi-tenancy.
