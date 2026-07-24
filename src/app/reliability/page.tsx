"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/**
 * The reliability page — /api/v1/slo rendered live.
 *
 * Every objective shows its definition, its live actual (computed from rows at
 * request time), the mechanism that enforces it, and the defined breach
 * response. The page re-fetches on demand so a reviewer can run a theater
 * scenario in one tab and watch the numbers move here.
 */

interface Objective {
  id: string;
  objective: string;
  actual: string;
  met: boolean;
  enforcement: string;
  breachResponse: string;
}

export default function ReliabilityPage() {
  const [data, setData] = useState<{ label: string; computedAt: string; allMet: boolean; objectives: Objective[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/v1/slo")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Reliability</h1>
        <button
          onClick={load}
          className="rounded-full border px-4 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
        >
          {loading ? "computing…" : "↻ recompute from rows"}
        </button>
      </div>
      <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--color-text-lo)" }}>
        {data?.label ?? "Prototype SLOs — project targets computed live from the database."}
      </p>

      {data && (
        <>
          <div
            className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: data.allMet
                ? "color-mix(in oklab, var(--color-state-recovered) 14%, transparent)"
                : "color-mix(in oklab, var(--color-state-failed) 14%, transparent)",
              color: data.allMet ? "var(--color-state-recovered)" : "var(--color-state-failed)",
            }}
          >
            {data.allMet ? "✓ all objectives met" : "✕ objective breached"}
            <span className="text-xs font-normal" style={{ color: "var(--color-text-lo)" }}>
              as of {new Date(data.computedAt).toLocaleTimeString()}
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {data.objectives.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border p-5"
                style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold">{o.objective}</h2>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    style={{
                      color: o.met ? "var(--color-state-recovered)" : "var(--color-state-failed)",
                      background: o.met
                        ? "color-mix(in oklab, var(--color-state-recovered) 12%, transparent)"
                        : "color-mix(in oklab, var(--color-state-failed) 12%, transparent)",
                    }}
                  >
                    {o.met ? "met" : "breached"}
                  </span>
                </div>
                <div className="mt-2 font-mono text-sm" style={{ color: "var(--color-state-verified)" }}>
                  {o.actual}
                </div>
                <div className="mt-2 grid gap-1 text-xs" style={{ color: "var(--color-text-lo)" }}>
                  <span>enforced by: {o.enforcement}</span>
                  <span>on breach: {o.breachResponse}</span>
                </div>
              </motion.div>
            ))}
          </div>

          <p className="mt-8 text-xs" style={{ color: "var(--color-text-lo)" }}>
            Tip: run a scenario in the <Link href="/theater" className="underline">Failure Theater</Link>,
            then recompute — the numbers here come from the same database rows.
          </p>
        </>
      )}
    </main>
  );
}
