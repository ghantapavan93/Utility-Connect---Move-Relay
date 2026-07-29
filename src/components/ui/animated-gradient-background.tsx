"use client";

import { motion } from "framer-motion";

import { accentRgb, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * A breathing radial gradient, coloured by whether the invariants held.
 *
 * The reference is a configurable multi-stop radial wash that breathes on a
 * fixed palette. The breathing is kept; the fixed palette is not, because on
 * this page there is something for it to say. The Failure Theater has exactly
 * three outcomes and this system already has a colour for each of them — amber
 * while nothing has been tried, green once every attack has been refused, red
 * the moment one is not.
 *
 * Red is the point. `lib/accents` reserves it for an invariant that did not
 * hold and says so out loud, and this is the one page a visitor can reach it
 * from. A background that stayed decorative through a breach would be the
 * project failing its own rule on the screen built to test that rule.
 *
 * Three offset layers rather than one. A single ellipse breathing on its own
 * reads as a pulsing shape with a visible edge; three at different sizes and
 * periods never line up, so what you see is the light changing rather than an
 * object resizing.
 */

/** Where each layer sits and how it breathes. Periods are deliberately coprime
    so the three never return to the same phase together. */
const LAYERS = [
  { at: "50% 108%", size: "115% 78%", scale: 1.07, period: 11, delay: 0, alpha: 0.5 },
  { at: "12% 88%", size: "78% 62%", scale: 1.11, period: 15, delay: 1.4, alpha: 0.32 },
  { at: "88% 96%", size: "86% 58%", scale: 1.09, period: 19, delay: 3.1, alpha: 0.28 },
] as const;

export function AnimatedGradientBackground({
  accent,
  /** Quickens the breathing while a sweep is running. */
  active = false,
}: {
  accent: Accent;
  active?: boolean;
}) {
  const still = useStillness();
  const rgb = accentRgb(accent);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {LAYERS.map((l, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          style={{
            /*
              Stops fall away to transparent well before the edge, so the wash
              has no boundary of its own. A radial gradient that reaches its
              container is a shape; one that fades out is light.

              `background` transitions on its own when `accent` changes, which
              is what carries a breach from amber to red without a flash.
            */
            background: `radial-gradient(ellipse ${l.size} at ${l.at}, rgba(${rgb},${l.alpha}) 0%, rgba(${rgb},${l.alpha * 0.45}) 34%, rgba(${rgb},0) 68%)`,
            transition: "background 700ms var(--ease-out-relay)",
            willChange: still ? undefined : "transform, opacity",
          }}
          animate={
            still
              ? undefined
              : {
                  scale: [1, l.scale, 1],
                  opacity: [0.82, 1, 0.82],
                }
          }
          transition={{
            // Faster while attacks are running: the page is doing something,
            // and the one honest way to say so is to change the rate rather
            // than add a spinner nobody asked for.
            duration: active ? l.period * 0.45 : l.period,
            repeat: Infinity,
            ease: "easeInOut",
            delay: l.delay,
          }}
        />
      ))}
    </div>
  );
}
