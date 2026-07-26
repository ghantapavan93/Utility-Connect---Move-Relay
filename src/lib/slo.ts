import { query } from "./db";

/**
 * Service-level objectives, computed from rows.
 *
 * This lives in lib rather than inside the route handler for two reasons. The
 * ordinary one is that a route should be transport and nothing else. The
 * specific one is that it was untestable where it was: there is no vitest alias
 * config in this project, so a test could not import the handler, and an audit
 * found three of the six objectives hardcoding `met: true` while the page above
 * them promised to report its own failures. A dashboard nobody can test is a
 * dashboard nobody should believe.
 *
 * Every objective here evaluates a predicate over rows and every one can go red.
 */

export async function computeObjectives() {
  const [
    canonicalActors,
    retriesBlocked,
    unknowns,
    reconciled,
    aiRuns,
    groundedRuns,
    fallbackRuns,
    quarantine,
    outbox,
    duplicateOrders,
    staleUnknowns,
  ] = await Promise.all([
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
      // The actual duplicate check. An operation_key is the stable identity of
      // one logical provider order, so more than one *succeeded* submission
      // sharing a key is a household enrolled twice — the exact outcome this
      // whole system exists to prevent. Previously this objective reported
      // "0 duplicates" as a hardcoded string and could never say anything else.
      query<{ n: number }>(
        // 'confirmed' and 'reconciled' are the two states in which a provider
        // order actually exists. The first draft of this query said
        // state = 'succeeded', which is not a value in the submission_state
        // enum at all — so it matched nothing and the objective could never
        // have gone red. The test that seeds a real duplicate caught it, which
        // is the entire argument for writing that test.
        `SELECT count(*)::int AS n FROM (
           SELECT operation_key
             FROM provider_submissions
            WHERE state IN ('confirmed', 'reconciled')
            GROUP BY organization_id, operation_key
           HAVING count(*) > 1
         ) dupes`,
      ),
      // An UNKNOWN is acceptable; an UNKNOWN nobody drained is not. Anything
      // older than an hour means the reconciliation sweep is not running.
      query<{ n: number }>(
        `SELECT count(*)::int AS n
           FROM provider_submissions
          WHERE state = 'unknown'
            AND started_at < now() - interval '1 hour'`,
      ),
    ]);

  const ca = canonicalActors[0] ?? { total: 0, named: 0 };
  const totalAi = aiRuns[0]?.n ?? 0;
  const grounded = groundedRuns[0]?.n ?? 0;
  const dupes = duplicateOrders[0]?.n ?? 0;
  const stale = staleUnknowns[0]?.n ?? 0;

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
      actual: `${retriesBlocked[0]?.n ?? 0} blind retries blocked, ${dupes} duplicate operation keys`,
      met: dupes === 0,
      enforcement: "unique operation_key + UNKNOWN state machine",
      breachResponse: "freeze provider submissions for the affected operation, reconcile manually",
    },
    {
      id: "unknowns-resolve",
      objective: "Ambiguous outcomes reach a definite state via reconciliation, never blind retry",
      actual: `${unknowns[0]?.n ?? 0} currently unknown (${stale} over an hour old), ${reconciled[0]?.n ?? 0} recovered`,
      met: stale === 0,
      enforcement: "reconciliation_jobs queue + resubmittable-state set",
      breachResponse: "unknown older than threshold escalates to a human",
    },
    {
      id: "ai-grounding",
      objective: "Ungrounded AI output never reaches display",
      actual: totalAi === 0 ? "no runs yet" : `${grounded}/${totalAi} runs grounded, ${fallbackRuns[0]?.n ?? 0} fallbacks`,
      // A run that is neither grounded nor a declared fallback is an ungrounded
      // claim that reached a surface. That is the breach, and it is now
      // computed rather than asserted.
      met: totalAi === 0 || grounded + (fallbackRuns[0]?.n ?? 0) >= totalAi,
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

  return ({
    label: "Prototype SLOs — project targets computed live from the database. Not production claims.",
    computedAt: new Date().toISOString(),
    allMet: objectives.every((o) => o.met),
    objectives,
  });
}
