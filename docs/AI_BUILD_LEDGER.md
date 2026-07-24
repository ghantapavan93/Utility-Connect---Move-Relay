# AI Build Ledger

This project was built AI-assisted, and this ledger is the honest record of what
that meant. Every entry is a real moment from this build: something the AI
proposed or defaulted to, what was wrong or risky about it, the correction, and
the test or constraint that now prevents regression.

The defining line:

> **AI accelerated implementation. Engineering judgment determined what reached
> the product.**

An entry is only allowed here if it maps to a real commit and a real test.
Decorative entries — plausible-sounding lessons with nothing behind them — are
themselves recorded as a failure criterion in
[BUSINESS_VALUE.md](BUSINESS_VALUE.md §6). Every entry below cites its evidence.

---

## 1 · The retry-after-timeout duplicate

**Component** `provider-submission.ts`
**Risk** Highest in the codebase — a duplicate order at a real utility.

**The natural first implementation** treats a provider call like any other async
call: `try { await callProvider() } catch { retry() }`. A timeout is an error, so
it lands in `catch`, so it retries.

**Why that is wrong here.** A timeout does not mean the order failed. The provider
may have created it and then lost the response. Their own Terms of Service say the
customer contracts directly with the provider and Utility Connect only facilitates
— so the provider owns order truth, and retrying blindly risks enrolling a real
customer twice in a system Utility Connect neither controls nor is liable for.

**Correction.** A timeout resolves to a distinct `unknown` state, never `failed`.
`unknown` is deliberately excluded from the resubmittable set, a reconciliation
job is queued, and the only path out is to ask the provider what exists.

**Test.** `scenario.test.ts` Act 3 — after a timeout the provider ledger holds
exactly one order; a retry is attempted and the provider callback throws if
invoked; the ledger still holds exactly one order.
**Commit** `103334f`, proven end to end in `a5cf25c`, live in `b8c4c66`.

---

## 2 · PII heading for the audit log and the LLM

**Component** `audit.ts`, `briefing.ts`

**The default.** Audit detail is convenient as a dump of whatever context a
transition had. The briefing is convenient as "hand the record to a model and ask
for a summary."

**Why that is wrong here.** Utility Connect's privacy policy states registered
users' data includes a social security number. A context dump into an audit row —
read by operators — or into an LLM prompt is exactly how an SSN leaks.

**Correction.** `audit.ts` redacts a fixed set of sensitive paths (`customer.ssn`,
account numbers) in one place, `redact()`, applied on every write. The v1 briefing
generates from structured rows with **no model in the loop at all**, so there is no
prompt for PII to leak into; the future LLM seam is contractually limited to
rephrasing claims it is handed, each of which must cite a source field id.

**Test.** `projections.test.ts` — the customer and partner views never contain the
SSN or the provider account number (negative assertions). `briefing.test.ts` —
every substantive claim cites a source field id.
**Commit** `b8c4c66`.

---

## 3 · Frontend-only "safety" on the projections

**Component** `projections.ts`, `views/page.tsx`

**The tempting shortcut.** Fetch the full Move Record once, then hide the fields
each audience should not see in the React component.

**Why that is wrong here.** Hidden-in-the-client is not hidden. The data is in the
network response; anyone can open dev tools. For a partner-safe boundary that the
privacy policy makes a data-handling obligation, that is a real leak.

**Correction.** Projections are computed on the server by **allow-list** — start
from nothing, add only what is permitted. The browser receives only the permitted
fields. A deny-list was rejected because it leaks anything someone forgets to add
to it.

**Test.** `projections.test.ts` — 10 tests, including that a partner with no
attribution on a move sees `attributed: false` and no progress data, and that no
audience but the concierge can see the provider account number.
**Commit** `b8c4c66`.

---

## 4 · The LLM as the duplicate-merge authority

**Component** `ingestion.ts`

**The seductive version.** "Send both records to a model and ask whether they are
the same person, and which value to keep." It reads well in a demo.

**Why that is wrong here.** Identity resolution decides whose data is combined with
whose. A model that is 97% right will, at scale, eventually merge two different
families' moves — and there is no audit trail that makes that acceptable.

**Correction.** Duplicate scoring and conflict detection are fully deterministic,
with explicit inspectable weights. Phone carries only 0.05 weight because a single
mistyped digit is the most common defect in hand-exported data and must not split
one family into two. The AI may *explain* a conflict; the merge requires a named
human, enforced by the `canonical_requires_actor` CHECK constraint.

**Test.** `ingestion.test.ts` — the roommate case (same address, different people)
and the shared-surname case both stay distinct. `verify-constraints.mjs` — a
canonical value without a named actor is rejected by the database.
**Commit** `f7dee7c`, `8c7f804`.

---

## 5 · The missing database uniqueness constraint

**Component** `db/schema.sql`

**The default idempotency story** is an in-memory or Redis lock: check whether this
operation is in flight, and if so, skip.

**Why that is insufficient here.** A lock that lives in a cache disappears on
eviction or restart, and takes the correctness guarantee with it. Two requests
racing across a restart both proceed.

**Correction.** A unique index on `(organization_id, operation_key)` in Postgres.
The database refuses the second insert regardless of application state, and it
survives restart and eviction. Redis is kept only for short-lived locks and rate
limiting, where losing the lock is harmless.

**Test.** `verify-constraints.mjs` — a duplicate `operation_key` insert is rejected.
**Commit** `103334f`, `8c7f804`.

---

## 6 · `CREATE EXTENSION pgcrypto` — an AI-idiomatic default that broke portability

**Component** `db/schema.sql`

**What happened.** The schema opened with `CREATE EXTENSION IF NOT EXISTS
"pgcrypto"` — a common idiom for `gen_random_uuid()`, and exactly the kind of line
that gets emitted by default.

**Why it was wrong.** `gen_random_uuid()` has been in Postgres core since version
13; the extension bought nothing. Worse, it is absent from PGlite, and because the
schema runs inside a transaction, the failed `CREATE EXTENSION` aborted **every
subsequent statement**. The whole schema silently failed to build.

**How it was caught.** Not by reading — by running. `verify-constraints.mjs`
attempted to build the schema against a real engine and failed loudly. The lesson
is the general one: AI-idiomatic defaults are plausible, and only execution
distinguishes plausible from correct.

**Correction.** The line was removed. The schema now builds on stock Postgres and
on PGlite unchanged.
**Test.** `verify-constraints.mjs` builds the full schema before every guarantee
check.
**Commit** `8c7f804`.

---

## 7 · The bundler that broke WASM Postgres

**Component** `next.config.ts`

**What happened.** With PGlite added, the API routes returned
`f.instantiateWasm is not a function` at runtime — while every test passed.

**Why.** Vitest does not bundle, so the tests were fine. The Next server bundler
rewrites PGlite's WASM instantiation and breaks it. A green test suite did **not**
mean a working server; only starting the server and calling the API over HTTP
surfaced it.

**Correction.** `serverExternalPackages: ["@electric-sql/pglite", "pg"]` so the
native and WASM packages load as real externals rather than being bundled. The
full flow was then re-verified over HTTP, not just in tests.
**Commit** `b8c4c66`.

---

## 8 · A briefing that could quietly become theatre

**Component** `briefing.ts`, and the metric in `BUSINESS_VALUE.md`

**The subtle failure.** A briefing that is always accepted looks like success. In
the data, "accepted because it was perfect" and "accepted because nobody read it"
are identical.

**Correction.** The briefing records an `ai_run` with `human_decision` left null
until a human accepts, edits, or rejects — and the business framework records a
**near-100% acceptance rate as failure, not success**. The honest signal is the
edit rate, tracked separately.

**Test.** `briefing.test.ts` — an `ai_run` is recorded `grounded: true` with
`human_decision` null; generating a briefing never advances move state (it is
advice, not an action).
**Commit** `b8c4c66`.

---

## What this ledger is really claiming

Not that the AI was wrong and a human was right. That the two together produced
something neither would alone: fast implementation, held to an engineering
standard where every consequential rule is enforced by a constraint or a test that
a reviewer can run in one command.

Seven of these eight entries are failures the AI's own first instinct would have
shipped. Entries 6 and 7 were caught only by *running the code*, not reading it —
which is the single most transferable lesson here, and the reason the proof is
verified live rather than asserted.
