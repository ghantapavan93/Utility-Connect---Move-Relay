import { query } from "./db";
import type { Actor } from "./actor";

/**
 * Where one projected field came from, told to the audience that received it.
 *
 * A projection answers *what* an audience may see. This answers *why this
 * value* — which source supplied it, what it superseded, and who decided. That
 * is the provenance the whole project is about, and until now it existed only
 * in `field_versions` and in the concierge panel's table.
 *
 * ## Lineage is a projection too
 *
 * The obvious mistake is to treat history as neutral and return all of it. It
 * is not: the source channel of a rejected value, the name of the operator who
 * chose between them, and the reason they gave are exactly the internal
 * machinery the customer projection withholds. Handing that back through a
 * second endpoint would undo the first one.
 *
 * So the same rule applies here. Start from nothing, add only what this
 * audience is entitled to, and never return a restricted value in order to
 * explain that it was restricted — the categories say what kind of thing is
 * missing, and nothing reconstructs it.
 */

export interface LineageStep {
  /** The channel that supplied this value. */
  source: string;
  /** ISO timestamp of when we learned it — system time, not valid time. */
  recordedAt: string;
  /** True for the value that currently stands. */
  canonical: boolean;
  /**
   * The value, only where this audience is entitled to it.
   *
   * Present for the concierge, who resolves conflicts and needs to see what was
   * rejected. Absent for everyone else: a customer being shown the value their
   * partner got wrong learns a fact about that partner's data quality, which is
   * not theirs to have.
   */
  value?: unknown;
}

export interface FieldLineage {
  field: string;
  label: string;
  /** The value this audience received, restated so the drawer stands alone. */
  projectedValue: unknown;
  /** Oldest first. Length is the number of times this field was supplied. */
  history: LineageStep[];
  /** Who chose the surviving value, and why. Concierge only. */
  decision: { by: string; reason: string | null } | null;
  /** Plain language: what this audience gets and in what form. */
  projectionRule: string;
  /** Categories, never fields. */
  withheldFromThisView: string[];
}

const LABELS: Record<string, string> = {
  "move.date": "Move date",
  "move.to_address": "Destination",
  "customer.phone": "Phone",
  "customer.email": "Email",
};

/**
 * Fields each audience may ask lineage for.
 *
 * The allow-list is deliberately the same shape as the projection's, and
 * deliberately separate from it: a field can be safe to *show* and unsafe to
 * *explain*, because the explanation carries the sources and the rejected
 * values with it. Asking about anything outside this list returns null rather
 * than an empty history, so the answer never distinguishes "no such field" from
 * "not for you".
 */
const LINEAGE_ALLOW: Record<Actor["audience"], Set<string>> = {
  concierge: new Set(["move.date", "move.to_address", "customer.phone", "customer.email"]),
  customer: new Set(["move.date", "move.to_address"]),
  partner: new Set(["move.date"]),
};

const RULE: Record<Actor["audience"], string> = {
  concierge:
    "Every version this field has had, with its channel and the decision that resolved it. The operator resolving the move needs to see what was rejected as well as what survived.",
  customer:
    "The value that stands, and how many times it was supplied. Sources, rejected values and internal decisions stay on the server.",
  partner:
    "The confirmed value only, where the partner's own referral relates to it. Nothing about other channels, other partners, or how the value was chosen.",
};

const WITHHELD: Record<Actor["audience"], string[]> = {
  concierge: [],
  customer: ["Source channels", "Rejected values", "The operator who decided", "Selection reasoning"],
  partner: ["Source channels", "Rejected values", "Internal decisions", "Other partners' contributions"],
};

interface Row {
  field_path: string;
  value: unknown;
  channel: string;
  is_canonical: boolean;
  selected_by: string | null;
  selection_reason: string | null;
  recorded_at: string;
}

export async function fieldLineage(
  moveId: string,
  fieldPath: string,
  audience: Actor["audience"],
): Promise<FieldLineage | null> {
  if (!LINEAGE_ALLOW[audience].has(fieldPath)) return null;

  const rows = await query<Row>(
    `SELECT field_path, value, channel, is_canonical, selected_by, selection_reason, recorded_at
       FROM field_versions
      WHERE move_id = $1 AND field_path = $2
      ORDER BY recorded_at ASC`,
    [moveId, fieldPath],
  );
  if (rows.length === 0) return null;

  const canonical = rows.find((r) => r.is_canonical) ?? rows[rows.length - 1]!;
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : v);

  const full = audience === "concierge";

  return {
    field: fieldPath,
    label: LABELS[fieldPath] ?? fieldPath,
    projectedValue: clean(canonical.value),
    history: rows.map((r) => ({
      source: full ? r.channel : "recorded",
      recordedAt: r.recorded_at,
      canonical: r.is_canonical,
      // Only the operator sees what was rejected.
      ...(full ? { value: clean(r.value) } : {}),
    })),
    /*
      The decision is the sharpest thing in this record: it names a person and
      their reasoning. The schema insists a canonical value carry both, and this
      is the only audience with any business reading them.
    */
    decision: full && canonical.selected_by
      ? { by: canonical.selected_by, reason: canonical.selection_reason }
      : null,
    projectionRule: RULE[audience],
    withheldFromThisView: WITHHELD[audience],
  };
}
