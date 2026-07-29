"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import type { LaneItem, Lane, LoadState } from "@/lib/control-room";

/**
 * What the system handled, what it recommends, and what only a person may do.
 *
 * The dashboard led with intake controls — the things a developer wants — above
 * a metric strip. An operations product leads with decisions, and the first
 * question an operator has is not "how many moves exist" but "what is waiting
 * for me".
 *
 * The three lanes are a policy boundary rendered as a layout. Automation is
 * everything deterministic, authorized and already done. Recommendations are
 * evidenced and reversible, and say who commits them. Authority is the
 * never-automate list: identity, consent, final merge, retry safety, provider
 * success. Nothing crosses lanes for visual balance.
 *
 * ## Empty is not a default
 *
 * A lane with nothing in it renders as nothing *only* when the page has
 * genuinely loaded. While loading, and after a failed read, it says so —
 * because "nothing needs your attention" is the wrong answer to "we could not
 * ask", and it is the answer a component reaches by treating an empty array as
 * good news.
 */

const LANES: Array<{ key: Lane; title: string; sub: string; accent: Accent }> = [
  {
    key: "automation",
    title: "Automation handled it",
    sub: "Deterministic, authorized, replay-safe. Already done.",
    accent: "verified",
  },
  {
    key: "recommend",
    title: "AI recommends next",
    sub: "Grounded in returned evidence. Not executed.",
    accent: "internet",
  },
  {
    key: "authority",
    title: "Authority required",
    sub: "Consequential. A named human commits this.",
    accent: "security",
  },
];

export function DecisionLanes({
  items,
  load,
  onAction,
}: {
  items: LaneItem[];
  load: LoadState;
  onAction?: (id: string) => void;
}) {
  const still = useStillness();

  return (
    <section aria-labelledby="lanes-heading" className="min-w-0">
      <h2 id="lanes-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
        What needs your judgment
      </h2>

      <div className="mt-3 grid min-w-0 gap-3 lg:grid-cols-3">
        {LANES.map((lane) => {
          const mine = items.filter((i) => i.lane === lane.key);
          return (
            <div
              key={lane.key}
              data-lane={lane.key}
              className="min-w-0 rounded-2xl border p-4"
              style={{
                borderColor: accentColor(lane.accent, mine.length ? 0.4 : 0.16),
                background: mine.length ? accentColor(lane.accent, 0.05) : "rgba(255,255,255,0.015)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk(lane.accent) }}>
                  {lane.title}
                </h3>
                {/* A count, not a badge — and absent rather than zero while unknown. */}
                {load === "ready" && (
                  <span className="font-mono text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                    {mine.length}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                {lane.sub}
              </p>

              <div className="mt-3 space-y-2">
                {load === "loading" && <Placeholder text="Reading…" />}
                {load === "failed" && (
                  /*
                    The distinction this component exists to preserve. A failed
                    read is not a calm lane, and rendering it as one turns "we
                    could not ask" into "nothing needs attention".
                  */
                  <Placeholder text="Could not read this lane. Nothing here is known." tone="failed" />
                )}
                {load === "empty" && <Placeholder text="No shift data yet." />}
                {load === "ready" && mine.length === 0 && <Placeholder text="Nothing in this lane." />}

                {load === "ready" &&
                  mine.map((item) => (
                    <motion.article
                      key={item.id}
                      initial={{ opacity: 0, y: still ? 0 : 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: still ? 0 : 0.22 }}
                      className="min-w-0 rounded-xl border p-3"
                      style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)" }}
                    >
                      <p className="text-[13px] font-semibold leading-snug text-white/90">{item.headline}</p>
                      {item.subject && (
                        <p className="mt-0.5 font-mono text-[11px]" style={{ color: accentInk(lane.accent) }}>
                          {item.subject}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                        {item.detail}
                      </p>

                      <p className="mt-2 font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                        {item.evidence}
                      </p>

                      {/*
                        Authority travels with the recommendation, never below
                        the fold. A recommendation whose boundary is unstated
                        reads as an instruction.
                      */}
                      {item.authority && (
                        <p
                          className="mt-2 border-t pt-2 text-[10px] leading-relaxed"
                          style={{ borderColor: "rgba(255,255,255,0.08)", color: accentInk(lane.accent) }}
                        >
                          {item.authority}
                        </p>
                      )}

                      {item.action && (
                        <button
                          onClick={() => onAction?.(item.id)}
                          className="mt-2.5 inline-flex min-h-11 items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ borderColor: accentColor(lane.accent, 0.5), color: accentInk(lane.accent) }}
                        >
                          {item.action}
                        </button>
                      )}
                    </motion.article>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Placeholder({ text, tone }: { text: string; tone?: "failed" }) {
  return (
    <p
      className="rounded-lg border border-dashed px-3 py-2 text-[11px]"
      style={{
        borderColor: tone === "failed" ? accentColor("failed", 0.4) : "rgba(255,255,255,0.1)",
        color: tone === "failed" ? accentInk("failed") : "var(--color-text-lo)",
      }}
    >
      {text}
    </p>
  );
}
