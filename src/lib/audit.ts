import type { Queryable } from "./db";

/**
 * Append-only audit log.
 *
 * Always called with the same `client` as the state change it describes, so the
 * two commit together or not at all. A state change without its audit row is the
 * exact failure this product exists to prevent, so it must not be possible to
 * produce one by accident.
 *
 * `audit_events` also carries DO INSTEAD NOTHING rules on UPDATE and DELETE, so
 * the append-only property survives application bugs, not just discipline.
 */
export interface AuditInput {
  organizationId: string;
  moveId?: string | null;
  eventType: string;
  /** 'system' | 'human:<id>' | 'ai:<run_id>' — never anonymous. */
  actor: string;
  correlationId?: string | null;
  causationId?: string | null;
  stateBefore?: Record<string, unknown> | null;
  stateAfter?: Record<string, unknown> | null;
  detail?: Record<string, unknown> | null;
}

/** Field paths whose values must never reach the audit log or an LLM prompt. */
const REDACTED_PATHS = new Set([
  "customer.ssn",
  "customer.social_security_number",
  "payment.account_number",
  // Bare keys as well, because a nested walk matches on both the full path and
  // the leaf name — a payload that drops the wrapper must not slip through.
  "ssn",
  "social_security_number",
  "account_number",
]);

/**
 * Utility Connect's privacy policy states that registered users' data includes
 * a social security number. Audit detail is written on every transition and is
 * read by operators, so it is the most likely place for such a value to leak.
 * Redaction happens here, once, rather than at each call site.
 *
 * This walks the whole object rather than its top level, and that is the fix
 * for a real leak. `REDACTED_PATHS` has always held dotted paths — `customer.ssn`
 * — while the implementation compared them against top-level keys only. Since
 * every payload in this system nests customer data under `customer`, the
 * matcher never fired once: the comment described redaction the code was not
 * doing, and an SSN in a referral payload went into the audit log in clear.
 *
 * Arrays are walked too, without their indices entering the path, so
 * `services[2].payment.account_number` still matches `payment.account_number`.
 */
export function redact(
  detail: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!detail) return null;
  return walk(detail, "") as Record<string, unknown>;
}

function walk(value: unknown, path: string): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, path));
  if (value === null || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${k}` : k;
    // Match on the full path *and* the bare key, so a payload that omits the
    // wrapper — `{ ssn }` rather than `{ customer: { ssn } }` — is still caught.
    out[k] = REDACTED_PATHS.has(next) || REDACTED_PATHS.has(k) ? "[redacted]" : walk(v, next);
  }
  return out;
}

export async function recordAudit(
  client: Queryable,
  input: AuditInput,
): Promise<void> {
  await client.query(
    `INSERT INTO audit_events
       (organization_id, move_id, event_type, actor, correlation_id,
        causation_id, state_before, state_after, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.organizationId,
      input.moveId ?? null,
      input.eventType,
      input.actor,
      input.correlationId ?? null,
      input.causationId ?? null,
      input.stateBefore ? JSON.stringify(input.stateBefore) : null,
      input.stateAfter ? JSON.stringify(input.stateAfter) : null,
      JSON.stringify(redact(input.detail)),
    ],
  );
}
