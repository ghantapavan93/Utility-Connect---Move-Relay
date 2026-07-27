"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { accentColor, type Accent } from "@/lib/accents";
import { stepImage } from "@/lib/step-images";
import { useStillness } from "@/lib/use-stillness";

/**
 * The stage: what the engine is doing, at the size it deserves.
 *
 * The console's left rail is nine buttons and a progress bar — accurate, and
 * completely silent about what any step actually *does*. A reviewer pressed
 * "Ingest 3 channels" and watched a tick appear.
 *
 * Each step now has an illustration showing the thing itself: the three
 * channels arriving with their real payloads, the duplicate scored, the
 * conflict surfaced, the provider going quiet. During a play-through they
 * advance with the story, so the page reads as a film with a control rail
 * rather than a control rail with a status line.
 *
 * The image is decorative in the strict accessibility sense — the step label
 * beside it and the live state band above it carry the meaning in text — so it
 * takes an empty `alt` rather than a description a screen reader would have to
 * sit through twice.
 */
export function StepStage({
  stepKey,
  label,
  blurb,
  accent,
  index,
  total,
  busy,
  playing,
}: {
  stepKey: string | null;
  label: string | null;
  blurb: string | null;
  accent: Accent;
  index: number | null;
  total: number;
  busy: boolean;
  playing: boolean;
}) {
  const still = useStillness();
  const src = stepKey ? stepImage(stepKey) : null;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{ borderColor: accentColor(accent, 0.35), background: "#05080c" }}
    >
      {/* 16:9 holds the frame whether or not an image is in it, so advancing a
          step never reflows the page under the reader's cursor. */}
      <div className="relative aspect-[16/9] w-full">
        <AnimatePresence mode="wait">
          {src ? (
            <motion.div
              key={src}
              className="absolute inset-0"
              initial={still ? { opacity: 1 } : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={still ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: still ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/*
                `object-contain`, not cover. These are dashboards with type in
                them — cropping one to fill a box cuts off the very payloads
                and field names that make it worth showing. One of the nine is
                4:3 where the rest are 16:9; contain lets that one letterbox
                instead of losing a third of its content.
              */}
              <Image
                src={src}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-contain"
                priority={index === 0}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 grid place-items-center px-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div>
                <div
                  className="mx-auto mb-3 h-1 w-12 rounded-full"
                  style={{ background: accentColor("verified", 0.7) }}
                />
                <p className="text-sm leading-relaxed text-white/45">
                  Press play and the engine performs each step against a real
                  database. What it does appears here.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* A scan line while a step is executing. It is tied to real request
            state, so it means "working" rather than decorating the wait. */}
        {busy && !still && (
          <motion.div
            aria-hidden
            className="absolute inset-x-0 h-px"
            style={{ background: accentColor(accent, 0.9), boxShadow: `0 0 18px ${accentColor(accent, 0.8)}` }}
            initial={{ top: "0%" }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />
        )}
      </div>

      {/* Caption rail — the text that actually carries the meaning. */}
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t px-5 py-3"
        style={{ borderColor: "rgba(255,255,255,0.08)" }}
      >
        {index !== null && (
          <span className="font-mono text-[11px]" style={{ color: accentColor(accent, 1) }}>
            {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
        )}
        <span className="text-sm font-semibold text-white/90">
          {label ?? "Nothing running"}
        </span>
        {blurb && <span className="text-xs text-white/50">{blurb}</span>}
        {playing && (
          <motion.span
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="ml-auto text-[10px] font-bold uppercase tracking-[0.18em]"
            style={{ color: accentColor(accent, 1) }}
          >
            ● playing
          </motion.span>
        )}
      </div>
    </div>
  );
}
