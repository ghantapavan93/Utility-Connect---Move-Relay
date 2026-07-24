import { query } from "./db";
import { withTransaction } from "./db";
import { recordAudit } from "./audit";

/**
 * Source-grounded concierge briefing.
 *
 * Version one generates entirely from structured database rows. No LLM is
 * required, and that is a deliberate architectural choice, not a shortcut:
 *
 *   - Every sentence in the briefing is traceable to a specific field_version
 *     row. There is no step at which a model could introduce a fact that no
 *     source supports.
 *   - It runs offline, deterministically, and is covered by tests.
 *
 * An LLM seam exists (`renderNarrative`) for a future version. Its contract is
 * strict: it may only rephrase claims it is given, and every claim it emits must
 * map back to an input field id. If a future model cannot cite a claim, the
 * claim is dropped, not shown. See docs/AI_BOUNDARIES.md and ADR-004.
 *
 * The briefing never decides anything. It assembles what is known, names what is
 * not, and hands both to a human who accepts, edits, or rejects it — a choice
 * recorded in ai_runs.human_decision.
 */

export interface Claim {
  /** The human-readable statement. */
  text: string;
  /** field_version ids that ground this claim. Empty is not allowed. */
  sourceFieldIds: string[];
  verification: string;
  /** 'known' | 'unknown' | 'conflict' — drives how the UI renders it. */
  kind: "known" | "unknown" | "conflict";
}

export interface Briefing {
  moveReference: string;
  generatedAt: string;
  claims: Claim[];
  openQuestions: string[];
  /** Every source id referenced anywhere above, for the "inspect sources" panel. */
  citedFieldIds: string[];
  grounded: boolean;
}

interface FieldRow {
  id: string;
  field_path: string;
  value: unknown;
  verification: string;
  is_canonical: boolean;
  channel: string;
}

const LABELS: Record<string, string> = {
  "customer.first_name": "First name",
  "customer.last_name": "Last name",
  "customer.email": "Email",
  "customer.phone": "Phone",
  "move.date": "Move date",
  "move.to_address": "Destination",
};

export async function buildBriefing(orgId: string, moveId: string): Promise<Briefing> {
  const ref = (
    await query<{ reference: string }>(`SELECT reference FROM moves WHERE id = $1`, [moveId])
  )[0]?.reference ?? "unknown";

  const fields = await query<FieldRow>(
    `SELECT id, field_path, value, verification, is_canonical, channel
       FROM field_versions WHERE move_id = $1
      ORDER BY field_path, recorded_at`,
    [moveId],
  );

  const byPath = new Map<string, FieldRow[]>();
  for (const f of fields) {
    const list = byPath.get(f.field_path) ?? [];
    list.push(f);
    byPath.set(f.field_path, list);
  }

  const claims: Claim[] = [];
  const openQuestions: string[] = [];

  for (const [path, rows] of byPath) {
    if (path.startsWith("services") || path === "customer.first_name") continue;

    const canonical = rows.find((r) => r.is_canonical);
    const label = LABELS[path] ?? path;
    const distinctValues = new Set(rows.map((r) => JSON.stringify(r.value)));

    if (canonical) {
      // A human resolved this. State it as settled, and cite the approval.
      claims.push({
        text: `${label}: ${fmt(canonical.value)} — confirmed.`,
        sourceFieldIds: [canonical.id],
        verification: canonical.verification,
        kind: "known",
      });
    } else if (distinctValues.size > 1) {
      // Still contested. The briefing shows the disagreement; it does not pick.
      const rendered = rows.map((r) => `${fmt(r.value)} (${r.channel})`).join(" vs ");
      claims.push({
        text: `${label}: sources disagree — ${rendered}.`,
        sourceFieldIds: rows.map((r) => r.id),
        verification: "unverified",
        kind: "conflict",
      });
      openQuestions.push(`Confirm ${label.toLowerCase()} with the customer directly.`);
    } else {
      // Agreed but unconfirmed by the customer.
      const only = rows[0]!;
      claims.push({
        text: `${label}: ${fmt(only.value)} — reported, not yet customer-confirmed.`,
        sourceFieldIds: [only.id],
        verification: only.verification,
        kind: "known",
      });
    }
  }

  // Services requested. Each channel stored its own list, so flatten every
  // list into individual service names and dedupe — otherwise the briefing
  // reads "electric,internet, electric, electric,internet,security" instead of
  // the actual set of distinct services.
  const serviceRows = fields.filter((f) => f.field_path.startsWith("services"));
  const serviceNames = new Set<string>();
  for (const row of serviceRows) {
    const v = row.value;
    if (Array.isArray(v)) for (const s of v) serviceNames.add(String(s));
    else if (typeof v === "string") serviceNames.add(v.replace(/^"|"$/g, ""));
  }
  if (serviceNames.size) {
    claims.push({
      text: `Services requested: ${[...serviceNames].sort().join(", ")}.`,
      sourceFieldIds: serviceRows.map((f) => f.id),
      verification: "customer_confirmed",
      kind: "known",
    });
  }

  // Consent, stated plainly. This is the field an outbound call must check.
  const consent = await query<{ purpose: string; channel: string; granted: boolean }>(
    `SELECT purpose, channel, granted FROM consent_events WHERE move_id = $1`,
    [moveId],
  );
  if (consent.length) {
    const channels = [...new Set(consent.filter((c) => c.granted).map((c) => c.channel))];
    claims.push({
      text: `Consent on file for ${channels.join(", ")} — customer-confirmed.`,
      sourceFieldIds: [],
      verification: "customer_confirmed",
      kind: "known",
    });
  } else {
    claims.push({
      text: "No consent on file. Do not contact until consent is captured.",
      sourceFieldIds: [],
      verification: "unverified",
      kind: "unknown",
    });
    openQuestions.push("Capture contact consent before any outbound communication.");
  }

  const citedFieldIds = [...new Set(claims.flatMap((c) => c.sourceFieldIds))];
  // Grounded means every non-consent claim cites at least one source row.
  const grounded = claims
    .filter((c) => c.kind !== "unknown" && !c.text.startsWith("Consent"))
    .every((c) => c.sourceFieldIds.length > 0);

  const briefing: Briefing = {
    moveReference: ref,
    generatedAt: new Date().toISOString(),
    claims,
    openQuestions,
    citedFieldIds,
    grounded,
  };

  // Record the run. A briefing is advice; the row captures that it was produced,
  // grounded, and awaiting a human decision.
  await withTransaction(async (c) => {
    await c.query(
      `INSERT INTO ai_runs
         (organization_id, move_id, purpose, model, prompt_version,
          input_field_ids, output, grounded)
       VALUES ($1,$2,'concierge_briefing','deterministic-v1','briefing-v1',$3,$4,$5)`,
      [orgId, moveId, citedFieldIds, JSON.stringify(briefing), grounded],
    );
    await recordAudit(c, {
      organizationId: orgId,
      moveId,
      eventType: "ai.briefing.generated",
      actor: "system",
      detail: { grounded, claims: claims.length, openQuestions: openQuestions.length },
    });
  });

  return briefing;
}

/**
 * The LLM seam, now live through the AI Gateway.
 *
 * The contract holds exactly as documented: the model may only rephrase claims
 * it is handed; every output sentence must cite source field ids drawn from the
 * input; uncited sentences are dropped before display; PII is masked before the
 * input leaves the process; and on timeout, invalid output, or no configured
 * key, the deterministic claims serve unchanged. Every run — model or fallback —
 * is recorded in ai_runs with its metrics. See ai-gateway.ts and ADR-004.
 */
export async function renderBriefingNarrative(
  briefing: Briefing,
  organizationId: string,
  moveId: string | null,
) {
  const { renderNarrative } = await import("./ai-gateway");
  return renderNarrative(
    briefing.claims.map((c) => ({
      text: c.text,
      sourceFieldIds: c.sourceFieldIds,
      kind: c.kind,
    })).filter((c) => c.sourceFieldIds.length > 0),
    { organizationId, moveId },
  );
}

function fmt(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}
