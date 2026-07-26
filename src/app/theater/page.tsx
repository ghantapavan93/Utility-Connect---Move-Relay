"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";
import type { Accent } from "@/lib/accents";
import type { TheaterResult } from "@/lib/theater-contract";
import { held, violated, completedCount, type Slot } from "@/lib/theater-verdict";

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


export default function TheaterPage() {
  const [results, setResults] = useState<Record<string, Slot>>({});
  const [attacking, setAttacking] = useState(false);
  const stopRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const run = useCallback(async (key: string) => {
    setResults((r) => ({ ...r, [key]: "running" }));
    try {
      const res = await fetch(`/api/v1/theater/${key}`, { method: "POST" });
      const json = await res.json();
      setResults((r) => ({ ...r, [key]: json.ok ? json : { error: json.error } }));
    } catch {
      setResults((r) => ({ ...r, [key]: { error: "network error" } }));
    }
  }, []);

  /**
   * Run every attack, in order.
   *
   * Six identical cards that each need their own click is a page most reviewers
   * sample one of and leave. The claim being made here is about all six holding
   * together, so the page should be able to make that claim without asking
   * anyone to click six times first. Any individual "Break it" stops the sweep
   * and hands control back.
   */
  const attackAll = useCallback(async () => {
    setAttacking(true);
    stopRef.current = false;
    setResults({});
    for (const s of SCENARIOS) {
      if (stopRef.current) break;
      await run(s.key);
      await new Promise((r) => setTimeout(r, 700));
    }
    setAttacking(false);
  }, [run]);

  const refused = SCENARIOS.filter((s) => held(results[s.key])).length;
  const breached = SCENARIOS.filter((s) => violated(results[s.key])).length;
  const ran = completedCount(SCENARIOS.map((s) => results[s.key]));

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
        image="/renders/interior-wide.webp"
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

      {/*
        The scoreboard.

        Six identical cards described six invariants in 12px text and reported
        nothing at all until each was clicked, which meant the page's actual
        claim — that all six hold, right now, against a live database — was
        never stated anywhere a reviewer would see it. It is stated here, at the
        size of the claim, and it counts real outcomes: a scenario returning
        `VIOLATION` lands in the breach column and turns the whole band red.
        A scoreboard that could only go up would not be evidence of anything.
      */}
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <div
          className="rounded-2xl border px-6 py-7 sm:px-9 sm:py-8"
          style={{
            borderColor: accentColor(breached ? "failed" : ran ? "recovered" : "conflict", 0.45),
            background: `linear-gradient(120deg, ${accentColor(
              breached ? "failed" : ran ? "recovered" : "conflict",
              0.16,
            )}, rgba(255,255,255,0.015) 60%)`,
          }}
        >
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              Attacks refused
            </span>
            {attacking && (
              <motion.span
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="text-[10px] font-bold uppercase tracking-[0.22em]"
                style={{ color: accentColor("conflict", 1) }}
              >
                ● attacking
              </motion.span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
            <span
              className="font-semibold leading-[0.95] tracking-tight"
              style={{
                fontSize: "clamp(44px,8vw,96px)",
                color: accentColor(breached ? "failed" : "recovered", 1),
              }}
            >
              {refused}
            </span>
            <span
              className="font-semibold leading-none tracking-tight text-white/35"
              style={{ fontSize: "clamp(22px,3.4vw,40px)" }}
            >
              / {SCENARIOS.length}
            </span>
            {breached > 0 && (
              <span
                className="text-sm font-bold uppercase tracking-[0.18em]"
                style={{ color: accentColor("failed", 1) }}
              >
                {breached} invariant{breached === 1 ? "" : "s"} breached
              </span>
            )}
          </div>

          <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            {breached > 0
              ? "An invariant did not hold. That result is shown exactly as returned — this page does not get to hide the one outcome worth seeing."
              : ran === SCENARIOS.length
                ? "Six attacks, six refusals, and the database rows that prove each one. Nothing here was scripted; press any card again and it runs again."
                : ran > 0
                  ? "Each refusal below is a real run against the live database, returning its evidence rows rather than a message saying it worked."
                  : "Nothing has been attacked yet. Run all six and watch what the system declines to do."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (attacking) {
                  stopRef.current = true;
                  setAttacking(false);
                } else {
                  void attackAll();
                }
              }}
              className="rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px"
              style={
                attacking
                  ? {
                      background: "transparent",
                      border: `1px solid ${accentColor("conflict", 0.6)}`,
                      color: accentColor("conflict", 1),
                    }
                  : { background: accentColor("conflict", 1), color: "#1a1207" }
              }
            >
              {attacking ? "■ Stop — take over" : "▶ Run all six attacks"}
            </button>
            <span className="font-mono text-[11px] text-white/40">
              isolated theater tenant · live database · not a scripted animation
            </span>
          </div>
        </div>
      </div>

      <div ref={gridRef} className="mx-auto grid max-w-[1400px] gap-4 px-5 pb-20 sm:px-8 md:grid-cols-2">
        {SCENARIOS.map((s) => {
          const result = results[s.key];
          const done = result && result !== "running" && !("error" in result);
          const ok = held(result);
          const bad = violated(result);
          const running = result === "running";

          // Four states, four weights. Every card used to look identical
          // whether it had held an invariant, breached one, or never run —
          // which meant the outcome, the only thing on this page that carries
          // information, was invisible until you read the small print.
          // Red only for a genuine break. Amber is for things needing a
          // person; a breached invariant needs a fix.
          const edge: Accent = bad ? "failed" : "recovered";
          return (
            <div
              key={s.key}
              className="cine-glass rounded-2xl p-5 transition-all"
              style={{
                borderColor: done ? accentColor(edge, 0.5) : undefined,
                boxShadow: running ? `0 0 0 3px ${accentColor("conflict", 0.16)}` : undefined,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      aria-hidden
                      className="text-lg"
                      style={{ color: accentColor(done ? edge : "conflict", 1) }}
                    >
                      {done ? (ok ? "✓" : "✕") : s.glyph}
                    </span>
                    <h3 className="text-sm font-semibold text-white/90">{s.title}</h3>
                  </div>
                  <p className="text-xs leading-relaxed text-white/55">{s.blurb}</p>
                </div>
                <button
                  onClick={() => {
                    stopRef.current = true;
                    setAttacking(false);
                    void run(s.key);
                  }}
                  disabled={running}
                  className="shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-transform hover:-translate-y-px disabled:opacity-50"
                  style={{ background: "var(--color-state-conflict)", color: "#1a1207" }}
                >
                  {running ? "breaking…" : done ? "Break it again" : "Break it"}
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
                    {/*
                      The invariant leads now. It used to sit below the outcome
                      in small italics, which inverted the hierarchy: the rule
                      the system is defending is the interesting sentence, and
                      the outcome is its confirmation.
                    */}
                    <div
                      className="mt-4 rounded-lg border p-3"
                      style={{
                        borderColor: accentColor(edge, 0.8),
                        background: accentColor(edge, 0.08),
                      }}
                    >
                      <div
                        className="text-[13px] font-semibold leading-snug"
                        style={{ color: accentColor(edge, 1) }}
                      >
                        {(result as TheaterResult).invariant}
                      </div>
                      <div className="mt-1.5 text-xs" style={{ color: "var(--color-text-mid)" }}>
                        <span style={{ color: accentColor(edge, 1) }}>{ok ? "✓" : "✕"}</span>{" "}
                        {(result as TheaterResult).outcome}
                      </div>
                      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                        Evidence, as returned
                      </div>
                      <pre className="mt-1 overflow-x-auto rounded p-2 font-mono text-[11px] leading-relaxed" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
                        {JSON.stringify((result as TheaterResult).evidence, null, 2)}
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
