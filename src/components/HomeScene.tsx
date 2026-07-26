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
 * It ran on a render out of `/story` for a while, on the reasoning that the
 * residence *is* a kitchen with an island and stools, so the marketing hero and
 * the 3D film could come from one model. That was honest and it was not good
 * enough: the scene carries baked bounce light on 13 of its 594 meshes, so the
 * shell is lit and everything standing in the rooms is not, and no camera angle
 * gets a modelled interior to read as a photographed one.
 *
 * So this is a licensed photograph — Pexels, free for commercial use, credited
 * in `public/photos/CREDITS.md`. Not theirs, and deliberately not: a system
 * whose entire argument is that every value remembers who supplied it cannot
 * be built on a page that quietly takes a company's hero image. The resemblance
 * comes from the grade below, which is matched to their art direction rather
 * than lifted from their asset.
 *
 * The renders keep the platform pages, where "this is the model you can walk
 * through" is the actual point.
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
        {/*
          The grade was crushing the photograph.

          `saturate(0.3)` under a 42% navy multiply is two desaturations
          stacked, and it turned an interior with warm oak and walnut into flat
          slate — a hero you look past rather than at. Their reference is
          desaturated, not colourless: enough wood tone survives to read as a
          home rather than a rendering.

          Holding more saturation and lifting contrast keeps the room warm,
          while the wash below does the work of making white type legible. That
          separation is the point — the tint should sit *over* the image, not be
          baked into it.
        */}
        <Image
          src="/photos/kitchen-island.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ filter: "saturate(0.52) contrast(1.12) brightness(0.94)" }}
        />
      </motion.div>

      {/* Blue-slate wash, the way their hero is graded. */}
      <div
        className="absolute inset-0"
        style={{ background: "var(--uc-navy-1)", opacity: 0.34, mixBlendMode: "multiply" }}
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
