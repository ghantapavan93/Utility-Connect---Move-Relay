"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { EASE } from "@/lib/motion";
import { Particles, accentColor, type Accent } from "./index";

/**
 * The cinematic hero.
 *
 * Five layers, and the reason for each one is why it works rather than merely
 * moves:
 *
 *   0 · a dark base, so nothing ever flashes white while the image decodes
 *   1 · the photograph, on a slow Ken-Burns push that also drifts and *blurs*
 *       as you scroll away — the blur is the trick, because it hands focus to
 *       the copy instead of competing with it
 *   2 · a tonal grade that deepens on scroll, so the hero darkens into the page
 *       rather than ending at a hard edge
 *   3 * a single hairline at the horizon, which is the one element that makes
 *       a full-bleed image read as *composed* rather than merely placed
 *   4 · a few motes of drifting light
 *
 * The content itself parallaxes upward slightly slower than the image, which is
 * what produces depth. All of it collapses to a still frame under
 * prefers-reduced-motion.
 *
 * The backdrop is rendered out of this project's own 3D residence, not licensed
 * stock — same house the visitor walks through in /story, so the marketing
 * surface and the product are literally the same model.
 */

export interface Credibility {
  eyebrow: string;
  body: string;
  accent: Accent;
}

export function CineHero({
  image,
  alt,
  pills,
  cycle,
  headline,
  sub,
  credibility,
  actions,
  accent = "verified",
}: {
  image: string;
  alt: string;
  pills: ReactNode;
  /** The cycling verb stack — the state machine, said as four words. */
  cycle?: ReactNode;
  headline: ReactNode;
  sub: string;
  /** Purpose / Proof / Code. What it is for, what it stands on, what it is made of. */
  credibility?: Credibility[];
  actions?: ReactNode;
  accent?: Accent;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const scale = useTransform(scrollYProgress, [0, 1], [reduce ? 1 : 1.08, reduce ? 1 : 1.24]);
  const y = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "13%"]);
  const blur = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 6]);
  const filter = useTransform(blur, (v) => `saturate(0.28) contrast(1.05) brightness(0.62) blur(${v}px)`);
  const grade = useTransform(scrollYProgress, [0, 1], [0.78, 0.96]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "-6%"]);

  return (
    <section ref={ref} className="relative isolate min-h-[100vh] w-full overflow-hidden">
      {/* 0 — base */}
      <div className="absolute inset-0 bg-[#04070b]" />

      {/* 1 — the photograph */}
      <motion.div style={{ scale, y, filter }} className="absolute inset-0">
        <Image src={image} alt={alt} fill priority sizes="100vw" className="object-cover" />
      </motion.div>

      {/* 2 — tonal grade, deepening on scroll */}
      <motion.div
        style={{ opacity: grade }}
        className="absolute inset-0 bg-gradient-to-b from-[#04070b]/70 via-[#04070b]/60 to-[#04070b]"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 128%, ${accentColor(accent, 0.2)}, transparent 60%),
                       radial-gradient(ellipse at 16% -8%, rgba(77,168,200,0.1), transparent 55%)`,
        }}
      />

      {/* 3 — the horizon hairline */}
      <div
        className="absolute inset-x-0 top-[62%] h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${accentColor(accent, 0.32)}, transparent)` }}
      />

      {/* 4 — motes */}
      <Particles count={16} accent={accent} />

      <motion.div
        style={{ y: contentY }}
        className="relative z-10 mx-auto flex min-h-[100vh] max-w-[1400px] flex-col justify-end px-5 pb-24 sm:px-8 sm:pb-32"
      >
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE.outQuart }}
          className="flex flex-wrap items-center gap-2"
        >
          {pills}
        </motion.div>

        {cycle && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.18, ease: EASE.outQuart }}
            className="mt-6"
          >
            {cycle}
          </motion.div>
        )}

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: EASE.outQuart }}
          className="mt-3 max-w-[20ch] text-[clamp(40px,7.2vw,112px)] font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-white"
        >
          {headline}
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.46, ease: EASE.outQuart }}
          className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70"
        >
          {sub}
        </motion.p>

        {/*
          Purpose · Proof · Code.

          The most load-bearing eight seconds on the page. A visitor who reads
          nothing else should leave knowing what this is for, the one specific
          thing it has already survived, and what it is actually made of. Vague
          copy here is what makes a demo read as a mockup — so Proof names a
          real number and a real failure, not an adjective.
        */}
        {credibility && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.58, ease: EASE.outQuart }}
            className="mt-9 grid max-w-4xl gap-3 sm:grid-cols-3"
          >
            {credibility.map((c) => (
              <div key={c.eyebrow} className="cine-glass rounded-2xl p-4">
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.22em]"
                  style={{ color: accentColor(c.accent, 0.95) }}
                >
                  {c.eyebrow}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/70">{c.body}</p>
              </div>
            ))}
          </motion.div>
        )}

        {actions && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.7, ease: EASE.outQuart }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            {actions}
          </motion.div>
        )}
      </motion.div>
    </section>
  );
}

/**
 * The cycling verb stack.
 *
 * Four words that are the state machine said out loud. Their version dissolves
 * each word into particles on a canvas; this crossfades and lets the type do
 * the work, because the words here are domain states — PRESERVED, RESOLVED,
 * VERIFIED, RECONCILED — and a particle effect would make them decoration
 * rather than a claim. Each word is the literal name of a thing the engine does.
 */
export function CycleWords({ words, accent = "verified" }: { words: string[]; accent?: Accent }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const i = useCycle(words.length, 2100, !!reduce);

  return (
    <div ref={ref} className="relative h-[64px] sm:h-[84px]">
      {words.map((w, n) => (
        <motion.span
          key={w}
          aria-hidden={n !== i}
          className="absolute text-[clamp(34px,5.4vw,68px)] font-extrabold uppercase tracking-[-0.02em]"
          style={{ color: accentColor(accent, 0.92) }}
          initial={false}
          animate={
            reduce
              ? { opacity: n === 0 ? 1 : 0, y: 0 }
              : { opacity: n === i ? 1 : 0, y: n === i ? 0 : 14, filter: n === i ? "blur(0px)" : "blur(6px)" }
          }
          transition={{ duration: 0.55, ease: EASE.outQuart }}
        >
          {w}
        </motion.span>
      ))}
    </div>
  );
}

function useCycle(count: number, ms: number, paused: boolean) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setI((p) => (p + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms, paused]);
  return paused ? 0 : i;
}
