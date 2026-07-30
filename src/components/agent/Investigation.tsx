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

export function Investigation({
  stages,
  running,
}: {
  stages: Stage[];
  running: boolean;
}) {
  const still = useStillness();

  return (
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
  );
}
