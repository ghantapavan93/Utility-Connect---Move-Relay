import { query, type Queryable } from "./db";
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

async function serviceType(
  client: Queryable,
  serviceRequestId: string | undefined,
): Promise<string> {
  if (!serviceRequestId) return "home";
  const rows = await client.query<{ service_type: string }>(
    `SELECT service_type FROM service_requests WHERE id = $1`,
    [serviceRequestId],
  );
  return rows.rows[0]?.service_type ?? "home";
}

async function addEntry(
  client: Queryable,
  event: OutboxEvent,
  moveId: string,
  projectionKey: string,
  headline: string,
  detail: string | null,
  tone: "info" | "progress" | "done",
): Promise<void> {
  /*
    Written on the dispatcher's client, so the entry and the consumer's claim
    commit or roll back together.

    Deduplication is on the *logical key*, not the event id. Keying on the event
    closed the replay hole and missed the one where two different events mean
    the same thing to a customer — `provider.confirmed` and
    `provider.reconciled` both say "scheduled", and an event-keyed rule cannot
    see that. `source_event_id` is still written, because which event produced
    the surviving row is provenance worth keeping; it is simply the wrong thing
    to be unique on.
  */
  await client.query(
    `INSERT INTO customer_timeline_entries
       (organization_id, move_id, headline, detail, tone, source_event_id, projection_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (move_id, projection_key) WHERE projection_key IS NOT NULL DO NOTHING`,
    [event.organization_id, moveId, headline, detail, tone, event.id, projectionKey],
  );
}

async function projectEvent(event: OutboxEvent, client: Queryable): Promise<void> {
  const payload = event.payload as {
    moveId?: string;
    serviceRequestId?: string;
  };
  const moveId = payload.moveId;
  if (!moveId) return;

  switch (event.event_type) {
    case "referral.received": {
      await addEntry(
        client,
        event,
        moveId,
        "customer:move:referral.received",
        "We received your move request",
        "A move specialist will review your details shortly.",
        "info",
      );
      return;
    }
    case "move.canonical.approved": {
      await addEntry(
        client,
        event,
        moveId,
        "customer:move:confirmed",
        "Your move details are confirmed",
        "A move specialist reviewed and confirmed your information.",
        "done",
      );
      return;
    }
    case "provider.submitted": {
      const svc = await serviceType(client, payload.serviceRequestId);
      await addEntry(
        client,
        event,
        moveId,
        `customer:${svc}:requested`,
        `We requested your ${svc} service`,
        "Your provider is setting things up.",
        "progress",
      );
      return;
    }
    case "provider.unknown": {
      // The system state is UNKNOWN. The customer's state is "in progress".
      const svc = await serviceType(client, payload.serviceRequestId);
      await addEntry(
        client,
        event,
        moveId,
        `customer:${svc}:confirming`,
        `We're confirming your ${svc} service with the provider`,
        "No action needed from you.",
        "progress",
      );
      return;
    }
    case "provider.confirmed":
    case "provider.reconciled": {
      const svc = await serviceType(client, payload.serviceRequestId);
      await addEntry(
        client,
        event,
        moveId,
        /*
          Both `provider.confirmed` and `provider.reconciled` arrive here, and
          they share this key deliberately: to the customer they are the same
          news. Whichever lands first writes the row; the other is absorbed.
        */
        `customer:${svc}:scheduled`,
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
