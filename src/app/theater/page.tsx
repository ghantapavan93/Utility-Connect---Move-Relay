"use client";

import { useState } from "react";
import Link from "next/link";
import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";

/**
 * The Failure Theater — "go ahead, try to break it."
 *
 * Each card triggers a real synthetic failure against the live backend and
 * shows the returned evidence rows. Nothing is scripted: the same functions run
 * in the test suite, so the buttons a reviewer clicks execute code with proven
 * behaviour.
 */

const SCENARIOS = [
  { key: "duplicate_csv", title: "Upload the same CSV twice", blurb: "A partner re-uploads a batch. The duplicate must collapse, not double.", glyph: "⧉" },
  { key: "webhook_twice", title: "Deliver a webhook twice", blurb: "At-least-once delivery meets exactly-once handling.", glyph: "⇉" },
  { key: "worker_crash", title: "Crash the worker mid-workflow", blurb: "Restart and resume — completed steps must never re-run.", glyph: "✕" },
  { key: "cross_tenant", title: "Read another tenant's referral", blurb: "No relationship path, no access. Deny is the default.", glyph: "⛒" },
  { key: "stale_write", title: "Two concierges, one record", blurb: "The stale write must surface as a conflict, never silently win.", glyph: "⚡" },
  { key: "schema_drift", title: "Drift a partner's schema", blurb: "A renamed field quarantines with reasons — never force-fed.", glyph: "≠" },
];

interface Result {
  scenario: string;
  invariant: string;
  outcome: string;
  evidence: Record<string, unknown>;
}

export default function TheaterPage() {
  const [results, setResults] = useState<Record<string, Result | "running" | { error: string }>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  const run = async (key: string) => {
    setResults((r) => ({ ...r, [key]: "running" }));
    try {
      const res = await fetch(`/api/v1/theater/${key}`, { method: "POST" });
      const json = await res.json();
      setResults((r) => ({ ...r, [key]: json.ok ? json : { error: json.error } }));
    } catch {
      setResults((r) => ({ ...r, [key]: { error: "network error" } }));
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="theater" />

      {/*
        A demo asks you to watch it succeed. This one hands you the controls and
        asks you to make it fail — which is a far stronger claim, and the only
        one worth making about reliability. The headline says exactly that,
        because the refusals *are* the product.
      */}
      <CineHero
        image="/renders/interior-wide.png"
        alt="The residence interior, seen down its full length"
        accent="conflict"
        pills={
          <>
            <Pill accent="conflict">Failure theater</Pill>
            <Pill accent="verified">Runs against the live database</Pill>
          </>
        }
        headline={
          <>
            Anyone can demo
            <br />
            <span className="cine-shimmer">the happy path.</span>
          </>
        }
        sub="Six buttons that push the real backend where it is supposed to hurt — a duplicate batch, a webhook delivered twice, a worker killed mid-workflow, a partner reaching across a boundary. Each one returns the database rows that prove the invariant held."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "conflict",
            body: "Let a reviewer attack the system directly instead of taking a claim about it on trust.",
          },
            {
            eyebrow: "Proof",
            accent: "recovered",
            body: "Every scenario runs in an isolated theater tenant against the live database, and returns the evidence rows — not a message saying it worked.",
          },
          {
            eyebrow: "Code",
            accent: "verified",
            body: "The same functions execute in the automated suite. These buttons are not props; they are the tests, with a UI on them.",
          },
        ]}
        actions={
          <>
            <button
              onClick={() => gridRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-[#1a1207] transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("conflict", 1) }}
            >
              Try to break it <ArrowDown className="h-4 w-4" />
            </button>
            <MagneticLink
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.26)" } }}
            >
              Back to the demo <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </>
        }
      />

      <ChapterMarker n="01" label="Six ways to break it" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          A system is only as trustworthy as{" "}
          <span style={{ color: accentColor("conflict", 1) }}>the things it refuses to do</span>.
        </h2>
      </div>

      <div ref={gridRef} className="mx-auto grid max-w-[1400px] gap-4 px-5 pb-20 sm:px-8 md:grid-cols-2">
        {SCENARIOS.map((s) => {
          const result = results[s.key];
          const done = result && result !== "running" && !("error" in result);
          return (
            <div key={s.key} className="cine-glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span aria-hidden className="text-lg" style={{ color: "var(--color-state-conflict)" }}>{s.glyph}</span>
                    <h3 className="text-sm font-semibold text-white/90">{s.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-white/55">{s.blurb}</p>
                </div>
                <button
                  onClick={() => run(s.key)}
                  disabled={result === "running"}
                  className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-px disabled:opacity-50"
                  style={{ background: "var(--color-state-conflict)", color: "#1a1207" }}
                >
                  {result === "running" ? "breaking…" : "Break it"}
                </button>
              </div>

              <AnimatePresence>
                {done && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 rounded-lg border p-3" style={{ borderColor: "var(--color-state-recovered)", background: "color-mix(in oklab, var(--color-state-recovered) 8%, transparent)" }}>
                      <div className="mb-1 text-xs font-semibold" style={{ color: "var(--color-state-recovered)" }}>
                        ✓ {(result as Result).outcome}
                      </div>
                      <div className="mb-2 text-xs italic" style={{ color: "var(--color-text-mid)" }}>
                        Invariant: {(result as Result).invariant}
                      </div>
                      <pre className="overflow-x-auto rounded p-2 font-mono text-[11px] leading-relaxed" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
                        {JSON.stringify((result as Result).evidence, null, 2)}
                      </pre>
                    </div>
                  </motion.div>
                )}
                {result && typeof result === "object" && "error" in result && (
                  <div className="mt-3 text-xs" style={{ color: "var(--color-state-failed)" }}>
                    {result.error}
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      <ChapterMarker n="02" label="Why this is not a prop" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <blockquote
          className="max-w-3xl border-l-2 pl-6 text-[clamp(18px,2.3vw,28px)] font-medium leading-[1.35] tracking-tight text-white/90"
          style={{ borderColor: accentColor("conflict", 1) }}
        >
          Every scenario runs in an isolated theater tenant against the live database, and the same
          functions execute in the automated suite. The buttons are{" "}
          <span style={{ color: accentColor("conflict", 1) }}>the tests, with a UI on them</span>.
        </blockquote>
      </section>
    </main>
  );
}
