"use client";

import { motion } from "framer-motion";

/**
 * The Handoff Constellation — 2D SVG, not 3D.
 *
 * This is the signature visual, and it is deliberately SVG rather than Three.js.
 * The design research concluded that serious operational software essentially
 * never uses 3D, and that a 3D constellation would have to render real state or
 * become exactly the decoration the design system bans. SVG carries the same
 * meaning — sources converging into one verified move, with line state encoding
 * the workflow — at a fraction of the cost, works on every device with no
 * fallback, and honours reduced-motion for free.
 *
 * Line state is the language, identical to the rest of the product:
 *   solid  = verified      dashed  = pending
 *   amber  = conflicting   grey    = in transit
 * The lines are not ornament. Each one is a real source in the demo.
 */

export interface Source {
  id: string;
  label: string;
  channel: string;
  state: "verified" | "pending" | "conflict" | "transit";
}

const COLORS: Record<Source["state"], string> = {
  verified: "var(--color-state-verified)",
  pending: "var(--color-state-pending)",
  conflict: "var(--color-state-conflict)",
  transit: "var(--color-state-transit)",
};

export function Constellation({
  sources,
  converged = false,
}: {
  sources: Source[];
  converged?: boolean;
}) {
  const cx = 300;
  const cy = 170;
  const radius = 130;

  return (
    <svg
      viewBox="0 0 600 340"
      className="w-full max-w-2xl"
      role="img"
      aria-label={`${sources.length} referral sources converging into one Move Record`}
    >
      {sources.map((s, i) => {
        const angle = (Math.PI * 2 * i) / sources.length - Math.PI / 2;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        const color = COLORS[s.state];
        const dashed = s.state === "pending";

        return (
          <g key={s.id}>
            <motion.line
              x1={x}
              y1={y}
              x2={cx}
              y2={cy}
              stroke={color}
              strokeWidth={s.state === "conflict" ? 2.5 : 1.75}
              strokeDasharray={dashed ? "5 5" : undefined}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: converged ? 0.9 : 0.55 }}
              transition={{ duration: 0.28, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.circle
              cx={x}
              cy={y}
              r={7}
              fill="var(--color-ground-2)"
              stroke={color}
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.22, delay: i * 0.06 + 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
            <text
              x={x}
              y={y - 14}
              textAnchor="middle"
              fill="var(--color-text-mid)"
              fontSize={11}
              fontWeight={500}
            >
              {s.label}
            </text>
          </g>
        );
      })}

      {/* Canonical record at the centre. Fills with the brand colour only once
          converged — verified is the one thing #0087B5 is allowed to mean. */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={converged ? 26 : 20}
        fill={converged ? "color-mix(in oklab, var(--color-state-verified) 22%, var(--color-ground-1))" : "var(--color-ground-2)"}
        stroke={converged ? "var(--color-state-verified)" : "var(--color-ground-3)"}
        strokeWidth={2.5}
        animate={{ r: converged ? 26 : 20 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--color-text-hi)" fontSize={12} fontWeight={600}>
        {converged ? "✓ Move" : "Move"}
      </text>
    </svg>
  );
}
