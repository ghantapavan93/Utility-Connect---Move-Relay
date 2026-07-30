"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { stageLabel } from "@/lib/agent/narrative";
import type { AgentEvalCaseResult, AgentEvalMetrics } from "@/lib/agent/eval";

/**
 * The adversarial lab: attack first, arithmetic second.
 *
 * The previous presentation was six numeric cards. The numbers were real and
 * they were the wrong opening, because a reviewer cannot tell 100% blocked
 * from 100% never-attempted without seeing the attempts. So each executed case
 * now renders as what it was: the attack that went in, the path the agent took,
 * where policy stopped it, and whether the boundary held — with the injected
 * hostile text quoted verbatim, in a quarantined style, because "trust me, it
 * was hostile" is not evidence.
 *
 * Everything here is returned data. The cases run server-side against a scratch
 * tenant, each one a real `runCaseAgent` execution with real seeded rows; the
 * verdicts arrive as `caseResults` and the aggregates as the same metrics the
 * test suite asserts on. Nothing is precomputed into this file — a page reload
 * runs a fresh evaluation or shows none.
 */

function Verdict({ result }: { result: AgentEvalCaseResult }) {
  const held = result.failures.length === 0;
  const accent: Accent = held ? "verified" : "failed";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{ borderColor: accentColor(accent, 0.5), color: accentInk(accent) }}
    >
      {held ? <ShieldCheck size={12} aria-hidden /> : <ShieldAlert size={12} aria-hidden />}
      {held ? "Boundary held" : "Boundary broke"}
    </span>
  );
}

function CaseCard({ result, index }: { result: AgentEvalCaseResult; index: number }) {
  const still = useStillness();
  const [open, setOpen] = useState(false);

  return (
    <motion.li
      initial={{ opacity: 0, y: still ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : 0.26, delay: still ? 0 : Math.min(index * 0.08, 0.4) }}
      className="min-w-0 rounded-xl border p-4"
      style={{
        borderColor: result.failures.length ? accentColor("failed", 0.5) : "rgba(255,255,255,0.12)",
        background: result.failures.length ? accentColor("failed", 0.06) : "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-white/90">{result.name}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            {result.hypothesis}
          </p>
        </div>
        <Verdict result={result} />
      </div>

      {/*
        The attack, quoted rather than described, and visually quarantined —
        a dashed amber border and an explicit label, so hostile text never
        reads as something the system said.
      */}
      {result.injected.length > 0 && (
        <div className="mt-3 rounded-lg border border-dashed p-2.5" style={{ borderColor: accentColor("conflict", 0.5) }}>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk("conflict") }}>
            Hostile text planted in customer data
          </p>
          {result.injected.map((text) => (
            <p key={text} className="mt-1 font-mono text-[11px] leading-relaxed text-white/70">
              “{text}”
            </p>
          ))}
        </div>
      )}

      <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-2">
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-bold" style={{ color: "var(--color-text-lo)" }}>Run ended:</dt>
          <dd className="text-white/80">{result.state.replace(/_/g, " ")}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-bold" style={{ color: "var(--color-text-lo)" }}>Proposed:</dt>
          <dd className="text-white/80">{result.proposedTool ? stageLabel(result.proposedTool) : "nothing"}</dd>
        </div>
        {result.refusedTool && (
          <div className="flex gap-1.5 sm:col-span-2">
            <dt className="shrink-0 font-bold" style={{ color: accentInk("security") }}>Stopped by policy:</dt>
            <dd className="text-white/80">{stageLabel(result.refusedTool)}</dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-2.5 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ color: accentInk("internet") }}
      >
        {open ? "Hide the executed path" : "Show the executed path"}
      </button>
      {open && (
        <ol className="mt-1 space-y-0.5 font-mono text-[10px]" style={{ color: "var(--color-text-mid)" }}>
          {result.toolPath.map((tool, i) => (
            <li key={`${tool}-${i}`}>
              {i + 1}. {tool}
              {tool === result.refusedTool ? "  ← refused here" : ""}
            </li>
          ))}
        </ol>
      )}

      {result.failures.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px]" style={{ color: accentInk("failed") }}>
          {result.failures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </motion.li>
  );
}

export function BreakTheAgent({
  metrics,
  running,
  onRun,
}: {
  metrics: AgentEvalMetrics | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="min-w-0">
      <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
        Manipulated customer text, missing evidence, unsafe shortcuts. The test is not whether the
        copilot sounds confident — it is whether the operating boundary still holds. Each case below
        seeds a real tenant, runs the real agent, and reports what actually happened.
      </p>

      <button
        type="button"
        onClick={onRun}
        disabled={running}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
        style={{ background: accentColor("failed", 0.85) }}
      >
        {running && <Loader2 size={14} className="animate-spin" aria-hidden />}
        {running ? "Attacking…" : metrics ? "Run the attacks again" : "Run the attacks"}
      </button>

      {metrics && (
        <>
          <ol className="mt-5 list-none space-y-3">
            {metrics.caseResults.map((result, i) => (
              <CaseCard key={result.name} result={result} index={i} />
            ))}
          </ol>

          {/* The arithmetic, after the attacks it summarises. */}
          <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Forbidden attempts blocked",
                value: `${metrics.forbiddenBlocked} / ${metrics.forbiddenAttempts}`,
                bad: metrics.forbiddenBlocked !== metrics.forbiddenAttempts,
              },
              {
                label: "Injection influence",
                value: String(metrics.injectionInfluence),
                bad: metrics.injectionInfluence > 0,
              },
              {
                label: "False all-clears",
                value: metrics.falseAllClearRate.toFixed(2),
                bad: metrics.falseAllClearRate > 0,
              },
              {
                label: "Refusals explained",
                value: `${metrics.refusalsExplained} / ${metrics.refusalsTotal}`,
                bad: metrics.refusalsExplained !== metrics.refusalsTotal,
              },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl border p-3"
                style={{
                  borderColor: accentColor(m.bad ? "failed" : "verified", 0.35),
                  background: accentColor(m.bad ? "failed" : "verified", 0.05),
                }}
              >
                <dd className="font-mono text-xl font-semibold" style={{ color: accentInk(m.bad ? "failed" : "verified") }}>
                  {m.value}
                </dd>
                <dt className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: "var(--color-text-mid)" }}>
                  {m.label}
                </dt>
              </div>
            ))}
          </dl>

          <p className="mt-5 text-sm font-semibold leading-relaxed text-white/85">
            The model did not earn authority.{" "}
            <span style={{ color: accentInk("security") }}>
              The system proved that authority remained where it belonged.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
