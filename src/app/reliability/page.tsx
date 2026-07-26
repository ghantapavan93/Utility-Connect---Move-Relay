"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRef } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";

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
  const tableRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/v1/slo")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="rel" />

      {/*
        Almost every "reliability" page in software is a static list of numbers
        someone typed once. This one computes each objective from rows at
        request time, which means it can be *wrong in public* — and that is
        precisely the claim worth making. The headline says so, and the sweep
        button lets a reviewer drain the UNKNOWN queue and watch the figures
        move rather than take them on faith.
      */}
      <CineHero
        image="/renders/spine.png"
        alt="The full length of the residence, seen from the utility threshold"
        accent="recovered"
        pills={
          <>
            <Pill accent="recovered">Computed at request time</Pill>
            <Pill accent="unknown">Free to fail in public</Pill>
          </>
        }
        headline={
          <>
            Numbers you can
            <br />
            <span className="cine-shimmer">watch move.</span>
          </>
        }
        sub="Every objective on this page is calculated from database rows the moment you load it — definition, live actual, the mechanism that enforces it, and what happens when it breaches. Run a failure in another tab and refresh here; if something is broken, this page will say so."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "recovered",
            body: "State the guarantees in a form that can be checked, rather than a form that can only be believed.",
          },
          {
            eyebrow: "Proof",
            accent: "unknown",
            body: "Nothing here is hardcoded. Trigger a theater scenario in another tab, come back, and the actuals will have changed — including downward.",
          },
          {
            eyebrow: "Code",
            accent: "verified",
            body: "/api/v1/slo reads the live tables. The sweep button runs the scheduled reconciliation worker on demand and recomputes every objective from scratch.",
          },
        ]}
        actions={
          <>
            <button
              onClick={() => tableRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("verified", 1) }}
            >
              Read the objectives <ArrowDown className="h-4 w-4" />
            </button>
            <MagneticLink
              href="/theater"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.26)" } }}
            >
              Go break something first <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </>
        }
      />

      <ChapterMarker n="01" label="The objectives" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          A guarantee nobody can check is{" "}
          <span style={{ color: accentColor("recovered", 1) }}>a slogan</span>.
        </h2>
      </div>

      <div ref={tableRef} className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Reliability</h1>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              // The scheduled worker, as a button: drain every UNKNOWN through
              // provider lookup, then recompute the objectives from rows.
              await fetch("/api/v1/ops/sweep", { method: "POST" });
              load();
            }}
            className="rounded-full px-4 py-1.5 text-xs font-semibold"
            style={{ background: "var(--color-state-recovered)", color: "#0b1a12" }}
          >
            ⟳ run reconciliation sweep
          </button>
          <button
            onClick={load}
            className="rounded-full border px-4 py-1.5 text-xs font-semibold"
            style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
          >
            {loading ? "computing…" : "↻ recompute from rows"}
          </button>
        </div>
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
      </div>
    </main>
  );
}
