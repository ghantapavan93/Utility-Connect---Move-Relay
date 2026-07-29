"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { Pulse, useScene } from "@/components/diagram/primitives";

/**
 * The hero of the architecture page: the boundary the page is about.
 *
 * This replaced a 3D render of a house driveway. That image was doing nothing
 * for a page about partial unique indexes and authority boundaries — a reader
 * met a photograph of a home and learned nothing from the largest element on
 * the screen. The strongest possible hero image for a page about a mechanism is
 * the mechanism.
 *
 * Four layers, read from the bottom: Postgres holds the truth, services apply
 * policy, named humans approve, and the AI gateway sits outside the line that
 * commits anything. A request travels up through them and one lane is refused,
 * continuously, because that refusal is the page's whole argument.
 *
 * Deliberately quiet. It sits behind a headline and a paragraph, so it runs at
 * low contrast and slow speed — a backdrop that competes with the type it is
 * behind has stopped being a backdrop.
 */

const LAYERS = [
  { label: "AI GATEWAY", note: "retrieve · explain · propose", accent: "internet" as const, y: 62 },
  { label: "NAMED HUMANS", note: "approve", accent: "security" as const, y: 168 },
  { label: "APPLICATION SERVICES", note: "deterministic policy", accent: "verified" as const, y: 274 },
  { label: "POSTGRESQL", note: "canonical truth · constraints · audit", accent: "recovered" as const, y: 380 },
];

export function TrustMapBackdrop() {
  const { ref, play, d } = useScene();

  return (
    <svg
      ref={ref}
      viewBox="0 0 1200 460"
      /*
        `meet`, not `slice`.

        Slice fills the frame and crops whatever does not fit, which is correct
        for a photograph and destructive for a diagram: on a tall viewport it
        cut the left edge off every layer and pushed the labels past the screen.
        A backdrop that is smaller but complete beats one that is large and
        truncated, because the truncated one is unreadable at any size.

        Held to the upper portion so it sits clear of the headline, which is
        bottom-aligned in this hero.
      */
      preserveAspectRatio="xMidYMin meet"
      className="h-full w-full"
      role="img"
      aria-label="Four authority layers, with the AI gateway held outside the boundary that commits state"
      fill="none"
      strokeLinecap="round"
    >
      {LAYERS.map((l, i) => (
        <g key={l.label}>
          <motion.rect
            x={140}
            y={l.y}
            width={920}
            height={54}
            rx={10}
            fill={accentColor(l.accent, 0.06)}
            stroke={accentColor(l.accent, 0.4)}
            strokeWidth={1.2}
            initial={{ opacity: 0, y: 14 }}
            animate={play ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            /* Bottom-up: nothing above a layer is safe until the one beneath it
               exists, and the order it assembles in should say so. */
            transition={{ duration: 0.6, delay: (LAYERS.length - 1 - i) * 0.18 }}
          />
          <motion.text
            x={168}
            y={l.y + 32}
            fontSize={15}
            letterSpacing="0.16em"
            fill={accentInk(l.accent)}
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : { opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + (LAYERS.length - 1 - i) * 0.18 }}
          >
            {l.label}
          </motion.text>
          <motion.text
            x={1032}
            y={l.y + 32}
            fontSize={12}
            textAnchor="end"
            letterSpacing="0.1em"
            fill="rgba(255,255,255,0.34)"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : { opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 + (LAYERS.length - 1 - i) * 0.18 }}
          >
            {l.note}
          </motion.text>
        </g>
      ))}

      {/*
        The line the gateway does not cross.

        Drawn between the AI layer and everything below it, because that is
        where the whole page's argument lives: the model may reach down to read
        and propose, and it may not reach down to commit.
      */}
      <motion.path
        d="M120 142 H1080"
        stroke={accentColor("failed", 0.5)}
        strokeWidth={1.4}
        strokeDasharray="6 8"
        {...d(1.1, 1.2)}
      />
      <motion.text
        x={120}
        y={132}
        fontSize={11}
        letterSpacing="0.2em"
        fill={accentInk("failed")}
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.6 }}
      >
        NOTHING ABOVE THIS LINE MAY COMMIT
      </motion.text>

      {/* Evidence rising: truth to policy, policy to the person who decides. */}
      {[
        { from: 380, to: 328, accent: "recovered" as const },
        { from: 274, to: 222, accent: "verified" as const },
      ].map((c, i) => (
        <g key={c.from}>
          <motion.path
            d={`M600 ${c.from} V ${c.to}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.2}
            {...d(1.3 + i * 0.2, 0.5)}
          />
          <Pulse
            d={`M600 ${c.from} V ${c.to}`}
            accent={c.accent}
            play={play}
            delay={2.2 + (1 - i) * 0.8}
            duration={1.1}
            r={3.4}
          />
        </g>
      ))}

      {/* The gateway reaching down to read — allowed — and the refusal beside it. */}
      <motion.path
        d="M430 116 V 168"
        stroke={accentColor("internet", 0.45)}
        strokeWidth={1.2}
        strokeDasharray="4 5"
        {...d(1.8, 0.5)}
      />
      <Pulse d="M430 116 V 168" accent="internet" play={play} delay={3} duration={1.1} r={3.2} />
      <motion.text
        x={444}
        y={150}
        fontSize={11}
        letterSpacing="0.12em"
        fill={accentInk("internet")}
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.4 }}
      >
        READ · PROPOSE
      </motion.text>

      <motion.path
        d="M810 116 V 148"
        stroke={accentColor("failed", 0.5)}
        strokeWidth={1.2}
        strokeDasharray="3 4"
        {...d(2, 0.4)}
      />
      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 2.7 }}
        style={{ transformOrigin: "810px 160px" }}
      >
        <path
          d="M800 150 L820 170 M820 150 L800 170"
          stroke={accentColor("failed", 0.95)}
          strokeWidth={2.6}
        />
      </motion.g>
      <motion.text
        x={834}
        y={166}
        fontSize={11}
        letterSpacing="0.12em"
        fill={accentInk("failed")}
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.9 }}
      >
        DECIDE
      </motion.text>
    </svg>
  );
}
