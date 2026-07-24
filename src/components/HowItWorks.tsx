"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * "How it works" — a faithful reimagining of Utility Connect's own
 * customer/partner toggle, elevated with a motion transition between the two
 * tracks. Their site has this exact FOR CUSTOMERS / FOR PARTNERS switch; this
 * keeps the structure and adds the animated step reveal.
 */

const TRACKS = {
  customers: [
    { n: 1, title: "Start enrollment", body: "Submit your details online or over the phone. One form, one place." },
    { n: 2, title: "Compare service options", body: "A dedicated concierge shops and compares every utility and home service for your address." },
    { n: 3, title: "We handle the rest", body: "Installations scheduled, a written service summary sent. You move in ready." },
  ],
  partners: [
    { n: 1, title: "Connect your channel", body: "Branded microsite, API, widget, or CSV — refer a client the way that fits your workflow." },
    { n: 2, title: "Every handoff stays verified", body: "Move Relay preserves who referred whom, through which channel, with attribution intact." },
    { n: 3, title: "See safe, live status", body: "A partner-safe view of engagement and progress — never another partner's pipeline." },
  ],
};

export function HowItWorks() {
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
            <span className="relative z-10">For {t}</span>
          </button>
        ))}
      </div>

      {/* Connecting timeline — a line with a node above each step, like theirs */}
      <div className="relative">
        <div className="absolute left-[16.66%] right-[16.66%] top-5 hidden h-px md:block" style={{ background: "var(--color-ground-3)" }} />
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
    </div>
  );
}
