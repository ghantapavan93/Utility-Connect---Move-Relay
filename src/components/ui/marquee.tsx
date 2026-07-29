"use client";

import type { ReactNode } from "react";

import { useStillness } from "@/lib/use-stillness";

/**
 * An infinite horizontal scroller.
 *
 * The children are rendered twice and the track is translated by exactly half
 * its width, so the second copy is in the first copy's position at the moment
 * the loop restarts and the seam is invisible. Any other duplication count
 * leaves a visible jump, which is the usual reason a marquee looks cheap.
 *
 * CSS animation rather than Framer here, deliberately. This runs forever, and a
 * spring library recalculating a value every frame for the lifetime of the page
 * is a cost with nothing to show for it — the motion is linear and never
 * interrupted, which is exactly what a keyframe does for free on the
 * compositor.
 *
 * Under reduced motion it stops moving and wraps instead. A visitor who asked
 * for stillness must not be given an animation that never ends; wrapping keeps
 * every item readable rather than hiding the overflow.
 */

export type MarqueeSpeed = "slow" | "normal" | "fast";

const DURATION: Record<MarqueeSpeed, string> = {
  slow: "68s",
  normal: "44s",
  fast: "26s",
};

export function Marquee({
  children,
  reverse = false,
  speed = "normal",
  className = "",
}: {
  children: ReactNode;
  reverse?: boolean;
  speed?: MarqueeSpeed;
  className?: string;
}) {
  const still = useStillness();

  if (still) {
    return (
      <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`group relative flex overflow-hidden ${className}`}
      /*
        The edges fade rather than cutting. A hard crop makes items appear and
        vanish mid-word, which reads as clipping; a mask makes them arrive from
        somewhere.
      */
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
      }}
    >
      <div
        className="flex shrink-0 items-center gap-3 pr-3 will-change-transform group-hover:[animation-play-state:paused]"
        style={{
          animation: `relay-marquee ${DURATION[speed]} linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {children}
        {/* The second pass. `aria-hidden` so a screen reader hears the list once. */}
        <span aria-hidden className="flex shrink-0 items-center gap-3 pr-3">
          {children}
        </span>
      </div>
    </div>
  );
}
