"use client";

import { motion } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";

/**
 * The drawn mark for each partner industry.
 *
 * Nine line drawings on one grid, one stroke weight, one cap style. Stock
 * photography was the obvious alternative and it is the wrong one here: nine
 * photographs of nine kinds of office would be nine different photographers'
 * lighting, and the set would read as a gallery rather than as one company's
 * work. Drawings share a hand by construction.
 *
 * Every mark carries the same base — three short feeds converging on one node —
 * because that is the Handoff Constellation, and the claim these cards make is
 * that whatever the industry, the referral lands in the same record. The motif
 * above the base is what differs.
 *
 * Two layers. The muted copy is always there, so a card is never blank and the
 * drawing does not depend on an animation running. The accent copy draws itself
 * over the top on hover, from the feeds upward, which is the direction the data
 * actually travels.
 */

/** One shared grid, so nine marks sit at the same optical size. */
const VB = { w: 168, h: 104 };

/**
 * The motif for each industry, as SVG path data.
 *
 * Kept as plain strings rather than nested JSX so the two layers can be
 * generated from one source. A drawing duplicated by hand drifts the moment one
 * copy is edited.
 */
const MOTIF: Record<string, string[]> = {
  // A house behind a listing sign: the thing being sold, and the sign that sells it.
  "brokers-and-agents": [
    "M52 46 L84 24 L116 46",
    "M60 42 V70 H108 V42",
    "M76 70 V56 H92 V70",
    "M30 34 H46 M38 34 V60",
    "M26 22 H50 V34 H26 Z",
  ],
  // Three blocks of differing height: a portfolio, not a house.
  "property-management": [
    "M40 70 V34 H66 V70",
    "M70 70 V22 H98 V70",
    "M102 70 V42 H128 V70",
    "M48 44 H58 M48 56 H58",
    "M78 32 H90 M78 46 H90 M78 60 H90",
    "M110 52 H120",
  ],
  // A document under seal: the closing file.
  "mortgage-and-title": [
    "M56 20 H100 L114 34 V72 H56 Z",
    "M100 20 V34 H114",
    "M68 44 H102 M68 54 H102 M68 64 H88",
    "M40 56 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0",
    "M34 56 L38 60 L46 52",
  ],
  // Roof trusses: the house at the stage the builder hands it over.
  "builders-and-hoas": [
    "M32 62 L84 20 L136 62",
    "M46 62 L84 34 L122 62",
    "M84 20 V62",
    "M60 62 L84 44 M108 62 L84 44",
    "M32 70 H136",
  ],
  // A truck: the one thing on this list that is not our job.
  "movers-and-relocation": [
    "M28 62 V34 H92 V62",
    "M92 44 H112 L126 58 V62 H92 Z",
    "M46 62 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0",
    "M108 62 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0",
    "M40 44 H80",
  ],
  // A house read through a lens.
  "home-inspectors": [
    "M42 48 L74 26 L106 48",
    "M50 44 V70 H98 V44",
    "M66 70 V58 H82 V70",
    "M116 40 m-18 0 a18 18 0 1 0 36 0 a18 18 0 1 0 -36 0",
    "M129 53 L142 66",
  ],
  // A pin dropped on a street grid.
  "apartment-locators": [
    "M34 26 H134 M34 48 H134 M34 70 H134",
    "M58 18 V78 M96 18 V78",
    "M84 30 a16 16 0 0 1 16 16 c0 12 -16 26 -16 26 s-16 -14 -16 -26 a16 16 0 0 1 16 -16 Z",
    "M84 46 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0",
  ],
  // Four parties, one table between them.
  "transaction-coordinators": [
    "M84 44 m-12 0 a12 12 0 1 0 24 0 a12 12 0 1 0 -24 0",
    "M34 22 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
    "M134 22 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
    "M34 68 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
    "M134 68 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0",
    "M41 26 L73 40 M127 26 L95 40 M41 64 L73 48 M127 64 L95 48",
  ],
  // A civic front: columns and a pediment.
  "city-municipalities": [
    "M40 34 L84 16 L128 34",
    "M44 34 V66 M62 34 V66 M80 34 V66 M98 34 V66 M116 34 V66",
    "M36 34 H132",
    "M32 66 H136 M28 74 H140",
  ],
};

/** The base every mark shares: three feeds arriving at one record. */
const BASE = ["M52 96 L84 84 M84 96 V84 M116 96 L84 84"];
const BASE_NODE = { cx: 84, cy: 84, r: 4 };

export function IndustryScene({
  slug,
  accent,
  lit,
}: {
  slug: string;
  accent: string;
  /** True while the card is hovered or focused. */
  lit: boolean;
}) {
  const still = useStillness();
  const motif = MOTIF[slug] ?? [];
  const paths = [...motif, ...BASE];

  /*
    Under stillness the accent copy is simply shown or hidden rather than drawn.
    Someone who asked for no motion should still get the hover feedback — losing
    it entirely would make the card look inert rather than calm.
  */
  const draw = (i: number) =>
    still
      ? { opacity: lit ? 1 : 0 }
      : { pathLength: lit ? 1 : 0, opacity: lit ? 1 : 0, transition: { duration: 0.42, delay: i * 0.035 } };

  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      className="h-full w-full"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* The mark at rest. Never animated, so the card is legible before, during
          and after any interaction, and identical with JavaScript disabled. */}
      <g stroke="currentColor" strokeWidth={2} opacity={0.34}>
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
        <circle {...BASE_NODE} />
      </g>

      {/* The mark lighting up, drawn from the feeds outward. */}
      <g stroke={accent} strokeWidth={2.4}>
        {paths.map((d, i) => (
          <motion.path key={i} d={d} initial={false} animate={draw(i)} />
        ))}
        <motion.circle
          {...BASE_NODE}
          fill={accent}
          initial={false}
          animate={{ opacity: lit ? 1 : 0, scale: lit ? 1 : 0.4 }}
          style={{ transformOrigin: `${BASE_NODE.cx}px ${BASE_NODE.cy}px` }}
          transition={{ duration: still ? 0 : 0.24, delay: still ? 0 : 0.3 }}
        />
      </g>
    </svg>
  );
}
