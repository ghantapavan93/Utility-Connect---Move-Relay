"use client";

import Link from "next/link";
import { motion } from "framer-motion";

import { useScene, Pulse, n } from "@/components/diagram/primitives";

/**
 * What the engine guarantees, said in one industry's own vocabulary.
 *
 * Every industry page sold the concierge and none of them said what was
 * underneath it. A broker read the value proposition, saw four benefits and a
 * branded microsite, and left knowing nothing about why a referral handed to
 * this system behaves differently from a referral handed to any other. The
 * thing that is actually defensible was the one thing the page did not mention.
 *
 * The drawing is the same constellation used everywhere else — sources converge
 * into one canonical record — with the labels changed to this industry's words.
 * That is the point being made visually as well as in prose: it is one engine,
 * and the industry page is a lens on it, not a separate product.
 *
 * The accent is inherited. These pages override `--color-state-verified` to the
 * industry's colour, so the converging lines and the record take that colour
 * without this component knowing which industry it is on.
 */

interface Props {
  moment: string;
  risk: string;
  guarantee: string;
  /** This industry's word for the party sending the handoff. */
  actor: string;
}

/** Three channels arriving, as everywhere else in the app. */
const SOURCES = ["Your handoff", "The customer", "The provider"];

/**
 * Two geometries for one drawing.
 *
 * An SVG does not reflow — it scales, and scaling shrinks type. Drawn once at
 * 620 units across, this was handed 278px on a 375px phone and rendered every
 * label between 5.4 and 6.7 physical pixels. The information was present and
 * nobody could read it, which is the worst of both outcomes: the cost of
 * drawing it and none of the benefit.
 *
 * So narrow screens get a genuinely different arrangement rather than the same
 * one made smaller — sources stacked, converging downward into a record beneath
 * them. Each geometry is sized to the width it is actually handed, verified at
 * 320, 375, 768, 1024 and 1440, so the smallest label clears ten physical
 * pixels everywhere. Both render; CSS picks one.
 */
type Layout = "wide" | "tall";

const GEOMETRY = {
  /*
    460 units, not the 620 this started at. The SVG's width is not monotonic in
    the viewport: stacked at tablet it gets ~640px, then the grid splits at `lg`
    and it drops to ~427px — narrower than tablet, on a bigger screen. Because
    the page is capped at `max-w-5xl`, that half-column never exceeds ~460px no
    matter how wide the display gets, so 620 units meant a permanent 0.69 scale
    and 8.3px labels on every desktop. The box is now sized to the space that
    actually exists.
  */
  wide: {
    viewBox: "0 0 460 300",
    sourceX: 118,
    sourceY: (i: number) => 60 + i * 90,
    recordL: 250,
    recordW: 210,
    recordT: 104,
    recordH: 92,
    /** Where the converging lines terminate. */
    joinX: 244,
    joinY: 150,
    titleY: 142,
    subY: 168,
    attrLabelY: 228,
    attrValueY: 248,
  },
  /*
    260 units for the same reason, measured against a 320px phone rather than a
    375px one. At 340 units the narrowest handset still in use rendered the
    smallest label at 8.1px. The font sizes are shared with the wide geometry,
    so shrinking the box is what makes the type larger relative to it — which
    means every coordinate here is recomputed against the real string widths,
    not scaled down from the previous values.
  */
  tall: {
    viewBox: "0 0 260 380",
    sourceX: 100,
    sourceY: (i: number) => 40 + i * 52,
    recordL: 28,
    recordW: 210,
    recordT: 192,
    recordH: 72,
    joinX: 133,
    joinY: 186,
    titleY: 224,
    subY: 248,
    attrLabelY: 300,
    attrValueY: 322,
  },
} as const satisfies Record<Layout, unknown>;

function Constellation({ actor, layout }: { actor: string; layout: Layout }) {
  const { ref, play, d } = useScene();
  const g = GEOMETRY[layout];
  const cx = g.recordL + g.recordW / 2;

  return (
    <svg
      ref={ref}
      viewBox={g.viewBox}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      role="img"
      aria-label={`Three sources converging into one record, with ${actor} attribution carried through`}
      fill="none"
      strokeLinecap="round"
    >
      {SOURCES.map((label, i) => {
        const y = g.sourceY(i);
        const startX = g.sourceX + 12;
        /*
          A curve, not a straight line — the same bezier the home page and the
          demo use. Matching the shape is what makes a reviewer recognise this
          as one system across nine pages.

          The tall variant needs its own control points rather than the wide
          ones rescaled. Its stacked sources sit only 22 units left of the join
          but up to 198 above it, so every line is almost vertical — routed like
          the wide ones they collapsed onto a single column and read as one
          thick stroke rather than three channels meeting. Bowing each one right
          by a different amount nests them instead: they stay distinct the whole
          way down and arrive at the junction from three angles, which is what
          "three become one" has to look like.
        */
        const bow = 200 - i * 15;
        const path =
          layout === "wide"
            ? `M${startX} ${y} C ${n(180)} ${n(y)}, ${n(215)} ${n(g.joinY)}, ${g.joinX} ${g.joinY}`
            : `M${startX} ${y} C ${n(bow)} ${n(y)}, ${n(bow)} ${n((y + g.joinY) / 2)}, ${g.joinX} ${g.joinY}`;
        const verified = i !== 1;
        return (
          <g key={label}>
            <motion.text
              x={g.sourceX}
              y={y + 5}
              fontSize={15}
              textAnchor="end"
              fill="var(--color-text-mid)"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.12 }}
            >
              {label}
            </motion.text>

            {/*
              The middle source is dashed. One channel always disagrees — that
              is the demo, and drawing three clean agreeing lines would
              illustrate a system that has never been tested.

              It cannot be drawn with `d()` like its neighbours. Framer animates
              `pathLength` by writing `stroke-dasharray` itself, which silently
              overwrote the dash and rendered the conflict line identical to the
              verified ones. So this one draws by marching its dash offset to
              zero instead: same arrival, same timing, and the dash survives to
              rest.
            */}
            {verified ? (
              <motion.path
                d={path}
                stroke="color-mix(in oklab, var(--color-state-verified) 62%, transparent)"
                strokeWidth={1.5}
                {...d(0.25 + i * 0.14, 1)}
              />
            ) : (
              <motion.path
                d={path}
                stroke="var(--color-state-conflict)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                initial={{ strokeDashoffset: 560, opacity: 0 }}
                animate={play ? { strokeDashoffset: 0, opacity: 1 } : { strokeDashoffset: 560, opacity: 0 }}
                transition={{ duration: 1, delay: 0.25 + i * 0.14, ease: "easeOut" }}
              />
            )}

            <Pulse d={path} accent={verified ? "verified" : "conflict"} play={play} delay={1.5 + i * 0.5} duration={3.2} r={3} />
          </g>
        );
      })}

      {/* The canonical record. */}
      <motion.rect
        x={g.recordL}
        y={g.recordT}
        width={g.recordW}
        height={g.recordH}
        rx={14}
        stroke="var(--color-state-verified)"
        strokeWidth={1.6}
        fill="color-mix(in oklab, var(--color-state-verified) 8%, transparent)"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.1 }}
      />
      <motion.text
        x={cx}
        y={g.titleY}
        fontSize={15}
        textAnchor="middle"
        fill="var(--color-state-verified)"
        letterSpacing="0.1em"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
      >
        ONE MOVE RECORD
      </motion.text>
      <motion.text
        x={cx}
        y={g.subY}
        fontSize={12.5}
        textAnchor="middle"
        fill="var(--color-text-lo)"
        fontFamily="monospace"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.45 }}
      >
        every field knows its source
      </motion.text>

      {/*
        Attribution sits beneath the record rather than inside it. As a third
        line in the box, "attributed to transaction coordinators" was wider than
        the box itself on the longest industries. Split across two lines
        underneath, every name fits without the box having to grow for the worst
        case.
      */}
      <motion.text
        x={cx}
        y={g.attrLabelY}
        fontSize={12}
        textAnchor="middle"
        fill="var(--color-text-lo)"
        letterSpacing="0.16em"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.55 }}
      >
        ATTRIBUTED TO
      </motion.text>
      <motion.text
        x={cx}
        y={g.attrValueY}
        fontSize={14}
        textAnchor="middle"
        fill="var(--color-state-verified)"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.65 }}
      >
        {actor}
      </motion.text>
    </svg>
  );
}

export function RelayForIndustry({ moment, risk, guarantee, actor }: Props) {
  return (
    <section className="mt-16">
      <div
        className="overflow-hidden rounded-3xl border"
        style={{
          borderColor: "color-mix(in oklab, var(--color-state-verified) 22%, transparent)",
          background: "color-mix(in oklab, var(--color-state-verified) 4%, transparent)",
        }}
      >
        <div className="grid gap-0 lg:grid-cols-[1fr_1.05fr]">
          <div className="p-6 sm:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-state-verified)" }}>
              What happens at the handoff
            </p>

            <p className="mt-4 text-xl font-semibold leading-snug" style={{ color: "var(--color-text-hi)" }}>
              {moment}
            </p>

            <div className="mt-6 space-y-5 text-sm leading-relaxed">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                  What usually goes wrong
                </p>
                <p className="mt-1.5" style={{ color: "var(--color-text-mid)" }}>
                  {risk}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-state-verified)" }}>
                  What this guarantees instead
                </p>
                <p className="mt-1.5" style={{ color: "var(--color-text-mid)" }}>
                  {guarantee}
                </p>
              </div>
            </div>

            {/*
              The claim above is checkable, so the page says where. An industry
              page that asserts a guarantee and offers no way to test it is
              marketing; one that hands you the console is evidence.

              `min-h-11` is the 44px touch target. Padding alone gave these 36px
              and 38px, which is comfortable with a mouse and a miss with a
              thumb.
            */}
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="inline-flex min-h-11 items-center rounded-full px-5 text-xs font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
                style={{ background: "var(--color-state-verified)", color: "white" }}
              >
                Watch it run
              </Link>
              <Link
                href="/reliability"
                className="inline-flex min-h-11 items-center rounded-full border px-5 text-xs font-semibold uppercase tracking-wide transition-colors"
                style={{
                  borderColor: "color-mix(in oklab, var(--color-state-verified) 40%, transparent)",
                  color: "var(--color-state-verified)",
                }}
              >
                See what holds it up
              </Link>
            </div>
          </div>

          <div
            className="border-t p-5 sm:p-8 lg:border-l lg:border-t-0"
            style={{ borderColor: "color-mix(in oklab, var(--color-state-verified) 16%, transparent)" }}
          >
            {/*
              Both geometries render; CSS picks one. Choosing in JavaScript from
              a media query would either mismatch what the server rendered or
              flash the wrong one on first paint. The hidden SVG never
              intersects the viewport, so its scene never plays.
            */}
            <div className="mx-auto hidden max-w-[500px] sm:block sm:h-full">
              <Constellation actor={actor} layout="wide" />
            </div>
            <div className="mx-auto max-w-[260px] sm:hidden">
              <Constellation actor={actor} layout="tall" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
