"use client";

import { motion, useInView } from "framer-motion";
import { useRef, type ReactNode } from "react";

import { accentColor, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * The shared vocabulary every animated diagram in this project draws with.
 *
 * Extracted from the Continuum scenes when the architecture page needed the
 * same marks. Two copies would have been the faster move and the wrong one:
 * these are not utilities, they are the *meaning* — a line that draws itself
 * once, a pulse that says the thing recurs, a record at the centre. A second
 * copy drifts, and then a solid line means one thing on one page and something
 * slightly different on another.
 *
 * The design system's line states hold throughout: solid is verified, dashed is
 * pending, amber needs judgement, a red break is a failure, a rejoin is a
 * recovery, a violet lock is human approval required.
 */

export const VB = { w: 420, h: 260 };

/**
 * Round every computed coordinate to two decimals.
 *
 * Not cosmetic. `Math.sin` and `Math.cos` return full-precision doubles, and
 * Node and the browser do not always render the last digit identically — the
 * server emitted `height="23.726076813259642"` where the client computed
 * `23.72607681325964`, and React reported a hydration mismatch across the whole
 * tree. Two decimals is far finer than a pixel at this viewBox and makes both
 * sides produce the same string.
 */
export const n = (v: number) => Math.round(v * 100) / 100;

/**
 * Draw a path on, once its scene is on screen.
 *
 * An earlier version had the same object in both branches of its ternary and
 * varied only the duration — so before a scene scrolled into view it animated
 * to the *finished* state in zero seconds. Every diagram was fully drawn on
 * mount with nothing left to do by the time anyone reached it, and the bug was
 * invisible in a screenshot because a finished drawing looks exactly like a
 * drawing that never moved.
 */
const draw = (play: boolean, delay = 0, duration = 0.9) => {
  const hidden = { pathLength: 0, opacity: 0 };
  const shown = { pathLength: 1, opacity: 1 };
  return {
    initial: hidden,
    animate: play ? shown : hidden,
    transition: { duration, delay, ease: [0.16, 1, 0.3, 1] as const },
  };
};

/**
 * The finished drawing, immediately, for reduced motion.
 *
 * The information is the point; withholding it from someone who asked for no
 * animation would be the wrong reading of the request.
 */
const drawStill = { initial: false as const, animate: { pathLength: 1, opacity: 1 } };

/**
 * Scene state, plus a `d` bound to it.
 *
 * The draw helper is handed back bound rather than exported loose because it
 * needs *both* flags — in-view and stillness — and a caller passing only one is
 * exactly how a page of diagrams ends up static.
 */
export function useScene() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const still = useStillness();
  const play = inView && !still;
  const d = (delay = 0, duration = 0.9) => (still ? drawStill : draw(play, delay, duration));
  return { ref, play, still, d };
}

/**
 * A dot travelling the length of a path, forever.
 *
 * This is what makes a diagram read as a process rather than a picture. The
 * draw-in happens once and the scene is then finished; a pulse that keeps
 * moving says the thing being drawn is something that *happens*.
 *
 * `offsetPath` rather than animated `cx`/`cy`: the browser does the arc-length
 * maths, the motion stays on the compositor, and the same path string that
 * draws the line drives the dot along it — so the two can never disagree about
 * where the line goes.
 */
export function Pulse({
  d,
  accent,
  delay = 0,
  duration = 2.6,
  play,
  r = 2.6,
}: {
  d: string;
  accent: Accent;
  delay?: number;
  duration?: number;
  play: boolean;
  r?: number;
}) {
  // Under stillness there is no pulse at all. A dot orbiting forever is the
  // least welcome thing to put in front of someone who asked for calm.
  if (!play) return null;
  return (
    <motion.circle
      r={r}
      fill={accentColor(accent, 1)}
      style={{ offsetPath: `path("${d}")`, offsetRotate: "0deg" }}
      initial={{ offsetDistance: "0%", opacity: 0 }}
      animate={{ offsetDistance: "100%", opacity: [0, 1, 1, 0] }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        // A gap between passes, so the eye reads discrete arrivals rather than
        // a conveyor belt. Continuous motion stops being informative.
        repeatDelay: 0.9,
        ease: "easeInOut",
        times: [0, 0.12, 0.85, 1],
      }}
    />
  );
}

export function Frame({
  children,
  label,
  svgRef,
}: {
  children: ReactNode;
  label: string;
  svgRef: React.Ref<SVGSVGElement>;
}) {
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      className="h-full w-full"
      role="img"
      aria-label={label}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** The canonical record: the one mark that recurs across every diagram. */
export function Record({
  x,
  y,
  accent = "verified" as Accent,
  r = 15,
}: {
  x: number;
  y: number;
  accent?: Accent;
  r?: number;
}) {
  return (
    <>
      <circle cx={x} cy={y} r={r} fill={accentColor(accent, 0.14)} stroke={accentColor(accent, 0.9)} strokeWidth={1.6} />
      <circle cx={x} cy={y} r={r * 0.3} fill={accentColor(accent, 1)} />
    </>
  );
}

/** A refusal: the mark that means the system said no, and meant it. */
export function Refused({
  x,
  y,
  play,
  delay = 1,
  size = 9,
}: {
  x: number;
  y: number;
  play: boolean;
  delay?: number;
  size?: number;
}) {
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay }}
      style={{ transformOrigin: `${x}px ${y}px` }}
    >
      <path
        d={`M${x - size} ${y - size} L${x + size} ${y + size} M${x + size} ${y - size} L${x - size} ${y + size}`}
        stroke={accentColor("failed", 1)}
        strokeWidth={2.4}
      />
    </motion.g>
  );
}

/** A row, drawn as a row. Used wherever a diagram is about what the table holds. */
export function Row({
  x,
  y,
  w = 132,
  label,
  value,
  accent,
  dim = false,
}: {
  x: number;
  y: number;
  w?: number;
  label: string;
  value?: string;
  accent: Accent;
  dim?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y - 13}
        width={w}
        height={26}
        rx={5}
        fill={dim ? "rgba(255,255,255,0.03)" : accentColor(accent, 0.1)}
        stroke={dim ? "rgba(255,255,255,0.14)" : accentColor(accent, 0.6)}
        strokeWidth={1.1}
      />
      <text x={x + 9} y={y + 3.5} fontSize={7.5} fontFamily="monospace" fill={dim ? "rgba(255,255,255,0.5)" : accentColor(accent, 1)}>
        {label}
      </text>
      {value && (
        <text x={x + w - 9} y={y + 3.5} fontSize={7} textAnchor="end" fontFamily="monospace" fill="rgba(255,255,255,0.45)">
          {value}
        </text>
      )}
    </g>
  );
}
