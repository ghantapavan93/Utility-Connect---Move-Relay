"use client";

import { motion } from "framer-motion";

/**
 * "Industries we work with" — Utility Connect names nine partner industries on
 * their own site. This mirrors that grid exactly, with a staggered reveal and a
 * cyan hover lift. Same content, elevated presentation.
 */

const INDUSTRIES = [
  { name: "Brokers & Agents", glyph: "◈", note: "Add value beyond the transaction." },
  { name: "Property Managers", glyph: "⌂", note: "A great resident move-in experience." },
  { name: "Mortgage & Title", glyph: "▤", note: "A free concierge that sets you apart." },
  { name: "Builders & HOAs", glyph: "◇", note: "Handle expectations at handover." },
  { name: "Movers & Relocation", glyph: "⇄", note: "You locate; we set up the home." },
  { name: "Home Inspectors", glyph: "◉", note: "A service they won't stop talking about." },
  { name: "Apartment Locators", glyph: "⊞", note: "Concierge for their home services too." },
  { name: "Transaction Coordinators", glyph: "⟐", note: "Alleviate stress across every party." },
  { name: "City Municipalities", glyph: "▣", note: "Integrated enrollment for city utilities." },
];

export function Industries() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {INDUSTRIES.map((ind, i) => (
        <motion.div
          key={ind.name}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.24, delay: (i % 3) * 0.05, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -4 }}
          className="group rounded-xl border p-5 transition-colors"
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
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
            {ind.note}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
