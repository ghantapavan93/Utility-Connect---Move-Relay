"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";
import { IndustryScene } from "@/components/ui/industry-scene";
import { asRoute } from "@/lib/routes";

/**
 * A card that resolves under the pointer: border, mark and pattern all arrive
 * together in the industry's own colour.
 *
 * The reference this is built from puts a photograph on top and inverts every
 * colour on hover, including the body text. Inverting a paragraph onto a
 * saturated fill is the part that does not survive contact with nine different
 * accent colours — some of these are amber and green, and white body text on
 * them fails contrast at 13px. So the accent moves onto the parts that can
 * carry it (the border, the drawn mark, the rule under the title, the arrow)
 * and the text is left alone at full contrast.
 *
 * Per-industry colour is not decoration here. Utility Connect themes each
 * industry page to its own accent, the branded-microsite promise made visible,
 * and `industries-data.ts` has carried those nine values since the pages were
 * built. The card is showing you which page it opens.
 */

export function InfoCard({
  href,
  slug,
  name,
  note,
  accent,
  delay = 0,
}: {
  href: string;
  slug: string;
  name: string;
  note: string;
  accent: string;
  delay?: number;
}) {
  const [lit, setLit] = useState(false);
  const still = useStillness();

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.24, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={asRoute(href)}
        onMouseEnter={() => setLit(true)}
        onMouseLeave={() => setLit(false)}
        onFocus={() => setLit(true)}
        onBlur={() => setLit(false)}
        className="group relative block h-full overflow-hidden rounded-xl border transition-[border-color,transform,box-shadow] duration-200"
        style={{
          borderColor: lit ? accent : "var(--color-ground-3)",
          background: "var(--color-ground-1)",
          transform: lit && !still ? "translateY(-4px)" : "translateY(0)",
          boxShadow: lit ? `0 14px 34px -18px ${accent}` : "none",
        }}
      >
        {/*
          The mark, on a panel of its own.

          Given real height rather than an icon's worth, because a drawing at
          36px is a glyph and reads as clip art. At this size it is an
          illustration and the converging base is actually legible.
        */}
        <div
          className="relative h-[124px] overflow-hidden border-b"
          style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}
        >
          {/*
            Hairline diagonals, revealed behind the mark on hover.

            A flat wash of the accent would compete with the drawing sitting on
            top of it. A ruled field reads as a surface instead of as a second
            shape, so the lines stay the loudest thing in the panel.
          */}
          <div
            aria-hidden
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              opacity: lit ? 1 : 0,
              backgroundImage: `repeating-linear-gradient(45deg, ${accent}1f 0 1px, transparent 1px 9px)`,
            }}
          />
          <div className="relative h-full w-full px-6 py-4">
            <IndustryScene slug={slug} accent={accent} lit={lit} />
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
            {name}
          </h3>
          {/* Their signature rule, in the industry's colour rather than the
              brand's, growing from the left as the card takes focus. */}
          <div
            aria-hidden
            className="mt-2 h-0.5 rounded-full transition-[width] duration-300"
            style={{ background: accent, width: lit ? 40 : 18 }}
          />
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
            {note}
          </p>
          <span
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold transition-opacity duration-200"
            style={{ color: accent, opacity: lit ? 1 : 0.55 }}
          >
            Learn more
            <span
              aria-hidden
              className="inline-block transition-transform duration-200"
              style={{ transform: lit && !still ? "translateX(3px)" : "none" }}
            >
              →
            </span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
