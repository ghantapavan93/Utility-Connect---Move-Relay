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
export async function POST() {
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
