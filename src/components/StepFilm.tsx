"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { accentColor, type Accent } from "@/lib/accents";
import { stepImage } from "@/lib/step-images";
import { useStillness } from "@/lib/use-stillness";
import { BlurReveal } from "./BlurReveal";

/**
 * The nine steps as a film, not a slideshow.
 *
 * The console proves the engine runs; it does not explain what any step *does*.
 * Dropping the nine frames into a static column would have answered that and
 * created a new problem — nine near-identical dark dashboards stacked in one
 * rhythm is a contact sheet, and the eye stops reading it around the fourth.
 *
 * So each step gets a full band and the side alternates: frame right, frame
 * left, frame right. The alternation is doing real work rather than decoration
 * — it resets the eye's entry point every band, which is what stops a long
 * sequence collapsing into wallpaper, and it is the same rhythm the Continuum
 * uses so the two pages read as one publication.
 *
 * Motion is scroll-coupled rather than looping. Each frame drifts and scales
 * against its own travel through the viewport and un-blurs as it arrives, so
 * moving through the sequence feels like a camera passing over the system
 * rather than a carousel advancing. Nothing animates on a timer: the reader's
 * scroll is the transport, which means they can stop, reverse, and re-read a
 * payload — the exact thing a video would take away.
 */

interface FilmStep {
  key: string;
  n: number;
  title: string;
  body: string;
  accent: Accent;
  act: string;
}

function Band({ step, flip }: { step: FilmStep; flip: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const still = useStillness();
  const src = stepImage(step.key);

  /*
    Measured across the band's own pass through the viewport, so the effect
    plays over exactly the distance it is on screen at any height. A spring on
    the progress keeps a trackpad's jitter out of the transform without adding
    latency the reader would feel as lag.
  */
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.35 });

  /*
    Travel is small and vertical only.

    The first version over-scaled the frame by 6% to give the parallax room,
    which is the right instinct for a photograph and the wrong one here:
    these are dashboards with type in them, and the over-scale cropped the
    left edge of every frame — "Retry is blocked" arrived as "etry is
    blocked". Losing the content is a worse trade than a smaller move.

    `object-contain` already letterboxes each frame inside a 16:9 box, so
    there is vertical slack to drift through without cropping anything. The
    scale barely moves — enough to read as depth, not enough to reach an edge.
  */
  const y = useTransform(p, [0, 1], still ? ["0%", "0%"] : ["3.5%", "-3.5%"]);
  const scale = useTransform(p, [0, 0.5, 1], still ? [1, 1, 1] : [1.015, 1, 1.015]);
  const blurPx = useTransform(p, [0, 0.35, 0.65, 1], still ? [0, 0, 0, 0] : [7, 0, 0, 7]);
  const filter = useTransform(blurPx, (v) => `blur(${v}px)`);
  const glow = useTransform(p, [0, 0.5, 1], [0, 0.5, 0]);

  return (
    <section
      ref={ref}
      className="relative border-t border-white/5 py-16 sm:py-24"
      aria-labelledby={`film-${step.key}`}
    >
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)] items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-14">
        {/* Copy. `order` flips only from lg up; stacked, the text always leads. */}
        <div className={`min-w-0 ${flip ? "lg:order-2" : "lg:order-1"}`}>
          <div className="flex items-baseline gap-3">
            <span
              className="font-mono text-[13px] font-bold"
              style={{ color: accentColor(step.accent, 1) }}
            >
              {String(step.n).padStart(2, "0")}
            </span>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: accentColor(step.accent, 0.85) }}
            >
              {step.act}
            </span>
          </div>

          <BlurReveal
            as="h3"
            text={step.title}
            className="mt-3 font-semibold leading-[1.08] tracking-tight text-white"
            style={{ fontSize: "clamp(24px,3.1vw,40px)" }}
          />
          <div
            className="mt-5 h-1 w-14 rounded-full"
            style={{ background: accentColor(step.accent, 1) }}
          />
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/65">{step.body}</p>
        </div>

        {/* Frame. */}
        <div className={`min-w-0 ${flip ? "lg:order-1" : "lg:order-2"}`}>
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{ borderColor: accentColor(step.accent, 0.3), background: "#04070b" }}
          >
            {/* Fixed 16:9 box; the frame letterboxes inside it and drifts within
                that slack, so nothing is ever cropped. */}
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              {src && (
                <motion.div className="absolute inset-0" style={{ y, scale, filter }}>
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-contain"
                  />
                </motion.div>
              )}
            </div>

            {/* An accent edge that brightens as the band centres — the band
                announcing it is the one being read, not an effect on a loop. */}
            <motion.div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-px"
              style={{ background: accentColor(step.accent, 1), opacity: still ? 0.4 : glow }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function StepFilm({ steps }: { steps: FilmStep[] }) {
  return (
    <div>
      {steps.map((s, i) => (
        // Alternating from the first band, so the rhythm is established
        // immediately rather than discovered on the third.
        <Band key={s.key} step={s} flip={i % 2 === 1} />
      ))}
    </div>
  );
}
