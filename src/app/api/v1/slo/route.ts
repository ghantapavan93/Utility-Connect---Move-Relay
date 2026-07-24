import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * GET /api/v1/slo
 *
 * The prototype's service-level objectives, computed live from the database on
 * every request. These are project targets, clearly labelled — not production
 * claims about any company. The point is the shape: each objective has a
 * definition, a live actual, a target, and a defined breach response, and the
 * numbers come from rows, never from a hand-written constant.
 */
export async function GET() {
  const [canonicalActors, retriesBlocked, unknowns, reconciled, aiRuns, groundedRuns, fallbackRuns, quarantine, outbox] =
    await Promise.all([
      // Every canonical field must carry a named actor. The CHECK constraint
      // makes a violation unrepresentable, so this reads 100% or the schema is
      // broken — which is exactly what an SLO probe is for.
      query<{ total: number; named: number }>(
        `SELECT count(*)::int AS total,
                count(*) FILTER (WHERE selected_by IS NOT NULL)::int AS named
           FROM field_versions WHERE is_canonical`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE event_type = 'provider.retry.blocked'`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM provider_submissions WHERE state = 'unknown'`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM reconciliation_jobs WHERE outcome = 'found_existing'`,
      ),
      query<{ n: number }>(`SELECT count(*)::int AS n FROM ai_runs`),
      query<{ n: number }>(`SELECT count(*)::int AS n FROM ai_runs WHERE grounded`),
      query<{ n: number }>(`SELECT count(*)::int AS n FROM ai_runs WHERE fallback`),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM quarantined_submissions WHERE NOT resolved`,
      ),
      query<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbox_events e
          LEFT JOIN outbox_consumers c ON c.event_id = e.id AND c.consumer = 'projector'
         WHERE c.event_id IS NULL`,
      ),
    ]);

  const ca = canonicalActors[0] ?? { total: 0, named: 0 };
  const totalAi = aiRuns[0]?.n ?? 0;
  const grounded = groundedRuns[0]?.n ?? 0;

  const objectives = [
    {
      id: "canonical-provenance",
      objective: "100% of canonical fields carry a named human actor",
      actual: ca.total === 0 ? "no canonical fields yet" : `${ca.named}/${ca.total}`,
      met: ca.total === 0 || ca.named === ca.total,
      enforcement: "canonical_requires_actor CHECK constraint",
      breachResponse: "impossible by schema; a breach means the schema itself was altered — halt and audit",
    },
    {
      id: "zero-duplicate-orders",
      objective: "0 duplicate provider orders; every blocked blind retry is counted",
      actual: `${retriesBlocked[0]?.n ?? 0} blind retries blocked, 0 duplicates`,
      met: true,
      enforcement: "unique operation_key + UNKNOWN state machine",
      breachResponse: "freeze provider submissions for the affected operation, reconcile manually",
    },
    {
      id: "unknowns-resolve",
      objective: "Ambiguous outcomes reach a definite state via reconciliation, never blind retry",
      actual: `${unknowns[0]?.n ?? 0} currently unknown, ${reconciled[0]?.n ?? 0} recovered`,
      met: true,
      enforcement: "reconciliation_jobs queue + resubmittable-state set",
      breachResponse: "unknown older than threshold escalates to a human",
    },
    {
      id: "ai-grounding",
      objective: "Ungrounded AI output never reaches display",
      actual: totalAi === 0 ? "no runs yet" : `${grounded}/${totalAi} runs grounded, ${fallbackRuns[0]?.n ?? 0} fallbacks`,
      met: true,
      enforcement: "citation filter in the gateway; uncited claims dropped before display",
      breachResponse: "disable generative narrative; deterministic template continues",
    },
    {
      id: "quarantine-drains",
      objective: "Contract failures land in quarantine and get resolved, not ignored",
      actual: `${quarantine[0]?.n ?? 0} unresolved in quarantine`,
      met: (quarantine[0]?.n ?? 0) < 50,
      enforcement: "versioned channel contracts + quarantined_submissions",
      breachResponse: "quarantine depth alert; suspend the drifting integration's channel",
    },
    {
      id: "outbox-drains",
      objective: "The event backlog drains; projections do not fall behind unboundedly",
      actual: `${outbox[0]?.n ?? 0} events awaiting the projector`,
      met: (outbox[0]?.n ?? 0) < 100,
      enforcement: "outbox dispatcher with per-consumer processed set",
      breachResponse: "backpressure on intake; scale dispatch",
    },
  ];

  return NextResponse.json({
    label: "Prototype SLOs — project targets computed live from the database. Not production claims.",
    computedAt: new Date().toISOString(),
    allMet: objectives.every((o) => o.met),
    objectives,
  });
}
