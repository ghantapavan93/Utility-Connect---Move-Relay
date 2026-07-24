"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { INDUSTRIES } from "@/lib/industries-data";

/**
 * "Industries we work with" — Utility Connect names nine partner industries on
 * their own site, each with its own page. This mirrors that grid, staggered and
 * with a cyan hover lift, and each card links through to that industry's page.
 */
export function Industries() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {INDUSTRIES.map((ind, i) => (
        <motion.div
          key={ind.slug}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.24, delay: (i % 3) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -4 }}
        >
          <Link
            href={`/industries/${ind.slug}` as never}
            className="group block h-full rounded-xl border p-5 transition-colors hover:border-white"
            style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
          >
            <div className="mb-2 flex items-center gap-3">
              <span
                className="grid h-9 w-9 place-items-center rounded-lg text-lg transition-colors"
                style={{ background: "color-mix(in oklab, var(--color-state-verified) 12%, transparent)", color: "var(--color-state-verified)" }}
                aria-hidden
              >
                {ind.glyph}
              </span>
              <h3 className="text-sm font-semibold">{ind.name}</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>{ind.note}</p>
            <span className="mt-3 inline-block text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--color-state-verified)" }}>
              Learn more →
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
