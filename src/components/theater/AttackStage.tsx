"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { verdictOf, isHeld, isViolated, isInconclusive, isSettled, type Slot, type Verdict } from "@/lib/theater-verdict";
import { resultLayers, establishesInvariant } from "@/lib/theater-narrative";
import type { TheaterResult } from "@/lib/theater-contract";
import { StageGlyph, TabMotif, type GlyphState } from "./AttackGlyphs";

/**
 * One stage, six instruments.
 *
 * This replaced a grid of six cards that each expanded into its own permanently
 * open wall of JSON. Every card was identical apart from its title, so the page
 * asserted six times that something had been proven and showed, six times, a
 * blob most readers cannot parse. The evidence was the loudest thing on screen
 * and the least legible, and the meaning — what would have gone wrong — was not
 * on the page at all.
 *
 * Now one attack occupies the stage at a time, drawn as the failure it actually
 * is, and its result is read in four sentences before any JSON is offered.
 *
 * ## Why this is a tablist and not six buttons
 *
 * Six independent buttons were reachable by tab and needed no roles. A set of
 * controls that swap one shared panel is a different thing: a keyboard user
 * expects one tab stop and arrow keys within the set, and a screen reader
 * expects to be told which of the six is showing. Getting this wrong would take
 * a page that works by keyboard today and make it worse in the name of looking
 * better.
 */

export interface AttackDef {
  key: string;
  title: string;
  blurb: string;
}

/*
  Inconclusive draws as idle, not as held. A glyph that showed the invariant
  surviving because the request merely returned would be the picture asserting
  what the verdict declined to.
*/
const glyphState = (v: Verdict): GlyphState =>
  v.kind === "running" ? "running" : v.kind === "held" ? "held" : v.kind === "violated" ? "violated" : "idle";

export function AttackStage({
  scenarios,
  results,
  onRun,
  busy,
}: {
  scenarios: AttackDef[];
  results: Record<string, Slot>;
  onRun: (key: string) => void;
  busy: boolean;
}) {
  const still = useStillness();
  const [selected, setSelected] = useState(0);
  const [showEvidence, setShowEvidence] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const active = scenarios[selected]!;
  const result = results[active.key];
  const verdict = verdictOf(result, (e) => establishesInvariant(active.key, e));
  const state = glyphState(verdict);
  const ok = isHeld(verdict);
  const bad = isViolated(verdict);
  const unsure = isInconclusive(verdict);
  const settled = isSettled(verdict);


  const select = useCallback((i: number) => {
    setSelected(i);
    setShowEvidence(false);
    tabRefs.current[i]?.focus();
  }, []);

  /**
   * Arrow keys move within the set; Tab leaves it.
   *
   * Both axes are handled because the instruments are a column beside the stage
   * on a wide screen and a wrapped row above it on a narrow one — a user
   * pressing the arrow that matches what they can see should not find it dead.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const last = scenarios.length - 1;
      /*
        Move relative to what is focused, not to what is selected.

        Roving tabindex keeps the two in step — Tab can only land on the
        selected tab — so reading `selected` was correct for every path a user
        can actually take. It was still the wrong thing to read: it made the
        keyboard handler depend on an invariant enforced somewhere else, and
        anything that ever focuses a tab without selecting it turns an arrow
        press into a jump. Reading the focused index is true by construction.
      */
      const focused = tabRefs.current.indexOf(document.activeElement as HTMLButtonElement);
      const from = focused >= 0 ? focused : selected;

      const next =
        e.key === "ArrowDown" || e.key === "ArrowRight"
          ? from === last
            ? 0
            : from + 1
          : e.key === "ArrowUp" || e.key === "ArrowLeft"
            ? from === 0
              ? last
              : from - 1
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? last
                : null;
      if (next === null) return;
      e.preventDefault();
      select(next);
    },
    [selected, scenarios.length, select],
  );

  const edge: Accent = bad ? "failed" : unsure ? "unknown" : ok ? "recovered" : "conflict";

  return (
    <div className="mx-auto grid max-w-[1400px] gap-4 px-5 pb-20 sm:px-8 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      {/* ---------------- the instruments ---------------- */}
      <div
        role="tablist"
        aria-label="Six ways to break it"
        aria-orientation="vertical"
        onKeyDown={onKeyDown}
        /*
          One column at every width, and not for looks.

          A wrapping flex row came first: with `flex-1` the instruments shrank
          instead of wrapping, so at 320px each was 40 pixels wide with a label
          measuring zero — six identical squares you could only tell apart by
          pressing one. A two-column grid fixed the labels and broke something
          worse. Grid tracks fill row-wise, so `ArrowDown` moved to the next
          index, which sits to the *right* on a two-column layout: the key would
          have said down and the selection would have gone sideways, while
          `aria-orientation="vertical"` told a screen reader something the
          screen contradicted.

          A single column makes the declared orientation true, the arrow keys
          spatially honest, and the labels legible, at every breakpoint.
        */
        className="grid min-w-0 grid-cols-1 gap-2"
      >
        {scenarios.map((s, i) => {
          const r = results[s.key];
          const v = verdictOf(r, (e) => establishesInvariant(s.key, e));
          const sOk = isHeld(v);
          const sBad = isViolated(v);
          const sUnsure = isInconclusive(v);
          const here = i === selected;
          const tone: Accent = sBad ? "failed" : sUnsure ? "unknown" : sOk ? "recovered" : "conflict";
          return (
            <button
              key={s.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`attack-tab-${s.key}`}
              aria-selected={here}
              aria-controls="attack-stage-panel"
              tabIndex={here ? 0 : -1}
              onClick={() => select(i)}
              className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors"
              style={{
                borderColor: here ? accentColor(tone, 0.6) : "rgba(255,255,255,0.1)",
                background: here ? accentColor(tone, 0.09) : "transparent",
              }}
            >
              {/*
                The selected cue is not colour.

                Selection was carried by border and background tint alone, which
                fails for anyone who cannot separate those hues and disappears
                entirely in forced-colours mode. A solid bar appears on the
                selected instrument and the label goes bold: two cues that
                survive without hue — one positional, one typographic — beside
                the colour for everyone else.
              */}
              <span
                aria-hidden
                className="w-[3px] shrink-0 self-stretch rounded-full"
                style={{ background: here ? accentColor(tone, 1) : "transparent" }}
              />
              <TabMotif scenario={s.key} accent={r ? tone : here ? tone : "conflict"} />
              <span
                className={`min-w-0 flex-1 text-xs leading-snug ${here ? "font-bold" : "font-medium"}`}
                style={{ color: here ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.6)" }}
              >
                {s.title}
              </span>
              {/* A dot only once the server has answered. Nothing is pre-green. */}
              {(sOk || sBad || sUnsure || v.kind === "running") && (
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: accentColor(v.kind === "running" ? "conflict" : tone, 1) }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ---------------- the stage ---------------- */}
      <div
        id="attack-stage-panel"
        role="tabpanel"
        aria-labelledby={`attack-tab-${active.key}`}
        tabIndex={0}
        className="min-w-0 rounded-2xl border"
        style={{ borderColor: accentColor(edge, settled ? 0.45 : 0.22), background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white/95">{active.title}</h3>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-white/55">{active.blurb}</p>
          </div>
          <button
            onClick={() => onRun(active.key)}
            disabled={verdict.kind === "running" || busy}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-5 text-xs font-bold uppercase tracking-wide transition-transform hover:-translate-y-px disabled:opacity-50"
            style={{ background: accentColor("conflict", 1), color: "#1a1207" }}
          >
            {verdict.kind === "running" ? "Breaking…" : settled ? "Break it again" : "Break it"}
          </button>
        </div>

        <div className="h-[150px] px-5 sm:px-6">
          <StageGlyph scenario={active.key} state={state} />
        </div>

        {/* The result, in four sentences. `aria-live` — the panel is the answer. */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6" aria-live="polite" aria-busy={verdict.kind === "running"}>
          <AnimatePresence mode="wait">
            {settled && (
              <motion.div
                key={`${active.key}-${verdict.kind}`}
                initial={{ opacity: 0, y: still ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: still ? 0 : 0.28 }}
                className="min-w-0"
              >
                {/*
                  Which four sentences these are — in particular whether the
                  refusal may be claimed at all — is decided in
                  `resultLayers`, where a test can reach it. A breach reported
                  as a refusal is the one mistake this page cannot make.
                */}
                {resultLayers(active.key, verdict).map((l) => (
                  <Layer key={l.label} label={l.label} body={l.body} tone={l.tone} mono={l.mono} />
                ))}
              </motion.div>
            )}

            {verdict.kind === "idle" && (
              <motion.p
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs leading-relaxed text-white/40"
              >
                Nothing has run for this one yet. Press break it, and the result below will be whatever the database
                returns.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/*
          Evidence lives outside the live region, and says so twice.

          It used to sit inside it, which meant pressing "inspect returned
          evidence" read the entire JSON payload aloud — several hundred
          characters of keys and UUIDs, announced because a disclosure opened.
          The four sentences are the answer and are worth announcing; the raw
          rows are for reading at leisure, and `aria-live="off"` keeps them out
          of the announcement even if this markup is ever nested back inside a
          live ancestor.
        */}
        {(ok || bad) && (
          <div className="min-w-0 px-5 pb-5 sm:px-6 sm:pb-6" aria-live="off">
            <button
              onClick={() => setShowEvidence((x) => !x)}
              aria-expanded={showEvidence}
              aria-controls="attack-evidence"
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide text-white/75"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              {showEvidence ? "Hide returned evidence" : "Inspect returned evidence"}
            </button>

            {showEvidence && (
              <div id="attack-evidence" className="mt-3 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  Evidence, as returned
                </p>
                <pre
                  className="mt-1.5 overflow-x-auto rounded p-3 font-mono text-[11px] leading-relaxed"
                  style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}
                >
                  {JSON.stringify((verdict as { result: TheaterResult }).result.evidence, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Layer({
  label,
  body,
  tone,
  mono,
}: {
  label: string;
  body: string;
  tone?: Accent;
  mono?: boolean;
}) {
  return (
    <div className="mt-3 min-w-0 first:mt-0">
      <p
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: tone ? accentInk(tone) : "rgba(255,255,255,0.4)" }}
      >
        {label}
      </p>
      <p className={`mt-1 text-sm leading-relaxed text-white/75 ${mono ? "font-mono text-[12px]" : ""}`}>{body}</p>
    </div>
  );
}
