import { query, withTransaction, type Queryable } from "./db";

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
 * That at-least-once claim was false for a while, and the way it was false is
 * worth keeping written down. The claim row was committed in its own statement
 * *before* the handler ran. A process that died in between left the event
 * claimed forever: `dispatch` skipped it, `backlog` reported zero, and
 * `deadLetters` never saw it. Delivery was in fact at-most-once, and the loss
 * was silent — the worst combination available.
 *
 * The claim and the handler now share one transaction, so an incomplete handle
 * takes its own claim down with it. Consumers must therefore do their work on
 * the client they are given; a handler that opens its own connection is outside
 * the transaction and reintroduces the gap.
 *
 * At demo scale the dispatcher is invoked directly; at production scale it runs
 * on a worker loop or LISTEN/NOTIFY. The correctness properties are identical,
 * and they are the part proven in durability.test.ts.
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

/**
 * A consumer's handler.
 *
 * `client` is the transaction the claim was taken in. Writing through it is
 * what makes the handle atomic with the claim — see the note at the top of this
 * file about why that matters.
 */
export type Handler = (event: OutboxEvent, client: Queryable) => Promise<void>;

/**
 * Deliver all unprocessed events to one named consumer.
 *
 * Each event is claimed and handled inside a single transaction. If the claim
 * conflicts, another dispatcher reached it first and this one skips. If the
 * handler throws — or the process dies — the transaction rolls back and the
 * event stays eligible for redelivery. Returns how many events this call
 * actually processed.
 */
export async function dispatch(consumer: string, handler: Handler): Promise<number> {
  /*
    Two things make an event ineligible, and they are deliberately different.

    A *claim* means it was handled — that is completion. A *dead letter* means
    it failed and a human has not yet fixed the handler; suppression there is
    what stops a permanently failing event from being retried on every single
    dispatch, which is the hot loop the ops suite exists to catch.

    Before the claim became transactional, one row did both jobs: the claim
    survived a failed handle, so it recorded "handled" and "do not retry" at
    once. That conflation is exactly what lost events on crash — an event that
    was never handled looked identical to one that was. Separating them keeps
    both properties: rollback makes an interrupted handle retryable, and the
    dead-letter row makes a *failed* one wait for a person.
  */
  const pending = await query<OutboxEvent>(
    `SELECT e.id, e.organization_id, e.event_type, e.aggregate_id, e.payload, e.created_at
       FROM outbox_events e
       LEFT JOIN outbox_consumers c
         ON c.event_id = e.id AND c.consumer = $1
       LEFT JOIN dead_letter_events d
         ON d.event_id = e.id AND d.consumer = $1
      WHERE c.event_id IS NULL AND d.event_id IS NULL
      ORDER BY e.id`,
    [consumer],
  );

  let processed = 0;
  for (const event of pending) {
    let failure: unknown = null;

    const handled = await withTransaction(async (client) => {
      const claimed = await client.query<{ event_id: number }>(
        `INSERT INTO outbox_consumers (consumer, event_id)
         VALUES ($1,$2)
         ON CONFLICT (consumer, event_id) DO NOTHING
         RETURNING event_id`,
        [consumer, event.id],
      );
      if (!claimed.rows[0]) return false; // another dispatcher got here first

      try {
        await handler(event, client);
        return true;
      } catch (err) {
        /*
          Remember the error, then abort the transaction by rethrowing. Both
          halves matter: rolling back releases the claim so the event can be
          retried once the handler is fixed, and the dead letter below is what
          stops that retry from being a silent hot loop.
        */
        failure = err;
        throw err;
      }
    }).catch(() => false);

    if (handled) {
      processed++;
      continue;
    }

    if (failure !== null) {
      // Recorded outside the rolled-back transaction, or it would vanish with
      // it. A failing handler must be visible to an operator, never silent.
      await query(
        `INSERT INTO dead_letter_events (consumer, event_id, error)
         VALUES ($1,$2,$3)
         ON CONFLICT (consumer, event_id)
           DO UPDATE SET attempts = dead_letter_events.attempts + 1,
                         error = EXCLUDED.error`,
        [consumer, event.id, failure instanceof Error ? failure.message : String(failure)],
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
