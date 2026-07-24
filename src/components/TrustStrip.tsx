"use client";

import { motion } from "framer-motion";

/**
 * The "trusted by vendors nationwide" strip that sits under Utility Connect's
 * hero. Their version shows third-party provider logos; those are other
 * companies' trademarks and are not reproduced here. Instead this shows the
 * service categories they connect, as neutral wordmarks — the same "we work with
 * everything" message, without borrowing anyone's brand.
 */
const CATEGORIES = ["Electric", "Internet", "Television", "Security", "Gas", "Water", "Solar", "Insurance"];

export function TrustStrip() {
  return (
    <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
      <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Connecting 18 home services across 3,500+ vendors nationwide
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {CATEGORIES.map((c, i) => (
            <motion.span
              key={c}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 0.6 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="text-sm font-bold uppercase tracking-wide text-white/60"
            >
              {c}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
