/**
 * Deterministic provider simulator.
 *
 * Real utility providers are not available to this project, and inventing an
 * integration would be dishonest. What *can* be built honestly is a faithful
 * model of how such integrations fail — which is the part that actually matters
 * architecturally.
 *
 * Every scenario here is drawn from real integration behaviour:
 *
 *   ok                  the happy path
 *   timeout_after_create  ← the one that matters
 *   duplicate_409       provider already holds an equivalent order
 *   invalid_payload     schema rejection
 *   degraded            slow but successful
 *   hard_failure        provider-side error
 *
 * `timeout_after_create` is the centrepiece: the provider **does** create the
 * order, then the response is lost in transit. From the caller's side this is
 * indistinguishable from "the order was never created" — and that ambiguity,
 * not the failure itself, is the hard problem. A system that assumes failure
 * here creates a duplicate order for a real customer at a real utility.
 *
 * The simulator keeps its own store of "orders the provider believes exist", so
 * reconciliation queries something that genuinely does not share state with the
 * application. Otherwise the demo would be checking its own homework.
 */

export type Scenario =
  | "ok"
  | "timeout_after_create"
  | "duplicate_409"
  | "invalid_payload"
  | "degraded"
  | "hard_failure";

export class ProviderTimeoutError extends Error {
  override readonly name = "ProviderTimeoutError";
  constructor(message = "Provider did not respond within the timeout window") {
    super(message);
  }
}

export class ProviderRejectedError extends Error {
  override readonly name = "ProviderRejectedError";
  constructor(
    message: string,
    readonly category: string,
  ) {
    super(message);
  }
}

export interface ProviderOrder {
  orderId: string;
  accountRef: string;
  serviceType: string;
  createdAt: string;
}

/**
 * Stands in for the provider's own database. Deliberately module-scoped and
 * separate from ours: reconciliation must interrogate a system that does not
 * share our state, or the demo proves nothing.
 */
const providerLedger = new Map<string, ProviderOrder>();

let sequence = 1000;
const nextOrderId = () => `RLNT-${++sequence}`;

export interface CallOptions {
  scenario: Scenario;
  /** Correlates a request with the order the provider may have created. */
  requestKey: string;
  serviceType: string;
  /** Fixed timestamp so scenario runs are reproducible. */
  now: string;
}

export interface ProviderResponse {
  orderId: string;
  duplicate: boolean;
  raw: Record<string, unknown>;
}

export async function callProvider(
  payload: Record<string, unknown>,
  opts: CallOptions,
): Promise<ProviderResponse> {
  switch (opts.scenario) {
    case "ok": {
      const order = create(opts);
      return { orderId: order.orderId, duplicate: false, raw: { status: "created", order } };
    }

    case "degraded": {
      // Slow, but it answers. Slowness is not ambiguity — we still learn the truth.
      await sleep(50);
      const order = create(opts);
      return { orderId: order.orderId, duplicate: false, raw: { status: "created", slow: true, order } };
    }

    case "duplicate_409": {
      const existing = create(opts);
      return {
        orderId: existing.orderId,
        duplicate: true,
        raw: { status: 409, message: "An order already exists for this service address" },
      };
    }

    case "invalid_payload":
      throw new ProviderRejectedError(
        "Missing required field: service_start_date",
        "schema_validation",
      );

    case "hard_failure":
      throw new ProviderRejectedError(
        "Provider internal error",
        "provider_error",
      );

    case "timeout_after_create": {
      // The order IS created. The provider's ledger now holds it.
      create(opts);
      // Then the response is lost. We will never learn this happened by waiting.
      throw new ProviderTimeoutError();
    }
  }
}

function create(opts: CallOptions): ProviderOrder {
  const existing = providerLedger.get(opts.requestKey);
  if (existing) return existing;

  const order: ProviderOrder = {
    orderId: nextOrderId(),
    accountRef: opts.requestKey,
    serviceType: opts.serviceType,
    createdAt: opts.now,
  };
  providerLedger.set(opts.requestKey, order);
  return order;
}

/**
 * The reconciliation endpoint — "does an order exist for this request?"
 *
 * This is the only honest way out of an UNKNOWN outcome. Ask, do not assume, and
 * never resubmit to find out.
 */
export async function lookupOrder(
  requestKey: string,
): Promise<{ orderId: string } | null> {
  const found = providerLedger.get(requestKey);
  return found ? { orderId: found.orderId } : null;
}

/** Test and demo helpers. */
export const __simulator = {
  reset(): void {
    providerLedger.clear();
    sequence = 1000;
  },
  size(): number {
    return providerLedger.size;
  },
  all(): ProviderOrder[] {
    return [...providerLedger.values()];
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
