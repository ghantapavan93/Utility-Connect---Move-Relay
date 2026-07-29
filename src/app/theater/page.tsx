"use client";

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, Pill, accentColor } from "@/components/cinematic";
import { RouteDistinction } from "@/components/nav/RouteDistinction";
import { RiskRail } from "@/components/theater/RiskRail";
import { HandoffPreview, type HandoffState } from "@/components/theater/HandoffPreview";
import { SignatureIncident } from "@/components/theater/SignatureIncident";
import { AttackStage } from "@/components/theater/AttackStage";
import { AttackBuilder } from "@/components/theater/AttackBuilder";
import type { Accent } from "@/lib/accents";
import type { TheaterResult } from "@/lib/theater-contract";
import { AnimatedGradientBackground } from "@/components/ui/animated-gradient-background";
import { tally, completedCount, verdictAccent, type Slot } from "@/lib/theater-verdict";
import { postTheater } from "@/lib/theater-request";

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
  const signatureRef = useRef<HTMLDivElement>(null);

  /**
   * Run one attack and record what actually came back.
   *
   * Classification lives in `postTheater`, which puts a real deadline on the
   * request and names every failure. The version this replaced wrote
   * `{ error: "network error" }` for anything that threw, so a timeout, an
   * abort and a malformed body arrived as the same string and the page had no
   * way to say which.
   */
  const run = useCallback(async (key: string) => {
    setResults((r) => ({ ...r, [key]: "running" }));
    const res = await postTheater<TheaterResult>(`/api/v1/theater/${key}`);
    setResults((r) => ({
      ...r,
      [key]: res.ok ? res.data : { error: res.failure.error, reason: res.failure.reason },
    }));
  }, []);

  /**
   * Run every attack, in order.
   *
   * Six identical cards that each need their own click is a page most reviewers
   * sample one of and leave. The claim being made here is about all six holding
   * together, so the page should be able to make that claim without asking
   * anyone to click six times first. Any individual attack stops the sweep and
   * hands control back.
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

  /** A single attack stops the sweep and hands control back to the reviewer. */
  const runOne = useCallback(
    (key: string) => {
      stopRef.current = true;
      setAttacking(false);
      void run(key);
    },
    [run],
  );

  const slots = SCENARIOS.map((s) => results[s.key]);
  const counts = tally(slots);
  const refused = counts.held;
  const breached = counts.violated;
  const unresolved = counts.inconclusive;
  const ran = completedCount(slots);

  // What the whole page is currently wearing. Derived in `theater-verdict` so
  // the branch that reports a breach can be tested without breaching anything.
  const washAccent: Accent = verdictAccent(slots);

  /*
    The state of the handoff drawn inside the primary button.

    It closes only when every scenario has run and every one held. Resolving on
    `refused > 0` would let a single passing attack redraw the line as whole,
    which is the shape of claim this page exists to refuse — a partial result
    presented as a settled one.
  */
  const handoffState: HandoffState = breached > 0
    ? "breached"
    : attacking
      ? "running"
      : refused === SCENARIOS.length
        ? "held"
        : "idle";
  // Inconclusive never closes the line: it is the absence of a result, and the
  // strip may only join on a proven one.

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      {/*
        The wash carries the verdict. Amber while the invariants are untested,
        green once every attack has been refused, red the moment one is not.
      */}
      <AnimatedGradientBackground accent={washAccent} active={attacking} />
      <FilmGrain id="theater" />

      {/*
        Content gets its own stacking context above the wash. A fixed,
        positioned element paints above non-positioned block content whatever
        the source order.
      */}
      <div className="relative" style={{ zIndex: 1 }}>

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
            <Pill accent="verified">Live backend</Pill>
            <Pill accent="conflict">Isolated synthetic tenant</Pill>
            <Pill accent="recovered">Not scripted</Pill>
          </>
        }
        /*
          The emphasis is on the clause, not a word. "Must not guess" is the
          whole claim: a system that guesses when the reply is lost is the one
          that creates the second order. Colouring single words would make the
          line decorative; colouring the clause makes it legible as a state.
        */
        headline={
          <>
            When the reply disappears,
            <br />
            <span style={{ color: accentColor("conflict", 1) }}>the system must not guess.</span>
          </>
        }
        sub="Anyone can demonstrate a successful order. This page shows what Move Relay believes, refuses, and proves when the handoff breaks."
        actions={
          <>
            {/*
              The primary action is the one that actually runs here. The button
              carries the failure it is about to cause: a committed signal that
              breaks short of the far side and stays broken until something
              proves it can close.
            */}
            <button
              onClick={() => signatureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="inline-flex min-h-11 flex-col items-start justify-center gap-1.5 rounded-2xl px-6 py-3 text-sm font-bold uppercase tracking-wide text-[#1a1207] transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("conflict", 1) }}
            >
              <span className="inline-flex items-center gap-2">
                Break the signature handoff <ArrowDown className="h-4 w-4" />
              </span>
              <HandoffPreview state={handoffState} />
            </button>
            <button
              onClick={() => {
                gridRef.current?.scrollIntoView({ behavior: "smooth" });
                void attackAll();
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-7 text-sm font-bold uppercase tracking-wide text-white/90"
              style={{ borderColor: "rgba(255,255,255,0.26)" }}
            >
              Launch all six attacks <ArrowRight className="h-4 w-4" />
            </button>
          </>
        }
      />

      {/*
        Three doors onto one room, named.

        Sits under the hero rather than over it: a reviewer should meet
        the page's own claim first, then learn that two neighbouring
        routes tell the same story a different way.
      */}
      <RouteDistinction />

      <RiskRail />

      <div ref={signatureRef}>
        <SignatureIncident />
      </div>

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
            {/*
              Counted separately and never folded into either column. An
              inconclusive run is not a refusal and not a breach, and a
              scoreboard that hid it would be reporting five-of-six as though
              the sixth had passed.
            */}
            {unresolved > 0 && (
              <span
                className="text-sm font-bold uppercase tracking-[0.18em]"
                style={{ color: accentColor("unknown", 1) }}
              >
                {unresolved} inconclusive
              </span>
            )}
          </div>

          <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            {breached > 0
              ? "An invariant did not hold. That result is shown exactly as returned — this page does not get to hide the one outcome worth seeing."
              : unresolved > 0
                ? "One or more attacks returned no usable result. That is shown as inconclusive rather than counted either way — an unknown outcome is exactly what this system refuses to guess about."
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
              className="inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px"
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

      {/*
        One stage, six instruments — see `AttackStage`. The grid of six cards
        this replaced expanded each result into its own permanently open wall of
        JSON, so the least readable thing on the page was also the loudest, and
        what any of it would have cost a customer appeared nowhere.
      */}
      <div ref={gridRef}>
        <AttackStage scenarios={SCENARIOS} results={results} onRun={runOne} busy={attacking} />
      </div>

      {/*
        The builder sits after the six. A reviewer who has watched the fixed
        demonstrations is in a position to choose a fault themselves; offered
        first, it would be a control panel for a system they had no reason yet
        to be curious about.
      */}
      <ChapterMarker n="02" label="Choose the fault yourself" />
      <AttackBuilder />

      <ChapterMarker n="03" label="Why this is not a prop" />
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
      </div>
    </main>
  );
}
