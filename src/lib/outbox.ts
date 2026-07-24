import { query, type Queryable } from "./db";

/**
 * Transactional outbox.
 *
 * The problem it solves: publishing an event directly to a broker from
 * application code creates a window where the database commit succeeds and the
 * publish fails (or vice versa). The system then either acts on state nobody
 * announced, or announces state that never happened.
 *
 * The fix: the event is a row, written in the SAME transaction as the state
 * change it describes. A dispatcher then delivers rows to consumers. Delivery
 * is at-least-once — crashes can cause redelivery — so consumers record what
 * they have processed, and the (consumer, event_id) primary key makes handling
 * exactly-once-per-consumer: a redelivered event conflicts and is skipped.
 *
 * At demo scale the dispatcher is invoked directly; at production scale it runs
 * on a worker loop or LISTEN/NOTIFY. The correctness properties are identical,
 * and they are the part proven in outbox.test.ts.
 */

export interface OutboxEvent {
  id: number;
  organization_id: string;
  event_type: string;
  aggregate_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

/**
 * Publish an event as part of an open transaction. Must be called with the
 * same client as the domain write — that is the whole point.
 */
export async function publish(
  client: Queryable,
  event: {
    organizationId: string;
    eventType: string;
    aggregateId?: string | null;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO outbox_events (organization_id, event_type, aggregate_id, payload)
     VALUES ($1,$2,$3,$4)`,
    [
      event.organizationId,
      event.eventType,
      event.aggregateId ?? null,
      JSON.stringify(event.payload),
    ],
  );
}

export type Handler = (event: OutboxEvent) => Promise<void>;

/**
 * Deliver all unprocessed events to one named consumer.
 *
 * Exactly-once per consumer is enforced by claiming the (consumer, event_id)
 * row BEFORE running the handler: if the claim conflicts, another delivery
 * already handled it and this one skips. Returns how many events the handler
 * actually processed on this call.
 */
export async function dispatch(consumer: string, handler: Handler): Promise<number> {
  const pending = await query<OutboxEvent>(
    `SELECT e.id, e.organization_id, e.event_type, e.aggregate_id, e.payload, e.created_at
       FROM outbox_events e
       LEFT JOIN outbox_consumers c
         ON c.event_id = e.id AND c.consumer = $1
      WHERE c.event_id IS NULL
      ORDER BY e.id`,
    [consumer],
  );

  let processed = 0;
  for (const event of pending) {
    const claimed = await query<{ event_id: number }>(
      `INSERT INTO outbox_consumers (consumer, event_id)
       VALUES ($1,$2)
       ON CONFLICT (consumer, event_id) DO NOTHING
       RETURNING event_id`,
      [consumer, event.id],
    );
    if (!claimed[0]) continue; // another dispatcher got here first

    try {
      await handler(event);
      processed++;
    } catch (err) {
      // A throwing handler must not strand its event invisibly. The claim
      // stays (so normal dispatch skips it — no hot retry loop) and the event
      // is recorded as a dead letter with its error, replayable once the
      // handler is fixed. Failure is visible, never silent.
      await query(
        `INSERT INTO dead_letter_events (consumer, event_id, error)
         VALUES ($1,$2,$3)
         ON CONFLICT (consumer, event_id)
           DO UPDATE SET attempts = dead_letter_events.attempts + 1,
                         error = EXCLUDED.error`,
        [consumer, event.id, err instanceof Error ? err.message : String(err)],
      );
    }
  }
  return processed;
}

/** Dead letters awaiting a fixed handler. */
export async function deadLetters(consumer: string) {
  return query<{ event_id: number; error: string; attempts: number; created_at: string }>(
    `SELECT event_id, error, attempts, created_at
       FROM dead_letter_events WHERE consumer = $1 ORDER BY event_id`,
    [consumer],
  );
}

/**
 * Replay dead letters through a (presumably fixed) handler. Releasing the
 * claim and the dead-letter row makes the events eligible for normal dispatch
 * again; the following dispatch reprocesses them with full exactly-once
 * semantics. Returns how many were released for replay.
 */
export async function replayDeadLetters(consumer: string, handler: Handler): Promise<number> {
  const dead = await deadLetters(consumer);
  for (const d of dead) {
    await query(
      `DELETE FROM dead_letter_events WHERE consumer = $1 AND event_id = $2`,
      [consumer, d.event_id],
    );
    await query(
      `DELETE FROM outbox_consumers WHERE consumer = $1 AND event_id = $2`,
      [consumer, d.event_id],
    );
  }
  if (dead.length === 0) return 0;
  await dispatch(consumer, handler);
  return dead.length;
}

/** Events not yet processed by a consumer — the queue-depth metric. */
export async function backlog(consumer: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM outbox_events e
       LEFT JOIN outbox_consumers c
         ON c.event_id = e.id AND c.consumer = $1
      WHERE c.event_id IS NULL`,
    [consumer],
  );
  return rows[0]?.n ?? 0;
}
