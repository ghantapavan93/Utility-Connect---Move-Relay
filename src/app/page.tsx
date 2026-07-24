import Link from "next/link";
import { Constellation } from "@/components/Constellation";

/**
 * Screen 1 — Cinematic public entry.
 *
 * Explains Utility Connect and Move Relay in seconds, states the thesis, and
 * routes to the working demo. No marketing filler; every claim on this page is
 * either demonstrable in the demo or labelled as vision.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-4 flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-md font-bold"
          style={{ background: "var(--color-state-verified)", color: "white" }}
        >
          ✓
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Move Relay</div>
          <div className="text-xs" style={{ color: "var(--color-text-lo)" }}>
            for Utility Connect
          </div>
        </div>
      </header>

      <section className="mb-12">
        <h1 className="max-w-3xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          One move. Every handoff verified.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          A single move arrives through a partner API, a CSV, and the customer&rsquo;s own form —
          and no two agree. Move Relay turns those contradictions into one
          provenance-aware record that is <em>visible, attributable, reversible,</em> and{" "}
          <em>verifiable</em>. AI accelerates the people operating it. AI never becomes the
          source of truth.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-px"
            style={{ background: "var(--color-state-verified)", color: "white" }}
          >
            Run the demo
          </Link>
          <Link
            href="/architecture"
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}
          >
            See the architecture
          </Link>
          <Link
            href="/future"
            className="rounded-lg border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}
          >
            Explore the future vision
          </Link>
        </div>
      </section>

      <section className="mb-14 grid place-items-center rounded-2xl border p-8" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
        <Constellation
          converged
          sources={[
            { id: "1", label: "Partner API", channel: "partner_api", state: "verified" },
            { id: "2", label: "CSV", channel: "csv_upload", state: "conflict" },
            { id: "3", label: "Customer form", channel: "customer_form", state: "verified" },
          ]}
        />
        <p className="mt-4 text-center text-sm" style={{ color: "var(--color-text-lo)" }}>
          Three sources. One verified move. Line colour is the state, not decoration.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            k: "Built and functioning",
            v: "Ingestion, conflict resolution, human-approved canonical record, grounded briefing, provider timeout and reconciliation, audit trail — all real code over Postgres, 41 tests.",
            c: "var(--color-state-verified)",
          },
          {
            k: "The failure is the product",
            v: "A provider creates the order, then the response is lost. The system enters UNKNOWN, blocks a blind retry, and reconciles the existing order. One order, never two.",
            c: "var(--color-state-conflict)",
          },
          {
            k: "Honest about its edges",
            v: "Provider integrations are simulated. Every screen is labelled Built, Concept, or Hypothesis. Facts, inferences, and hypotheses stay visibly separate.",
            c: "var(--color-state-transit)",
          },
        ].map((card) => (
          <div key={card.k} className="rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
            <div className="mb-2 h-1 w-10 rounded-full" style={{ background: card.c }} />
            <h3 className="mb-1.5 text-sm font-semibold">{card.k}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {card.v}
            </p>
          </div>
        ))}
      </section>

      <footer className="mt-16 border-t pt-6 text-xs" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
        A hypothesis-driven, additive product layer based on public workflows. Not a claim
        that Utility Connect currently lacks any capability shown here. All demo data is synthetic.
      </footer>
    </main>
  );
}
