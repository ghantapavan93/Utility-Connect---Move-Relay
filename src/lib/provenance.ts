import { query } from "./db";

/**
 * Bitemporal provenance queries.
 *
 * field_versions carries two clocks:
 *   recorded_at — SYSTEM time: when this system learned the value
 *   valid_at    — VALID time: when the fact was true in the world (where known)
 *
 * Separating them lets the system answer questions a plain audit log cannot:
 *
 *   "What did we believe on Tuesday at 14:00?"    → beliefAt(system time)
 *   "Did the provider receive stale information?" → compare submission time
 *      against the belief in force at that moment vs the belief now
 *
 * That second question is the operational one: when a customer corrects a move
 * date AFTER a provider submission went out, the diff between then-belief and
 * now-belief is the compensation workload, computed rather than guessed.
 */

export interface Belief {
  value: unknown;
  channel: string;
  verification: string;
  recordedAt: string;
  validAt: string | null;
  isCanonical: boolean;
}

/**
 * The belief in force for a field at a given SYSTEM time: the latest version
 * recorded at or before that moment, preferring a canonical version when one
 * existed by then.
 */
export async function beliefAt(
  moveId: string,
  fieldPath: string,
  systemTime: string,
): Promise<Belief | null> {
  const rows = await query<{
    value: unknown;
    channel: string;
    verification: string;
    recorded_at: string;
    valid_at: string | null;
    is_canonical: boolean;
  }>(
    `SELECT value, channel, verification, recorded_at, valid_at, is_canonical
       FROM field_versions
      WHERE move_id = $1 AND field_path = $2 AND recorded_at <= $3
      ORDER BY is_canonical DESC, recorded_at DESC
      LIMIT 1`,
    [moveId, fieldPath, systemTime],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    value: r.value,
    channel: r.channel,
    verification: r.verification,
    recordedAt: r.recorded_at,
    validAt: r.valid_at,
    isCanonical: r.is_canonical,
  };
}

export interface StalenessFinding {
  fieldPath: string;
  believedThen: unknown;
  believedNow: unknown;
  changedAfter: string;
}

/**
 * Which fields changed AFTER a given moment — e.g. after a provider submission
 * went out? Each finding is a place downstream state may rest on stale truth
 * and need compensation.
 */
export async function staleSince(
  moveId: string,
  systemTime: string,
): Promise<StalenessFinding[]> {
  const paths = await query<{ field_path: string }>(
    `SELECT DISTINCT field_path FROM field_versions WHERE move_id = $1`,
    [moveId],
  );

  const findings: StalenessFinding[] = [];
  for (const { field_path } of paths) {
    const then = await beliefAt(moveId, field_path, systemTime);
    const now = await beliefAt(moveId, field_path, new Date().toISOString());
    if (then && now && JSON.stringify(then.value) !== JSON.stringify(now.value)) {
      findings.push({
        fieldPath: field_path,
        believedThen: then.value,
        believedNow: now.value,
        changedAfter: systemTime,
      });
    }
  }
  return findings;
}
