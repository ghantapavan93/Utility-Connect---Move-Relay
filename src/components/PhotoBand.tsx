"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useStillness } from "@/lib/use-stillness";

/**
 * A full-bleed photograph with a line of copy over it.
 *
 * The marketing pages were almost entirely type on flat colour, which reads as
 * a document rather than a brand. This is the counterweight: a photograph given
 * the full width, at a height that makes it a moment in the scroll rather than
 * an illustration beside a paragraph.
 *
 * Every photograph gets the same grade as the hero — desaturated under a navy
 * wash, darkened from the side the text sits on. That consistency is what makes
 * a set of stock photographs read as one brand's photography instead of a
 * gallery of things found on the internet. It is also what lets white type sit
 * on any of them without hand-tuning each one.
 *
 * Sources and licences are recorded in `public/photos/CREDITS.md`.
 */
export function PhotoBand({
  src,
  alt,
  eyebrow,
  title,
  body,
  align = "left",
  height = "tall",
  priority = false,
}: {
  src: string;
  alt: string;
  eyebrow?: string;
  title: React.ReactNode;
  body?: string;
  align?: "left" | "center";
  height?: "tall" | "short";
  priority?: boolean;
}) {
  const centred = align === "center";
  const ref = useRef<HTMLElement>(null);
  const reduce = useStillness();

  /*
    Parallax, measured across the band's own travel through the viewport.

    `offset: ["start end", "end start"]` runs from the moment the top edge
    enters the bottom of the screen to the moment the bottom edge leaves the
    top — the full time the band is visible — so the photograph drifts against
    the page for the whole pass rather than snapping at an arbitrary point.

    The image is over-scaled to 118% so there is material to move; without that
    headroom a translated `fill` image exposes the background at one edge.
  */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-9%", "9%"]);

  return (
    <section
      ref={ref}
      className={`relative flex overflow-hidden ${
        height === "tall" ? "min-h-[64vh]" : "min-h-[44vh]"
      }`}
      style={{ background: "var(--uc-navy-1)" }}
    >
      {/*
        `alt` is empty when the photograph is decorative and the heading above
        already carries the meaning — announcing "a family carrying boxes" to a
        screen reader after it has read the heading adds nothing and costs time.
        Callers pass real alt text when the image itself is the information.
      */}
      <motion.div
        className="absolute inset-0"
        style={{ y, height: "118%", top: "-9%", willChange: "transform" }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover"
          style={{ filter: "saturate(0.5) contrast(1.1) brightness(0.92)" }}
        />
      </motion.div>

      {/* The grade, in two passes: a brand wash, then a directional darkening
          under wherever the text lands. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: "var(--uc-navy-1)", opacity: 0.38, mixBlendMode: "multiply" }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: centred
            ? "radial-gradient(ellipse at center, rgba(16,22,28,0.74) 0%, rgba(16,22,28,0.5) 70%)"
            : "linear-gradient(90deg, rgba(16,22,28,0.82) 0%, rgba(16,22,28,0.36) 55%, rgba(16,22,28,0.08) 100%)",
        }}
      />

      <div className="relative flex w-full items-center">
        <div
          className={`mx-auto w-full max-w-6xl px-6 py-20 ${centred ? "text-center" : ""}`}
        >
          {eyebrow && (
            <div
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--uc-cyan-ink)" }}
            >
              {eyebrow}
            </div>
          )}
          <h2
            className={`mt-3 font-semibold leading-[1.08] tracking-tight text-white ${
              centred ? "mx-auto max-w-3xl" : "max-w-2xl"
            }`}
            style={{ fontSize: "clamp(26px,4vw,52px)" }}
          >
            {title}
          </h2>
          {body && (
            <p
              className={`mt-4 text-base leading-relaxed text-white/75 sm:text-lg ${
                centred ? "mx-auto max-w-2xl" : "max-w-xl"
              }`}
            >
              {body}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
