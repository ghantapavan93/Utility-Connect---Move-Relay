import Link from "next/link";
import { Constellation3D } from "@/components/Constellation3D";
import { Reveal } from "@/components/Reveal";
import { SiteNav } from "@/components/SiteNav";

/**
 * Screen 1 — the premium public entry.
 *
 * Built to Utility Connect's own visual DNA: bold uppercase headlines, a single
 * cyan accent word, pill buttons, a deep navy ground. The hero is the 3D Handoff
 * Constellation — their orbiting-particle logo made functional. Every claim on
 * the page is demonstrable in the live demo or explicitly labelled as vision.
 */
export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        {/* Hero */}
        <section className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-6 pt-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(60% 50% at 70% 30%, color-mix(in oklab, var(--color-state-verified) 12%, transparent), transparent)",
            }}
          />
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <Reveal>
                <span
                  className="inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest"
                  style={{ borderColor: "var(--color-ground-3)", color: "var(--color-state-verified)" }}
                >
                  Verified handoff infrastructure
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-5 text-5xl font-bold uppercase leading-[1.02] tracking-tight sm:text-6xl">
                  One move.
                  <br />
                  Every handoff{" "}
                  <span style={{ color: "var(--color-state-verified)" }}>verified.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                  One move arrives through a partner API, a CSV, and the customer&rsquo;s own
                  form — and no two agree. Move Relay turns those contradictions into a
                  single provenance-aware record: visible, attributable, reversible,
                  verifiable. AI accelerates the people. It never becomes the source of truth.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/demo"
                    className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--color-state-verified)", color: "white" }}
                  >
                    Run the live demo
                  </Link>
                  <Link
                    href="/architecture"
                    className="rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors hover:border-white"
                    style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}
                  >
                    See the architecture
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.2}>
              <Constellation3D
                converged
                height={440}
                sources={[
                  { id: "1", label: "Partner API", state: "verified" },
                  { id: "2", label: "CSV", state: "conflict" },
                  { id: "3", label: "Customer form", state: "verified" },
                  { id: "4", label: "Microsite", state: "transit" },
                  { id: "5", label: "Concierge", state: "pending" },
                ]}
              />
            </Reveal>
          </div>
        </section>

        {/* Stat band */}
        <section className="border-y" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
            {[
              { n: "51", l: "tests passing" },
              { n: "11", l: "DB guarantees proven" },
              { n: "0", l: "duplicate orders created" },
              { n: "3", l: "audiences, safely projected" },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 0.05}>
                <div>
                  <div className="text-4xl font-bold" style={{ color: "var(--color-state-verified)" }}>
                    {s.n}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--color-text-lo)" }}>
                    {s.l}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The story spine */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <h2 className="text-3xl font-bold uppercase tracking-tight sm:text-4xl">
              The failure is the <span style={{ color: "var(--color-state-conflict)" }}>product.</span>
            </h2>
            <p className="mt-3 max-w-2xl text-lg" style={{ color: "var(--color-text-mid)" }}>
              Their own Terms of Service say the customer contracts directly with the
              provider. So a lost response doesn&rsquo;t mean the order failed — it means we
              don&rsquo;t know. Here is what the system does about that.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {SPINE.map((step, i) => (
              <Reveal key={step.k} delay={i * 0.06}>
                <div className="h-full rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                  <div className="mb-3 h-1 w-10 rounded-full" style={{ background: step.c }} />
                  <div className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: step.c }}>
                    {step.tag}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{step.k}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                    {step.v}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <Reveal>
            <div
              className="grid place-items-center rounded-3xl border px-6 py-16 text-center"
              style={{
                borderColor: "var(--color-ground-3)",
                background:
                  "radial-gradient(80% 120% at 50% 0%, color-mix(in oklab, var(--color-state-verified) 14%, var(--color-ground-1)), var(--color-ground-1))",
              }}
            >
              <h2 className="max-w-2xl text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                Watch one move survive a lost provider response.
              </h2>
              <p className="mt-3 max-w-xl" style={{ color: "var(--color-text-mid)" }}>
                Ten steps, real database, real state. The retry gets blocked. No duplicate.
                The existing order is recovered. Every transition is in the audit trail.
              </p>
              <Link
                href="/demo"
                className="mt-8 rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--color-state-verified)", color: "white" }}
              >
                Run the demo
              </Link>
            </div>
          </Reveal>
        </section>

        <footer className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
          <div className="mx-auto max-w-6xl px-6 py-8 text-xs" style={{ color: "var(--color-text-lo)" }}>
            A hypothesis-driven, additive product layer based on public workflows. Not a
            claim that Utility Connect currently lacks any capability shown here. All demo
            data is synthetic.
          </div>
        </footer>
      </main>
    </>
  );
}

const SPINE = [
  {
    tag: "Ingest",
    k: "Three doors, one human",
    v: "Partner API, CSV, and the customer form arrive with contradictory values. Deterministic scoring identifies the duplicate despite a mistyped phone digit.",
    c: "var(--color-state-transit)",
  },
  {
    tag: "Resolve",
    k: "A human decides. AI cannot.",
    v: "Conflicts surface field by field with provenance. The merge requires a named concierge — enforced by a database constraint, not a policy.",
    c: "var(--color-state-verified)",
  },
  {
    tag: "Recover",
    k: "Unknown, not failed",
    v: "The provider times out after creating the order. The system blocks a blind retry, reconciles against the provider, and recovers the existing order. One order, never two.",
    c: "var(--color-state-conflict)",
  },
];
