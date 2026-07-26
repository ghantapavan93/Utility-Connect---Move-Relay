import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill } from "@/components/cinematic";
import { accentColor } from "@/lib/accents";

/**
 * The architecture page — written for a CTO. It states the decisions that carry
 * risk and the reason each was made, and points at the tests that prove them.
 */
export default function Architecture() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="arch" />

      {/*
        An architecture page is usually a diagram nobody can disagree with. This
        one is a list of decisions that could have gone the other way, each with
        the reason it did not — because a decision with no rejected alternative
        was never a decision. Every entry names the constraint or the test that
        enforces it, so the document cannot drift away from the code without
        something going red.
      */}
      <CineHero
        image="/renders/arrival.png"
        alt="The residence seen from the drive"
        accent="verified"
        pills={
          <>
            <Pill accent="verified">Six load-bearing decisions</Pill>
            <Pill accent="recovered">Each one enforced by a test</Pill>
          </>
        }
        headline={
          <>
            Opinions are cheap.
            <br />
            <span className="cine-shimmer">Constraints are not.</span>
          </>
        }
        sub="Six decisions that carry real risk, the reason each was made this way, and the constraint or test that stops it quietly becoming untrue. Documentation drifts; a failing build does not."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "verified",
            body: "Give a reviewer the decisions worth arguing with, rather than a diagram nobody can disagree with.",
          },
          {
            eyebrow: "Proof",
            accent: "recovered",
            body: "Eleven schema guarantees are proven by SQL that must be rejected, and fitness tests fail the build if a module crosses a boundary this page claims it does not.",
          },
          {
            eyebrow: "Code",
            accent: "unknown",
            body: "Idempotency persisted in Postgres rather than Redis, so correctness survives cache eviction. Audit is append-only by rule, not by discipline.",
          },
        ]}
        actions={
          <MagneticLink
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white"
            {...{ style: { background: accentColor("verified", 1) } }}
          >
            See it running <ArrowRight className="h-4 w-4" />
          </MagneticLink>
        }
      />

      <ChapterMarker n="01" label="Six decisions" />
      <div className="mx-auto max-w-[1400px] px-5 pb-10 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          A decision with no rejected alternative{" "}
          <span style={{ color: accentColor("verified", 1) }}>was never a decision</span>.
        </h2>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-4 px-5 pb-16 sm:px-8 md:grid-cols-2">
        {DECISIONS.map((d, i) => (
          <section key={d.title} className="cine-glass rounded-2xl p-6">
            <span className="font-mono text-[11px] font-semibold text-white/35">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-white">{d.title}</h3>
            <p className="mt-2.5 text-sm leading-relaxed text-white/65">{d.body}</p>
            <p
              className="mt-4 border-l-2 pl-3 font-mono text-[11px] leading-relaxed"
              style={{ borderColor: accentColor("verified", 0.7), color: accentColor("verified", 0.95) }}
            >
              {d.proof}
            </p>
          </section>
        ))}
      </div>

      <ChapterMarker n="02" label="Check it yourself" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <div className="cine-glass max-w-2xl rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/90">Nothing here needs Docker</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            The suite runs against an embedded Postgres, so the guarantees on this page can be
            verified on a laptop in under a minute.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/50 p-4 font-mono text-xs leading-relaxed text-white/75">
{`npm install
npm run verify   # 11 schema guarantees + the behaviour suite`}
          </pre>
        </div>
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
