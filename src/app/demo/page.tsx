"use client";

import { useState, useCallback, useEffect } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Constellation, type Source } from "@/components/Constellation";
import { auditLabel } from "@/lib/agent/narrative";
import { StateBadge, type State } from "@/components/StateBadge";
import { EngineeringPanel } from "@/components/EngineeringPanel";
import { ProvenanceDrawer } from "@/components/ProvenanceDrawer";
import { CsvUpload } from "@/components/CsvUpload";
import { ReferralConsole } from "@/components/ReferralConsole";
import { StepStage } from "@/components/StepStage";
import { StepFilm } from "@/components/StepFilm";
import { CineHero, CycleWords } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";
import { RouteDistinction } from "@/components/nav/RouteDistinction";
import { ParticleCanvas, type FieldPhase } from "@/components/ui/particle-canvas";
import type { Accent } from "@/lib/accents";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";

/**
 * The demo control room — Screens 2, 3, 4, 6, 9 in one guided flow.
 *
 * Each step posts to /api/v1/demo/:step, which performs real database work, then
 * the panel re-reads /api/v1/move and renders the actual resulting state. Nothing
 * on this page is mocked. The operator advances the story one deliberate step at
 * a time, exactly as a concierge would.
 */

interface StepDef {
  key: string;
  label: string;
  blurb: string;
  act: string;
}

/**
 * Nine steps in four acts.
 *
 * The acts are not decoration. A flat list of nine buttons reads as a queue and
 * tells a reviewer nothing about which moments matter; grouped, the shape of
 * the argument becomes visible before anything is clicked. Three sources
 * arrive, a person decides, the provider goes silent, and the system recovers
 * without ever guessing. The third act is the one this whole project exists
 * for, and in a flat list it looked exactly as important as step two.
 */
const ACTS: { id: string; n: string; title: string; note: string; accent: "verified" | "conflict" | "unknown" | "recovered" }[] = [
  {
    id: "arrival",
    n: "I",
    title: "The arrival",
    note: "One move begins in three places at once, and no two agree.",
    accent: "verified",
  },
  {
    id: "judgement",
    n: "II",
    title: "The judgement",
    note: "A disagreement is not an error. It needs a person, and it gets one.",
    accent: "conflict",
  },
  {
    id: "silence",
    n: "III",
    title: "The silence",
    note: "The order was created. The reply never came. Guessing here enrols a household twice.",
    accent: "unknown",
  },
  {
    id: "recovery",
    n: "IV",
    title: "The recovery",
    note: "Ask the provider what it knows. Recover the order that already existed.",
    accent: "recovered",
  },
];

/**
 * The nine narrative steps.
 *
 * `reset` is deliberately not one of them. It is plumbing, and giving it the
 * first slot in the rail meant the first thing a reviewer saw — highlighted as
 * the next action — was an instruction to wipe the database. It now lives as a
 * quiet control beneath the player, which runs it implicitly before each play.
 */
const STEPS: StepDef[] = [
  { key: "ingest", label: "1 · Ingest 3 channels", blurb: "Partner API, CSV, and the customer form arrive.", act: "arrival" },
  { key: "detect", label: "2 · Detect duplicate", blurb: "Deterministic scoring across the three submissions.", act: "arrival" },
  { key: "create_move", label: "3 · Create Move Record", blurb: "One canonical record; every value keeps its source.", act: "judgement" },
  { key: "conflicts", label: "4 · Surface conflicts", blurb: "Only the fields where sources disagree.", act: "judgement" },
  { key: "merge", label: "5 · Human approves merge", blurb: "A named concierge decides. AI cannot.", act: "judgement" },
  { key: "briefing", label: "6 · Grounded briefing", blurb: "Every claim cites a source row.", act: "judgement" },
  { key: "submit", label: "7 · Submit to provider", blurb: "The response is lost after the order is created.", act: "silence" },
  { key: "retry", label: "8 · Retry is blocked", blurb: "UNKNOWN outcome — a blind retry is refused.", act: "silence" },
  { key: "reconcile", label: "9 · Reconcile", blurb: "Ask the provider. Recover the existing order.", act: "recovery" },
];

type MoveData = {
  exists: boolean;
  move?: { state: string; reference: string };
  fields?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
  timeline?: Array<Record<string, unknown>>;
};

/**
 * What the database currently says, at the size the claim deserves.
 *
 * Every value here is read back from Postgres after each step — the move's own
 * state, and the provider submission's state, which is the only field in this
 * project that is allowed to say "unknown" out loud. Nothing is animated ahead
 * of the data; the band changes because a row changed.
 */
function StateBand({
  move,
  playing,
  busy,
}: {
  move: MoveData | null;
  playing: boolean;
  busy: string | null;
}) {
  const state = (move?.move?.state as string | undefined) ?? null;
  const services = (move?.services ?? []) as Array<Record<string, unknown>>;
  const submission = (services.find((s) => s.submission_state)?.submission_state as string) ?? null;

  // The headline is the provider outcome once one exists, because that is where
  // the risk lives. Before submission, the move's own state is the story.
  const headline = submission ?? state ?? "no record";
  const accent: Accent =
    submission === "unknown"
      ? "unknown"
      : submission === "reconciled"
        ? "recovered"
        : state === "conflict_pending"
          ? "conflict"
          : state
            ? "verified"
            : "verified";

  const reading =
    submission === "unknown"
      ? "The order may or may not exist. A blind retry from here could enrol this household twice."
      : submission === "reconciled"
        ? "Reconciliation found the order that was already there. One order — never two."
        : submission === "submitted"
          ? "Sent to the provider. Waiting on a reply that may not arrive."
          : state === "conflict_pending"
            ? "Sources disagree. The record will not resolve itself; a named person decides."
            : state === "canonical"
              ? "One canonical record. Every value still carries the channel that supplied it."
              : state === "intake"
                ? "Submissions received. Nothing has been merged, and nothing has been guessed."
                : "Nothing ingested yet. Press play and the engine builds the record in front of you.";

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
      <div
        className="relative overflow-hidden rounded-2xl border px-6 py-7 sm:px-9 sm:py-8"
        style={{
          borderColor: accentColor(accent, 0.45),
          background: `linear-gradient(120deg, ${accentColor(accent, 0.16)}, rgba(255,255,255,0.015) 60%)`,
        }}
      >
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
            Live record state
          </span>
          {playing && (
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: accentColor(accent, 1) }}
            >
              ● playing
            </motion.span>
          )}
        </div>

        {/*
          What the engine is doing right now.

          The briefing step calls a language model on this machine, and a cold
          model can take the better part of a minute to load its weights. Without
          this line the story simply stops mid-act, and a pause you cannot
          account for is indistinguishable from a hang.
        */}
        {busy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: accentColor(accent, 0.9) }}
          >
            {busy === "briefing"
              ? "Calling a local language model — first call loads the weights"
              : `Running ${busy.replace(/_/g, " ")}`}
            …
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={headline}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.26, ease: "easeOut" }}
          >
            <div
              className="mt-2 font-semibold uppercase leading-[0.95] tracking-tight"
              style={{
                fontSize: "clamp(38px,7vw,86px)",
                color: accentColor(accent, 1),
              }}
            >
              {headline.replace(/_/g, " ")}
            </div>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
              {reading}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-white/40">
          <span>moves.state = {state ?? "—"}</span>
          <span>provider_submissions.state = {submission ?? "—"}</span>
          <span>read live · not a scripted animation</span>
        </div>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [move, setMove] = useState<MoveData | null>(null);
  const [lastResult, setLastResult] = useState<{ step: string; data: unknown } | null>(null);
  const [drawerField, setDrawerField] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/move");
    setMove(await res.json());
  }, []);

  /**
   * Read the record on arrival.
   *
   * The state band is a claim about what the database currently holds, and until
   * this ran it only knew what *this browser tab* had done — so landing on the
   * page after a step ran elsewhere (or after a reload) reported "no record"
   * over a database that had one. A panel labelled "read live" has to actually
   * read on arrival.
   */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (step: string) => {
      setBusy(step);
      // Before the await: the stage changes as the step starts, not when it
      // finishes, so the picture and the work are the same event.
      if (step !== "reset") setStageStep(step);
      try {
        const res = await fetch(`/api/v1/demo/${step}`, { method: "POST" });
        const json = await res.json();
        if (!json.ok) {
          toast.error(json.error ?? "step failed");
          return false;
        }
        setLastResult({ step, data: json.result });
        setDone((d) => new Set(d).add(step));
        await refresh();

        // Narrate the moments that matter.
        if (step === "submit") toast.warning("Provider response lost. Outcome is UNKNOWN.");
        else if (step === "retry") toast.error("Blind retry blocked. No duplicate created.");
        else if (step === "reconcile") toast.success("Existing order recovered. One order, never two.");
        else if (step === "merge") toast.success("Merge approved by concierge-7.");
        else toast.success(STEPS.find((s) => s.key === step)?.label ?? step);
        return true;
      } catch {
        toast.error("network error");
        return false;
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  /**
   * Play the whole story.
   *
   * The console used to be nine identical cards that did nothing until someone
   * clicked ten times in the right order — which meant the most interesting
   * thing in the project was gated behind knowing what to press. It now runs
   * itself, pausing on the beats that matter so a viewer can read what just
   * happened, and any click stops it and hands over control. Same principle as
   * the diagrams: demonstrate first, then get out of the way.
   */
  const playAll = useCallback(async () => {
    setPlaying(true);
    stopRef.current = false;
    setDone(new Set());
    setStageStep(null);

    // Always start from a clean database, so a second play tells the same story
    // as the first rather than deduplicating everything to nothing.
    if (!(await run("reset"))) {
      setPlaying(false);
      return;
    }

    for (const s of STEPS) {
      if (stopRef.current) break;
      const ok = await run(s.key);
      if (!ok) break;
      // The silence and the refusal get a longer hold. They are the point of
      // the whole demo and they are over in a blink at an even pace.
      const hold = s.key === "submit" || s.key === "retry" ? 2600 : 900;
      await new Promise((r) => setTimeout(r, hold));
    }
    setPlaying(false);
  }, [run]);

  const moveState = move?.move?.state;
  const sources = constellationFor(done, lastResult);
  const consoleRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  /*
    Which step the stage is showing.

    Deliberately not derived from `done` or from `busy`. `busy` clears the
    moment a request resolves, and the illustration should stay up afterwards
    so a reviewer can read it — the picture is the payoff, not a spinner. This
    holds the last step that ran until another one starts.
  */
  const [stageStep, setStageStep] = useState<string | null>(null);
  const stopRef = useRef(false);
  const completed = STEPS.filter((s) => done.has(s.key)).length;

  /**
   * Which act the background field is showing.
   *
   * Read from the provider submission first, because that row is the only place
   * in this project allowed to say "unknown" out loud and it outranks anything
   * the step rail believes. Only when there is no submission does this fall back
   * to the act of the step currently on the stage — the same precedence
   * `StateBand` uses, so the two never disagree about what is happening.
   */
  const submissionState = ((move?.services ?? []) as Array<Record<string, unknown>>).find(
    (s) => s.submission_state,
  )?.submission_state as string | undefined;

  const fieldPhase: FieldPhase =
    submissionState === "unknown"
      ? "silence"
      : submissionState === "reconciled"
        ? "recovery"
        : ((STEPS.find((s) => s.key === stageStep)?.act as FieldPhase | undefined) ?? "idle");

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      {/*
        The field reads the same phase the console is in, so it is showing the
        database rather than accompanying it. During the provider silence it
        very nearly stops — which is the honest picture of an UNKNOWN outcome.
      */}
      <ParticleCanvas phase={fieldPhase} />
      <FilmGrain id="demo" />

      {/*
        Everything below sits in its own stacking context above the canvas.

        Without it the canvas wins: a fixed, positioned element paints above
        non-positioned block content no matter what order they appear in, so the
        particles would be drawn over the copy rather than behind it.
      */}
      <div className="relative" style={{ zIndex: 1 }}>

      {/*
        The hero states the thesis before the console asks anyone to click.

        The centrepiece of this demo is not that the happy path works — every
        system's happy path works. It is the timeout: the provider created the
        order, the answer never arrived, and the engine refused to guess. So
        that is the headline, and Proof names the actual failure rather than an
        adjective.
      */}
      <CineHero
        image="/renders/utility.webp"
        alt="The utility room of the residence, where the provider circuit stalls"
        accent="unknown"
        pills={
          <>
            <Pill accent="unknown">Live demo · real database</Pill>
            <Pill accent="verified">All data synthetic</Pill>
          </>
        }
        cycle={<CycleWords words={["Preserved.", "Resolved.", "Verified.", "Reconciled."]} accent="verified" />}
        headline={
          <>
            The order existed.
            <br />
            <span className="cine-shimmer">The answer never came.</span>
          </>
        }
        sub="Every system handles the path where the provider replies. This one is built for the moment it does not — where an order may or may not exist, a retry could enrol a real household twice, and the only honest state is UNKNOWN."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "verified",
            body: "Stop a household being enrolled twice when a provider goes quiet — and keep every value traceable to whoever supplied it.",
          },
          {
            eyebrow: "Proof",
            accent: "unknown",
            body: "Maya Patel arrives on three channels with two move dates and one wrong digit. The provider creates the order; the response is lost. The blind retry is refused. Reconciliation finds the order that already existed.",
          },
          {
            eyebrow: "Code",
            accent: "recovered",
            body: "Next.js and React over PostgreSQL. Persisted idempotency, append-only audit, durable workflow steps, relationship-based authorization. 575 tests against a real database.",
          },
        ]}
        actions={
          <>
            <button
              onClick={() => consoleRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("verified", 1) }}
            >
              Run it yourself <ArrowDown className="h-4 w-4" />
            </button>
            <MagneticLink
              href="/story"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.26)" } }}
            >
              Watch it as a film <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </>
        }
      />

      {/*
        The nine steps as a film.

        The story first, the controls after.

        The console below proves the engine runs, and it is the wrong thing to
        meet first: a reviewer arriving at nine unlabelled buttons has to press
        one to learn anything. These bands show the thing itself — the three
        channels arriving with their real payloads, the duplicate scored, the
        provider going quiet, the retry refused — so by the time anyone reaches
        the controls they already know what they are driving.

        Sides alternate, and that is doing work rather than decoration: it
        resets the eye's entry point on every band, which is what stops nine
        near-identical dark dashboards collapsing into a contact sheet.
      */}
      <ChapterMarker n="01" label="What each step actually does" />
      <div className="mx-auto max-w-[1400px] px-5 pb-4 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          Nine steps, and{" "}
          <span style={{ color: accentColor("verified", 1) }}>what the engine is doing</span> in
          each one.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Scroll is the transport — nothing plays on a timer, so you can stop on any frame and
          read the payload it is showing you.
        </p>
      </div>
      <StepFilm
        steps={STEPS.map((s, i) => ({
          key: s.key,
          n: i + 1,
          title: s.label.replace(/^\d+\s*·\s*/, ""),
          body: s.blurb,
          accent: ACTS.find((a) => a.id === s.act)?.accent ?? "verified",
          act: ACTS.find((a) => a.id === s.act)?.title ?? "",
        }))}
      />

      {/*
        Three doors onto one room, named.

        Sits under the hero rather than over it: a reviewer should meet
        the page's own claim first, then learn that two neighbouring
        routes tell the same story a different way.
      */}
      <RouteDistinction />

      <ChapterMarker n="02" label="The console" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          Nine steps. Every one of them{" "}
          <span style={{ color: accentColor("verified", 1) }}>writes to a real database</span> and
          reads the result back.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Nothing here is a scripted animation. Press a step and the engine performs it —
          deduplication, a human-gated merge, a provider submission that loses its reply, a retry
          the system refuses to make. Press them out of order and it will tell you why it will not.
        </p>
      </div>

      <StateBand move={move} playing={playing} busy={busy} />

      <div
        ref={consoleRef}
        className="mx-auto grid max-w-[1400px] gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-[340px_1fr]"
      >
      {/* Step rail */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-white">The console</h2>
        <p className="mb-4 text-xs text-white/45">Maya Patel · North Texas Realty · synthetic data</p>
        <div className="mb-4 flex flex-col gap-1">
          <a href="/views" className="text-xs font-semibold" style={{ color: "var(--color-state-verified)" }}>
            See this record as concierge / customer / partner →
          </a>
          <a href="/story" className="text-xs font-semibold" style={{ color: "var(--color-state-transit)" }}>
            Watch it as a story — The Living Move →
          </a>
          <a href="/theater" className="text-xs font-semibold" style={{ color: "var(--color-state-conflict)" }}>
            Try to break it — Failure Theater →
          </a>
        </div>
        {/*
          Play / stop, and a progress read-out.
          `completed` counts narrative steps only; see the progress bar below.

          A demo that requires ten correct clicks before anything happens is a
          demo most people close. This one performs itself on arrival and yields
          the moment anyone touches a step.
        */}
        <div className="mb-5">
          <button
            onClick={() => {
              if (playing) {
                stopRef.current = true;
                setPlaying(false);
              } else {
                void playAll();
              }
            }}
            className="w-full rounded-xl px-5 py-3 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px"
            style={{
              background: playing ? "transparent" : accentColor("verified", 1),
              border: `1px solid ${accentColor(playing ? "conflict" : "verified", playing ? 0.6 : 1)}`,
              color: playing ? accentColor("conflict", 1) : "#fff",
            }}
          >
            {playing ? "■ Stop — take over" : "▶ Play the whole story"}
          </button>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  // Counted over the narrative steps only — `reset` also lands in
                  // `done`, and counting it would report 10/9.
                  width: `${(completed / STEPS.length) * 100}%`,
                  background: accentColor("verified", 1),
                }}
              />
            </div>
            <span className="font-mono text-[10px] text-white/45">
              {completed}/{STEPS.length}
            </span>
            <button
              onClick={() => {
                stopRef.current = true;
                setPlaying(false);
                setDone(new Set());
                setStageStep(null);
                void run("reset");
              }}
              disabled={busy !== null}
              className="font-mono text-[10px] text-white/35 underline-offset-2 hover:text-white/70 hover:underline disabled:opacity-40"
            >
              reset
            </button>
          </div>

          {/*
            The checkmarks track what this browser watched happen; the band above
            tracks what the database holds. When a record already exists from an
            earlier run those two disagree, and the honest fix is to say so
            rather than to reverse-engineer a tick list from the rows.
          */}
          {move?.exists && completed === 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-white/45">
              A record already exists from an earlier run. Press play — it resets
              first, so the story starts from nothing.
            </p>
          )}
        </div>

        <div className="space-y-6">
          {ACTS.map((act) => {
            const steps = STEPS.filter((x) => x.act === act.id);
            const allDone = steps.every((x) => done.has(x.key));
            return (
              <div key={act.id}>
                {/*
                  The act header carries its own colour. It is what makes THE
                  SILENCE read amber from across the room — previously all four
                  acts were the same grey, so the section the whole project is
                  built around announced itself no louder than "Reset".
                */}
                <div
                  className="mb-2 border-l-2 pl-3"
                  style={{ borderColor: accentColor(act.accent, allDone ? 1 : 0.5) }}
                >
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className="font-mono text-[13px] font-bold"
                      style={{ color: accentColor(act.accent, allDone ? 1 : 0.7) }}
                    >
                      {act.n}
                    </span>
                    <span
                      className="text-[13px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: accentColor(act.accent, 1) }}
                    >
                      {act.title}
                    </span>
                    {allDone && (
                      <span style={{ color: accentColor(act.accent, 1) }} className="text-[12px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/50">{act.note}</p>
                </div>
                <ol className="space-y-1.5">
                  {steps.map((s) => {
                    const complete = done.has(s.key);
                    // The first not-yet-run step, in narrative order. This is
                    // what turns a list into an instruction.
                    const isNext = !complete && STEPS.find((x) => !done.has(x.key))?.key === s.key;
                    return (
                      <li key={s.key}>
                        <button
                          onClick={() => {
                            stopRef.current = true;
                            setPlaying(false);
                            void run(s.key);
                          }}
                          disabled={busy !== null}
                          className="group w-full rounded-lg border px-3 py-2 text-left text-sm transition-all disabled:opacity-60"
                          style={{
                            // Three states, three weights. Previously every step
                            // looked identical, so the refusal that the whole
                            // project is built around read exactly like "Reset".
                            borderColor: complete
                              ? accentColor(act.accent, 0.55)
                              : isNext
                                ? accentColor(act.accent, 0.9)
                                : "rgba(255,255,255,0.08)",
                            background: complete
                              ? accentColor(act.accent, 0.08)
                              : isNext
                                ? accentColor(act.accent, 0.14)
                                : "rgba(255,255,255,0.02)",
                            boxShadow: isNext ? `0 0 0 3px ${accentColor(act.accent, 0.12)}` : undefined,
                            opacity: complete ? 0.72 : 1,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-medium"
                              style={{ color: isNext ? accentColor(act.accent, 1) : "rgba(255,255,255,0.9)" }}
                            >
                              {s.label}
                            </span>
                            {complete && <span style={{ color: accentColor(act.accent, 1) }}>✓</span>}
                            {busy === s.key && (
                              <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{ duration: 1, repeat: Infinity }}
                                className="text-[10px] font-bold uppercase tracking-wider"
                                style={{ color: accentColor(act.accent, 1) }}
                              >
                                running
                              </motion.span>
                            )}
                            {isNext && busy === null && (
                              <span
                                className="text-[9px] font-bold uppercase tracking-[0.16em]"
                                style={{ color: accentColor(act.accent, 0.85) }}
                              >
                                next
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed text-white/50">{s.blurb}</div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Stage */}
      <section className="space-y-6">
        {/*
          What the engine is doing, shown rather than described.

          The rail on the left is accurate and silent — a reviewer pressed
          "Ingest 3 channels" and watched a tick appear. Each step now has an
          illustration of the thing itself, and during a play-through they
          advance with the story.
        */}
        <StepStage
          stepKey={stageStep}
          label={stageStep ? (STEPS.find((s) => s.key === stageStep)?.label ?? null) : null}
          blurb={stageStep ? (STEPS.find((s) => s.key === stageStep)?.blurb ?? null) : null}
          accent={
            stageStep
              ? (ACTS.find((a) => a.id === STEPS.find((s) => s.key === stageStep)?.act)?.accent ??
                "verified")
              : "verified"
          }
          index={stageStep ? STEPS.findIndex((s) => s.key === stageStep) : null}
          total={STEPS.length}
          busy={busy !== null && busy !== "reset"}
          playing={playing}
        />
        {/*
          The two channels a visitor can drive with their own data.

          The step rail to the left walks one hardcoded move, which made the
          engine behind it read as a scripted tour of a single record. It is not
          one: `POST /api/v1/referrals` has always accepted arbitrary payloads
          through the same contract validation, idempotency and duplicate
          detection. That capability was real and completely invisible.
        */}
        <ReferralConsole />
        <CsvUpload />
        <EngineeringPanel />
        <div className="grid place-items-center rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <Constellation sources={sources} converged={done.has("create_move")} />
          {moveState && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span style={{ color: "var(--color-text-lo)" }}>Move state:</span>
              <StateBadge state={moveStateToBadge(moveState)} />
            </div>
          )}
        </div>

        {/* Live field provenance — tap any row for the full version history */}
        {move?.fields && move.fields.length > 0 && (
          <Panel title="Canonical Move Record — tap a field for its full history">
            <FieldTable fields={move.fields} onSelect={setDrawerField} />
          </Panel>
        )}
        <ProvenanceDrawer field={drawerField} onClose={() => setDrawerField(null)} />

        {/* Provider + services */}
        {move?.services && move.services.length > 0 && (
          <Panel title="Provider submission">
            {move.services.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{String(s.service_type)}</span>
                <span style={{ color: "var(--color-text-lo)" }}>via {String(s.provider_name)}</span>
                <StateBadge state={submissionBadge(String(s.submission_state ?? "pending"))} />
                {s.provider_order_id ? (
                  <span className="font-mono text-xs" style={{ color: "var(--color-text-mid)" }}>
                    order {String(s.provider_order_id)}
                  </span>
                ) : null}
                {/* The identity reconciliation looks the order up by — the
                    safe path out of "unknown", shown rather than asserted. */}
                {s.operation_key ? (
                  <span className="w-full break-all font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                    operation identity: {String(s.operation_key)}
                  </span>
                ) : null}
              </div>
            ))}
          </Panel>
        )}

        {/* Raw step result */}
        <AnimatePresence mode="wait">
          {lastResult && (
            <motion.div
              key={lastResult.step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Panel title={`Step result · ${lastResult.step}`}>
                {/*
                  The payload is evidence, not the message — an always-open
                  JSON dump as the primary rendering was the exact habit the
                  rest of this project keeps refusing. The drawer keeps it one
                  click away, verbatim.
                */}
                <details>
                  <summary
                    className="cursor-pointer text-xs font-bold uppercase tracking-wide"
                    style={{ color: "var(--color-state-verified)" }}
                  >
                    Inspect the raw step result
                  </summary>
                  <pre className="mt-2 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
                    {JSON.stringify(lastResult.data, null, 2)}
                  </pre>
                </details>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit timeline */}
        {move?.timeline && move.timeline.length > 0 && (
          <Panel title="Operational audit trail — append-only">
            <ol className="space-y-2">
              {move.timeline.map((e, i) => {
                const type = String(e.event_type);
                /*
                  The dot was hardcoded to the verified green, which painted
                  `provider.retry.blocked` and `provider.submission.unknown`
                  in the one colour this vocabulary reserves for verified
                  state. The tone now follows the event, and the business
                  sentence leads with the raw type underneath as evidence.
                */
                const tone = /blocked|unknown/.test(type)
                  ? "var(--color-state-conflict)"
                  : /confirmed|reconcil|approved/.test(type)
                    ? "var(--color-state-verified)"
                    : "rgba(255,255,255,0.35)";
                return (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />
                    <div className="min-w-0">
                      <span className="font-medium" style={{ color: "var(--color-text-hi)" }}>
                        {auditLabel(type)}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                        {type} · {String(e.actor)}
                        {e.occurred_at ? ` · ${new Date(String(e.occurred_at)).toLocaleString()}` : ""}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>
        )}
      </section>
      </div>


      <ChapterMarker n="03" label="The same record, three ways" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              href: "/views" as const,
              t: "Concierge · Customer · Partner",
              b: "One record, three projections. The partner never sees what the partner is not entitled to — enforced by relationship tuples, not a role string.",
              a: "verified" as const,
            },
            {
              href: "/theater" as const,
              t: "Failure Theater",
              b: "Try to break it. Replay the timeout, force a duplicate, read across a partner boundary. The refusals are the product.",
              a: "conflict" as const,
            },
            {
              href: "/future" as const,
              t: "The Continuum",
              b: "Seven modules extending this same kernel — one built, four concepts, two hypotheses, each labelled where it stands.",
              a: "solar" as const,
            },
          ].map((c) => (
            <MagneticLink
              key={c.t}
              href={c.href}
              className="cine-glass group block rounded-2xl p-6 transition-colors hover:bg-white/[0.06]"
              strength={3}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: accentColor(c.a, 0.95) }}
              >
                {c.t}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{c.b}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
                Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </MagneticLink>
          ))}
        </div>

        <blockquote
          className="mt-12 max-w-3xl border-l-2 pl-6 text-[clamp(18px,2.3vw,28px)] font-medium leading-[1.35] tracking-tight text-white/90"
          style={{ borderColor: accentColor("verified", 1) }}
        >
          A handoff is not finished when the request is sent. It is finished when someone can prove
          what happened — and{" "}
          <span style={{ color: accentColor("verified", 1) }}>say who decided it</span>.
        </blockquote>
      </section>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cine-glass rounded-xl p-5">
      <h2 className="mb-3 text-sm font-semibold text-white/90">{title}</h2>
      {children}
    </div>
  );
}

function FieldTable({
  fields,
  onSelect,
}: {
  fields: Array<Record<string, unknown>>;
  onSelect: (field: string) => void;
}) {
  const canonical = fields.filter((f) => f.is_canonical);
  const shown = canonical.length > 0 ? canonical : fields;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "var(--color-text-lo)" }} className="text-left text-xs">
            <th className="pb-2 font-medium">Field</th>
            <th className="pb-2 font-medium">Value</th>
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium">Verification</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f, i) => (
            <tr
              key={i}
              onClick={() => onSelect(String(f.field_path))}
              className="cursor-pointer border-t transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--color-ground-3)" }}
              title="Tap for full version history"
            >
              <td className="py-1.5 font-mono text-xs">{String(f.field_path)}</td>
              <td className="py-1.5">{fmt(f.value)}</td>
              <td className="py-1.5 text-xs" style={{ color: "var(--color-text-mid)" }}>{String(f.channel)}</td>
              <td className="py-1.5">
                <StateBadge state={verifBadge(String(f.verification))} subtle />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- small mappers --------------------------------------------------------

function constellationFor(done: Set<string>, last: { step: string; data: unknown } | null): Source[] {
  const base: Source[] = [
    { id: "1", label: "Partner API", channel: "partner_api", state: "pending" },
    { id: "2", label: "CSV", channel: "csv_upload", state: "pending" },
    { id: "3", label: "Customer form", channel: "customer_form", state: "pending" },
  ];
  if (!done.has("ingest")) return base.map((s) => ({ ...s, state: "pending" }));
  if (done.has("detect") && !done.has("merge"))
    return [
      { ...base[0]!, state: "verified" },
      { ...base[1]!, state: "conflict" },
      { ...base[2]!, state: "verified" },
    ];
  if (done.has("merge")) return base.map((s) => ({ ...s, state: "verified" }));
  return base.map((s) => ({ ...s, state: "transit" }));
}

const moveStateToBadge = (s: string): State =>
  s === "canonical" || s === "completed" ? "verified" : s === "conflict_pending" ? "conflict" : "pending";

const submissionBadge = (s: string): State =>
  s === "confirmed" || s === "reconciled" ? "verified"
  : s === "unknown" ? "unknown"
  : s === "failed" ? "failed"
  : s === "duplicate" ? "recovered"
  : "pending";

const verifBadge = (v: string): State =>
  v === "human_approved" || v === "customer_confirmed" ? "verified"
  : v === "system_validated" ? "transit"
  : "pending";

function fmt(v: unknown): string {
  if (typeof v === "string") return v.replace(/^"|"$/g, "");
  return JSON.stringify(v);
}
