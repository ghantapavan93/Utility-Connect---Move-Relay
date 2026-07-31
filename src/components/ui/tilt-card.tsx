"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";
import { asRoute } from "@/lib/routes";

/**
 * A card that tilts toward the pointer.
 *
 * Rotation is driven from the pointer's position within the card, normalised to
 * ±1 on each axis and put through a spring, so the card follows a hand rather
 * than snapping to a target. Springs matter more here than anywhere else on the
 * page: a tilt that eases to a stop reads as a mechanism, and a tilt that
 * settles reads as an object.
 *
 * The angles are deliberately small. Most implementations of this run to 15° or
 * more, which throws the type badly out of plane and makes a card of prose
 * genuinely harder to read. Seven degrees is enough to see depth and not enough
 * to fight the text.
 *
 * `transformPerspective` sits on the card, not on a wrapper. Perspective on an
 * ancestor is shared by every child that uses it, so a grid of these would all
 * converge on one vanishing point somewhere off to the side, and cards away
 * from the centre would shear instead of tilt.
 *
 * Under stillness there is no tilt at all — this is motion whose entire purpose
 * is the sensation of motion, so a reduced version of it would be pointless.
 * The hover state still changes; it just changes flat.
 */

const MAX_DEG = 7;

export function TiltCard({
  href,
  title,
  body,
  cta = "Open",
}: {
  href: string;
  title: string;
  body: string;
  cta?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const still = useStillness();

  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [-1, 1], [MAX_DEG, -MAX_DEG]), spring);
  const rotateY = useSpring(useTransform(px, [-1, 1], [-MAX_DEG, MAX_DEG]), spring);

  const track = (e: React.MouseEvent) => {
    if (still) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Normalised to ±1 from the card's own centre, so the tilt is identical on
    // a narrow card and a wide one.
    px.set(((e.clientX - r.left) / r.width) * 2 - 1);
    py.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };

  const release = () => {
    setHovered(false);
    px.set(0);
    py.set(0);
  };

  return (
    /*
      The wrapper tilts and a plain `Link` fills it, rather than making the
      anchor itself a motion component. Wrapping `Link` in `motion()` costs its
      prefetching, and `legacyBehavior` is on its way out; this keeps both the
      transform and the router behaviour without either compromise.
    */
    <motion.div
      ref={ref}
      onMouseMove={track}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={release}
      className="h-full"
      style={{
        rotateX: still ? 0 : rotateX,
        rotateY: still ? 0 : rotateY,
        transformPerspective: 900,
        transformStyle: "preserve-3d",
      }}
    >
    <Link
      href={asRoute(href)}
      onFocus={() => setHovered(true)}
      onBlur={release}
      className="group relative block h-full rounded-xl border p-5"
      style={{
        borderColor: hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
        background: "var(--uc-navy-2)",
        boxShadow: hovered ? "0 22px 44px -26px rgba(0,135,181,0.85)" : "none",
        transition: "border-color 200ms var(--ease-out-relay), box-shadow 240ms var(--ease-out-relay)",
      }}
    >
      {/*
        The rule that already marks every heading on this site, doubling here as
        the card's icon. It inverts on hover — cyan bar to white bar — which is
        the one place white is allowed to outrank the verified colour, because
        here it means "this is the card you are about to open".
      */}
      <div
        aria-hidden
        className="mb-2 h-1 rounded-full transition-[width,background] duration-200"
        style={{
          width: hovered ? 34 : 22,
          background: hovered ? "#ffffff" : "var(--color-state-verified)",
        }}
      />
      <h3 className="mb-1 text-sm font-bold text-white">{title}</h3>
      <p className="text-xs leading-relaxed text-white/60">{body}</p>

      <span
        className="relative mt-3 inline-flex items-center gap-1.5 text-xs font-bold"
        style={{ color: "var(--color-state-verified)" }}
      >
        {cta}
        <span
          aria-hidden
          className="inline-block transition-transform duration-200"
          style={{ transform: hovered && !still ? "translateX(3px)" : "none" }}
        >
          →
        </span>
        {/* Underline drawn under the link text only, not the arrow, so it reads
            as an underline rather than as a second rule. */}
        <span
          aria-hidden
          className="absolute -bottom-0.5 left-0 h-px transition-[width] duration-200"
          style={{
            width: hovered ? "calc(100% - 14px)" : 0,
            background: "var(--color-state-verified)",
          }}
        />
      </span>
    </Link>
    </motion.div>
  );
}
