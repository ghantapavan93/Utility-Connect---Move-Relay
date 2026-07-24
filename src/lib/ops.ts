import { query } from "./db";
import { reconcile } from "./provider-submission";

/**
 * Operational sweeps — the scheduled work a worker loop would run.
 *
 * An UNKNOWN outcome must never depend on a human remembering to click
 * "reconcile". The sweep finds every submission still sitting in ambiguity and
 * drives each one through the only sanctioned exit: ask the provider. In
 * production this runs on a timer; here it is invocable — same code, same
 * guarantees, and the Reliability page exposes it as a button so a reviewer
 * can watch the unknown count drain.
 */

export interface SweepResult {
  scanned: number;
  recovered: number;
  stillPending: number;
  details: Array<{ submissionId: string; outcome: string; providerOrderId: string | null }>;
}

/**
 * Reconcile every open UNKNOWN. The resolver answers "does an order exist for
 * this submission?" — in the demo it interrogates the provider simulator's
 * separate ledger; in production it would call the provider's lookup API.
 */
export async function sweepUnknownOutcomes(
  resolver: (submission: { id: string; operation_key: string }) => Promise<{ orderId: string } | null>,
): Promise<SweepResult> {
  const open = await query<{
    id: string;
    organization_id: string;
    operation_key: string;
    move_id: string | null;
  }>(
    `SELECT ps.id, ps.organization_id, ps.operation_key, sr.move_id
       FROM provider_submissions ps
       JOIN service_requests sr ON sr.id = ps.service_request_id
      WHERE ps.state = 'unknown'`,
  );

  const result: SweepResult = { scanned: open.length, recovered: 0, stillPending: 0, details: [] };

  for (const sub of open) {
    const outcome = await reconcile(
      {
        organizationId: sub.organization_id,
        moveId: sub.move_id ?? "",
        submissionId: sub.id,
        correlationId: "00000000-0000-4000-8000-00000000s0ee".replace("s0ee", "05ee"),
      },
      () => resolver({ id: sub.id, operation_key: sub.operation_key }),
    );
    if (outcome.outcome === "found_existing") result.recovered++;
    else result.stillPending++;
    result.details.push({
      submissionId: sub.id,
      outcome: outcome.outcome,
      providerOrderId: outcome.providerOrderId,
    });
  }

  return result;
}
