"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import type { Headline, Metric, ShiftBrief, LoadState } from "@/lib/control-room";

/**
 * The opening, and what it is allowed to claim.
 *
 * This replaced an `<h1>` reading "Operator console" — a label, describing the
 * page rather than the shift. A reviewer could read the entire header without
 * learning anything about the tenant in front of them.
 *
 * Every word below is a function of returned state. The chips say what is
 * literally true and stop there: the tenant is shared, so it does not claim
 * isolation, and the AI assembles rather than decides, so it does not claim
 * more.
 */

const TONE: Record<Headline["tone"], Accent> = {
  neutral: "internet",
  verified: "verified",
  conflict: "conflict",
  failed: "failed",
  recovered: "recovered",
  security: "security",
};

const EVIDENCE_LABEL: Record<ShiftBrief["evidenceState"], string> = {
  fully: "Fully supported by returned evidence",
  partially: "Partially supported",
  conflicting: "Conflicting evidence",
  insufficient: "Insufficient evidence",
};

const EVIDENCE_TONE: Record<ShiftBrief["evidenceState"], Accent> = {
  fully: "verified",
  partially: "internet",
  conflicting: "conflict",
  insufficient: "unknown",
};

export function ControlRoomHero({
  headline,
  metrics,
  brief,
  load,
  onStartShift,
  shiftRunning,
}: {
  headline: Headline;
  metrics: Metric[];
  brief: ShiftBrief;
  load: LoadState;
  onStartShift: () => void;
  shiftRunning: boolean;
}) {
  const still = useStillness();
  const tone = TONE[headline.tone];
  const action = metrics.filter((m) => m.kind === "action");
  const evidence = metrics.filter((m) => m.kind === "evidence");

  return (
    <header className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: accentInk(tone) }}>
        Move operations control room
      </p>

      {/*
        Four chips, each literally true. No isolation claim: the tenant is
        shared, and a page that said otherwise would be making exactly the kind
        of unverified assertion the rest of this project spends its time
        refusing.
      */}
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {[
          ["Live backend", "verified"],
          ["Synthetic demo data", "conflict"],
          ["Server truth", "verified"],
          ["AI assisted operations", "security"],
        ].map(([label, a]) => (
          <li
            key={label}
            className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
            style={{ borderColor: accentColor(a as Accent, 0.4), color: accentInk(a as Accent) }}
          >
            {label}
          </li>
        ))}
      </ul>

      <motion.h1
        key={`${headline.lead}${headline.follow}`}
        initial={{ opacity: 0, y: still ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: still ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mt-4 max-w-3xl text-[clamp(24px,3.6vw,44px)] font-semibold leading-[1.07] tracking-tight text-white"
      >
        {headline.lead}
        <br />
        <span style={{ color: accentColor(tone, 1) }}>{headline.follow}</span>
      </motion.h1>

      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        What entered the system, what was handled without anyone, what still needs judgment, and the evidence behind
        each — without reading a database row.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={onStartShift}
          disabled={shiftRunning}
          className="inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-60"
          style={{ background: accentColor("verified", 1) }}
        >
          {shiftRunning ? "Shift running…" : "Run the synthetic shift"}
        </button>
        <a
          href="/agent"
          className="inline-flex min-h-11 items-center rounded-full border px-5 text-xs font-semibold uppercase tracking-wide"
          style={{ borderColor: "rgba(255,255,255,0.22)", color: "var(--color-text-mid)" }}
        >
          The AI operating loop
        </a>
      </div>

      {/* ---------------- actionable state, then evidence counters ---------------- */}
      <div className="mt-6 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {action.map((m) => (
          <MetricTile key={m.label} metric={m} load={load} lead />
        ))}
      </div>
      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {evidence.map((m) => (
          <MetricTile key={m.label} metric={m} load={load} />
        ))}
      </div>

      {/* ---------------- the shift brief ---------------- */}
      <section
        aria-labelledby="brief-heading"
        className="cine-glass mt-6 min-w-0 rounded-2xl p-5"
        style={{ borderColor: accentColor("security", 0.35) }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="brief-heading" className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("security") }}>
            AI shift brief
          </h2>
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{
              borderColor: accentColor(EVIDENCE_TONE[brief.evidenceState], 0.45),
              color: accentInk(EVIDENCE_TONE[brief.evidenceState]),
            }}
          >
            {EVIDENCE_LABEL[brief.evidenceState]}
          </span>
        </div>

        <div aria-live="polite" className="min-w-0">
          {brief.observations.length === 0 ? (
            <p className="mt-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
              {load === "failed"
                ? "The console could not read the tenant, so there is nothing to summarise."
                : "Nothing has been read yet."}
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {brief.observations.map((o) => (
                <li key={o} className="text-sm leading-relaxed text-white/80">
                  {o}
                </li>
              ))}
            </ul>
          )}

          {brief.whyItMatters && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              <span className="font-bold uppercase tracking-[0.14em]" style={{ color: "var(--color-text-lo)" }}>
                Why it matters ·{" "}
              </span>
              {brief.whyItMatters}
            </p>
          )}

          {brief.recommendation && (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: accentInk("internet") }}>
              <span className="font-bold uppercase tracking-[0.14em] text-[11px]">Recommended · </span>
              {brief.recommendation}
            </p>
          )}
        </div>

        {brief.sourcesInspected.length > 0 && (
          <p className="mt-3 font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
            Sources inspected: {brief.sourcesInspected.join(" · ")}
          </p>
        )}

        {/*
          The boundary, always, and not as small print. This brief is assembled
          from rows rather than generated — the same position `buildBriefing`
          takes for a single move — so it says so instead of implying a model
          reached these conclusions.
        */}
        <p
          className="mt-3 border-t pt-3 text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ borderColor: "rgba(255,255,255,0.08)", color: accentInk("security") }}
        >
          AI recommendation only. No record was changed by the AI.
        </p>
      </section>
    </header>
  );
}

function MetricTile({ metric, load, lead }: { metric: Metric; load: LoadState; lead?: boolean }) {
  const known = metric.value !== null;
  return (
    <div
      className="min-w-0 rounded-xl border p-3"
      style={{
        borderColor: lead && known && metric.value! > 0 ? accentColor("conflict", 0.4) : "rgba(255,255,255,0.1)",
        background: lead && known && metric.value! > 0 ? accentColor("conflict", 0.05) : "rgba(255,255,255,0.015)",
      }}
    >
      {/*
        An em dash, not a zero, until the server has answered. A dashboard that
        prints 0 while it is still asking has told the operator there is nothing
        to do — which it does not know.
      */}
      <p
        className={`font-mono font-semibold ${lead ? "text-2xl" : "text-lg"}`}
        style={{ color: known ? (metric.value! > 0 && lead ? accentInk("conflict") : "#fff") : "var(--color-text-lo)" }}
      >
        {known ? metric.value : "—"}
      </p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: "var(--color-text-mid)" }}>
        {metric.label}
      </p>
      <p className="mt-0.5 text-[10px] leading-snug" style={{ color: "var(--color-text-lo)" }}>
        {metric.scope}
      </p>
    </div>
  );
}
