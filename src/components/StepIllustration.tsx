"use client";

import { motion } from "framer-motion";
import { useStillness } from "@/lib/use-stillness";

/**
 * Line illustrations for the "how it works" steps.
 *
 * Utility Connect's own page carries one large custom illustration per step —
 * navy outline, cyan fill, generous scale — and that single choice is most of
 * why their section reads as finished while a numbered list reads as a wireframe.
 * Ours had a small numeral in a circle above a text card. Same information,
 * nothing to look at.
 *
 * These are drawn here rather than taken from them. Same visual language —
 * 2px navy stroke, round caps and joins, flat cyan fills, one idea per frame —
 * applied to our own subjects. Matching an art direction is legitimate; copying
 * the assets that express it is not, and the difference is the whole reason
 * this file exists instead of a download.
 *
 * Each draws itself on scroll: the outline strokes on, then the fills arrive.
 * The stroke-drawing is why they are inline SVG and not raster assets — a
 * bitmap can fade in, but it cannot be drawn.
 */

const NAVY = "var(--uc-navy-1, #1a2128)";
const CYAN = "var(--color-state-verified, #0087b5)";

type Kind = "enrollment" | "compare" | "handled" | "refer" | "brand" | "track";

/** Stroke that draws itself once, in view. */
function Draw({
  d,
  delay = 0,
  still,
  ...rest
}: { d: string; delay?: number; still: boolean } & React.SVGProps<SVGPathElement>) {
  if (still) return <path d={d} fill="none" strokeWidth={2} {...rest} />;
  return (
    <motion.path
      d={d}
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ pathLength: { duration: 1, delay, ease: "easeInOut" }, opacity: { duration: 0.2, delay } }}
      {...(rest as object)}
    />
  );
}

/** Flat shape that arrives after the outline that contains it. */
function Fill({
  delay = 0,
  still,
  children,
}: {
  delay?: number;
  still: boolean;
  children: React.ReactNode;
}) {
  if (still) return <g>{children}</g>;
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-15% 0px" }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{ transformOrigin: "center" }}
    >
      {children}
    </motion.g>
  );
}

export function StepIllustration({ kind, className }: { kind: Kind; className?: string }) {
  const still = useStillness();
  const common = { stroke: NAVY, still } as const;

  return (
    <svg
      viewBox="0 0 160 120"
      className={className}
      role="img"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      {kind === "enrollment" && (
        <>
          {/* A form on a screen, with fields being ticked off. */}
          <Draw {...common} d="M24 20h112a6 6 0 0 1 6 6v58a6 6 0 0 1-6 6H24a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6Z" />
          <Draw {...common} delay={0.3} d="M62 90v10M98 90v10M56 100h48" />
          <Fill delay={0.8} still={still}>
            <rect x={32} y={32} width={62} height={16} rx={3} fill={CYAN} opacity={0.9} />
            <rect x={32} y={56} width={40} height={5} rx={2.5} fill={NAVY} opacity={0.25} />
            <rect x={32} y={68} width={54} height={5} rx={2.5} fill={NAVY} opacity={0.25} />
          </Fill>
          <Fill delay={1} still={still}>
            {[104, 118].map((x, i) => (
              <g key={x}>
                <rect x={x} y={56} width={14} height={14} rx={3} fill={CYAN} opacity={i ? 0.45 : 0.9} />
                <path d={`M${x + 3.5} 63l3 3 5-6`} stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ))}
          </Fill>
        </>
      )}

      {kind === "compare" && (
        <>
          {/* Options weighed against one another, one chosen. */}
          <Draw {...common} d="M28 96V44a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v52" />
          <Draw {...common} delay={0.2} d="M68 96V30a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v66" />
          <Draw {...common} delay={0.4} d="M108 96V52a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v44" />
          <Draw {...common} delay={0.6} d="M18 96h128" />
          <Fill delay={1} still={still}>
            <rect x={68} y={26} width={32} height={70} rx={4} fill={CYAN} opacity={0.9} />
            <circle cx={84} cy={16} r={9} fill={CYAN} />
            <path d="M79.5 16.5l3 3 6-6.5" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Fill>
        </>
      )}

      {kind === "handled" && (
        <>
          {/* A house, switched on. */}
          <Draw {...common} d="M80 22 24 62v44a6 6 0 0 0 6 6h100a6 6 0 0 0 6-6V62L80 22Z" />
          <Draw {...common} delay={0.4} d="M64 112V78h32v34" />
          <Fill delay={0.9} still={still}>
            <rect x={64} y={78} width={32} height={34} rx={3} fill={CYAN} opacity={0.9} />
            <circle cx={90} cy={95} r={2} fill="#fff" />
          </Fill>
          <Fill delay={1.05} still={still}>
            {[
              [40, 70],
              [110, 70],
            ].map(([x, y]) => (
              <rect key={x} x={x} y={y} width={18} height={14} rx={3} fill={CYAN} opacity={0.4} />
            ))}
          </Fill>
        </>
      )}

      {kind === "refer" && (
        <>
          {/* One hand to another — a referral passing across. */}
          <Draw {...common} d="M34 60a16 16 0 1 1 32 0 16 16 0 0 1-32 0Z" />
          <Draw {...common} delay={0.25} d="M94 60a16 16 0 1 1 32 0 16 16 0 0 1-32 0Z" />
          <Draw {...common} delay={0.5} d="M70 60h20" />
          <Fill delay={0.9} still={still}>
            <path d="M84 55l8 5-8 5" fill="none" stroke={CYAN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={50} cy={60} r={9} fill={CYAN} opacity={0.9} />
            <circle cx={110} cy={60} r={9} fill={CYAN} opacity={0.45} />
          </Fill>
        </>
      )}

      {kind === "brand" && (
        <>
          {/* A microsite carrying someone else's mark. */}
          <Draw {...common} d="M26 26h108a6 6 0 0 1 6 6v56a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V32a6 6 0 0 1 6-6Z" />
          <Draw {...common} delay={0.35} d="M20 46h120" />
          <Fill delay={0.85} still={still}>
            <circle cx={32} cy={36} r={3.5} fill={NAVY} opacity={0.3} />
            <circle cx={44} cy={36} r={3.5} fill={NAVY} opacity={0.3} />
            <rect x={34} y={58} width={44} height={28} rx={4} fill={CYAN} opacity={0.9} />
            <rect x={88} y={58} width={38} height={6} rx={3} fill={NAVY} opacity={0.25} />
            <rect x={88} y={72} width={28} height={6} rx={3} fill={NAVY} opacity={0.25} />
          </Fill>
        </>
      )}

      {kind === "track" && (
        <>
          {/* Progress, visible while it happens. */}
          <Draw {...common} d="M24 92h112" />
          <Draw {...common} delay={0.2} d="M24 92V34" />
          <Draw {...common} delay={0.45} d="M32 78l26-22 24 16 30-34" />
          <Fill delay={1} still={still}>
            {[
              [32, 78],
              [58, 56],
              [82, 72],
              [112, 38],
            ].map(([x, y], i) => (
              <circle key={x} cx={x} cy={y} r={5} fill={CYAN} opacity={i === 3 ? 1 : 0.55} />
            ))}
          </Fill>
        </>
      )}
    </svg>
  );
}
