"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { useScene, Pulse } from "@/components/diagram/primitives";

/**
 * Canonical record → relationship gate → purpose-built view.
 *
 * This replaced three static cards headed Purpose, Proof and Code. They named
 * the parts of the work rather than the problem, and nothing about their
 * arrangement said the three were causally linked. They are: the record is what
 * exists, the gate decides who may ask, and the view is what that decision
 * permits to leave the server.
 *
 * The middle stage is the one worth drawing. A field stream approaches a
 * boundary; some fields cross and some stop, and the ones that stop are still
 * there — on the server, where they always were. That is the difference between
 * a projection and a filter, and it is the difference this page exists to make
 * visible.
 *
 * Every glyph is textless. An SVG scales rather than reflows, so type inside one
 * shrinks with its container — the fault that rendered a hero's labels at 2.8px
 * on a phone. Prose lives in the grid where it wraps.
 */

const W = 220;
const H = 64;

/** 01 — many sources converge into one record. */
function CanonicalGlyph() {
  const { ref, play, d } = useScene();
  const lanes = [14, 32, 50];

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" fill="none" strokeLinecap="round" aria-hidden>
      {lanes.map((y, i) => {
        const path = `M6 ${y} C 60 ${y}, 90 32, 140 32`;
        return (
          <g key={y}>
            <motion.path
              d={path}
              stroke={accentColor("verified", 0.5)}
              strokeWidth={1.3}
              {...d(0.1 + i * 0.12, 0.7)}
            />
            <Pulse d={path} accent="verified" play={play} delay={0.8 + i * 0.3} duration={2.6} r={2.4} />
          </g>
        );
      })}
      {/* One record. Filled, because it is the thing that actually exists. */}
      <motion.rect
        x={148}
        y={18}
        width={54}
        height={28}
        rx={6}
        stroke={accentColor("verified", 0.95)}
        strokeWidth={1.6}
        fill={accentColor("verified", 0.14)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      />
    </svg>
  );
}

/**
 * 02 — the gate reads who is asking.
 *
 * Purple, because in this project's palette that means a decision under human
 * or policy control rather than a mechanical outcome. The relationship check is
 * exactly that: a rule about responsibility, not a computation on the data.
 */
function GateGlyph() {
  const { ref, play, d, still } = useScene();
  const shut = play || still;

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" fill="none" strokeLinecap="round" aria-hidden>
      {/* The request, arriving. */}
      <motion.path d="M6 32 H92" stroke={accentColor("security", 0.85)} strokeWidth={1.5} {...d(0.1, 0.6)} />

      {/* The boundary it has to satisfy. */}
      <path d="M104 6 V58" stroke="rgba(255,255,255,0.28)" strokeWidth={1.4} strokeDasharray="3 5" />

      {/* Two leaves meeting: a decision taken, not a fact of the diagram. */}
      {[`M104 6 V28`, `M104 58 V36`].map((leaf) => (
        <motion.path
          key={leaf}
          d={leaf}
          stroke={accentColor("security", 1)}
          strokeWidth={2.6}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: shut ? 1 : 0 }}
          transition={{ duration: still ? 0 : 0.4, delay: still ? 0 : 0.5 }}
        />
      ))}

      {/* Beyond it, nothing has been decided yet. */}
      <motion.path
        d="M116 32 H214"
        stroke="rgba(255,255,255,0.16)"
        strokeWidth={1.2}
        strokeDasharray="3 5"
        {...d(0.9, 0.5)}
      />
    </svg>
  );
}

/**
 * 03 — some fields cross, some stay.
 *
 * The withheld rows do not vanish. They stop at the boundary and remain drawn,
 * because the claim is that they never left the server — not that they ceased
 * to exist. A glyph that erased them would be illustrating deletion.
 */
function ProjectionGlyph() {
  const { ref, play, d, still } = useScene();
  const rows = [12, 26, 40, 54];
  const crosses = [true, true, false, true];

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" fill="none" strokeLinecap="round" aria-hidden>
      <path d="M96 4 V60" stroke="rgba(255,255,255,0.28)" strokeWidth={1.4} strokeDasharray="3 5" />

      {rows.map((y, i) => {
        const through = crosses[i]!;
        return (
          <g key={y}>
            <motion.path
              d={`M8 ${y} H${through ? 88 : 84}`}
              stroke={accentColor(through ? "verified" : "conflict", 0.75)}
              strokeWidth={1.4}
              {...d(0.12 + i * 0.1, 0.5)}
            />
            {through ? (
              <motion.path
                d={`M104 ${y} H212`}
                stroke={accentColor("verified", 0.9)}
                strokeWidth={1.4}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: play || still ? 1 : 0 }}
                transition={{ duration: still ? 0 : 0.5, delay: still ? 0 : 0.7 + i * 0.1 }}
              />
            ) : (
              /* Held back: a stop mark, and the lane beyond stays empty. */
              <motion.circle
                cx={90}
                cy={y}
                r={3.4}
                stroke={accentColor("conflict", 1)}
                strokeWidth={1.6}
                initial={{ opacity: 0 }}
                animate={{ opacity: play || still ? 1 : 0 }}
                transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.8 }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

const STAGES = [
  {
    n: "01",
    title: "Canonical move",
    body: "One record holds the verified move state, its provenance, consent, provider operations and audit context.",
    tint: "verified" as const,
    Glyph: CanonicalGlyph,
  },
  {
    n: "02",
    title: "Relationship gate",
    body: "The server decides who is asking and how they are connected to this move, before any view is built.",
    tint: "security" as const,
    Glyph: GateGlyph,
  },
  {
    n: "03",
    title: "Purpose-built view",
    body: "Only the fields that audience needs cross the boundary. The rest stay where they were.",
    tint: "verified" as const,
    Glyph: ProjectionGlyph,
  },
];

export function ProjectionRail() {
  return (
    <section
      aria-label="Canonical move, relationship gate, purpose-built view"
      className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8"
    >
      <div
        className="grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.06)" }}
      >
        {STAGES.map(({ n, title, body, tint, Glyph }) => (
          <div key={n} className="min-w-0 bg-[#04070b] p-6 sm:p-7">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[11px] font-bold tracking-[0.18em]" style={{ color: accentInk(tint) }}>
                {n}
              </span>
              <h3 className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/90">{title}</h3>
            </div>
            <div className="mt-4">
              <Glyph />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/60">{body}</p>
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
        The browser cannot expose what it never received.
      </p>
    </section>
  );
}
