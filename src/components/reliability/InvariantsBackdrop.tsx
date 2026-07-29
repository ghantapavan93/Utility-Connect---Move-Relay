"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { Pulse, useScene } from "@/components/diagram/primitives";

/**
 * The hero of the reliability page: five invariants, each under attack.
 *
 * This replaced `spine.webp` — a render of a house — on the page that measures
 * what happens when things break. A photograph of a home says nothing about a
 * blocked retry, and it was the largest element on a screen whose whole subject
 * is failure.
 *
 * Each line is one guarantee. Each is struck at a different moment, and each
 * holds: the strike lands, the line survives it, and the enforcement that made
 * that possible is named underneath. Nothing here is decorative — the five are
 * the five the page then computes from real rows.
 *
 * They break at different points on purpose. Five simultaneous strikes reads as
 * one event; staggered, it reads as a system that keeps being tested and keeps
 * holding, which is what an SLO page is claiming.
 */

interface Invariant {
  label: string;
  enforcement: string;
  /** Where along the line the attack lands, 0 to 1. */
  at: number;
  accent: Accent;
}

const INVARIANTS: Invariant[] = [
  { label: "No duplicate provider order", enforcement: "unique operation_key", at: 0.32, accent: "verified" },
  { label: "No canonical value without a human", enforcement: "CHECK constraint", at: 0.52, accent: "security" },
  { label: "No silent overwrite", enforcement: "optimistic version", at: 0.44, accent: "conflict" },
  { label: "No history rewritten", enforcement: "trigger raises", at: 0.62, accent: "recovered" },
  { label: "No cross-tenant read", enforcement: "relationship graph", at: 0.38, accent: "internet" },
];

/**
 * Two arrangements, because one could not serve both ends of the range.
 *
 * Drawn once at 1200 units across, this had two faults that only measurement
 * showed. The label gutter was 136 units and the longest invariant — "No
 * canonical value without a human" — is 221, so three of the five started
 * outside the viewBox; on a wide desktop they survived only because the SVG is
 * inset from the page edge, and the hero clips, so they were genuinely cut off
 * as the window narrowed. And 1200 units only clears 11px of type above a
 * ~1200px viewport: a tablet rendered the labels at 7.6px and a phone at 2.8px.
 *
 * So the gutter now fits the longest string that exists, the wide box is 700
 * units rather than 1200 — and capped, so it stops growing once it is big
 * enough — and narrow screens get the five stacked as rows instead of the same
 * drawing shrunk past reading. Verified at 320, 375, 768, 1024 and 1440.
 */
type Layout = "wide" | "narrow";

const LABEL = { wide: 13, narrow: 14 } as const;
const ENFORCE = { wide: 10.5, narrow: 11 } as const;

function Scene({ layout }: { layout: Layout }) {
  const { ref, play, d } = useScene();
  const wide = layout === "wide";

  /*
    The gutter is set from the widest label that exists — 221 units at size 13,
    measured, not guessed. An invariant added later must be checked against it:
    the only thing that catches an overflow here is a human eye, and it missed
    this one for as long as the drawing existed.
  */
  const X0 = wide ? 260 : 0;
  const X1 = wide ? 640 : 232;
  const rowY = (i: number) => (wide ? 50 : 44) + i * (wide ? 72 : 94);

  return (
    <svg
      ref={ref}
      viewBox={wide ? "0 0 700 380" : "0 0 300 520"}
      preserveAspectRatio="xMidYMin meet"
      className="h-full w-full"
      role="img"
      aria-label="Five invariants, each struck at a different point and each holding"
      fill="none"
      strokeLinecap="round"
    >
      {INVARIANTS.map((inv, i) => {
        const y = rowY(i);
        const strike = X0 + inv.at * (X1 - X0);
        const line = `M${X0} ${y} H${X1}`;
        /*
          Wide puts the naming to the left of the line it names. Narrow has no
          left to put it in, so the label sits beneath its own line instead —
          the strike still arrives from above and still stops, which is the
          claim; only the reading order changes.
        */
        const labelX = wide ? X0 - 14 : X0;
        const labelAnchor = wide ? "end" : "start";
        const labelY = wide ? y - 8 : y + 22;
        const enforceY = wide ? y + 10 : y + 40;

        return (
          <g key={inv.label}>
            <motion.text
              x={labelX}
              y={labelY}
              fontSize={LABEL[layout]}
              textAnchor={labelAnchor}
              fill={accentInk(inv.accent)}
              letterSpacing="0.04em"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
            >
              {inv.label}
            </motion.text>
            <motion.text
              x={labelX}
              y={enforceY}
              fontSize={ENFORCE[layout]}
              textAnchor={labelAnchor}
              fill="rgba(255,255,255,0.3)"
              fontFamily="monospace"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            >
              {inv.enforcement}
            </motion.text>

            {/* The guarantee, unbroken end to end. */}
            <motion.path
              d={line}
              stroke={accentColor(inv.accent, 0.45)}
              strokeWidth={1.4}
              {...d(0.2 + i * 0.12, 1)}
            />

            {/*
              The attack. It arrives from above, meets the line, and stops —
              the line does not break, which is the entire claim. A diagram
              where the strike passed through would be drawing the failure this
              page exists to say does not happen.
            */}
            <motion.path
              d={`M${strike} ${y - 34} V ${y - 9}`}
              stroke={accentColor("failed", 0.7)}
              strokeWidth={1.6}
              strokeDasharray="3 4"
              {...d(1.4 + i * 0.22, 0.35)}
            />
            <motion.circle
              cx={strike}
              cy={y}
              r={5.5}
              fill="none"
              stroke={accentColor("failed", 0.9)}
              strokeWidth={1.8}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 1.75 + i * 0.22 }}
              style={{ transformOrigin: `${strike}px ${y}px` }}
            />

            {/* Traffic keeps flowing straight through the point of impact. */}
            <Pulse d={line} accent={inv.accent} play={play} delay={2.4 + i * 0.4} duration={3.4} r={3.2} />

            <motion.text
              x={X1 + 14}
              y={y + 4}
              fontSize={11}
              letterSpacing="0.12em"
              fill={accentInk(inv.accent)}
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.5, delay: 2 + i * 0.22 }}
            >
              HELD
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}

export function InvariantsBackdrop() {
  return (
    <>
      {/*
        Both render and CSS picks one, as elsewhere — choosing from a media
        query in JavaScript either mismatches what the server sent or flashes
        the wrong arrangement on first paint. The hidden one never intersects
        the viewport, so its scene never plays.

        The cap keeps the wide drawing from inflating on a large display: the
        hero is full-bleed, so without it the type would keep growing with the
        window long after it stopped needing to.
      */}
      <div className="hidden h-full md:block">
        <div className="mx-auto h-full max-w-[820px]">
          <Scene layout="wide" />
        </div>
      </div>
      <div className="mx-auto h-full max-w-[340px] md:hidden">
        <Scene layout="narrow" />
      </div>
    </>
  );
}
