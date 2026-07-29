import { query, withTransaction, type Queryable } from "./db";
import {
  submitToProvider,
  reconcile,
  operationKey,
  type SubmissionState,
} from "./provider-submission";
import { callProvider, lookupOrder, type Scenario } from "./provider-simulator";
import { SERVICE_CATALOGUE } from "./service-catalogue";

/**
 * Fulfillment for any move, not just the scripted one.
 *
 * `submitToProvider` and `reconcile` were always move-agnostic — they take an
 * organization, a move and a service request and have no opinion about which.
 * What was not general was everything around them: the only code that created a
 * `service_requests` row lived inside the demo workflow and hardcoded
 * `'electric'` with `'Reliant'`, and the only key an UNKNOWN outcome could be
 * looked back up by was a module constant, `"svc-electric-maya"`.
 *
 * The consequence was quiet and total. A move created through the real intake
 * endpoint — the console, the partner API, a CSV row — had no service requests
 * at all, so it could not be submitted to a provider, could not time out, and
 * could not be reconciled. Every move outside the one scripted narrative was a
 * dead end, and nothing said so.
 *
 * This module is the missing middle. Services are materialised from the payload
 * the customer or partner actually sent, and the provider request key is
 * derived per service request rather than being a constant, which is what makes
 * reconciliation possible for a move nobody wrote a script for.
 */

/** Service ids the catalogue knows. Anything else is not a service we fulfil. */
const KNOWN = new Set(SERVICE_CATALOGUE.map((s) => s.id));

/**
 * Which provider handles which service, for the simulator.
 *
 * A real deployment resolves this per market, per availability and per customer
 * selection. Here it is a fixed map and labelled as one — inventing a routing
 * engine to make a demo look deeper would be exactly the kind of fiction this
 * project refuses elsewhere.
 */
const PROVIDER: Record<string, string> = {
  electric: "Reliant",
  gas: "Atmos",
  water: "City Utilities",
  internet: "Spectrum",
  cable: "Spectrum",
  security: "ADT",
  solar: "Sunrun",
};

const providerFor = (serviceType: string) => PROVIDER[serviceType] ?? "Unassigned";

/**
 * The identifier the provider knows a request by.
 *
 * Derived from the service request's own id, so it is unique per service per
 * move and stable across retries of that same intent. The previous constant
 * meant two moves submitting electricity would have collided in the provider's
 * ledger — the second one's reconciliation would have found the first one's
 * order and attached it, which is the precise failure this system exists to
 * prevent, reintroduced by a shortcut.
 */
export const providerRequestKey = (serviceRequestId: string) => `svc:${serviceRequestId}`;

export interface ServiceRow {
  id: string;
  serviceType: string;
  providerName: string;
  state: SubmissionState | "pending";
  submissionId: string | null;
  providerOrderId: string | null;
  submissionState: SubmissionState | null;
}

/**
 * Turn the `services` a payload asked for into rows that can be fulfilled.
 *
 * Idempotent by the table's own `(move_id, service_type, provider_name)`
 * constraint, so a second source naming the same service does not create a
 * second request — the customer asked for electricity once, however many
 * channels mentioned it.
 *
 * Unknown service names are skipped rather than stored. A partner sending
 * `"electricty"` should not silently create a service nobody fulfils; it lands
 * as a field version like every other value, where a human can see it.
 */
export async function materialiseServices(
  client: Queryable,
  organizationId: string,
  moveId: string,
  services: unknown,
): Promise<string[]> {
  if (!Array.isArray(services)) return [];

  const wanted = [
    ...new Set(
      services
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => KNOWN.has(s)),
    ),
  ];

  const created: string[] = [];
  for (const serviceType of wanted) {
    /*
      `.rows`, not an index. The transaction client is the pg `Queryable`, which
      returns a QueryResult; only the pooled `query` helper unwraps it. Reading
      `rows[0]` off the result object returns undefined silently, so this
      inserted every service and reported that it had created none.
    */
    const result = await client.query<{ id: string }>(
      `INSERT INTO service_requests (organization_id, move_id, service_type, provider_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (move_id, service_type, provider_name)
         DO UPDATE SET state = service_requests.state
       RETURNING id`,
      [organizationId, moveId, serviceType, providerFor(serviceType)],
    );
    const row = result.rows[0];
    if (row) created.push(row.id);
  }
  return created;
}

/** Every service on a move, with whatever the provider has said about it. */
export async function servicesFor(moveId: string): Promise<ServiceRow[]> {
  return query<ServiceRow>(
    `SELECT sr.id,
            sr.service_type   AS "serviceType",
            sr.provider_name  AS "providerName",
            sr.state,
            ps.id             AS "submissionId",
            ps.provider_order_id AS "providerOrderId",
            ps.state          AS "submissionState"
       FROM service_requests sr
       LEFT JOIN provider_submissions ps ON ps.service_request_id = sr.id
      WHERE sr.move_id = $1
      ORDER BY sr.service_type`,
    [moveId],
  );
}

export interface FulfillmentContext {
  organizationId: string;
  moveId: string;
  serviceRequestId: string;
  correlationId: string;
  actor: string;
}

async function serviceOrThrow(moveId: string, serviceRequestId: string) {
  const rows = await query<{ id: string; service_type: string; provider_name: string }>(
    `SELECT id, service_type, provider_name FROM service_requests
      WHERE id = $1 AND move_id = $2`,
    [serviceRequestId, moveId],
  );
  const row = rows[0];
  // Scoped by move as well as by id: a service request id from another move must
  // not be actionable just because the caller could reach *this* move.
  if (!row) throw new Error("no such service request on this move");
  return row;
}

/**
 * Submit a service to its provider.
 *
 * The scenario is a caller's choice because this is a simulator and pretending
 * otherwise would be worse. `timeout_after_create` is the default because it is
 * the one failure this whole system was designed around: the order exists and
 * the answer never arrived.
 */
export async function submitService(
  ctx: FulfillmentContext,
  scenario: Scenario = "timeout_after_create",
) {
  const service = await serviceOrThrow(ctx.moveId, ctx.serviceRequestId);
  const requestKey = providerRequestKey(service.id);

  const result = await submitToProvider(
    {
      organizationId: ctx.organizationId,
      moveId: ctx.moveId,
      serviceRequestId: service.id,
      payload: { service: service.service_type, provider: service.provider_name },
      correlationId: ctx.correlationId,
      actor: ctx.actor,
      providerRequestKey: requestKey,
    },
    (payload) =>
      callProvider(payload, {
        scenario,
        requestKey,
        serviceType: service.service_type,
        // Fixed per submission rather than per call, so a replay of the same
        // intent produces the same provider-side timestamp.
        now: new Date().toISOString(),
      }),
  );

  return { ...result, serviceType: service.service_type, providerName: service.provider_name };
}

/**
 * Attempt the retry that must not happen.
 *
 * The provider callback throws if it is ever reached. That is the assertion:
 * this function is not testing whether the retry succeeds, it is testing
 * whether the provider is contacted at all while the outcome is UNKNOWN. A
 * blind retry here enrols a real household twice.
 */
export async function retryService(ctx: FulfillmentContext) {
  const service = await serviceOrThrow(ctx.moveId, ctx.serviceRequestId);

  const result = await submitToProvider(
    {
      organizationId: ctx.organizationId,
      moveId: ctx.moveId,
      serviceRequestId: service.id,
      payload: { service: service.service_type, provider: service.provider_name },
      correlationId: ctx.correlationId,
      actor: ctx.actor,
      providerRequestKey: providerRequestKey(service.id),
    },
    () => {
      throw new Error("provider must not be called while the outcome is UNKNOWN");
    },
  );

  return {
    ...result,
    serviceType: service.service_type,
    // The headline operational metric: a duplicate order that did not happen.
    blocked: result.state === "unknown",
  };
}

/** Ask the provider what it actually has, and resolve the UNKNOWN with it. */
export async function reconcileService(ctx: FulfillmentContext) {
  const service = await serviceOrThrow(ctx.moveId, ctx.serviceRequestId);

  const sub = (
    await query<{ id: string }>(`SELECT id FROM provider_submissions WHERE operation_key = $1`, [
      operationKey(service.id),
    ])
  )[0];
  if (!sub) throw new Error("nothing to reconcile: this service was never submitted");

  const outcome = await reconcile(
    {
      organizationId: ctx.organizationId,
      moveId: ctx.moveId,
      submissionId: sub.id,
      correlationId: ctx.correlationId,
    },
    () => lookupOrder(providerRequestKey(service.id)),
  );

  return { ...outcome, serviceType: service.service_type };
}

/**
 * Backfill services for moves that predate this module.
 *
 * A move ingested before services were materialised has its requested services
 * recorded as field versions and no rows to act on. Rather than leave those
 * moves permanently unfulfillable, this reads what they asked for and creates
 * the requests now — same idempotent insert, so running it twice is safe.
 */
export async function backfillServices(organizationId: string, moveId: string): Promise<string[]> {
  /*
    `recorded_at`, not `created_at`. `field_versions` is bitemporal: system time
    is when we learned the value, valid time is when it was true in the world.
    Latest-learned is the right ordering for "what does this move currently
    think it asked for".
  */
  const rows = await query<{ value: unknown }>(
    `SELECT value FROM field_versions
      WHERE move_id = $1 AND field_path LIKE 'services%'
      ORDER BY recorded_at DESC`,
    [moveId],
  );

  const names = rows
    .map((r) => r.value)
    .flatMap((v) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []));

  if (!names.length) return [];
  return withTransaction((client) => materialiseServices(client, organizationId, moveId, names));
}
