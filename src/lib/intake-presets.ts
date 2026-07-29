import type { ContractChannel } from "./contracts";

/**
 * Payloads that each provoke one specific behaviour of the intake gauntlet.
 *
 * `ingestReferral` has always been able to do all of this — idempotent replay,
 * key conflict, exact-duplicate collapse, cross-move deduplication, contract
 * quarantine — and until now the only way to see any of it was to read the
 * source or run the test suite. The operator console had a hardcoded array of
 * five invented customers instead, which is the one thing a page about
 * provenance must never contain.
 *
 * So these are the door. Each preset is a real payload that lands on the real
 * endpoint and produces a real row; nothing here is simulated, and the console
 * reports whatever actually came back rather than what this file predicted.
 * `expect` is a claim the UI checks itself against, not an outcome it fakes —
 * when the two disagree, the console says so, because a demonstration that
 * cannot be wrong is not evidence of anything.
 *
 * The order is deliberate: the presets build on each other, so working down the
 * list walks a reviewer through the whole gauntlet in the order a real partner
 * integration hits it.
 */

export type IntakeStatus =
  | "created"
  | "attached"
  | "collapsed"
  | "replayed"
  | "quarantined"
  | "key_conflict";

export interface IntakePreset {
  id: string;
  label: string;
  /**
   * The command, in the operator's words.
   *
   * Every preset used one button reading "Send", which made the console read as
   * an API testing tool: seven identical verbs firing seven different domain
   * conditions. A control that does not name what it does leaves the reviewer
   * to infer it from the response.
   */
  action: string;
  /** What a reviewer is being shown, in one line. */
  demonstrates: string;
  /** Why the system behaves this way, and what it would cost not to. */
  why: string;
  channel: ContractChannel;
  expect: IntakeStatus;
  /**
   * How the key should be handled when this preset is fired.
   *
   * `fresh` mints a new one. `reuse` sends the previous submission's key
   * unchanged — which is the only way to demonstrate replay and conflict, and
   * the reason this is a property of the preset rather than of the form.
   */
  key: "fresh" | "reuse";
  /** Sent verbatim as the request body's `payload`. */
  payload: Record<string, unknown>;
}

/** A well-formed partner referral. The baseline every other preset varies. */
const BASE = {
  customer: {
    first_name: "Dana",
    last_name: "Okonkwo",
    email: "dana.okonkwo@example.com",
    phone: "214-555-0182",
  },
  move: { date: "2026-09-04", to_address: "1140 Rowlett Creek Way, Plano, TX 75024" },
  services: ["electric", "internet"],
  referral: { partner_slug: "north-texas-realty", agent: "j.alvarez" },
};

export const INTAKE_PRESETS: IntakePreset[] = [
  {
    id: "clean",
    action: "Submit referral",
    label: "A clean partner referral",
    demonstrates: "Accepted, a move is created, every field keeps its channel and trust tier.",
    why: "The baseline. Partner API is trusted at 0.7 and marked unverified, because a partner asserting a phone number is not the same as a customer confirming one.",
    channel: "partner_api",
    expect: "created",
    key: "fresh",
    payload: BASE,
  },
  {
    id: "replay",
    action: "Replay request",
    label: "The same request, retried",
    demonstrates: "Replayed. The stored response is returned; no second move, no second row.",
    why: "A partner whose connection dropped will retry. Idempotency here is a persisted record with a unique operation key, not a cache — so it survives a restart, an eviction, and a deploy.",
    channel: "partner_api",
    expect: "replayed",
    key: "reuse",
    payload: BASE,
  },
  {
    id: "key_conflict",
    action: "Test key conflict",
    label: "The same key, a different body",
    demonstrates: "Refused with 409. The key is already bound to a different request.",
    why: "The dangerous one. A client reusing a key for new data is a bug, and quietly accepting it would let one key stand for two different moves. Storing the request fingerprint is what makes this detectable at all.",
    channel: "partner_api",
    expect: "key_conflict",
    key: "reuse",
    payload: {
      ...BASE,
      move: { ...BASE.move, date: "2026-09-11" },
    },
  },
  {
    id: "collapse",
    action: "Test logical duplicate",
    label: "The identical payload, a new key",
    demonstrates: "Collapsed into the existing submission rather than stored twice.",
    why: "At-least-once delivery means the same batch arrives more than once with different keys. The payload hash has a unique constraint, so the collapse is enforced by the database rather than by the code remembering to check.",
    channel: "partner_api",
    expect: "collapsed",
    key: "fresh",
    payload: BASE,
  },
  {
    id: "duplicate",
    action: "Submit possible match",
    label: "The same person, one wrong digit",
    demonstrates:
      "Attached to the existing move as a second source, with the disagreeing fields surfaced.",
    why: "This is the wedge. A second move for one household is the failure that costs a duplicate provider order; a merge decided by a machine is the failure that costs trust. So it attaches, and a named person decides.",
    channel: "csv_upload",
    expect: "attached",
    key: "fresh",
    payload: {
      customer: { ...BASE.customer, phone: "214-555-0183" },
      move: { ...BASE.move, date: "2026-09-06" },
      services: ["electric"],
      referral: { partner_slug: "north-texas-realty" },
    },
  },
  {
    id: "quarantine",
    action: "Introduce schema drift",
    label: "A partner renames a column",
    demonstrates: "Quarantined with machine-readable reasons. Nothing malformed reaches canon.",
    why: "Schema drift is not an outage. The rows that validate land, the rows that do not are held with the exact paths that failed, and a partner gets a list instead of a silence.",
    channel: "csv_upload",
    expect: "quarantined",
    key: "fresh",
    payload: {
      // `mobile` instead of `phone`, and a date in the wrong format: the two
      // ways a hand-maintained export actually breaks.
      customer: {
        first_name: "Dana",
        last_name: "Okonkwo",
        email: "dana.okonkwo@example.com",
        mobile: "214-555-0182",
      },
      move: { date: "04/09/2026", to_address: "1140 Rowlett Creek Way, Plano, TX 75024" },
    },
  },
  {
    id: "consented",
    action: "Confirm as customer",
    label: "A customer confirms it themselves",
    demonstrates: "Accepted at the highest trust tier, with the consent version recorded.",
    why: "Customer-confirmed outranks partner-asserted at 0.95 against 0.7, which is how a merge resolves without anyone arguing. The consent wording version is stored because 'they agreed' is not an answer without 'to what, exactly'.",
    channel: "customer_form",
    expect: "attached",
    key: "fresh",
    payload: {
      customer: BASE.customer,
      move: { ...BASE.move, date: "2026-09-06" },
      services: ["electric", "internet", "security"],
      consent: {
        granted: true,
        channels: ["email", "phone"],
        purposes: ["customer_care", "connection_status"],
        text_version: "consent-2026-03",
      },
    },
  },
];

/** Presets that need the previous submission's key rather than a new one. */
export const reusesKey = (p: IntakePreset) => p.key === "reuse";

/**
 * Whether what came back matches what the preset claimed.
 *
 * Deliberately exact. A near-miss — "attached" where "created" was promised —
 * means the tenant is in a different state than the preset assumed, and the
 * console should say so rather than colour it green because it did not error.
 */
export function matchedExpectation(preset: IntakePreset, actual: string): boolean {
  return preset.expect === actual;
}
