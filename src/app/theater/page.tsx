"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

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
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Failure Theater</h1>
      <p className="mt-2 max-w-2xl text-lg" style={{ color: "var(--color-text-mid)" }}>
        Most demos show a happy path. These buttons push the real backend where it is
        supposed to hurt — and return the database rows that prove each invariant held.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {SCENARIOS.map((s) => {
          const result = results[s.key];
          const done = result && result !== "running" && !("error" in result);
          return (
            <div key={s.key} className="rounded-2xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span aria-hidden className="text-lg" style={{ color: "var(--color-state-conflict)" }}>{s.glyph}</span>
                    <h2 className="text-sm font-semibold">{s.title}</h2>
                  </div>
                  <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>{s.blurb}</p>
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

      <p className="mt-8 text-xs" style={{ color: "var(--color-text-lo)" }}>
        Every scenario runs in an isolated theater tenant against the live database. The
        same functions execute in the automated test suite — the buttons are not props.
      </p>
    </main>
  );
}
