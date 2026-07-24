import Link from "next/link";

/**
 * The architecture page — written for a CTO. It states the decisions that carry
 * risk and the reason each was made, and points at the tests that prove them.
 */
export default function Architecture() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Move Relay
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Architecture</h1>
      <p className="mt-3 text-lg" style={{ color: "var(--color-text-mid)" }}>
        Six decisions that carry risk, and why each was made this way. Every one is
        enforced by a constraint or a test, not by convention.
      </p>

      <div className="mt-10 space-y-8">
        {DECISIONS.map((d) => (
          <section key={d.title}>
            <h2 className="text-lg font-semibold">{d.title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {d.body}
            </p>
            <p className="mt-2 font-mono text-xs" style={{ color: "var(--color-state-verified)" }}>
              {d.proof}
            </p>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
        <h2 className="text-sm font-semibold">Verify it yourself</h2>
        <pre className="mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
{`npm install
npm run verify   # 11 schema guarantees + 30 behaviour tests, no Docker needed`}
        </pre>
      </section>
    </main>
  );
}

const DECISIONS = [
  {
    title: "The database is the source of truth — not XState, not the frontend",
    body: "Workflow state lives in Postgres and is enforced by constraints. A partial unique index permits exactly one canonical value per field per move, so two concurrent approvals cannot produce two truths. The UI may visualise state; it can never be the authority for it.",
    proof: "field_versions_one_canonical_idx · scenario.test.ts Act 2",
  },
  {
    title: "AI explains conflicts; it never merges them",
    body: "A canonical value requires a named human actor. This is a CHECK constraint, so it holds regardless of application code — an attempt to write a canonical value with no selector is rejected by the database itself.",
    proof: "canonical_requires_actor CHECK · verify-constraints.mjs",
  },
  {
    title: "A lost provider response is UNKNOWN, not failed",
    body: "Their own Terms of Service state the customer contracts directly with the provider; Utility Connect facilitates. So the provider owns order truth, and a lost response means we do not know. The system records UNKNOWN, blocks a blind retry, and reconciles against the provider — recovering the existing order rather than creating a second one.",
    proof: "provider-submission.ts · scenario.test.ts Act 3",
  },
  {
    title: "Idempotency is persisted, never Redis-only",
    body: "A unique index on (organization_id, operation_key) makes a duplicate submission structurally impossible, and it survives restart and cache eviction — which a Redis lock does not. Redis is reserved for short-lived locks and rate limiting.",
    proof: "provider_submissions_operation_key_idx",
  },
  {
    title: "The audit log is append-only, enforced",
    body: "Every consequential transition writes an audit event in the same transaction as the change, so the two commit together or not at all. DO INSTEAD NOTHING rules on UPDATE and DELETE mean the log survives application bugs, not just good intentions.",
    proof: "audit_events_no_update / _no_delete · scenario.test.ts Act 4",
  },
  {
    title: "RAG and 3D are deferred on purpose",
    body: "The v1 briefing generates from structured rows, so every claim is traceable and testable with no model in the loop. The signature visual is 2D SVG rather than Three.js, because operational software that needs to be trusted rarely benefits from 3D — and a constellation that does not render real state would be exactly the decoration the design system bans.",
    proof: "briefing.ts renderNarrative seam · ADR-004, ADR-005",
  },
];
