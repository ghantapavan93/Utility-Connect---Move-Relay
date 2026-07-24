"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * An original animated home interior for the hero.
 *
 * Utility Connect's hero is a photograph of a home under a navy wash. A licensed
 * photo is not ours and copying theirs is out of the question, so this is an
 * original geometric interior — a window with warm light, a counter, a pendant
 * lamp, a plant — drawn as SVG and gently brought to life: warm window light
 * breathes, the lamp pulses, a soft light sweep drifts across the scene. It gives
 * the hero the movement of a background video without any video file, and it
 * honours reduced-motion by holding still.
 */
export function HomeScene() {
  const reduce = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3c242" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#e08a2e" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#243040" />
            <stop offset="100%" stopColor="#161e28" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#f3c242" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#f3c242" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4da8c8" stopOpacity="0" />
            <stop offset="50%" stopColor="#4da8c8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#4da8c8" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="1200" height="600" fill="url(#wall)" />
        <rect y="470" width="1200" height="130" fill="#0e141b" opacity="0.6" />
        <line x1="0" y1="470" x2="1200" y2="470" stroke="#0087b5" strokeWidth="1" opacity="0.3" />

        {/* Window with warm evening light that gently breathes */}
        <g transform="translate(720 90)">
          <rect x="-6" y="-6" width="392" height="332" rx="6" fill="#0087b5" opacity="0.18" />
          <motion.rect
            width="380" height="320" rx="4" fill="url(#warm)"
            animate={reduce ? {} : { opacity: [0.85, 1, 0.85] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <line x1="190" y1="0" x2="190" y2="320" stroke="#161e28" strokeWidth="6" />
          <line x1="0" y1="160" x2="380" y2="160" stroke="#161e28" strokeWidth="6" />
          <g opacity="0.4" fill="#161e28">
            <rect x="20" y="90" width="30" height="70" />
            <rect x="60" y="60" width="24" height="100" />
            <rect x="95" y="105" width="34" height="55" />
            <rect x="210" y="80" width="28" height="80" />
            <rect x="250" y="50" width="22" height="110" />
            <rect x="290" y="100" width="36" height="60" />
          </g>
        </g>
        <motion.ellipse
          cx="910" cy="250" rx="360" ry="260" fill="url(#glow)"
          animate={reduce ? {} : { opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Pendant lamp with a pulsing bulb */}
        <g stroke="#0087b5" strokeWidth="2" fill="none" opacity="0.55">
          <line x1="300" y1="60" x2="300" y2="150" />
          <path d="M270 150 Q300 200 330 150 Z" fill="#0087b5" fillOpacity="0.15" />
        </g>
        <motion.circle
          cx="300" cy="158" r="6" fill="#f3c242"
          animate={reduce ? { opacity: 0.7 } : { opacity: [0.5, 0.9, 0.5], r: [6, 7, 6] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Kitchen island */}
        <g opacity="0.85">
          <rect x="150" y="360" width="360" height="110" rx="6" fill="#1c2733" stroke="#0087b5" strokeOpacity="0.35" strokeWidth="1.5" />
          <rect x="150" y="352" width="360" height="14" rx="3" fill="#2a3947" />
          <g stroke="#0087b5" strokeWidth="2" opacity="0.4" fill="none">
            <circle cx="220" cy="500" r="16" />
            <line x1="220" y1="500" x2="220" y2="470" />
            <circle cx="320" cy="500" r="16" />
            <line x1="320" y1="500" x2="320" y2="470" />
          </g>
          <path d="M300 352 q30 26 60 0" stroke="#f3c242" strokeWidth="2" fill="none" opacity="0.6" />
        </g>

        {/* Plant with softly swaying leaves */}
        <g transform="translate(560 350)" opacity="0.7">
          <path d="M0 120 L28 120 L24 70 L4 70 Z" fill="#1c2733" stroke="#0087b5" strokeOpacity="0.4" />
          <motion.g
            stroke="#3da76a" strokeWidth="2.5" fill="none" opacity="0.8"
            style={{ transformOrigin: "14px 70px" }}
            animate={reduce ? {} : { rotate: [-1.5, 1.5, -1.5] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M14 70 Q-6 30 4 4" />
            <path d="M14 70 Q34 34 24 6" />
            <path d="M14 70 Q14 30 14 -4" />
          </motion.g>
        </g>

        {/* A slow light sweep across the whole scene — the 'live/video' feel */}
        {!reduce && (
          <motion.rect
            y="0" width="500" height="600" fill="url(#sweep)"
            animate={{ x: [-500, 1200] }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        )}
      </svg>

      <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, color-mix(in oklab, var(--uc-navy-1) 90%, transparent) 30%, color-mix(in oklab, var(--uc-navy-1) 55%, transparent) 100%)" }} />
    </div>
  );
}
