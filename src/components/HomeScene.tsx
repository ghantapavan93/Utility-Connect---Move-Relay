"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

/**
 * The hero image.
 *
 * Utility Connect's own hero is a photograph of a kitchen — island, stools,
 * pendants — desaturated hard and pushed under a navy wash. Their photograph is
 * theirs, so this used to be an SVG approximation of an interior standing in
 * for one, on the reasoning that a licensed photo was not ours to use.
 *
 * That reasoning is obsolete. The residence in `/story` *is* a kitchen with an
 * island, stools and pendants, so this is a still rendered straight out of it at
 * 3000×1687 — `window.__captureHero()` in development renders the scene at print
 * size and writes it to `public/renders`. Same subject as theirs, same grade,
 * entirely our own asset. The marketing hero and the 3D film now come from one
 * model, which is the honest way to match someone's art direction rather than
 * borrow it.
 *
 * The grade is half the job. Their hero is not a bright photo; it is a heavily
 * desaturated one under a blue-slate wash, and that is what lets white type sit
 * on it and what gives the brand its cool, technical register. Matching the
 * composition without matching the grade would miss most of what makes it read
 * as theirs.
 */
export function HomeScene() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        A very slow drift — enough that the hero is not a dead flat plate, small
        enough that nobody consciously registers it moving, and held completely
        still when the visitor has asked for reduced motion.
      */}
      <motion.div
        className="absolute inset-0"
        initial={reduce ? undefined : { scale: 1.06, x: "-1%" }}
        animate={reduce ? undefined : { scale: 1.12, x: "1%" }}
        transition={
          reduce ? undefined : { duration: 38, repeat: Infinity, repeatType: "reverse", ease: "linear" }
        }
      >
        <Image
          src="/renders/residence-hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ filter: "saturate(0.3) contrast(1.08) brightness(1.02)" }}
        />
      </motion.div>

      {/* Blue-slate wash, the way their hero is graded. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--uc-navy-1)", opacity: 0.42, mixBlendMode: "multiply" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(26,33,40,0.5) 0%, rgba(26,33,40,0.24) 45%, rgba(26,33,40,0.72) 100%)",
        }}
      />
      {/* Left-weighted darkening, so the headline keeps its contrast wherever
          the drift happens to have carried the image. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(16,22,28,0.72) 0%, rgba(16,22,28,0.22) 58%, rgba(16,22,28,0) 100%)",
        }}
      />
    </div>
  );
}
