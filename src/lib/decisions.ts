import type { Accent } from "./accents";

/**
 * The six decisions that carry risk, with the arguments behind them.
 *
 * The architecture page listed these as six paragraphs in a grid. Every word
 * was true and none of it was legible: a reviewer met six equal-weight blocks
 * of prose and had no way to tell which claim was load-bearing, what the code
 * actually looked like, or what the alternative would have cost.
 *
 * So each decision now carries four things a paragraph cannot: the *rejected*
 * alternative, because a decision with no rejected alternative was never a
 * decision; the schema or code that enforces it, because a claim about a
 * constraint is worth nothing without the constraint; what makes it unusual,
 * because most of these are choices a competent team would make differently;
 * and a drawing, because the mechanism is a shape before it is a sentence.
 */

export interface Decision {
  slug: string;
  title: string;
  /** The one sentence this decision is allowed to say loudly. */
  line: string;
  body: string;
  /** What was not chosen, and what it would have cost. */
  rejected: { option: string; cost: string };
  /** The actual enforcement, as it appears in the schema or the code. */
  code: { lang: string; source: string; snippet: string };
  /** Why this is not the default choice. */
  unusual: string;
  proof: string;
  accent: Accent;
}

export const DECISIONS: Decision[] = [
  {
    slug: "database-is-truth",
    title: "The database is the source of truth",
    line: "Two concurrent approvals cannot produce two truths. The index refuses the second.",
    body: "Workflow state lives in Postgres and is enforced by constraints. A partial unique index permits exactly one canonical value per field per move, so two concierges resolving the same conflict at the same moment cannot both win. The interface may visualise state; it can never be the authority for it.",
    rejected: {
      option: "A state machine in the application — XState, or a status column the code maintains",
      cost: "Both are correct exactly as long as every writer remembers the rules. A second service, a migration script, or a rushed hotfix writes a second canonical row and nothing objects until someone notices two different move dates.",
    },
    code: {
      lang: "sql",
      source: "db/schema.sql",
      snippet: `CREATE UNIQUE INDEX field_versions_one_canonical_idx
  ON field_versions (move_id, field_path)
  WHERE is_canonical;`,
    },
    unusual:
      "Most systems put this in the service layer, where it is easier to read and easier to bypass. Pushing it into a partial index means the guarantee survives code nobody on the team has written yet.",
    proof: "field_versions_one_canonical_idx · concurrent-merge.test.ts",
    accent: "verified",
  },
  {
    slug: "human-merges",
    title: "AI explains conflicts; it never merges them",
    line: "A canonical value with no human behind it is rejected by the database, not by a code review.",
    body: "Every canonical field version must name the actor who chose it. That is a CHECK constraint, so it holds regardless of what any application, script or model does — an attempt to write a canonical value with no selector is refused by Postgres itself.",
    rejected: {
      option: "Enforcing it in the merge service, where the AI proposal path happens to call a function that sets the actor",
      cost: "One new write path — a backfill, an import, an agent tool added in a hurry — and the constraint is silently gone. The failure is invisible: the row looks exactly like a legitimate one.",
    },
    code: {
      lang: "sql",
      source: "db/schema.sql",
      snippet: `CONSTRAINT canonical_requires_actor CHECK (
  NOT is_canonical OR selected_by IS NOT NULL
)`,
    },
    unusual:
      "The boundary is usually written in a prompt or a policy document. Here it is a column that cannot be null, which is the only version of the rule a language model cannot talk its way past.",
    proof: "canonical_requires_actor CHECK · verify-constraints.mjs",
    accent: "security",
  },
  {
    slug: "unknown-not-failed",
    title: "A lost provider response is UNKNOWN, not failed",
    line: "The order may exist. Guessing either way enrols a household twice or loses their electricity.",
    body: "The provider owns order truth, so a lost response means we do not know. The system records UNKNOWN, refuses a blind retry, and reconciles against the provider — recovering the order that already existed rather than creating a second one.",
    rejected: {
      option: "Treating a timeout as a failure and retrying, which is what almost every HTTP client does by default",
      cost: "The provider created the order before the connection dropped. A retry creates a second one, and a real household is enrolled twice with two accounts and two bills. Marking it failed instead loses an order that exists.",
    },
    code: {
      lang: "ts",
      source: "src/lib/provider-submission.ts",
      snippet: `if (existing?.state === "unknown") {
  // The provider is never called. The outcome is
  // genuinely unknown, so a second submit is a guess
  // with a household's electricity as the stake.
  return blocked(existing);
}`,
    },
    unusual:
      "Two states is the norm: succeeded or failed. A third state that means 'ask them' costs a reconciliation job and a queue, and it is the only honest answer when the reply never arrived.",
    proof: "provider-submission.ts · fulfillment.test.ts · scenario.test.ts Act 3",
    accent: "unknown",
  },
  {
    slug: "persisted-idempotency",
    title: "Idempotency is persisted, never Redis-only",
    line: "A cache eviction must not be able to double-charge someone.",
    body: "A unique index on the operation key makes a duplicate submission structurally impossible, and it survives a restart, a deploy and a cache eviction — which a Redis lock does not. Redis is kept for short-lived locks and rate limiting, where losing a key is harmless.",
    rejected: {
      option: "A Redis SETNX lock with a TTL, which is the standard recipe and is genuinely faster",
      cost: "Redis is a cache and behaves like one: it evicts under pressure and it loses keys on failover. Every one of those is a moment when the same operation can execute twice, and the pressure that causes the eviction is exactly the traffic that makes a duplicate likely.",
    },
    code: {
      lang: "sql",
      source: "db/schema.sql",
      snippet: `CREATE UNIQUE INDEX provider_submissions_operation_key_idx
  ON provider_submissions (organization_id, operation_key);
-- plus request_fingerprint, so the same key with a
-- different body is a conflict rather than a replay.`,
    },
    unusual:
      "Correctness that survives cache eviction is slower and duller than a lock, and it is the difference between a guarantee and a strong tendency.",
    proof: "provider_submissions_operation_key_idx · concurrent-provider.test.ts",
    accent: "electricity",
  },
  {
    slug: "append-only-audit",
    title: "The audit log is append-only, enforced",
    line: "An UPDATE against history raises. It does not quietly change nothing.",
    body: "Every consequential transition writes an audit event in the same transaction as the change, so the two commit together or not at all. Triggers on UPDATE and DELETE raise rather than discard, so code that believes it corrected history is told that it did not. A correction is a new event, with its own actor and time.",
    rejected: {
      option: "`DO INSTEAD NOTHING` rules, which is what this used to be and which does keep history safe",
      cost: "The statement still succeeds. Code that believed it had corrected an audit row carries on believing it, and the discrepancy surfaces months later in the one place that must never be ambiguous.",
    },
    code: {
      lang: "sql",
      source: "db/schema.sql",
      snippet: `CREATE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only: % is not
    permitted. Append a correcting event instead.', TG_OP;
END; $$ LANGUAGE plpgsql;`,
    },
    unusual:
      "Raising is louder and more inconvenient than silently discarding, which is the whole point: a system that lets you believe you edited history has a worse problem than one that stops you.",
    proof: "audit_events_no_update / _no_delete triggers · audit-immutable.test.ts",
    accent: "conflict",
  },
  {
    slug: "deferred-on-purpose",
    title: "RAG and a 3D signature are deferred on purpose",
    line: "The briefing generates from rows, so every sentence can be checked against one.",
    body: "The v1 briefing is built from structured field versions, so every claim cites the row it came from and the whole thing is testable with no model in the request path. The model seam exists, is exercised against a real local model, and is documented — it is deferred, not faked.",
    rejected: {
      option: "Retrieval-augmented generation over the case notes, which would read better and demo well",
      cost: "A sentence a reviewer cannot trace to a row is a sentence a concierge might repeat to a customer. Grounding checked after the model speaks is the only version of this that survives a prompt injection, and it is cheaper to ground rows than to police prose.",
    },
    code: {
      lang: "ts",
      source: "src/lib/briefing.ts",
      snippet: `// Every claim carries the field version it came from.
// Output citing an id we did not supply is dropped
// after the model speaks — not asked for politely
// beforehand.
const cited = claims.filter(c => supplied.has(c.sourceFieldId));`,
    },
    unusual:
      "Deferring the most impressive-sounding capability in a portfolio piece is a strange choice, and it is the one that makes the rest of the page believable.",
    proof: "briefing.ts renderNarrative seam · llm-live.test.ts · ADR-004, ADR-005",
    accent: "recovered",
  },
];

export const decision = (slug: string) => DECISIONS.find((d) => d.slug === slug);
