import { query } from "./db";

/**
 * The consent gate.
 *
 * Consent here is scoped (four named purposes), per-channel, versioned to the
 * exact wording agreed to, and revocable at any moment — which means it cannot
 * be a boolean checked once at intake. It must be resolved AT SEND TIME, for
 * this channel and this purpose, against the latest event on the ledger.
 *
 * This function is that resolution. Every outbound touch — call, SMS, email —
 * is expected to pass through it, and its default is deny: no ledger entry
 * means no contact, not "probably fine".
 */

/**
 * The values, and the types derived from them.
 *
 * These were union types with no runtime counterpart, which meant nothing
 * outside TypeScript could check a purpose before handing it to Postgres — and
 * the column is a real enum, so a wrong value is not a validation failure, it is
 * a transaction that throws mid-write. The console's own consent payload used
 * `service_setup` and `provider_contact`, neither of which exists, and it went
 * unnoticed because that referral always attached to an existing move and the
 * attach path does not write consent. On a fresh tenant it would have created a
 * move and then crashed.
 *
 * Derived with `as const` so the arrays are the single source and the types
 * cannot drift from them.
 */
export const CONSENT_CHANNELS = ["phone", "sms", "email"] as const;
export const CONSENT_PURPOSES = [
  "customer_care",
  "connection_status",
  "account_information",
  "appointment_details",
] as const;

export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

export interface ConsentDecision {
  allowed: boolean;
  reason: string;
  /** The wording version in force, when allowed — for the audit trail. */
  consentTextVersion?: string;
  /** When the governing event was recorded. */
  decidedBy?: string;
}

/**
 * May we contact this move's customer on `channel` for `purpose`, right now?
 *
 * The latest event for the (purpose, channel) pair governs — a revocation is
 * just a newer row with granted = false, so revocation needs no special path.
 */
export async function canContact(
  moveId: string,
  channel: ConsentChannel,
  purpose: ConsentPurpose,
): Promise<ConsentDecision> {
  const rows = await query<{
    granted: boolean;
    consent_text_version: string;
    occurred_at: string;
  }>(
    `SELECT granted, consent_text_version, occurred_at
       FROM consent_events
      WHERE move_id = $1 AND purpose = $2 AND channel = $3
      ORDER BY occurred_at DESC, id DESC
      LIMIT 1`,
    [moveId, purpose, channel],
  );

  const latest = rows[0];

  if (!latest) {
    return {
      allowed: false,
      reason: `no consent on file for ${channel}/${purpose} — deny by default`,
    };
  }

  if (!latest.granted) {
    return {
      allowed: false,
      reason: `consent for ${channel}/${purpose} was revoked`,
      decidedBy: latest.occurred_at,
    };
  }

  return {
    allowed: true,
    reason: `consent granted for ${channel}/${purpose}`,
    consentTextVersion: latest.consent_text_version,
    decidedBy: latest.occurred_at,
  };
}

/** Record a consent change — grant or revocation — as a new ledger event. */
export async function recordConsent(
  organizationId: string,
  moveId: string,
  purpose: ConsentPurpose,
  channel: ConsentChannel,
  granted: boolean,
  textVersion: string,
): Promise<void> {
  await query(
    `INSERT INTO consent_events
       (organization_id, move_id, purpose, channel, granted, consent_text_version)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [organizationId, moveId, purpose, channel, granted, textVersion],
  );
}
