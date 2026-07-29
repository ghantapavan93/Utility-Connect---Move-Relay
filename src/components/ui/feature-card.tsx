"use client";

import { useState } from "react";

import { GlowEffect } from "@/components/ui/glow-effect";
import { FeatureIcon } from "@/components/ui/feature-icon";
import { useStillness } from "@/lib/use-stillness";

/**
 * One concierge feature, lit from behind.
 *
 * The card body stays opaque and sits on top of the glow, so the light only
 * ever appears as a fringe past the corners. That is the whole trick: a glow
 * that bleeds *through* a panel turns the panel into frosted plastic, which is
 * the glassmorphism this design system rules out. Here the panel is solid and
 * the light is behind it, the way a lit sign works.
 */
export function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  const [hovered, setHovered] = useState(false);
  const still = useStillness();

  return (
    <div
      className="relative h-full rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        transform: hovered && !still ? "translateY(-3px)" : "none",
        transition: "transform 220ms var(--ease-out-relay)",
      }}
    >
      <GlowEffect blur="medium" spread={7} intensity={hovered ? 0.72 : 0.34} />

      <div
        className="relative h-full rounded-2xl border bg-white p-6"
        style={{ borderColor: "var(--color-ground-3)" }}
      >
        <div
          className="mb-3 grid h-12 w-12 place-items-center rounded-xl transition-colors duration-200"
          style={{
            background: hovered
              ? "var(--uc-cyan-fill)"
              : "color-mix(in oklab, var(--color-state-verified) 12%, white)",
            color: hovered ? "#ffffff" : "var(--color-state-verified)",
          }}
        >
          <FeatureIcon name={icon} />
        </div>
        <h3 className="mb-1.5 text-base font-bold" style={{ color: "var(--color-text-hi)" }}>
          {title}
        </h3>
        <p className="text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
