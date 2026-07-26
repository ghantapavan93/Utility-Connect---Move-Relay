import { query } from "./db";
import { newTrace, traced } from "./observability";
import { installTracing } from "./tracing";
import { dispatch, type OutboxEvent } from "./outbox";

/**
 * The customer-timeline projector.
 *
 * A CQRS consumer: it reads domain events from the outbox and writes the
 * customer_timeline_entries read model — in customer language, not system
 * language. The translation table below IS the projection boundary:
 *
 *   provider.unknown       → "We're confirming with the provider"
 *                             (never the word UNKNOWN — ambiguity is an
 *                              internal concern, handled internally)
 *   provider.retry.blocked → NO ENTRY AT ALL
 *                             (a blocked retry is pure machinery; the customer
 *                              timeline is not a debug log)
 *
 * Because the outbox is replay-safe and the dispatcher is exactly-once per
 * consumer, this read model can be dropped and rebuilt from events at any
 * time — the definition of a projection rather than a second source of truth.
 * Each row keeps the id of the event that produced it: even the projection
 * has provenance.
 */

async function serviceType(serviceRequestId: string | undefined): Promise<string> {
  if (!serviceRequestId) return "home";
  const rows = await query<{ service_type: string }>(
    `SELECT service_type FROM service_requests WHERE id = $1`,
    [serviceRequestId],
  );
  return rows[0]?.service_type ?? "home";
}

async function addEntry(
  event: OutboxEvent,
  moveId: string,
  headline: string,
  detail: string | null,
  tone: "info" | "progress" | "done",
): Promise<void> {
  await query(
    `INSERT INTO customer_timeline_entries
       (organization_id, move_id, headline, detail, tone, source_event_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [event.organization_id, moveId, headline, detail, tone, event.id],
  );
}

async function projectEvent(event: OutboxEvent): Promise<void> {
  const payload = event.payload as {
    moveId?: string;
    serviceRequestId?: string;
  };
  const moveId = payload.moveId;
  if (!moveId) return;

  switch (event.event_type) {
    case "referral.received": {
      await addEntry(
        event,
        moveId,
        "We received your move request",
        "A move specialist will review your details shortly.",
        "info",
      );
      return;
    }
    case "move.canonical.approved": {
      await addEntry(
        event,
        moveId,
        "Your move details are confirmed",
        "A move specialist reviewed and confirmed your information.",
        "done",
      );
      return;
    }
    case "provider.submitted": {
      const svc = await serviceType(payload.serviceRequestId);
      await addEntry(
        event,
        moveId,
        `We requested your ${svc} service`,
        "Your provider is setting things up.",
        "progress",
      );
      return;
    }
    case "provider.unknown": {
      // The system state is UNKNOWN. The customer's state is "in progress".
      const svc = await serviceType(payload.serviceRequestId);
      await addEntry(
        event,
        moveId,
        `We're confirming your ${svc} service with the provider`,
        "No action needed from you.",
        "progress",
      );
      return;
    }
    case "provider.confirmed":
    case "provider.reconciled": {
      const svc = await serviceType(payload.serviceRequestId);
      await addEntry(
        event,
        moveId,
        `Your ${svc} service is scheduled`,
        "You'll receive the details in your service summary.",
        "done",
      );
      return;
    }
    default:
      // Events with no customer meaning produce no entry. That silence is the
      // projection doing its job.
      return;
  }
}

/** Drain the outbox into the timeline. Returns how many events were projected. */
/**
 * Instrumented entry point.
 *
 * The projector is the quietest thing in the system — it succeeds silently and
 * fails silently, and a read model that has stopped updating looks exactly like
 * one with nothing to do. The span's `dispatched` count is the difference.
 */
export async function runProjector(): Promise<number> {
  installTracing();
  return traced("projector.run", newTrace(), {}, async () => {
    const dispatched = await dispatch("projector", projectEvent);
    return dispatched;
  });
}

export async function timelineFor(moveId: string) {
  return query<{
    headline: string;
    detail: string | null;
    tone: string;
    occurred_at: string;
  }>(
    `SELECT headline, detail, tone, occurred_at
       FROM customer_timeline_entries WHERE move_id = $1
      ORDER BY occurred_at, id`,
    [moveId],
  );
}
