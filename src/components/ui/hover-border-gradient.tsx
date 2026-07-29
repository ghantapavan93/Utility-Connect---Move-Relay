"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

import { useStillness } from "@/lib/use-stillness";

/**
 * A button whose border lights as the pointer approaches it.
 *
 * The reference implementation sweeps a multi-stop rainbow conic gradient
 * around the edge. That is a generic-AI tell in this project and it would also
 * be the only place on the site where colour carries no meaning, so the sweep
 * here is a single cyan arc on a dark ring: the same mechanic, in the palette
 * that already means something.
 *
 * Built from two stacked layers rather than an animated `border-image`, which
 * cannot be transitioned. The outer layer holds the rotating gradient and the
 * inner layer covers all but a hairline of it, so what remains visible is a
 * 1px ring that appears to travel.
 */

export function HoverBorderGradient({
  href,
  children,
  variant = "solid",
}: {
  /* Typed routes are on, so this borrows Link's own href type rather than
     taking a string and casting at the call site. */
  href: React.ComponentProps<typeof Link>["href"];
  children: ReactNode;
  /** `solid` is the primary action; `ghost` sits beside it. */
  variant?: "solid" | "ghost";
}) {
  const [hovered, setHovered] = useState(false);
  const still = useStillness();
  const active = hovered && !still;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className="relative inline-flex overflow-hidden rounded-full p-px transition-transform hover:-translate-y-0.5"
      style={{ background: "rgba(255,255,255,0.22)" }}
    >
      {/*
        The travelling arc. Sized well beyond the button and spun, so the bright
        sector of the cone passes around the edge. `-z` keeps it behind the
        face; the padding of 1px on the parent is what leaves the ring visible.
      */}
      {!still && (
        <span
          aria-hidden
          className="absolute left-1/2 top-1/2 aspect-square w-[240%] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, transparent 300deg, var(--uc-cyan-ink) 340deg, transparent 360deg)",
            animation: active ? "relay-border-spin 1.6s linear infinite" : "none",
            opacity: active ? 1 : 0,
            transition: "opacity 220ms ease-out",
          }}
        />
      )}

      <span
        className="relative rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white"
        style={{
          background:
            variant === "solid"
              ? "var(--uc-cyan-fill)"
              : "rgba(9,14,19,0.72)",
          backdropFilter: variant === "ghost" ? "blur(4px)" : undefined,
        }}
      >
        {children}
      </span>
    </Link>
  );
}
