import { NextResponse } from "next/server";
import { runProjector } from "@/lib/projector";
import { backlog, deadLetters } from "@/lib/outbox";

/**
 * POST /api/v1/ops/drain
 *
 * Drains the transactional outbox and reports what it found.
 *
 * The outbox has always had a dispatcher — `runProjector()` runs inline at the
 * end of every write path, which is why the projections are never stale in
 * normal operation and why the CQRS tests pass. What it did not have is a way
 * to run *without* a write.
 *
 * That gap is small and real. A process that commits a transaction and then
 * dies before the inline drain leaves its events undelivered, and they stay
 * undelivered until somebody happens to write again — which on a quiet system
 * could be a long time. Delivery guarantees that depend on future traffic are
 * not guarantees.
 *
 * This is the timer's entry point: idempotent, safe to call when there is
 * nothing to do, and safe to call concurrently with an inline drain because
 * dispatch is exactly-once per consumer at the database level rather than by
 * coordination. Point a scheduler at it and the "nobody wrote again" case
 * stops existing.
 *
 * It reports the backlog *after* draining rather than the number dispatched,
 * because the number that matters operationally is what is still waiting. A
 * response of `{ dispatched: 0, backlog: 0 }` is the healthy steady state and
 * reads as one.
 */
/**
 * Is this caller allowed to cause a drain?
 *
 * Enforced only when `CRON_SECRET` is set, which is deliberate: local
 * development and the test suite call this with no configuration, and a route
 * that 401s on a developer's machine gets commented out rather than
 * understood. In any deployment the variable is set, and then it is required.
 *
 * The response reports which mode it is in, so "I thought I had set it" is a
 * question a `curl` answers rather than an assumption someone carries.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    /*
      A public URL with an unauthenticated write is a public URL somebody will
      eventually find. Draining is idempotent and safe, so the risk is not
      corruption — it is that anyone can make this database do work on demand,
      on a free tier metered by exactly that.
    */
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const dispatched = await runProjector();

  const [remaining, dead] = await Promise.all([
    backlog("projector"),
    deadLetters("projector"),
  ]);

  return NextResponse.json({
    ok: true,
    dispatched,
    backlog: remaining,
    deadLettered: dead.length,
    // Stated on the response rather than only in a comment: a caller looking at
    // this in isolation should be able to tell what guarantee it carries.
    delivery: "exactly-once per consumer, enforced by a unique constraint",
    // Whether CRON_SECRET was enforced on this call. Cheaper to read than to
    // assume, and the assumption is the one that goes wrong quietly.
    protected: Boolean(process.env.CRON_SECRET),
  });
}

/**
 * GET is the read-only half — a health probe for the queue.
 *
 * A scheduler needs to be able to ask "is anything stuck?" without causing a
 * side effect, and an operator looking at a dashboard should not have to drain
 * the queue to find out how deep it is.
 */
export async function GET() {
  const [remaining, dead] = await Promise.all([
    backlog("projector"),
    deadLetters("projector"),
  ]);

  return NextResponse.json({
    ok: true,
    backlog: remaining,
    deadLettered: dead.length,
    healthy: remaining === 0 && dead.length === 0,
  });
}
