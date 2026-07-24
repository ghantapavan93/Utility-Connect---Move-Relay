"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";

/**
 * Sticky top navigation. Transparent over the hero, then it gains a solid
 * background and a hairline border once the page scrolls — a small, standard
 * premium cue that the header is now floating over content.
 */
export function SiteNav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 40));

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50 transition-colors"
      style={{
        background: solid ? "color-mix(in oklab, var(--color-ground-0) 82%, transparent)" : "transparent",
        borderBottom: solid ? "1px solid var(--color-ground-3)" : "1px solid transparent",
        backdropFilter: solid ? "blur(12px)" : "none",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <OrbitMark />
          <span className="text-sm font-bold tracking-tight">
            MOVE<span style={{ color: "var(--color-state-verified)" }}>RELAY</span>
          </span>
        </Link>
        <div className="flex items-center gap-1 text-sm">
          <NavLink href="/demo">Live demo</NavLink>
          <NavLink href="/views">Audiences</NavLink>
          <NavLink href="/architecture">Architecture</NavLink>
          <NavLink href="/future">Future</NavLink>
          <Link
            href="/demo"
            className="ml-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-transform hover:-translate-y-px"
            style={{ background: "var(--color-state-verified)", color: "white" }}
          >
            Run demo
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href as never}
      className="hidden rounded-md px-3 py-1.5 font-medium transition-colors hover:text-white sm:block"
      style={{ color: "var(--color-text-mid)" }}
    >
      {children}
    </Link>
  );
}

/** A nod to Utility Connect's orbiting-particle logo, drawn as clean SVG. */
function OrbitMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="2.5" fill="var(--color-state-verified)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-verified)" strokeWidth="1.3" opacity="0.7" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-transit)" strokeWidth="1.3" opacity="0.7" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-transit)" strokeWidth="1.3" opacity="0.7" transform="rotate(120 12 12)" />
    </svg>
  );
}
