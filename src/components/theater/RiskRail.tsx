"use client";

import { motion } from "framer-motion";

import { accentColor } from "@/lib/accents";
import { useScene, Pulse } from "@/components/diagram/primitives";
import { RAIL } from "@/lib/theater-narrative";

/**
 * Business risk → domain invariant → persisted evidence, as one movement.
 *
 * This replaced three static cards headed Purpose, Proof and Code. They were
 * accurate and they were inert: three boxes of prose that named the parts of
 * the work rather than the problem it addresses, and nothing about their
 * arrangement said the three were causally linked. They are — the risk is why
 * the invariant exists, and the evidence is the only reason to believe the
 * invariant held — so they are drawn as one sequence that has to happen in
 * order.
 *
 * ## Text is HTML, not SVG
 *
 * Every glyph here is textless on purpose. An SVG does not reflow, it scales,
 * so type inside one shrinks with its container — the fault that rendered the
 * reliability hero's labels at 2.8px on a phone and the industries diagram's at
 * 6.7px. Prose lives in the grid where it wraps; the SVGs carry only marks,
 * whose legibility does not depend on their size. That also makes the whole
 * component responsive for free.
 */

const GLYPH_W = 200;
const GLYPH_H = 56;

/** 01 — three unsafe paths converge on a boundary, one of them turning. */
function RiskGlyph() {
  const { ref, play, d } = useScene();
  const lanes = [14, 28, 42];

  return (
    <svg ref={ref} viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`} className="h-14 w-full" fill="none" strokeLinecap="round" aria-hidden>
      {lanes.map((y, i) => {
        const path = `M4 ${y} H150`;
        /*
          The middle lane is the one that goes wrong. Three identical threats
          would read as volume; one diverging inside otherwise ordinary traffic
          is what an unsafe write actually looks like arriving.
        */
        const hostile = i === 1;
        return (
          <g key={y}>
            <motion.path
              d={path}
              stroke={accentColor(hostile ? "failed" : "conflict", hostile ? 0.9 : 0.5)}
              strokeWidth={hostile ? 1.8 : 1.2}
              {...d(0.1 + i * 0.12, 0.7)}
            />
            <Pulse d={path} accent={hostile ? "failed" : "conflict"} play={play} delay={0.9 + i * 0.35} duration={2.4} r={2.4} />
          </g>
        );
      })}
      {/* The boundary they are heading for. */}
      <motion.path
        d={`M162 6 V${GLYPH_H - 6}`}
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={1.4}
        strokeDasharray="2 4"
        {...d(0.5, 0.5)}
      />
    </svg>
  );
}

/** 02 — the gate closes across the lane and the approach stops short. */
function InvariantGlyph() {
  const { ref, play, d, still } = useScene();
  const shut = play || still;

  return (
    <svg ref={ref} viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`} className="h-14 w-full" fill="none" strokeLinecap="round" aria-hidden>
      {/* The attempt, arriving and stopping. It does not reach the far side. */}
      <motion.path d={`M4 28 H84`} stroke={accentColor("failed", 0.85)} strokeWidth={1.8} {...d(0.1, 0.5)} />
      <motion.circle
        cx={88}
        cy={28}
        r={4}
        stroke={accentColor("failed", 0.9)}
        strokeWidth={1.6}
        initial={{ opacity: 0 }}
        animate={{ opacity: shut ? 1 : 0 }}
        transition={{ duration: 0.25, delay: still ? 0 : 0.8 }}
      />

      {/*
        Two leaves meeting in the middle, not one bar appearing. A gate that
        closes is an action the system took; a bar that fades in is a fact of
        the diagram. The difference is the whole point of the stage.
      */}
      <motion.path
        d={`M100 4 V26`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2.4}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: shut ? 1 : 0 }}
        transition={{ duration: still ? 0 : 0.4, delay: still ? 0 : 0.5, ease: "easeOut" }}
      />
      <motion.path
        d={`M100 ${GLYPH_H - 4} V30`}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2.4}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: shut ? 1 : 0 }}
        transition={{ duration: still ? 0 : 0.4, delay: still ? 0 : 0.5, ease: "easeOut" }}
      />

      {/* Beyond the gate: untouched. */}
      <motion.path
        d={`M112 28 H${GLYPH_W - 6}`}
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={1.2}
        strokeDasharray="3 5"
        {...d(1, 0.5)}
      />
    </svg>
  );
}

/** 03 — rows land and resolve to committed cyan. */
function EvidenceGlyph() {
  const { ref, play, d, still } = useScene();
  const rows = [12, 24, 36, 48];

  return (
    <svg ref={ref} viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`} className="h-14 w-full" fill="none" strokeLinecap="round" aria-hidden>
      {rows.map((y, i) => (
        <g key={y}>
          <motion.path
            d={`M20 ${y} H${120 + i * 18}`}
            stroke={accentColor("verified", 0.55)}
            strokeWidth={1.3}
            {...d(0.15 + i * 0.14, 0.6)}
          />
          {/*
            The tick only resolves after its row has drawn. Evidence that
            appears at the same moment as the thing it evidences is decoration;
            arriving after is what makes it read as a return value.
          */}
          <motion.path
            d={`M6 ${y} l3.5 3.5 L16 ${y - 4}`}
            stroke={accentColor("verified", 1)}
            strokeWidth={1.8}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: play || still ? 1 : 0, opacity: play || still ? 1 : 0 }}
            transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.9 + i * 0.14 }}
          />
        </g>
      ))}
    </svg>
  );
}

const GLYPHS = [RiskGlyph, InvariantGlyph, EvidenceGlyph];
const TINTS = ["conflict", "failed", "verified"] as const;

export function RiskRail() {
  return (
    <section aria-label="Business risk, domain invariant, persisted evidence" className="mx-auto max-w-[1400px] px-5 pb-14 sm:px-8">
      <div className="grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)" }}>
        {RAIL.map((stage, i) => {
          const Glyph = GLYPHS[i]!;
          const tint = TINTS[i]!;
          return (
            <div key={stage.n} className="min-w-0 bg-[#04070b] p-6 sm:p-7">
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: accentColor(tint, 0.9) }}>
                  {stage.n}
                </span>
                <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/90">{stage.title}</h3>
              </div>
              <div className="mt-4">
                <Glyph />
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/60">{stage.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
