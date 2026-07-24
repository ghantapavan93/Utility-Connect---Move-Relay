"use client";

import { motion } from "framer-motion";

/**
 * Hero backdrop — an architectural blueprint field.
 *
 * Utility Connect's own hero is a photograph of a home under a navy wash. A
 * licensed photograph is not ours to use, and copying theirs is not an option, so
 * this evokes the same idea a different way: a faint isometric grid and a drawn
 * house outline, the way a home reads as a blueprint. It carries the "home +
 * structure + technical" feeling without a stock photo, stays on-brand in cyan,
 * and is pure SVG so it costs nothing and needs no fallback.
 *
 * It sits behind the hero at low opacity and is aria-hidden — decoration that
 * sets mood without competing with the headline or the 3D.
 */
export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Brand glow */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(58% 48% at 70% 34%, color-mix(in oklab, var(--color-state-verified) 14%, transparent), transparent 70%)" }}
      />

      {/* Isometric grid, fading toward the top */}
      <svg className="absolute inset-0 h-full w-full" style={{ opacity: 0.16 }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="iso" width="56" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
            <path d="M0 16 L28 0 L56 16 L28 32 Z" fill="none" stroke="var(--color-state-transit)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="black" stopOpacity="0" />
            <stop offset="55%" stopColor="black" stopOpacity="0.5" />
            <stop offset="100%" stopColor="black" stopOpacity="0.9" />
          </linearGradient>
          <mask id="fademask">
            <rect width="100%" height="100%" fill="url(#fade)" />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#iso)" mask="url(#fademask)" />
      </svg>

      {/* A drawn house, slowly breathing — the blueprint focal motif */}
      <motion.svg
        className="absolute right-[6%] top-[18%] hidden lg:block"
        width="220"
        height="200"
        viewBox="0 0 220 200"
        fill="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.1, 0.22, 0.1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      >
        <path d="M20 90 L110 20 L200 90" stroke="var(--color-state-verified)" strokeWidth="1.2" />
        <path d="M40 78 L40 170 L180 170 L180 78" stroke="var(--color-state-verified)" strokeWidth="1.2" />
        <rect x="92" y="120" width="36" height="50" stroke="var(--color-state-verified)" strokeWidth="1.2" />
        <rect x="58" y="100" width="26" height="26" stroke="var(--color-state-transit)" strokeWidth="1" />
        <rect x="136" y="100" width="26" height="26" stroke="var(--color-state-transit)" strokeWidth="1" />
        <circle cx="110" cy="20" r="3" fill="var(--color-state-verified)" />
      </motion.svg>
    </div>
  );
}
