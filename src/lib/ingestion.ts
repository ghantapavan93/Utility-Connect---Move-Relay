import type { PoolClient } from "pg";
import { recordAudit } from "./audit";

/**
 * Ingestion, duplicate detection and conflict surfacing.
 *
 * Every rule in this file is deterministic. That is a product decision, not a
 * technical shortcut: identity resolution and duplicate merging decide whose
 * data gets combined with whose. An LLM that is right 97% of the time will
 * eventually merge two different families' moves, and there is no audit trail
 * that makes that acceptable.
 *
 * AI's role, defined in docs/AI_BOUNDARIES.md, is to *explain* a conflict to the
 * operator in plain language. It never chooses. See ADR-003.
 */

export type Channel =
  | "partner_api"
  | "csv_upload"
  | "customer_form"
  | "microsite"
  | "concierge_manual";

export type Verification =
  | "unverified"
  | "customer_confirmed"
  | "system_validated"
  | "human_approved";

export interface FieldCandidate {
  fieldPath: string;
  value: unknown;
  channel: Channel;
  partnerId: string | null;
  rawSubmissionId: string;
  verification: Verification;
  confidence: number;
  recordedAt: string;
}

/**
 * Verification is a property of *how we learned* a value, never of the value.
 *
 * A partner API is a well-formed, authenticated, machine-generated source — and
 * still only ever reports what someone told the partner at some earlier point.
 * A customer web form is messier and less reliable technically, yet it is the
 * only channel where the person the data is *about* asserts it directly.
 *
 * So the customer form outranks the partner API here. That inversion is the
 * product's whole point of view, in one constant.
 */
const CHANNEL_TRUST: Record<Channel, { verification: Verification; confidence: number }> = {
  customer_form: { verification: "customer_confirmed", confidence: 0.95 },
  concierge_manual: { verification: "human_approved", confidence: 0.9 },
  microsite: { verification: "customer_confirmed", confidence: 0.9 },
  partner_api: { verification: "unverified", confidence: 0.7 },
  // Hand-exported and re-imported. Every transcription step is a chance to drop
  // a digit — which is exactly what happens in the demo fixture.
  csv_upload: { verification: "unverified", confidence: 0.5 },
};

// --- normalisation --------------------------------------------------------

export const normalizePhone = (v: string): string => v.replace(/\D/g, "").slice(-10);

export const normalizeEmail = (v: string): string => v.trim().toLowerCase();

export const normalizeName = (v: string): string =>
  v.trim().toLowerCase().replace(/\s+/g, " ");

export const normalizeAddress = (v: string): string =>
  v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b(street|st)\b/g, "st")
    .replace(/\b(parkway|pkwy)\b/g, "pkwy")
    .replace(/\b(avenue|ave)\b/g, "ave")
    .replace(/[.,]/g, "");

/** Flattens a nested payload into dotted field paths. */
export function flatten(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v as Record<string, unknown>, path));
    } else {
      out[path] = v;
    }
  }
  return out;
}

// --- duplicate detection --------------------------------------------------

export interface MatchSignal {
  signal: string;
  weight: number;
  matched: boolean;
  detail: string;
}

export interface DuplicateAssessment {
  score: number;
  signals: MatchSignal[];
  /** Deterministic bands. Nothing here is a model output. */
  verdict: "distinct" | "probable_duplicate" | "certain_duplicate";
}

/**
 * Scores whether two submissions describe the same move.
 *
 * Weights are explicit and inspectable so an operator can see exactly why the
 * system thinks two records are the same. "The model said so" is not a reason a
 * concierge can defend to a customer.
 */
export function assessDuplicate(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): DuplicateAssessment {
  const fa = flatten(a);
  const fb = flatten(b);

  const str = (o: Record<string, unknown>, k: string): string | null =>
    typeof o[k] === "string" ? (o[k] as string) : null;

  const signals: MatchSignal[] = [];

  const emailA = str(fa, "customer.email");
  const emailB = str(fb, "customer.email");
  signals.push({
    signal: "email",
    weight: 0.5,
    matched: !!emailA && !!emailB && normalizeEmail(emailA) === normalizeEmail(emailB),
    detail: `${emailA ?? "—"} vs ${emailB ?? "—"}`,
  });

  const nameA = `${str(fa, "customer.first_name") ?? ""} ${str(fa, "customer.last_name") ?? ""}`;
  const nameB = `${str(fb, "customer.first_name") ?? ""} ${str(fb, "customer.last_name") ?? ""}`;
  signals.push({
    signal: "name",
    weight: 0.2,
    matched: normalizeName(nameA) === normalizeName(nameB) && normalizeName(nameA) !== "",
    detail: `${nameA.trim()} vs ${nameB.trim()}`,
  });

  const addrA = str(fa, "move.to_address");
  const addrB = str(fb, "move.to_address");
  signals.push({
    signal: "destination_address",
    weight: 0.25,
    matched: !!addrA && !!addrB && normalizeAddress(addrA) === normalizeAddress(addrB),
    detail: `${addrA ?? "—"} vs ${addrB ?? "—"}`,
  });

  const phoneA = str(fa, "customer.phone");
  const phoneB = str(fb, "customer.phone");
  const phoneMatch =
    !!phoneA && !!phoneB && normalizePhone(phoneA) === normalizePhone(phoneB);
  signals.push({
    signal: "phone",
    weight: 0.05,
    matched: phoneMatch,
    // Phone carries deliberately low weight. A single mistyped digit is the most
    // common defect in hand-exported data, and treating it as strong evidence of
    // *distinctness* would split one family into two moves.
    detail: phoneMatch
      ? `${phoneA} vs ${phoneB}`
      : `${phoneA ?? "—"} vs ${phoneB ?? "—"} — differs`,
  });

  const score = signals.reduce((sum, s) => sum + (s.matched ? s.weight : 0), 0);

  const verdict =
    score >= 0.9 ? "certain_duplicate" : score >= 0.6 ? "probable_duplicate" : "distinct";

  return { score: Math.round(score * 100) / 100, signals, verdict };
}

// --- conflict detection ---------------------------------------------------

export interface FieldConflict {
  fieldPath: string;
  candidates: FieldCandidate[];
  /** Deterministic suggestion. The human still has to choose. */
  recommended: FieldCandidate | null;
  reason: string;
}

/**
 * Groups candidates by field and returns only the fields where sources disagree.
 *
 * `recommended` applies one rule: prefer the highest verification level, then the
 * most recent. It is a starting point for the operator, never an action. Nothing
 * in this module writes `is_canonical` — that requires an explicit human
 * approval, and the database enforces it via `canonical_requires_actor`.
 */
export function detectConflicts(candidates: FieldCandidate[]): FieldConflict[] {
  const byPath = new Map<string, FieldCandidate[]>();
  for (const c of candidates) {
    const list = byPath.get(c.fieldPath) ?? [];
    list.push(c);
    byPath.set(c.fieldPath, list);
  }

  const rank: Record<Verification, number> = {
    human_approved: 4,
    customer_confirmed: 3,
    system_validated: 2,
    unverified: 1,
  };

  const conflicts: FieldConflict[] = [];

  for (const [fieldPath, list] of byPath) {
    const distinct = new Set(list.map((c) => JSON.stringify(c.value)));
    if (distinct.size <= 1) continue;

    const sorted = [...list].sort((a, b) => {
      const r = rank[b.verification] - rank[a.verification];
      if (r !== 0) return r;
      return Date.parse(b.recordedAt) - Date.parse(a.recordedAt);
    });

    const top = sorted[0] ?? null;

    conflicts.push({
      fieldPath,
      candidates: sorted,
      recommended: top,
      reason: top
        ? `${top.channel} carries verification '${top.verification}', the highest among ${list.length} sources.`
        : "No candidate could be ranked.",
    });
  }

  return conflicts;
}

// --- persistence ----------------------------------------------------------

export async function persistCandidates(
  client: PoolClient,
  opts: { organizationId: string; moveId: string; correlationId: string },
  candidates: FieldCandidate[],
): Promise<void> {
  for (const c of candidates) {
    await client.query(
      `INSERT INTO field_versions
         (organization_id, move_id, field_path, value, raw_submission_id,
          channel, partner_id, verification, confidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        opts.organizationId,
        opts.moveId,
        c.fieldPath,
        JSON.stringify(c.value),
        c.rawSubmissionId,
        c.channel,
        c.partnerId,
        c.verification,
        c.confidence,
      ],
    );
  }

  await recordAudit(client, {
    organizationId: opts.organizationId,
    moveId: opts.moveId,
    eventType: "ingestion.candidates.recorded",
    actor: "system",
    correlationId: opts.correlationId,
    detail: { count: candidates.length, fields: [...new Set(candidates.map((c) => c.fieldPath))] },
  });
}

export function candidatesFromSubmission(sub: {
  id: string;
  channel: Channel;
  partner_id: string | null;
  payload: Record<string, unknown>;
  received_at: string;
}): FieldCandidate[] {
  const trust = CHANNEL_TRUST[sub.channel];
  const flat = flatten(sub.payload);

  return Object.entries(flat)
    .filter(([path]) => !path.startsWith("consent."))
    .map(([fieldPath, value]) => ({
      fieldPath,
      value,
      channel: sub.channel,
      partnerId: sub.partner_id,
      rawSubmissionId: sub.id,
      verification: trust.verification,
      confidence: trust.confidence,
      recordedAt: sub.received_at,
    }));
}

export { CHANNEL_TRUST };
