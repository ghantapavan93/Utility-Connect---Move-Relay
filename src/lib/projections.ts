import { query } from "./db";

/**
 * Tenant-safe projections.
 *
 * The same Move Record is seen by three audiences: the concierge (everything),
 * the customer (their own move, no internal machinery), and the partner (their
 * attributed engagement, nothing about other partners or provider internals).
 *
 * This is not a UI convenience. Utility Connect's own privacy policy states that
 * when their technology is hosted on a partner site, PII may be shared with that
 * "Hosting Business" — which makes a partner-safe boundary a stated data-handling
 * obligation, not a product idea. Getting this wrong leaks one customer's SSN or
 * one partner's pipeline to another. So the projection is built by allow-list, on
 * the server, from the canonical record — never by hiding fields in the client.
 *
 * The rule everywhere below: start from nothing and add only what is permitted.
 * A deny-list would leak every field someone forgot to add to it.
 */

interface FieldRow {
  field_path: string;
  value: unknown;
  channel: string;
  verification: string;
  is_canonical: boolean;
  selected_by: string | null;
  selection_reason: string | null;
}

async function canonicalFields(moveId: string): Promise<Map<string, FieldRow>> {
  const rows = await query<FieldRow>(
    `SELECT field_path, value, channel, verification, is_canonical,
            selected_by, selection_reason
       FROM field_versions WHERE move_id = $1 AND is_canonical`,
    [moveId],
  );
  // Fall back to the latest non-canonical value where nothing is approved yet,
  // so an in-progress move still shows something coherent.
  const latest = await query<FieldRow>(
    `SELECT DISTINCT ON (field_path)
            field_path, value, channel, verification, is_canonical,
            selected_by, selection_reason
       FROM field_versions WHERE move_id = $1
      ORDER BY field_path, is_canonical DESC, recorded_at DESC`,
    [moveId],
  );
  const map = new Map<string, FieldRow>();
  for (const r of latest) map.set(r.field_path, r);
  for (const r of rows) map.set(r.field_path, r); // canonical wins
  return map;
}

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v);

// ---------------------------------------------------------------------------
// Concierge view — full context, because the concierge is the trusted operator.
// ---------------------------------------------------------------------------

export async function conciergeView(orgId: string, moveId: string) {
  const fields = await canonicalFields(moveId);

  const verified: Array<{ field: string; value: unknown; source: string; by: string | null }> = [];
  const unconfirmed: Array<{ field: string; value: unknown; source: string }> = [];

  for (const [path, f] of fields) {
    if (path.startsWith("services")) continue;
    const entry = { field: path, value: clean(f.value), source: f.channel };
    if (f.is_canonical || f.verification === "customer_confirmed") {
      verified.push({ ...entry, by: f.selected_by });
    } else {
      unconfirmed.push(entry);
    }
  }

  // Open conflicts still needing a decision.
  const conflictRows = await query<{ field_path: string; n: number }>(
    `SELECT field_path, count(DISTINCT value)::int AS n
       FROM field_versions WHERE move_id = $1 AND NOT is_canonical
      GROUP BY field_path HAVING count(DISTINCT value) > 1`,
    [moveId],
  );
  const stillCanonical = await query<{ field_path: string }>(
    `SELECT DISTINCT field_path FROM field_versions WHERE move_id = $1 AND is_canonical`,
    [moveId],
  );
  const resolved = new Set(stillCanonical.map((r) => r.field_path));
  const openConflicts = conflictRows.filter((c) => !resolved.has(c.field_path)).map((c) => c.field_path);

  // Services and their live provider state.
  const services = await query<Record<string, unknown>>(
    `SELECT sr.service_type, sr.provider_name, ps.state AS submission_state,
            ps.provider_order_id, ps.error_category
       FROM service_requests sr
       LEFT JOIN provider_submissions ps ON ps.service_request_id = sr.id
      WHERE sr.move_id = $1`,
    [moveId],
  );

  const unknowns = services.filter((s) => s.submission_state === "unknown").length;

  // The latest grounded briefing.
  const briefing = await query<{ output: unknown; grounded: boolean; human_decision: string | null }>(
    `SELECT output, grounded, human_decision FROM ai_runs
      WHERE move_id = $1 AND purpose = 'concierge_briefing'
      ORDER BY created_at DESC LIMIT 1`,
    [moveId],
  );

  return {
    audience: "concierge",
    verified,
    unconfirmed,
    openConflicts,
    services,
    priority: {
      unknownsToReconcile: unknowns,
      conflictsToResolve: openConflicts.length,
    },
    briefing: briefing[0]?.output ?? null,
    briefingDecision: briefing[0]?.human_decision ?? null,
  };
}

// ---------------------------------------------------------------------------
// Customer view — their move, in plain terms. No internal machinery at all.
// ---------------------------------------------------------------------------

const CUSTOMER_ALLOW = new Set(["move.date", "move.to_address"]);

export async function customerView(moveId: string) {
  const fields = await canonicalFields(moveId);

  const details: Array<{ label: string; value: unknown }> = [];
  for (const path of CUSTOMER_ALLOW) {
    const f = fields.get(path);
    if (f) details.push({ label: LABELS[path] ?? path, value: clean(f.value) });
  }

  // Services as customer-facing progress, never internal error categories.
  const rows = await query<{ service_type: string; submission_state: string | null }>(
    `SELECT sr.service_type, ps.state AS submission_state
       FROM service_requests sr
       LEFT JOIN provider_submissions ps ON ps.service_request_id = sr.id
      WHERE sr.move_id = $1`,
    [moveId],
  );

  const services = rows.map((r) => ({
    service: r.service_type,
    status: customerStatus(r.submission_state),
  }));

  // What still needs the customer, derived from open conflicts on their fields.
  const openConflicts = await query<{ field_path: string }>(
    `SELECT field_path FROM field_versions
      WHERE move_id = $1 AND NOT is_canonical
      GROUP BY field_path HAVING count(DISTINCT value) > 1`,
    [moveId],
  );
  const resolved = await query<{ field_path: string }>(
    `SELECT DISTINCT field_path FROM field_versions WHERE move_id = $1 AND is_canonical`,
    [moveId],
  );
  const resolvedSet = new Set(resolved.map((r) => r.field_path));
  const needsYou = openConflicts
    .filter((c) => !resolvedSet.has(c.field_path) && CUSTOMER_ALLOW.has(c.field_path))
    .map((c) => `Please confirm your ${(LABELS[c.field_path] ?? c.field_path).toLowerCase()}.`);

  return { audience: "customer", details, services, needsYou };
}

/** Customer-facing status. Never exposes 'unknown', 'failed', or error categories. */
function customerStatus(s: string | null): string {
  switch (s) {
    case "confirmed":
    case "reconciled":
    case "duplicate":
      return "Scheduled";
    case "unknown":
    case "pending":
    case "submitted":
    case "failed":
    default:
      // A lost provider response is an internal concern. To the customer this is
      // simply still in progress — they are never shown "UNKNOWN" or "failed".
      return "In progress";
  }
}

// ---------------------------------------------------------------------------
// Partner view — their attributed engagement only. Nothing cross-partner,
// nothing about provider accounts, no internal notes, no AI prompts.
// ---------------------------------------------------------------------------

export async function partnerView(moveId: string, partnerId: string) {
  // Confirm this partner is actually attributed to this move. If not, they see
  // nothing — the default is deny.
  const attributed = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM field_versions
      WHERE move_id = $1 AND partner_id = $2`,
    [moveId, partnerId],
  );
  if (!attributed[0] || attributed[0].n === 0) {
    return { audience: "partner", attributed: false, message: "No engagement attributed to this partner." };
  }

  const move = await query<{ reference: string; state: string }>(
    `SELECT reference, state FROM moves WHERE id = $1`,
    [moveId],
  );

  const fields = await canonicalFields(moveId);
  const moveDate = fields.get("move.date");

  // Progress in coarse terms only. A partner sees momentum, not provider order
  // ids, error categories, other partners, or customer PII beyond the move date.
  const services = await query<{ service_type: string; submission_state: string | null }>(
    `SELECT sr.service_type, ps.state AS submission_state
       FROM service_requests sr
       LEFT JOIN provider_submissions ps ON ps.service_request_id = sr.id
      WHERE sr.move_id = $1`,
    [moveId],
  );
  const scheduled = services.filter((s) =>
    ["confirmed", "reconciled", "duplicate"].includes(s.submission_state ?? ""),
  ).length;

  return {
    audience: "partner",
    attributed: true,
    reference: move[0]?.reference,
    engagement: move[0]?.state === "canonical" ? "Active — details confirmed" : "In progress",
    moveDate: moveDate ? clean(moveDate.value) : "pending confirmation",
    progress: {
      servicesRequested: services.length,
      servicesScheduled: scheduled,
    },
    attributionStatus: "Referral source recorded and traceable",
  };
}

const LABELS: Record<string, string> = {
  "move.date": "Move date",
  "move.to_address": "Destination",
  "customer.phone": "Phone",
  "customer.email": "Email",
};
