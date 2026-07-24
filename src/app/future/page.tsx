import Link from "next/link";

/**
 * The future-vision page. Every item is labelled Built, Concept, or Hypothesis,
 * and the labels are never blurred. The working proof stays visibly the centre.
 */
export default function Future() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Move Relay
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Utility Connect Continuum</h1>
      <p className="mt-3 text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        The move is the acquisition moment. The home relationship is the long-term product.
        Move Relay makes the initial handoffs trustworthy; these modules extend the same
        provenance, consent, and attribution kernel across the whole home lifecycle.
      </p>

      <div className="mt-6 flex gap-2 text-xs">
        <Legend color="var(--color-state-verified)" label="Built" />
        <Legend color="var(--color-state-transit)" label="Interactive concept" />
        <Legend color="var(--color-state-pending)" label="Future hypothesis" />
      </div>

      <div className="mt-10 space-y-4">
        {MODULES.map((m) => (
          <section key={m.title} className="rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color: m.color, background: `color-mix(in oklab, ${m.color} 14%, transparent)` }}>
                {m.label}
              </span>
              <h2 className="text-base font-semibold">{m.title}</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {m.body}
            </p>
          </section>
        ))}
      </div>

      <blockquote className="mt-12 border-l-2 pl-4 text-lg italic leading-relaxed" style={{ borderColor: "var(--color-state-verified)", color: "var(--color-text-hi)" }}>
        Utility Connect should not only connect the home. It can become the intelligence
        layer that keeps the home, customer, partner, concierge, provider, and vendor
        relationship connected over time.
      </blockquote>
    </main>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span style={{ color: "var(--color-text-mid)" }}>{label}</span>
    </span>
  );
}

const BUILT = "var(--color-state-verified)";
const CONCEPT = "var(--color-state-transit)";
const HYPO = "var(--color-state-pending)";

const MODULES = [
  { title: "Move Relay", label: "Built", color: BUILT, body: "Multi-channel ingestion, deterministic conflict resolution, human-approved canonical record, grounded briefing, provider timeout and reconciliation, audit trail. Real code over Postgres, 41 tests. This is the foundation everything else stands on." },
  { title: "Concierge Compiler", label: "Interactive concept", color: CONCEPT, body: "Every customer conversation compiles into evidence-linked facts, each tied to a transcript utterance. The AI proposes; a human confirms; the real Move Record updates through the same approval path Move Relay already enforces. Demo uses a synthetic call replay, not live telephony." },
  { title: "Move Wallet & Offer Graph", label: "Interactive concept", color: CONCEPT, body: "One transparent place for every eligible move-in benefit. Eligibility is determined by rules and verified campaign data. AI may explain an offer; it may never invent a discount or secretly rank providers by payment. Any recurring charge uses clear consent and easy cancellation." },
  { title: "Network Launchpad", label: "Interactive concept", color: CONCEPT, body: "Enterprise partner onboarding: sample data → AI-assisted mapping → deterministic validation → contract tests → synthetic referrals → human approval → launch → drift monitoring. Credible at LeadingRE scale (~550 firms, ~135k associates). AI suggests; it never activates without a human." },
  { title: "Scenario Compiler", label: "Interactive concept", color: CONCEPT, body: "Describe a scenario in plain language; the system generates synthetic referrals, injects failures, runs permission tests, and produces a pass/fail replay. The scenario.test.ts suite is a working seed of exactly this." },
  { title: "Home Continuum", label: "Future hypothesis", color: HYPO, body: "A permissioned home profile that keeps Utility Connect useful after move-in: activation checks, plan reviews, renewals, life events. The retention engine that turns a one-time acquisition into a lifetime relationship — the direct answer to competitors' lifetime-concierge positioning." },
  { title: "Provider Reliability Graph", label: "Future hypothesis", color: HYPO, body: "Learn operationally from every handoff — latency, timeout rate, unknown-outcome rate, reconciliation success. No LLM decides which provider is best; the graph uses real operational outcomes. The prototype already emits the raw material." },
  { title: "Service Continuity Graph", label: "Future hypothesis", color: HYPO, body: "Authorized home-service needs flowing into a verified vendor workflow. Move Relay and VendorHub stay separate products sharing primitives — provenance, consent, attribution, workflow state, human approval, audit. Portfolio thinking without assuming a private roadmap." },
];
