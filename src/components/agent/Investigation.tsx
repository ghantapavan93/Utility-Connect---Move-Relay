"use client";

import { motion } from "framer-motion";
import { Check, X, AlertTriangle, Loader2, Circle } from "lucide-react";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import type { Stage } from "@/lib/agent/narrative";

/**
 * What the agent did, as work rather than as a call log.
 *
 * The previous version of this listed `get_move_record`, `get_provider_operation`,
 * `submit_provider_enrollment — refused`. Every line was true and the whole
 * thing read as a trace viewer, which is the correct tool for an engineer
 * debugging a run and the wrong first thing for anyone deciding whether this
 * system is trustworthy.
 *
 * So the business label leads and the tool name sits underneath it in mono, as
 * the evidence for the sentence above rather than as the sentence itself. Both
 * are on screen at once — the claim is not that the tool name is unimportant,
 * it is that it is the second thing you need.
 *
 * ## The refusal is the point
 *
 * A refused step is styled as an *outcome*, not an error. It is the one line on
 * this page that proves the boundary is enforced by the system rather than
 * honoured by the caller, so it gets the registry's own wording, unparaphrased,
 * at full contrast. Rendering it in red beside the successful reads would file
 * it under "something went wrong", which is exactly backwards: it is the thing
 * that went right.
 */

const STATE_ACCENT: Record<Stage["state"], Accent> = {
  completed: "verified",
  refused: "security",
  failed: "failed",
  running: "internet",
  queued: "unknown",
};

const STATE_LABEL: Record<Stage["state"], string> = {
  completed: "Completed",
  refused: "Refused by policy",
  failed: "Failed",
  running: "Running",
  queued: "Queued",
};

function StageIcon({ state }: { state: Stage["state"] }) {
  const props = { size: 13, "aria-hidden": true as const, strokeWidth: 2.5 };
  if (state === "completed") return <Check {...props} />;
  if (state === "refused") return <X {...props} />;
  if (state === "failed") return <AlertTriangle {...props} />;
  if (state === "running") return <Loader2 {...props} className="animate-spin" />;
  return <Circle {...props} />;
}

/**
 * The run's time, as one bar.
 *
 * Every stage row already prints its milliseconds; this is the same persisted
 * data given shape, because "the reads took 400ms and the refusal cost
 * nothing" is a sentence about proportions, and proportions are what a list
 * of numbers hides. Each segment is a real `durationMs` from `agent_steps` —
 * nothing is interpolated, and a step whose duration was not recorded simply
 * contributes no width rather than an invented one.
 */
function RunTiming({ stages }: { stages: Stage[] }) {
  const timed = stages.filter((s) => s.durationMs !== null && s.durationMs > 0);
  const total = timed.reduce((n, s) => n + (s.durationMs ?? 0), 0);
  if (timed.length < 2 || total === 0) return null;

  const tone: Record<Stage["state"], string> = {
    completed: accentColor("internet", 0.75),
    refused: accentColor("security", 0.85),
    failed: accentColor("failed", 0.85),
    running: accentColor("internet", 0.4),
    queued: "rgba(255,255,255,0.15)",
  };

  return (
    <figure className="mt-3 min-w-0">
      <figcaption className="flex items-baseline justify-between text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
        <span>Where the run&rsquo;s time went</span>
        <span className="font-mono normal-case tracking-normal">{total}ms total</span>
      </figcaption>
      <div
        className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={`Run timing: ${timed.map((s) => `${s.label} ${s.durationMs}ms`).join(", ")}`}
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {timed.map((s, i) => (
          <div
            key={`${s.tool}-${i}`}
            title={`${s.label} — ${s.durationMs}ms`}
            style={{
              width: `${((s.durationMs ?? 0) / total) * 100}%`,
              background: tone[s.state],
              // A hairline seam so adjacent same-tone segments stay countable.
              boxShadow: "inset -1px 0 0 rgba(4,7,11,0.8)",
              minWidth: 2,
            }}
          />
        ))}
      </div>
    </figure>
  );
}

export function Investigation({
  stages,
  running,
  onHoverTool,
}: {
  stages: Stage[];
  running: boolean;
  /**
   * Fired with the stage's tool on pointer-over and null on leave, so the
   * boundary diagram beside this list can answer — the same panels-talk-to-
   * each-other grammar the thesis's failure switch established. Optional and
   * purely additive: with no listener the rows behave exactly as before.
   */
  onHoverTool?: (tool: string | null) => void;
}) {
  const still = useStillness();

  return (
    <>
    <ol className="min-w-0 space-y-1.5" aria-label="Investigation steps">
      {stages.map((stage, i) => {
        const accent = STATE_ACCENT[stage.state];
        const notable = stage.state === "refused" || stage.state === "failed";

        return (
          <motion.li
            key={`${stage.tool}-${stage.state}-${i}`}
            /*
              Staggered by index so the steps arrive in the order they ran. The
              delay is capped rather than proportional: a nine-step run should
              not take three seconds to finish appearing, and a reader who has
              seen it once should not be made to wait again.
            */
            initial={{ opacity: 0, x: still ? 0 : -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: still ? 0 : 0.24,
              delay: still ? 0 : Math.min(i * 0.07, 0.5),
              ease: [0.16, 1, 0.3, 1],
            }}
            className="min-w-0 rounded-lg border p-2.5"
            style={{
              borderColor: accentColor(accent, notable ? 0.45 : 0.2),
              background: notable ? accentColor(accent, 0.07) : "rgba(255,255,255,0.02)",
            }}
            onMouseEnter={() => onHoverTool?.(stage.tool)}
            onMouseLeave={() => onHoverTool?.(null)}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                style={{ background: accentColor(accent, 0.16), color: accentInk(accent) }}
              >
                <StageIcon state={stage.state} />
              </span>

              <div className="min-w-0 flex-1">
                {/* The work, first and loudest. */}
                <p className="text-[13px] font-semibold leading-snug text-white/90">
                  {stage.label}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {/*
                    Not colour alone. The state is spelled out beside the icon
                    so "refused" is legible to a reader who cannot distinguish
                    the purple from the green.
                  */}
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.12em]"
                    style={{ color: accentInk(accent) }}
                  >
                    {STATE_LABEL[stage.state]}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                    {stage.tool}
                  </span>
                  {stage.durationMs !== null && (
                    <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                      {stage.durationMs}ms
                    </span>
                  )}
                </div>

                {/*
                  The registry's own words, not a paraphrase. This sentence is
                  the evidence that the refusal came from policy rather than
                  from the caller's good manners, and rewording it here would
                  quietly make the page the source of truth.
                */}
                {stage.note && notable && (
                  <p
                    className="mt-1.5 text-[11px] leading-relaxed"
                    style={{ color: "var(--color-text-mid)" }}
                  >
                    {stage.note}
                  </p>
                )}
              </div>
            </div>
          </motion.li>
        );
      })}

      {running && (
        <li
          className="rounded-lg border border-dashed p-2.5 text-[11px]"
          style={{ borderColor: "rgba(255,255,255,0.16)", color: "var(--color-text-lo)" }}
        >
          <span className="inline-flex items-center gap-2">
            <Loader2 size={12} className="animate-spin" aria-hidden />
            Reading the case…
          </span>
        </li>
      )}

      {!running && stages.length === 0 && (
        <li
          className="rounded-lg border border-dashed p-3 text-[11px]"
          style={{ borderColor: "rgba(255,255,255,0.14)", color: "var(--color-text-lo)" }}
        >
          Nothing has run yet. Every line that appears here is a persisted step, not a
          simulation.
        </li>
      )}
    </ol>
    {!running && <RunTiming stages={stages} />}
    </>
  );
}
