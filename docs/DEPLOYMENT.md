# Deploying on three free tiers

Neon holds the database, Vercel runs the application, Render runs the one timer
Vercel's free tier cannot. Every step below fits inside a free plan.

## What is actually being deployed

**One Next.js application.** The API routes under `/api/v1/*` are part of it, so
there is no separate backend service. Deploying to Render as well as Vercel
would deploy the same thing twice; Render is here for the scheduler only.

The database is the piece that has to be real. `src/lib/db.ts` runs against
PGlite — Postgres compiled to WASM, in-process — whenever `DATABASE_URL` is
absent. That is exactly right for a reviewer running `npm run dev` and exactly
wrong on a serverless host, where each invocation gets its own empty copy.
**Setting `DATABASE_URL` is what makes a deployment real**, and forgetting it
fails silently rather than loudly.

---

## 1 — Neon

1. **New Project**. Name it, take the current Postgres version, and pick the
   region you will also deploy Vercel to. Cross-region adds a round trip to
   every query.
2. **Connect** → copy the **Pooled connection string**. The host contains
   `-pooler`. This matters more than it looks: the direct endpoint opens one
   Postgres backend per connection, and a free project runs out during ordinary
   traffic. The pooled endpoint multiplexes them.
3. Keep `?sslmode=require` on the end. `pg` reads it from the string.

Load the schema from your own machine, pointed at Neon:

```bash
DATABASE_URL="postgresql://…-pooler…?sslmode=require" npm run db:migrate
```

```bash
DATABASE_URL="postgresql://…-pooler…?sslmode=require" npm run db:seed
```

Prove it before going further. This reads the live database and checks the
constraints the architecture claims:

```bash
DATABASE_URL="postgresql://…-pooler…?sslmode=require" npm run verify:db
```

It must print `12 passed, 0 failed`.

> **Free-tier behaviour worth knowing.** Neon suspends a project after five
> idle minutes. The first query after that takes a few hundred milliseconds
> longer while the compute resumes — it is not an error, and the five-minute
> drain in step 3 happens to keep it warm.

## 2 — Vercel

1. **Add New → Project**, import the repository. Framework detects as Next.js;
   change nothing about build or output.
2. **Settings → Environment Variables**, applied to Production, Preview and
   Development:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the Neon **pooled** string |
   | `CRON_SECRET` | `openssl rand -hex 32` |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` |

   Leave `ANTHROPIC_API_KEY` unset unless you want the model path — the
   deterministic path is the designed floor. Never set `RELAY_DB` or
   `RELAY_PG_SCHEMA`; both are test-harness controls and either one will
   quietly break a deployment.

3. Deploy, then check the two things that fail silently:

```bash
curl -s https://your-app.vercel.app/api/v1/health
```

Must report `"backend":"pg"`. If it says `"embedded"`, `DATABASE_URL` did not
reach the runtime and every write you make will disappear.

```bash
curl -s https://your-app.vercel.app/api/v1/stats
```

Must return real counts rather than an error.

## 3 — Render, for the timer

The outbox drains inline at the end of every write path, so projections are
never stale in normal operation. The gap is a process that commits and then dies
before its inline drain: those events wait until somebody writes again.
`POST /api/v1/ops/drain` closes it.

Vercel's free tier cannot run this, for two separate reasons:

- **Hobby runs cron at most once per day.** This wants every few minutes.
- **Vercel cron issues GET.** `GET /api/v1/ops/drain` is deliberately a
  read-only probe — it reports the backlog and drains nothing. A GET schedule
  would return `200` for ever while the queue grew, which is worse than a
  visible failure.

So the cron lives on Render, where it can issue a real authenticated POST.

1. **New → Blueprint**, point it at this repository. It reads `render.yaml`.
2. Set the two variables it asks for:

   | Name | Value |
   |---|---|
   | `MOVE_RELAY_URL` | `https://your-app.vercel.app` — no trailing slash |
   | `CRON_SECRET` | **the same value you set in Vercel** |

3. Trigger a run from the dashboard and read the log. A healthy run prints the
   JSON body and exits `0`.

If the secrets do not match you get `401`, and because the container uses
`curl -f` that becomes a failed run in Render's dashboard rather than a green
tick over a broken job.

---

## Verifying the whole chain

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/v1/ops/drain
```

Expect `{"ok":true,"dispatched":0,"backlog":0,"deadLettered":0,…,"protected":true}`.

- `"protected": false` means `CRON_SECRET` is not set on Vercel and the endpoint
  is open to anyone who finds it.
- A non-zero `backlog` that never falls means the drain is not running.
- `deadLettered` above zero means events exceeded their retry budget and are
  parked deliberately — they need looking at, not retrying.

## Things that will bite

**`DATABASE_URL` missing.** The single failure worth checking twice. No error,
no warning, and an empty database on every request. `/api/v1/health` is the tell.

**The unpooled Neon string.** Works under no load and fails under the first
concurrency you care about, with `remaining connection slots are reserved`.

**Pool size.** `src/lib/db.ts` defaults to 2 connections on Vercel and 10
elsewhere, because pool size is per process and serverless has many. Raising
`RELAY_PG_MAX` on a free Neon project is how you exhaust it.

**Preview deployments share the database.** Every Vercel preview points at the
same `DATABASE_URL`, so a preview branch writes into production data. Give
Preview its own Neon branch if that matters — Neon branching is free and
instant.

**The seed is not idempotent.** `npm run db:seed` assumes the schema it just
built. Re-running it against a live database is `db:reset` territory, which
drops everything.
