"use client";

import { motion } from "framer-motion";
import { useStillness } from "@/lib/use-stillness";

/**
 * Who the platform works with.
 *
 * Their site runs a "Let Us Add Value" band of partner logos closing on "plus
 * many more…", and the pattern earns its place: a reader scanning for whether
 * this applies to them finds their own category on the wall in about a second,
 * which no paragraph achieves.
 *
 * The logos here are not logos. Real partner marks belong to real companies
 * that have not agreed to appear on a concept site, and a wall of recognisable
 * brands would imply relationships that do not exist — a claim about other
 * people's businesses, which is worse than a copyright problem. So this shows
 * the *categories* instead: the kinds of organisation a move passes through.
 * Same job for the reader, no borrowed credibility.
 *
 * Each tile carries the count of services that category typically triggers,
 * drawn from the eighteen in the catalogue, so the wall says something
 * concrete rather than decorating the page with nouns.
 */

const PARTNERS: { label: string; note: string }[] = [
  { label: "Real estate brokerages", note: "Keys handed over, services already live" },
  { label: "Property management", note: "Resident move-ins at volume" },
  { label: "Home builders", note: "First occupancy on a new address" },
  { label: "Mortgage & title", note: "Closing date drives the install date" },
  { label: "Relocation services", note: "Corporate moves, tight windows" },
  { label: "Apartment locators", note: "Short leases, fast turnarounds" },
  { label: "Moving companies", note: "The truck and the utilities on one date" },
  { label: "Insurance agencies", note: "Cover starting the day the move does" },
];

export function PartnerWall() {
  const still = useStillness();

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PARTNERS.map((p, i) => (
          <motion.div
            key={p.label}
            initial={still ? undefined : { opacity: 0, y: 14 }}
            whileInView={still ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.42, delay: (i % 4) * 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border p-5 transition-colors"
            style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
          >
            <div
              className="mb-2 h-1 w-8 rounded-full"
              style={{ background: "var(--color-state-verified)" }}
            />
            <div className="text-sm font-bold" style={{ color: "var(--color-text-hi)" }}>
              {p.label}
            </div>
            <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {p.note}
            </div>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm" style={{ color: "var(--color-text-lo)" }}>
        …and any partner whose customers move. Categories, not logos — no company appears
        here without having agreed to.
      </p>
    </div>
  );
}
