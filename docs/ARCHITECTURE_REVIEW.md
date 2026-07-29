# Move Relay — independent architecture review

**Reviewer stance:** principal engineer, adversarial, evidence-only.
**Date:** 2026-07-27 · **Commit under review:** working tree at `978d07f` + this session's changes.
**Method:** repository inventory and code reading. Counts recalculated, not recalled.

**Scope honesty:** this review reads the domain, database, outbox, authorization,
agent, and operational layers in depth. It samples the marketing pages and the
3D/cinematic components rather than auditing them line by line. Claiming
exhaustive coverage would be the same overclaim this review exists to find.

---

## 1. Executive verdict

**READY WITH SPECIFIC FIXES.**

**Is it technically credible?** Yes. [FACT] The core claim — a provider order is
created, the response is lost, and no second order is ever created — is enforced
by a database constraint rather than by application discipline
(`db/schema.sql:204-205`, `provider_submissions_operation_key_idx`), and is
executed end to end against a real Postgres engine in `scenario.test.ts` (21
tests). That is a genuinely strong proof and it survives restart and cache
eviction, which is the exact thing most candidate projects get wrong.

**Strongest engineering proof.** [FACT] The pairing of
`db/schema.sql:185-209` (one row per intent, unique on
`(organization_id, operation_key)`, plus `order_id_requires_settled_state`) with
`src/lib/provider-submission.ts:110-345`. The blind retry is not *discouraged*;
it is unrepresentable.

**Largest credibility risk.** [FACT] Three claims in the documentation and UI are
stronger than the code:

1. the outbox is documented as at-least-once and is at-most-once under crash;
2. projection idempotency is asserted but has no database constraint behind it,
   and the dead-letter replay path can produce a duplicate customer timeline
   entry;
3. "authorization is real, server-side" is true for one read route and **no
   write route**.

A reviewer who reads the code will find these in about twenty minutes. Fixing
them costs far less than being caught by them.

---

## 2. Verified inventory

All counts recalculated from the filesystem and from `npm run verify` output.

| Item | Verified count | Source |
| --- | --- | --- |
| Pages | **13** | `src/app/**/page.tsx` |
| API routes | **22** | `src/app/api/**/route.ts` |
| Tables | **23** | `grep '^CREATE TABLE' db/schema.sql` |
| Test files | **34** | `src/lib/__tests__/*.test.ts` |
| Tests | **296** | `npx vitest run` |
| Schema checks | **11 pass, 0 fail** | `npm run verify:db` (actual output below) |
| ADRs | **11** | `docs/DECISIONS/` |
| Docs | **12** | `docs/*.md` |

Actual `npm run verify:db` output:

```
  ✓ a canonical field value requires a named actor
  ✓ a canonical value inserts when an actor is named
  ✓ a second canonical value for the same field is impossible
  ✓ non-canonical versions of the same field remain unlimited
  ✓ one provider submission per operation key
  ✓ an UNKNOWN submission cannot claim a provider order id
  ✓ reconciliation may record the order id it recovered
  ✓ audit events cannot be updated
  ✓ audit events cannot be deleted
  ✓ identical payloads on one channel collapse to a single submission
  ✓ consent records scope, channel and wording version
11 passed, 0 failed
```

### Differences from published documentation

| Claim | Where | Reality |
| --- | --- | --- |
| "35 tests green" | `CLAUDE.md:151` | 296 [FACT] |
| "Commands: Not yet established — no application code" | `CLAUDE.md:188` | `verify`, `dev`, `build`, `db:reset`, `mcp` all exist [FACT] |
| "Deliberately deferred: … agents" | `CLAUDE.md:88` | Reversed by ADR-010; agent is built [FACT] |
| Deadline 2026-07-26 | `CLAUDE.md:149` | Passed |
| Directory map | `CLAUDE.md:138-145` | Missing `src/lib/agent/`, `mcp/`, `public/videos/`, `scripts/` |
| "11 schema guarantees proven by SQL that must be rejected" | `CLAUDE.md:153`, docs | Only **6 of 11** were rejection tests [FACT] — see §4 |

`CLAUDE.md` is not edited by this review, per its own rule.

---

## 3. Architecture strengths — evidence only

**[FACT] Idempotency is persisted and structural.** `provider_submissions` holds
one row per intent with `UNIQUE (organization_id, operation_key)`
(`db/schema.sql:204-205`). A retry updates; it cannot insert. Verified by
`verify-constraints.mjs` check 5 and by `scenario.test.ts`.

**[FACT] Illegal provider states are unrepresentable.**
`order_id_requires_settled_state` (`db/schema.sql:208-209`) forbids claiming an
order id while `unknown`. This is the constraint that stops "we think it
probably worked" becoming data.

**[FACT] Canonical truth is single and attributed.** A partial unique index
permits one canonical value per field, and `canonical_requires_actor` forbids a
canonical value with no named selector. Together these encode "AI cannot merge"
as a schema rule, not a policy — the strongest expression of the project's
thesis anywhere in the repository.

**[FACT] Optimistic concurrency on the consequential write.**
`approveMergeFor` (`src/lib/moves.ts:160-215`) bumps `moves.version` with
`WHERE version = $expected` inside `withTransaction`, throwing `StaleMergeError`
on zero rows; the route returns 409 with the current version
(`src/app/api/v1/moves/[id]/merge/route.ts:52-57`). Two concierges cannot
silently overwrite each other.

**[FACT] Outbox writes share the domain transaction.** `publish(client, …)`
(`src/lib/outbox.ts:35-54`) takes the caller's client, and every call site passes
the transaction client. An event therefore cannot commit without its state
change. This half of the outbox pattern is correct.

**[FACT] The agent's authority is data, checked server-side.**
`invokeTool` (`src/lib/agent/tools.ts`) checks the tier *before* parsing
arguments and before any model output is consulted; forbidden tools are defined
rather than omitted so a refusal is a row. Three consumers share the registry
(agent, HTTP route, MCP bridge) and `agent-tools-route.test.ts` walks the
registry rather than naming tools.

**[FACT] The provider simulator keeps its own ledger.**
`src/lib/provider-simulator.ts:66` — reconciliation interrogates a store that
does not share our state, so the recovery proof is not circular.

---

## 4. Vague, stale, contradictory, or overclaimed

### 4.1 "11 schema guarantees proven by SQL that must be rejected"

*(The claim as written at review time. Since corrected — see the addendum.)*

**Evidence:** `scripts/verify-constraints.mjs`. Of 11 checks:

- **6 are true rejection tests** (canonical requires actor; second canonical
  impossible; duplicate operation key; unknown cannot claim order id; duplicate
  payload hash; consent purpose outside the enum).
- **3 are positive controls** (canonical inserts *with* an actor; non-canonical
  versions unlimited; reconciliation *may* record an order id). These are
  valuable — they prove the constraint is not simply blocking everything — but
  they are not "SQL that must be rejected".
- **2 are silent-ignore tests** (audit update, audit delete): the statement
  *succeeds* and the assertion is that the data did not change
  (`verify-constraints.mjs:160-171`).

**Corrected wording:** *"11 schema checks: six statements the database must
reject, three positive controls proving the constraints are not over-broad, and
two proving audit history is immune to update and delete."*

### 4.2 Audit immutability is silent, not loud

**[FACT]** `UPDATE audit_events SET actor='tampered'` returns success and
changes nothing. **[INFER]** implemented with a `RULE`, since a trigger would
raise.

**Risk:** a caller that believes it amended audit history receives no error.
Silent no-ops are how a bug survives a code review.

**Recommendation:** keep the ignore semantics if deliberate, but say so
explicitly in the schema comment and in docs. Do not describe it as "rejected".

### 4.3 "Authorization is real (relationship tuples, server-side)"

**[FACT]** `checkView` is called from exactly two production paths:
`src/lib/actor.ts:92` (serving `/api/v1/views`) and `src/lib/theater.ts:210-212`
(a scripted demonstration). Every consequential **write** route performs no
authorization check:

- `POST /api/v1/moves/[id]/merge` — derives the org from the move and proceeds
  (`merge/route.ts:34-49`);
- `POST /api/v1/agent/runs/[id]` — requires an `X-Actor` header but never checks
  whether that actor may act on this move;
- `POST /api/v1/agent/tools/[name]`, `/api/v1/ops/*`, `/api/v1/referrals`.

**Corrected wording:** *"Relationship-based authorization is implemented and
enforced on the audience projection route. Write routes currently authenticate
an actor by header but do not yet authorize it. Both facts are stated on the
page."* — or fix it (see §9).

### 4.4 Migrations

**[FACT]** `scripts/migrate.mjs` applies `db/schema.sql` wholesale.
**[FACT]** `db/schema.sql` contains **zero** `IF NOT EXISTS` clauses (verified by
grep). Re-running against a populated database therefore fails, and `--reset`
runs `DROP SCHEMA public CASCADE`.

There is no migration versioning, no reversibility, and no expand-and-contract
path. **[INFER]** a schema change cannot currently be deployed to a live
database without destroying it. For a demo this is defensible; describing it as
a migration system would not be.

---

## 5. Critical correctness risks

### RISK-1 — The outbox loses events on crash · **Severity: high · Likelihood: certain under crash**

**Current behaviour.** `dispatch` (`src/lib/outbox.ts:66-107`) commits the
claim with an autocommit `query`, *then* runs the handler outside any
transaction:

```
INSERT INTO outbox_consumers …  ← committed
await handler(event)            ← separate transaction(s)
```

**[FACT]** If the process dies between those two lines, the event is claimed
forever. `dispatch` skips it (the `LEFT JOIN` excludes claimed rows), `backlog`
reports zero, and `deadLetters` never sees it. The event is silently and
permanently lost.

**Contradiction.** The module comment states *"Delivery is at-least-once —
crashes can cause redelivery"* (`outbox.ts:13-15`). Under this implementation it
is **at-most-once**.

**Desired invariant.** A crash at any point must leave the event eligible for
redelivery.

**Smallest sufficient fix.** Claim and handle inside one transaction, so a crash
rolls back the claim with the work.

**Missing test.** A handler that throws *after* writing, asserting the claim did
not survive.

**Operational recovery today.** None automatic. Manual: `DELETE FROM
outbox_consumers WHERE consumer=… AND event_id=…`. Requires knowing an event was
lost, which nothing reports.

### RISK-2 — Duplicate customer timeline entries are reachable · **Severity: high · Likelihood: moderate**

**[FACT]** `customer_timeline_entries.source_event_id` carries **no unique
constraint** (`db/schema.sql:420-431`). Projection idempotency rests entirely on
the outbox claim.

**[FACT]** `replayDeadLetters` (`outbox.ts:124-139`) deletes the claim and
re-dispatches. A handler that writes an entry and *then* throws — a partial
success — is dead-lettered, and replay writes the entry a second time.

**This is precisely the reported symptom:** *"Your electric service is
scheduled"* appearing twice.

**The existing test does not cover it.** `cqrs.test.ts:123-128` re-runs the
projector and asserts nothing was added — but the event is already claimed, so
it proves the claim works, not that the projection is idempotent. The rebuild
test (`:130-144`) deletes the timeline *and* the claims together, so it never
exercises double-write either.

**Required proof.** Same logical event delivered twice ⇒ exactly one entry.

**Smallest sufficient fix.** A partial unique index on `source_event_id`, plus
`ON CONFLICT DO NOTHING` in `addEntry`. The constraint makes the guarantee
structural rather than procedural — the same move the provider path already
makes.

### RISK-3 — Consequential writes are unauthorized · **Severity: high (as a claim) · Likelihood: certain**

Covered in §4.3. Anyone who can reach the API can merge any move, approve any
agent proposal, and read any move's provenance by id. There is no tenant check
beyond "the move exists".

**[ASSUME]** For a public demo this may be intended. It is not currently stated
where the claim is made.

### RISK-4 — No concurrency test exists · **Severity: medium**

**[FACT]** `vitest.config.ts` sets `fileParallelism: false` and every suite is
sequential. The guards (`UNIQUE`, optimistic version) are structurally sound
**[INFER]**, but no test runs two writers at once. Sequential tests are being
presented as evidence of concurrency safety.

### RISK-5 — Proven only under PGlite · **Severity: medium**

**[FACT]** `src/lib/db.ts:34` selects the backend from `DATABASE_URL`; tests
default to embedded. **[ASSUME]** behaviour is identical on a real server —
plausible (same engine) but unproven in-repo. PGlite is single-connection, so it
cannot exhibit the interleavings RISK-4 is about.

---

## 6. AI and agent assessment

**Actual model contribution: currently none in the agent path.** [FACT]
`runCaseAgent` (`src/lib/agent/case-agent.ts`) contains no model call. The plan
is control flow; `model` defaults to the string `"deterministic"`. The model
appears only in the *briefing* path (`ai-gateway.ts`), which is a separate
feature.

**This is the right design and it is under-stated rather than over-stated.**
The page says "its plan is ordinary code", which is accurate. A reviewer asking
"where is the AI?" should be told plainly: the agent is a governed tool-using
runner with a deterministic policy, and the model's job is explanation, not
decision.

Answers to the specific questions, all [FACT] unless noted:

| Question | Answer |
| --- | --- |
| Can the model invent a tool name? | It cannot call tools at all today. An unknown name to `invokeTool` returns a recorded refusal. |
| Can customer text affect tool authority? | No. Authority is checked from the registry before any content is read. Proven by `agent/eval.ts` injection cases. |
| Can an old approval be reused? | No. Conditional `UPDATE … WHERE state='awaiting_approval'` inside a transaction; second attempt 409s. |
| Is authorization rechecked at execution? | **No — there is no authorization at all on this path.** See RISK-3. |
| Can the model decide retry safety? | No. The refusal is structural. |
| Can core workflows run with AI disabled? | Yes. [FACT] `resolveAdapter()` returns null and the briefing falls back deterministically, recorded as `ai_runs.fallback`. |
| Are citations validated against real field versions? | Yes for the briefing — unknown ids are dropped. **[ASSUME]** cross-tenant citation is not separately tested. |
| Are prompts/models/registries versioned per run? | Partially. `ai_runs.prompt_version` and `model` exist. `agent_runs` records `model` but **not** a tool-registry version — an original run cannot be distinguished from a replay under a changed registry. **[HYPO]** add a registry hash. |

**Evaluation quality: genuinely good.** `agent/eval.ts` measures server
enforcement (`forbiddenBlockRate` computed from `agent_steps` rows), not text.
`falseAllClearRate` exists because that bug shipped. This is the most credible
AI artifact in the repository.

**Do not add LangGraph, LangChain, RAG, or a vector database.** No requirement
in this codebase is unmet by the current typed runner. **The custom runner is
the smallest sufficient solution.** The MCP server is already read-only and
justified by ADR-011.

---

## 7. Backend depth assessment

| Dimension | Verdict |
| --- | --- |
| Transactions | **Strong.** Domain write + audit + outbox share one transaction throughout. |
| Idempotency (provider) | **Strong, structural.** |
| Idempotency (projection) | **Weak.** Procedural only — RISK-2. |
| Concurrency | **Structurally sound, untested.** RISK-4. |
| External side effects | **Well isolated.** Separate simulator ledger; `provider_request_key` now persisted. |
| Outbox | **Half correct.** Publish is right; dispatch loses events — RISK-1. |
| Replay | Works for a full rebuild; unsafe for partial dead-letter replay — RISK-2. |
| Authorization | **Implemented, barely wired.** RISK-3. |
| Privacy | `maskPII` before the model; `redact()` on audit detail; spans documented as pre-scrubbed. **[ASSUME]** quarantined submissions and dead-letter payloads retain raw input — appropriate for forensics, but retention policy is absent. |
| Migrations | **Absent.** §4.4. |
| Operations | Real controls (`sweep`, `drain`, dead-letter replay) with no authorization and no audit event of their own. |

---

## 8. Frontend truthfulness assessment

**[FACT] Labels are accurate where checked.** `/agent`, `/demo`, `/moves`,
`/views`, `/reliability` read live database state through real routes. `/future`
is labelled FUTURE HYPOTHESIS.

**[FACT] The Handoff Constellation communicates real state on `/agent`.** The
new `AgentConstellation` derives every line state from `agent_steps` rows —
severed strands are recorded refusals, the green gate is a committed approval.
It is not decorative.

**[FACT] A real defect was found and fixed during this session**: `/agent` held
a run whose row had been cascade-deleted by a demo reset and still offered an
Approve button, then surfaced a raw UUID.

**Gaps [FACT]:**

- No page has a **permission-denied** state, because no page can be denied.
- **Stale data:** `/moves` and `/agent` fetch once on mount; another tab's reset
  is invisible until reload.
- **Partial-data:** `/agent` renders `run.summary` unconditionally; a `failed`
  run shows the failure sentence but no distinct visual treatment.
- **Mobile/reduced-motion:** `useStillness()` is honoured in the new components.
  **[ASSUME]** older cinematic pages are compliant; not re-verified here.

**Recommendation, per the review's own instruction:** do **not** extend the
constellation treatment to the remaining pages yet. The reviewer path has three
correctness defects above it. Fix those first; the diagram work is cheap and
uncontroversial afterwards.

---

## 9. Top improvements

Ranked. The first three are must-fix.

**1. Make projection idempotency structural.** Partial unique index on
`customer_timeline_entries(source_event_id)`, `ON CONFLICT DO NOTHING` in
`addEntry`. Files: `db/schema.sql`, `src/lib/projector.ts`. Test: same event
dispatched twice ⇒ one row. No ADR. Proof: a test named for the duplicate
headline.

**2. Make the outbox genuinely at-least-once.** Claim and handle in one
transaction. Files: `src/lib/outbox.ts`, `src/lib/projector.ts` (handler takes a
client). Test: handler throws after writing ⇒ claim rolled back ⇒ redelivered.
No ADR — this restores the documented behaviour.

**3. State the authorization boundary truthfully, or enforce it.** Smallest
sufficient: require an actor on consequential writes and check it with the
existing `checkView` graph; where the demo intentionally allows anyone, say so
in the UI. Files: merge route, agent decision route, `src/lib/actor.ts`. ADR only
if the model changes.

4. Add two real concurrency tests (parallel merge; parallel dispatch) against
   `RELAY_DB=pg`.
5. Run the suite once against a real Postgres and record the result.
6. Record a tool-registry version on `agent_runs` so a replay is distinguishable.
7. Give operational controls their own audit events.
8. Add a retention note for `quarantined_submissions` and `dead_letter_events`.
9. Add a stale-data affordance (refresh, or poll) to `/moves` and `/agent`.
10. Correct the "11 guarantees" wording everywhere it appears.

**Deliberately do not build:** LangGraph/LangChain, RAG, vector DB, more agents,
streaming agent steps, a second MCP transport, invented SLO targets.

---

## 10. Five-minute reviewer path

1. `npm install && npm run verify` — 11 schema checks, 364 tests, ~2 minutes.
2. `/demo` — press play; watch `moves.state` and `provider_submissions.state`
   change from Postgres.
3. `/agent` — "What should happen next?" Watch the strand reach
   `submit_provider_enrollment` and break at the boundary.
4. Approve. Gate turns green: order `RLNT-1001` recovered.
5. `docs/DECISIONS/ADR-010` — why the plan is deterministic.
6. `db/schema.sql:185-209` — the constraint that makes it all true.

---

## 11. Questions only Pavan can answer

1. **Is the deployed demo intended to be publicly writable?** The answer decides
   whether §4.3 is a bug or a documented stance.
2. **Has the suite ever run against a real Postgres server?** If yes, record it;
   if no, RISK-5 stands.
3. **What is the deadline now?** `CLAUDE.md:149` has passed.
4. **Is audit's silent-ignore semantics deliberate**, or should tampering raise?

---

---

## Addendum — verification phase, 2026-07-27

### Verification A — does one event ever legitimately produce two entries?

**Yes.** [FACT] `projector.ts:123-124` maps `provider.confirmed` and
`provider.reconciled` to the same customer sentence. Two outbox rows, two ids,
one meaning — so uniqueness on `source_event_id` could not see the duplicate.

**Resolved.** Uniqueness moved to a stable logical key:
`customer_timeline_entries.projection_key`, unique per `(move_id,
projection_key)`. `source_event_id` is retained as provenance and is no longer
the deduplication key. Keys carry their subject (`service.scheduled:electric`)
so a household with two services hears about both. Proven by
`projection-logical-key.test.ts` — the failing assertion before the fix was
`expected 2 to be 1`.

### Verification B — is claim + handler in one transaction DB-local only?

**Yes today, unguarded structurally.** [FACT] Every `dispatch()` caller passes a
database-only handler: `projector.ts:154` (`projectEvent`, SQL only),
`theater.ts:122,125` (counters), and the test handlers. No `fetch` occurs inside
any handler, so no transaction is held across a network call.

**[INFER]** This is convention, not a control. The `Handler` type now receives a
`Queryable` and its doc comment states the constraint, but nothing prevents a
future handler from calling out. Worth a lint rule or a runtime guard if a
non-projection consumer is ever added.

### Resolved since the review

| Risk | Status |
| --- | --- |
| RISK-1 outbox at-most-once | **Fixed.** Claim and handler share a transaction; dead-letter rows suppress hot retry instead of the claim. |
| RISK-2 duplicate timeline entries | **Fixed twice** — first on `source_event_id`, then correctly on the logical key. |
| RISK-3 unauthorized merge | **Fixed.** `requireConciergeWrite` gates before the body is parsed; actor comes from the header, never the payload. |
| §4.1 "11 guarantees … must be rejected" | **Corrected.** Now 12 checks, 8 of them true rejections. |
| §4.2 audit silently ignores mutation | **Fixed.** `audit_events_immutable()` raises `restrict_violation`; corrections are appended. |

### New: the palette told a lie, and now does not

`ConflictConstellation` drew a locally selected candidate in `#0087B5` —
*verified* — on the strength of a click. It would have gone on asserting that
through a 403 or a 409. A `proposed` state now exists (locked token, "selected,
not yet committed"), `transit` covers in flight, and **verified is reachable
only from a committed phase**. `constellation-semantics.test.ts` asserts
reachability from source rather than from a rendered snapshot, because the
property being guarded is "is there any path from selection state to the
verified token".

---

## Addendum 2 — PostgreSQL isolation unit, 2026-07-27

### Evidence, kept separate by backend

| Backend | Result | How obtained |
| --- | --- | --- |
| **PGlite (embedded)** | 12 schema checks, **335/364 tests** | `npm run verify` |
| **PostgreSQL 17.8 (local)** | **335/364 tests, 42 files** | `RELAY_DB=pg` against a freshly created `move_relay_test`, schema applied by `scripts/migrate.mjs` |
| **PostgreSQL 16 (CI)** | **no evidence yet** | Job added to `.github/workflows/ci.yml`; has not run |

**No claim of PostgreSQL support is made.** Local 17.8 is not CI 16, and the
job has not executed.

### A product defect found before any test could catch it

**[FACT]** `withTransaction` issued `BEGIN`, the work, and `COMMIT` as three
independent calls on the shared handle (`db.ts:96-109` as it stood). Under
`RELAY_DB=pg` that handle is a `Pool`, and each call may be served by a
different connection — so `BEGIN` opened a transaction on one connection, the
writes committed individually on others, and `COMMIT` closed an empty
transaction elsewhere.

Sequentially the pool returns the same idle connection, which is why the suite
passed and why nothing surfaced. It would have broken the moment two writers
ran at once — that is, in the concurrency tests themselves, where the failure
would have been read as a flaky test rather than as a missing transaction.

**Fixed.** The pg backend now exposes `transact`, which checks out one client,
runs `BEGIN`/work/`COMMIT` on it, and releases in `finally`. PGlite keeps the
old path because it has one connection and nothing to interleave.

### Classification of the seven earlier PostgreSQL failures

| Class | Count | Detail |
| --- | --- | --- |
| **Invalid test assumption** | 7 | Every suite assumed a private database. Under PGlite that was true by accident — Vitest isolates modules per file, so each file got a fresh in-memory instance. On a shared server a new outbox consumer legitimately receives *every* unclaimed event, so `ops.test.ts` published one and dead-lettered five. |
| **Product defect** | 1 | The pooled-transaction bug above. Found by reading, not by a failing test. |
| **Portability defect** | 0 detected | **No portability defects were detected by the current suite on PostgreSQL 17.8.** The same DDL applies unaltered to both backends. This is not a claim of zero portability defects: untested PostgreSQL-specific behaviour remains around concurrency, locking, time zones, collations, migration behaviour, and connection interruption. |
| **Documentation drift** | 1 | `fitness.test.ts` — stated counts. Corrected. |

### The isolation harness

Schema per test file, not a truncate hook. `src/lib/__tests__/setup-pg-schema.ts`
creates `t_<uuid>`, applies the production DDL inside it, points `search_path`
at it via the pool's `options`, and drops only that schema afterwards. A hook
that deleted rows from whatever database a connection string named would be a
loaded gun aimed at a developer's local database the first time an environment
variable was wrong.

Proven by `harness-isolation-a/b.test.ts`, which assert both halves:

- file B cannot see file A's row, and starts with an empty `organizations`;
- two separate clients inside one file **do** observe each other's commits —
  the property a concurrency test needs, and the one a truncate hook would have
  destroyed.

The proof was itself wrong first: importing the marker from a `.test.ts` file
registered file A's suites inside file B, so B planted the marker it then
"found". The only visible symptom was Vitest reporting 5 tests for a file
defining 3. The marker now lives in a plain module.

---

## Addendum 3 — transaction primitive proofs, 2026-07-27

### Evidence by backend

| Backend | Result |
| --- | --- |
| **PGlite** | 12 schema checks · **340 passed, 3 skipped (343)** · `npm run verify` |
| **PostgreSQL 17.8 local** | **343/343, 43 files** · `RELAY_DB=pg`, fresh database |
| **PostgreSQL 16 CI** | **still unproven** — workflow exists, has not run |

**Concurrency guarantees remain unproven.** The three concurrency suites
(merge, provider submission, two-worker outbox) are not written.

### The proofs, and the one that mattered

`src/lib/__tests__/transaction-primitive.test.ts`:

1. **Rollback atomicity** — two writes then a throw leave nothing committed.
2. **Connection pinning** — `pg_backend_pid()` four times inside one callback
   returns one PID; and two *simultaneously open* transactions get different
   PIDs, so the first assertion is not vacuous.
3. **Release after failure** — a failed transaction releases its client; 15
   consecutive failures against a pool capped at 10 do not exhaust it.

**The first three passed against the broken implementation.** That was the
finding worth having. With a single caller the pool hands back the same idle
connection every time, so `BEGIN`, the writes and `ROLLBACK` all land together
and behave correctly. A proof that cannot fail is not a proof.

A fourth test forces contention: twelve concurrent pool queries run *between*
two writes inside one open transaction. Verified in both directions by
temporarily restoring the old code path:

```
BROKEN:   × rolls back even while the pool is under contention
            → expected [ 'tx-contended-b-1785147873054' ] to deeply equal []
REPAIRED: ✓ rolls back even while the pool is under contention
```

Under the pool-level implementation the second write **escaped the transaction
and committed**. That is the defect, reproduced, on PostgreSQL 17.8.

### `withTransaction` caller audit

Every caller passes the transaction client through; no callback falls back to
the global pool. **[FACT]** `provider-submission.ts` already implements the
required pattern — reserve in a transaction (`:146`), commit, call the provider
outside any transaction (`:254`, commented at `:247-249`), persist the result in
a new transaction (`:259`). Line 208 is sequential, not nested.

### Rollback-failure semantics

`ROLLBACK` failures were being swallowed by a bare `.catch(() => {})`. The
application's error is now rethrown unchanged and the rollback failure is
attached as its `cause`, so neither fact is lost.

---

## Addendum 4 — first domain concurrency proof, 2026-07-27

### Evidence by backend

| Backend | Result |
| --- | --- |
| **PGlite** | 12 schema checks · **340 passed, 8 skipped (348)** |
| **PostgreSQL 17.8 local** | **348/348, 44 files** · 0 leaked test schemas |
| **PostgreSQL 16 CI** | **still unproven** — workflow exists, no green run |
| Production build | clean |

**Precise status:** the current suite passes on PostgreSQL 17.8 locally.
PostgreSQL 16 CI and the remaining domain concurrency guarantees are unproven.

### Concurrent merge — proven

`src/lib/__tests__/concurrent-merge.test.ts`, PostgreSQL only. It skips under
PGlite rather than pretending: one connection cannot host two writers, and
presenting that as concurrency evidence would be the precise failure this review
exists to catch.

Both writers read the version, then meet at an explicit two-party barrier, then
write. Two promises started near each other are not a race — the first can
finish before the second begins. The barrier is what makes the lost-update
window real.

Proven: exactly one winner; the loser receives `StaleMergeError`; the version
increments exactly once; exactly one canonical value exists and it is the
*winner's*; exactly one `move.canonical.approved` audit event exists and it
names the winner; the losing actor never appears as approver; and the route maps
a stale version to **409** with the current version, not 500.

### Rollback-failure handling, tightened

- The application error remains the primary thrown object.
- `cause` is left alone — it belongs to the application, and overwriting it even
  when empty would lose context a caller might later add.
- The rollback failure is attached as a non-enumerable `rollbackError`.
- A client whose `ROLLBACK` failed is **destroyed**, not recycled: its
  transactional state is unknown and the next caller would inherit it.

### Contention proof, strengthened

The test now records `pg_backend_pid()` for both transactional writes and for
the competing pool work, and asserts both writes shared one backend while at
least one competitor used a different one. Without that, a future `max: 1` pool
would silently turn the test back into a sequential green.

### Harness checklist — partially closed

| Item | Status |
| --- | --- |
| Schema names generated internally, quoted | **Done** — `t_<uuid-hex>`, always double-quoted |
| Under the 63-byte identifier limit | **Done** — 22 characters |
| `search_path` on every pool connection | **Done** — set via the pool's `options`, applied at connection start |
| Separate files cannot share rows | **Proven** — `harness-isolation-a/b` |
| Separate clients in one file share the schema | **Proven** — same pair |
| No leaked schemas after a run | **Verified: 0** |
| Pool closed before schema drop | **Not done** — the drop currently races a still-open pool |
| Cleanup failures fail the suite visibly | **Not done** |
| Objects cannot be created in `public` | **Not enforced** — `search_path` ends with `public` as a fallback |

---

## Addendum 5 — harness closure and two-worker outbox, 2026-07-27

### Evidence by backend

| Backend | Result |
| --- | --- |
| **PGlite** | 12 schema checks · **340 passed, 18 skipped (358)** |
| **PostgreSQL 17.8 local** | **355/355, 45 files** · 0 leaked test schemas |
| **PostgreSQL 16 CI** | **still unproven** — workflow exists, no green run |
| Production build | clean |

The 18 PGlite skips are the PostgreSQL-only concurrency and pinning tests. They
skip rather than running a single-connection imitation.

### Harness checklist — closed

| Item | Status |
| --- | --- |
| Pool closed before schema drop | **Fixed** — `closeDb()` ends the pool and clears the cached handle before `DROP SCHEMA` |
| Cleanup failures visible | **Fixed** — the drop is verified against `information_schema.schemata` and throws if the schema survived; `DROP … IF EXISTS` reports success either way, so the check is the only thing that distinguishes "cleaned up" from "silently did nothing" |
| No objects in `public` | **Fixed** — `search_path` is the test schema alone. With `public` appended, a statement that failed to resolve in the test schema would quietly succeed against the shared one and write to a table no cleanup drops. Safe because `gen_random_uuid()` has been in `pg_catalog` since PostgreSQL 13 |

Asserted in `harness-isolation-b.test.ts`: `SHOW search_path` contains no
`public`, and `moves` exists in the test schema.

### Two-worker outbox — proven

`src/lib/__tests__/concurrent-outbox.test.ts`, PostgreSQL only, five proofs:

- **Exclusive processing** — two workers race for one event through a barrier
  placed *inside* the handler, so neither can finish and release before the
  other tries. One handler application, one completed consumer record.
- **Rollback and takeover** — an abandoned handle leaves no claim; the event is
  dead-lettered and a later replay succeeds.
- **Dead-letter suppression** — three ordinary dispatches after a permanent
  failure produce one attempt.
- **Safe replay** — a replayed event is handled once and not redelivered.
- **History versus projection** — `provider.confirmed` and `provider.reconciled`
  both survive in `outbox_events` while exactly one
  `customer:electric:scheduled` entry exists.

### A second instance of the same mistake

The first version of these tests failed for a reason worth recording: each test
used a fresh consumer, and a fresh consumer legitimately receives **every**
unclaimed event in the schema — including the ones earlier tests in the same
file had published. Three assertions failed with counts of 2, 3 and 4.

This is the identical assumption that broke the suite when it first met a real
server ("I am the only publisher"), reappearing one scope smaller: within a file
rather than across files. The fix is the same in spirit — scope the assertion
rather than the database. Every count is now bound to a specific event id, so
the tests exercise the contention instead of removing it.

---

## Addendum 6 — concurrent provider submission, 2026-07-27

### Evidence by backend

| Backend | Result |
| --- | --- |
| **PGlite** | 12 schema checks · **340 passed, 21 skipped (361)** |
| **PostgreSQL 17.8 local** | **358/358, 46 files** · 0 leaked test schemas |
| **PostgreSQL 16 CI** | **still unproven** — workflow exists, no green run |
| Production build | clean |

### A real defect: the fingerprint was stored and never read

**[FACT]** `submitToProviderImpl` computed `fingerprint(input.payload)` on every
call and wrote it on insert. **Nothing ever compared it.** Phase 2 branched only
on `state`, so the same operation key carrying *different content* — a corrected
move date, a changed address — took the ordinary duplicate path and received the
first submission's confirmed result.

The second caller was told their change had been accepted. The provider had
never been told anything. That is worse than either honest outcome: worse than
rejecting, and worse than resubmitting.

Reproduced before fixing:

```
× refuses the second payload rather than silently accepting it
  → expected null to be an instance of Error
```

**Fixed.** `IdempotencyConflictError` is raised when
`prior.request_fingerprint !== fp`, checked *ahead of* the state branches — a
conflicting payload is a conflict whether the prior intent is confirmed, unknown
or failed, and the answer never depends on how the first one turned out. The
stored payload is left untouched and the provider is not called.

### Same key, same fingerprint — proven

Two callers meet at a barrier, then submit. One intent row; **at most one
provider-simulator ledger call**; neither caller receives a raw database error.

The contention is evidenced rather than assumed: exactly one caller reports
`deduplicated: false` and one reports `true`, and both name the same
`submissionId`. Without that assertion the test would pass whether or not the
window ever opened — the same trap the transaction proofs fell into, where three
tests passed against the very defect they were written for.

### The abandoned-reservation window — unrecovered, and now recorded

**[FACT]** The reserve-then-call design commits the intent before calling the
provider, which is correct and deliberate. It creates a window: the process dies
after the commit and before `callProvider` begins, leaving a row in `submitted`
with no provider order.

**Nothing currently recovers it.** `sweepUnknownOutcomes` selects
`state = 'unknown'` only (`ops.ts:39`), so a stranded `submitted` row is outside
its reach. There is no lease column, no age-based sweep, and no operational
surface that lists these rows.

`concurrent-provider.test.ts` records the state rather than asserting a recovery
that does not exist. The remedy — a reservation lease plus a stale-reservation
sweep — is a design decision, not a test fix, and is listed as outstanding.

---

## Addendum 7 — local PostgreSQL 16 run, 2026-07-27

**This is not CI evidence.** The workflow in `.github/workflows/ci.yml` has still
never executed. What follows is the same sequence of steps, run by hand against
a `postgres:16` container. It is labelled **local PostgreSQL 16** everywhere and
no PostgreSQL 16 compatibility claim is made on its basis.

| Step | Result |
| --- | --- |
| Server version | `PostgreSQL 16.14 (Debian 16.14-1.pgdg13+1) on x86_64-pc-linux-gnu` |
| Schema from zero | **23 tables** |
| Schema guarantees | **12 passed, 0 failed** |
| Transaction primitive proofs | **8/8** |
| Concurrency suite | **13/13** (merge 5, outbox 5, provider 3) |
| Complete integration suite | **358/358, 46 files** |
| Leaked test schemas | **0** |
| Other open connections after the run | **0** |
| Production build | clean |

Regression on the other two backends after the fix below: PGlite 12 schema
checks and 340 passed / 21 skipped; PostgreSQL 17.8 358/358.

### A flaky test, found only because a second version was tried

`tracing.test.ts` — *"keeps every span of one trace together and in order"* —
failed on the first PostgreSQL 16 run. Measured rather than assumed:

```
PostgreSQL 16.14 : 5 runs → 2 failures
PostgreSQL 17.8  : 5 runs → 0 failures
```

**[FACT]** Not a version behaviour difference. The test asserted retrieval order
— child before parent, "because the child ends first" — and that was never a
guarantee the implementation made. Span writes are fire-and-forget, so the two
inserts race, and `trace_spans.started_at` is the *row's insert time*, not the
span's start time. Whichever insert reaches the server first gets the earlier
timestamp. PostgreSQL 17.8 happened to lose that race consistently; 16 did not.

**Fixed on both sides.** `traceById` now orders `started_at ASC, id ASC` so
repeated reads are at least stable. The test asserts what a trace actually
promises — every span shares the trace id and the child names its parent —
rather than an ordering nothing enforces. Stable across 6 consecutive PG16 runs.

A second assumption surfaced while fixing it: the first replacement asserted the
parent span had no parent. It does. `newTrace()` establishes a root context
whose span is never written, so `probe.parent` legitimately points at it. That
was my assumption, not the code's behaviour, and the failing assertion is what
said so.

### What this run does and does not establish

**Does:** the production DDL applies to PostgreSQL 16.14 from zero; all 358
tests pass there; the concurrency and transaction proofs hold on 16 as well as
17.8; no schemas or connections leak.

**Does not:** anything about the repository's CI environment. `gh` is
unauthenticated and the local repository has no configured remote, so the
workflow cannot be triggered from here.

---

## Addendum 8 — trace semantics corrected, 2026-07-27 · not pushed

### Three defects, all silent

**1. `started_at` was insertion time.** [FACT] `startSpan` captured the true
start to compute `duration_ms` and discarded it; the column defaulted to
`now()` at insert, which for a fire-and-forget write lands after the span has
finished. Measured: parent work began at +0 ms, ran 316 ms, recorded start
**+353 ms**.

**2. One dangling parent per trace.** [FACT] `newTrace()` minted a span id and
never persisted a row for it. Empirically confirmed before the fix:

```
ROOT_CTX_SPAN_ID(never persisted)=c4e42a32-ca72-45
DANGLING=1
DANGLE probe.parent -> c4e42a32-ca72-45
```

**3. Failed writes were invisible.** `.catch(() => {})` recorded nothing, not
even a count.

### The corrections

- `started_at` / `finished_at` carry real runtime values; `created_at` holds
  insertion time; `CHECK (finished_at >= started_at)`.
- `TraceContext.spanId` is `string | null`; `newTrace()` returns `null`, so the
  first application span persists with `parent_span_id = NULL`.
- **No foreign key on `parent_span_id`** — a child finishes and persists before
  its parent, so completeness is verified after flush rather than enforced per
  row.
- Failed writes increment a counter and emit one structured warning;
  `tracingHealth()` exposes pending/failures.
- `flushTracing({ timeoutMs })` waits on tracked promises with a bounded
  timeout. Called from tests and controlled shutdown only, never a request path.
- Retrieval: `ORDER BY started_at ASC, id ASC` — `id` as tie-breaker only.

**Stated guarantee:** trace persistence is best-effort and non-authoritative. A
graceful flush attempts to persist pending spans; abrupt process termination may
lose in-flight telemetry.

### The tests were verified to fail first

`trace-semantics.test.ts`, 11 assertions. Each defect was restored and the suite
re-run:

```
started_at = write time restored  → 2 failed
  "expected 1785188055293 to be less than 1785188055292"
  "created_at should trail the true start by at least the span's duration:
   expected 1 to be >= 50"

invented root restored            → 2 failed
  "a fresh trace has no span until one is opened: expected '5a50a674-9e89-4e' to be null"
  "a span references a parent that was never written: expected [ …(4) ] to deeply equal []"
```

### Reverification — not pushed

| Backend | Version | Result |
| --- | --- | --- |
| **PGlite** | embedded | 12 schema checks · **351 passed, 18 skipped (369)** |
| **PostgreSQL local** | 17.8 | **369/369** |
| **PostgreSQL local** | **16.14** (`Debian 16.14-1.pgdg13+1`) | schema from zero **23 tables** · guarantees **12/12** · transaction proofs **8/8** · trace semantics **16/16** · concurrency **13/13** · complete suite **369/369** |
| Leaked test schemas | PG16 | **0** |
| Other open connections | PG16 | **0** |
| Dangling `parent_span_id` | PG16 | **0** |
| Production build | — | clean |
| **PostgreSQL 16 CI** | — | **never run** |

The 18 PGlite skips are the PostgreSQL-only concurrency and pinning tests.

### Still outstanding from this phase

Not started, and not claimed: **PostgreSQL 16 CI job**, **concurrent merge
test**, **concurrent provider-submission test**, **two-worker outbox test**,
**migration ledger and ordered migrations**, **public-demo isolation**. RISK-4
(no concurrency test) and RISK-5 (PGlite-only) therefore stand unchanged. The
three remaining constellation pages — `/reliability`, `/views`, `/architecture`
— are also not started.

---

## Verdict

**READY WITH SPECIFIC FIXES.**

The engineering that matters is real and constraint-backed. The risk is not that
the system is weak — it is that three statements about it are stronger than the
code, and the reviewer most likely to check is the one being courted. Fix
RISK-1, RISK-2, and RISK-3, and the project's central virtue — saying only what
is true — holds all the way down.
