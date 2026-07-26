"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { SITE_COPY, type Lang } from "@/lib/site-copy";
import { StepIllustration } from "./StepIllustration";

/**
 * Which drawing belongs to which step, per track.
 *
 * Keyed by position rather than by copy, so translating a step title cannot
 * silently detach it from its illustration.
 */
const ILLUSTRATION = {
  customers: ["enrollment", "compare", "handled"],
  partners: ["refer", "brand", "track"],
} as const;

/**
 * "How it works" — a faithful reimagining of Utility Connect's own
 * customer/partner toggle, elevated with a motion transition between the two
 * tracks, bilingual like their site, with their "Watch Video" affordance
 * pointing at The Living Move.
 */
export function HowItWorks({ lang = "en" }: { lang?: Lang }) {
  const copy = SITE_COPY[lang].how;
  const TRACKS = { customers: copy.customers, partners: copy.partners };
  const LABELS = { customers: copy.customersLabel, partners: copy.partnersLabel };
  const [track, setTrack] = useState<"customers" | "partners">("customers");

  return (
    <div>
      <div className="mx-auto mb-8 flex w-fit rounded-full border p-1" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
        {(["customers", "partners"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className="relative rounded-full px-6 py-2 text-sm font-semibold uppercase tracking-wide transition-colors"
            style={{ color: track === t ? "white" : "var(--color-text-mid)" }}
          >
            {track === t && (
              <motion.span
                layoutId="track-pill"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--color-state-verified)" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{LABELS[t]}</span>
          </button>
        ))}
      </div>

      {/* Connecting timeline — a line with a node above each step, like theirs */}
      <div className="relative">
        <div className="absolute left-[16.66%] right-[16.66%] top-[152px] hidden h-px md:block" style={{ background: "var(--color-ground-3)" }} />
        <div className="relative grid gap-4 md:grid-cols-3">
          <AnimatePresence mode="wait">
            {TRACKS[track].map((step, i) => (
              <motion.div
                key={`${track}-${step.n}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.26, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col items-center text-center"
              >
                {/*
                  The illustration, at the scale the reference gives it.

                  A numeral in a circle carried the same information and gave
                  the eye nothing to hold, which is most of why this section
                  read as a wireframe next to theirs. The drawings are ours,
                  in their visual language rather than lifted from it.
                */}
                <StepIllustration
                  kind={ILLUSTRATION[track][i]!}
                  className="mb-2 h-[132px] w-full max-w-[220px]"
                />

                {/* node on the line */}
                <div
                  className="relative z-10 mb-5 grid h-10 w-10 place-items-center rounded-full ring-4"
                  style={{ background: "var(--color-state-verified)", color: "white", ...( { "--tw-ring-color": "var(--color-ground-0)" } as React.CSSProperties) }}
                >
                  <span className="text-sm font-bold">{step.n}</span>
                </div>
                <div className="rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}>
                  <h3 className="mb-1.5 text-lg font-semibold" style={{ color: "var(--color-text-hi)" }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                    {step.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Their "Watch Video" affordance — ours opens the cinematic story. */}
      <div className="mt-8 text-center">
        <Link
          href="/story"
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
          style={{ background: "var(--color-state-verified)" }}
        >
          <span aria-hidden>▶</span> {copy.watchStory}
        </Link>
      </div>
    </div>
  );
}
