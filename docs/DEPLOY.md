# Deploying

The whole point of this repository is that a reviewer can check the claims
themselves. `npm run verify` does that locally with no services at all. This
document covers the other half: putting it somewhere a link can be clicked.

## The short version

```bash
npm install
npm run verify   # 11 schema guarantees + 234 tests, embedded Postgres, no Docker
npm run dev      # http://localhost:3000
```

That runs everything. Deployment adds nothing to the argument except reach.

## Vercel + Neon

**1 — a database.** Create a Postgres database (Neon's free tier is enough) and
copy its pooled connection string.

**2 — apply the schema.**

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

**3 — import the repository into Vercel** and set two environment variables:

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | the Neon pooled connection string | the server path |
| `RELAY_DB` | `pg` | selects real Postgres over the embedded fallback |

`NEXT_PUBLIC_SITE_URL` is optional. Set it to the deployed origin if you want
link previews to resolve before a custom domain is attached — without it the
metadata falls back to `VERCEL_URL`, which is correct but changes per
deployment.

**4 — seed the demo**, once, so the first visitor lands on a populated record
rather than an empty one:

```bash
curl -X POST https://<your-deployment>/api/v1/demo/reset
```

## What the cron does

`vercel.json` schedules `POST /api/v1/ops/drain` every five minutes.

The outbox is drained inline at the end of every write path, so under traffic
the projections are never stale. The cron covers the case that inline drain
cannot: a process that commits and then dies before dispatching leaves its
events undelivered until somebody happens to write again, which on a quiet
system may be never. A delivery guarantee that depends on future traffic is not
a guarantee.

The endpoint is idempotent and free when there is nothing to do, which is most
of the time. `GET` on the same path is the read-only probe — backlog depth and
dead-letter count, no side effects — if you want to point a monitor at it.

## The language model is optional

With nothing configured, the concierge briefing is assembled deterministically
from cited database rows. That is the designed floor, not a degraded mode.

Set `ANTHROPIC_API_KEY` to use a hosted model, or run [Ollama](https://ollama.com)
locally and it is discovered automatically. Either way the model only rewrites
claims that were already built from `field_versions` rows, and any line citing
an id that was not supplied is dropped before display.

## Honest notes

- **There is no authentication.** Identity is an `X-Actor` header — a demo
  stand-in, trivially forged, and labelled as such in the code. Authorization
  is real and decided server-side against relationship tuples. Deploy this
  publicly understanding that anyone can act as any demo actor.
- **All data is synthetic**, including every review on the marketing page.
- **Provider integrations are simulated**, with a separate ledger so that
  reconciliation interrogates a system that does not share our state.
- Not affiliated with Utility Connect.
