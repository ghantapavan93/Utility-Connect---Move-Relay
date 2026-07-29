"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { postTheater } from "@/lib/theater-request";
import { verdictOf, type Verdict, type Slot } from "@/lib/theater-verdict";
import { MUTATION_COPY, MUTATION_ORDER, builderEstablishes } from "@/lib/theater-builder-narrative";
import type { Mutation } from "@/lib/theater-builder";
import { UnsafeBaseline } from "./UnsafeBaseline";

/**
 * Mutate a synthetic handoff.
 *
 * The six attacks are chosen for the reviewer. This one hands the choice over,
 * which is a different and stronger claim: not "watch these guarantees hold"
 * but "pick the fault yourself, and the guarantee named beside it still holds".
 * Someone who selected the fault has already ruled out the suspicion that the
 * demonstration was arranged around its result.
 *
 * ## Expected before observed
 *
 * The risk and the invariant are shown *before* staging, and the observed
 * result appears beside them afterwards. A page that only narrated outcomes
 * could describe any result as the expected one and nobody could tell. Stating
 * the expectation first is what makes the comparison mean something.
 *
 * ## A radiogroup, not a tablist
 *
 * The attack chamber swaps panels, so it is tabs. This is a single choice from
 * a set that then gets acted on, which is what a radio group is for — and a
 * screen reader should hear "one of eight selected", not "tab three of eight".
 */

type Phase = "armed" | "staging" | "settled";

interface BuilderResponse {
  mutation: Mutation;
  invariant: string;
  expected: string;
  outcome: string;
  evidence: Record<string, unknown>;
}

export function AttackBuilder() {
  const still = useStillness();
  const [selected, setSelected] = useState<Mutation>(MUTATION_ORDER[0]!);
  const [phase, setPhase] = useState<Phase>("armed");
  const [slot, setSlot] = useState<Slot>(undefined);
  const [observed, setObserved] = useState<BuilderResponse | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const copy = MUTATION_COPY[selected];
  const verdict: Verdict = verdictOf(slot, (e) => builderEstablishes(selected, e));

  const select = useCallback((i: number) => {
    const next = MUTATION_ORDER[i]!;
    setSelected(next);
    // A new choice invalidates the last result. Leaving it on screen beside a
    // different mutation's risk copy would attribute one run's evidence to
    // another run's fault.
    setSlot(undefined);
    setObserved(null);
    setPhase("armed");
    setShowEvidence(false);
    radioRefs.current[i]?.focus();
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    const last = MUTATION_ORDER.length - 1;
    const focused = radioRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const from = focused >= 0 ? focused : MUTATION_ORDER.indexOf(selected);

    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? from === last ? 0 : from + 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? from === 0 ? last : from - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    select(next);
  }, [selected, select]);

  const stage = useCallback(async () => {
    setPhase("staging");
    setSlot("running");
    setShowEvidence(false);

    const res = await postTheater<BuilderResponse>("/api/v1/theater/builder", {
      body: { mutation: selected },
    });

    if (res.ok) {
      setObserved(res.data);
      setSlot({
        scenario: res.data.mutation,
        invariant: res.data.invariant,
        outcome: res.data.outcome,
        evidence: res.data.evidence,
      });
    } else {
      setObserved(null);
      setSlot({ error: res.failure.error, reason: res.failure.reason });
    }
    setPhase("settled");
  }, [selected]);

  const tone: Accent =
    verdict.kind === "violated" ? "failed"
      : verdict.kind === "inconclusive" ? "unknown"
        : verdict.kind === "held" ? "recovered"
          : "conflict";

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-20 sm:px-8" aria-label="Mutate a synthetic handoff">
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}>
        <div className="border-b p-6 sm:p-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: accentInk("security") }}>
            Mutate a synthetic handoff
          </p>
          <h2 className="mt-3 max-w-3xl text-[clamp(20px,2.6vw,32px)] font-semibold leading-[1.12] tracking-tight text-white">
            Start from a valid referral. Break one thing. See what survives.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            One synthetic household in the theater tenant. Choose a fault, read what should happen, then stage it and
            compare against what the database actually returned.
          </p>
        </div>

        <div className="grid gap-4 p-6 sm:p-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* ---------- the choice ---------- */}
          <div
            role="radiogroup"
            aria-label="Which fault to introduce"
            onKeyDown={onKeyDown}
            className="grid min-w-0 grid-cols-1 gap-2"
          >
            {MUTATION_ORDER.map((m, i) => {
              const here = m === selected;
              return (
                <button
                  key={m}
                  ref={(el) => {
                    radioRefs.current[i] = el;
                  }}
                  role="radio"
                  aria-checked={here}
                  tabIndex={here ? 0 : -1}
                  onClick={() => select(i)}
                  className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: here ? accentColor("security", 0.6) : "rgba(255,255,255,0.1)",
                    background: here ? accentColor("security", 0.09) : "transparent",
                  }}
                >
                  {/* Non-colour cue: a bar, and weight. Same rule as the chamber. */}
                  <span
                    aria-hidden
                    className="w-[3px] shrink-0 self-stretch rounded-full"
                    style={{ background: here ? accentColor("security", 1) : "transparent" }}
                  />
                  <span
                    className={`min-w-0 flex-1 text-xs leading-snug ${here ? "font-bold" : "font-medium"}`}
                    style={{ color: here ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)" }}
                  >
                    {MUTATION_COPY[m].label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ---------- expected, then observed ---------- */}
          <div className="min-w-0">
            <Block label="The fault you are introducing" body={copy.fault} />
            <Block label="Business risk if this were unguarded" body={copy.risk} tone="conflict" />

            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: accentColor("security", 0.3), background: accentColor("security", 0.05) }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk("security") }}>
                Expected — stated before the run
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/75">
                {observed?.expected ?? EXPECTED_BEFORE_RUN[selected]}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void stage()}
                disabled={phase === "staging"}
                className="inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px disabled:opacity-60"
                style={{ background: accentColor("security", 1), color: "#0d0a1a" }}
              >
                {phase === "staging" ? "Staging…" : phase === "settled" ? "Stage it again" : "Stage this failure"}
              </button>
              <span className="font-mono text-[11px] text-white/40">isolated theater tenant · synthetic data only</span>
            </div>

            {/* Observed. `aria-live` — this is the answer. Evidence stays outside. */}
            <div className="mt-4 min-w-0" aria-live="polite" aria-busy={phase === "staging"}>
              <AnimatePresence mode="wait">
                {phase === "settled" && (
                  <motion.div
                    key={`${selected}-${verdict.kind}`}
                    initial={{ opacity: 0, y: still ? 0 : 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: still ? 0 : 0.28 }}
                    className="min-w-0 rounded-xl border p-4"
                    style={{ borderColor: accentColor(tone, 0.45), background: accentColor(tone, 0.06) }}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk(tone) }}>
                      {VERDICT_LABEL[verdict.kind]}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/80">
                      {verdict.kind === "inconclusive"
                        ? verdict.detail
                        : verdict.kind === "violated"
                          ? verdict.result.invariant
                          : (observed?.outcome ?? "")}
                    </p>

                    {/*
                      The evidence sentence only appears where it can be earned.
                      An inconclusive run has nothing to read, and a breach with
                      thin evidence gets the breach without the proof.
                    */}
                    {verdict.kind === "held" && (
                      <p className="mt-2 font-mono text-[12px] leading-relaxed text-white/65">
                        {copy.proves(verdict.result.evidence)}
                      </p>
                    )}
                    {verdict.kind === "violated" && verdict.evidenceState === "complete" && (
                      <p className="mt-2 font-mono text-[12px] leading-relaxed text-white/65">
                        {copy.proves(verdict.result.evidence)}
                      </p>
                    )}
                    {verdict.kind === "violated" && verdict.evidenceState !== "complete" && (
                      <p className="mt-2 text-[12px] leading-relaxed" style={{ color: accentInk("unknown") }}>
                        Violation reported. Supporting evidence was incomplete.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Outside the live region, and marked off. Raw rows are read, not announced. */}
            {(verdict.kind === "held" || verdict.kind === "violated") && (
              <div className="mt-3 min-w-0" aria-live="off">
                <button
                  onClick={() => setShowEvidence((v) => !v)}
                  aria-expanded={showEvidence}
                  aria-controls="builder-evidence"
                  className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide text-white/75"
                  style={{ borderColor: "rgba(255,255,255,0.2)" }}
                >
                  {showEvidence ? "Hide returned evidence" : "Inspect returned evidence"}
                </button>
                {showEvidence && (
                  <pre
                    id="builder-evidence"
                    className="mt-2 overflow-x-auto rounded p-3 font-mono text-[11px] leading-relaxed"
                    style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}
                  >
                    {JSON.stringify(verdict.result.evidence, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/*
          The comparison, and only for the mutation it was written for.

          Shown after a run rather than beside the chooser: it is an answer to
          "what would this have cost", and that question only lands once the
          reviewer has watched the guarantee hold. Scoped to `stale_version`
          because the baseline models that specific rule — offering it against
          every mutation would be one simulation standing in for six different
          mechanisms.
        */}
        {selected === "stale_version" && verdict.kind === "held" && (
          <div className="border-t px-6 pb-6 sm:px-8 sm:pb-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">
              Compare against an unsafe baseline
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/50">
              The left column is not a system. It is arithmetic — what last-write-wins does, written out, so the
              difference is visible. Nothing there ran, and nothing there can.
            </p>
            <UnsafeBaseline />
          </div>
        )}
      </div>
    </section>
  );
}

const VERDICT_LABEL: Record<Verdict["kind"], string> = {
  idle: "Not run",
  running: "Staging",
  held: "Invariant held",
  violated: "Invariant violated",
  inconclusive: "No verdict reached",
};

/**
 * The expectation, available before the server has said anything.
 *
 * Mirrors what each mutation returns as `expected`, and is replaced by the
 * server's own copy once a run completes — so the two can be compared and any
 * drift between them becomes visible rather than hidden behind one source.
 */
const EXPECTED_BEFORE_RUN: Record<Mutation, string> = {
  replay_batch: "The second delivery replays. No second referral is created.",
  replay_webhook: "Both deliveries are accepted. The handler runs once.",
  remove_required_field: "Validation fails on move.date. The payload quarantines with a machine-readable reason.",
  rename_partner_field: "move.date is absent under its contract name. The payload quarantines rather than losing the date.",
  stale_version: "The first write commits. The second updates nothing and becomes a visible conflict.",
  other_tenant: "The owning agent is granted with an explanation. The other tenant is denied.",
  drop_provider_response: "Our state is UNKNOWN while the provider already holds a created order.",
  crash_at_submit: "reserve stays committed. The crash lands in submit. Resumption starts at submit, not at reserve.",
};

function Block({ label, body, tone }: { label: string; body: string; tone?: Accent }) {
  return (
    <div className="mt-3 min-w-0 first:mt-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: tone ? accentInk(tone) : "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-white/75">{body}</p>
    </div>
  );
}
