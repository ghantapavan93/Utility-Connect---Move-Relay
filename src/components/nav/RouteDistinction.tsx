"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { accentColor, accentInk, type Accent } from "@/lib/accents";

/**
 * Why three routes tell the same story, stated on all three.
 *
 * `/story`, `/theater` and `/demo` all walk one move from conflict to
 * recovery, and nothing on any of them said why a reviewer should open more
 * than one. Three doors onto the same room is a site that looks padded, and the
 * one who suffers is the person who picks the wrong door first and leaves
 * believing they have seen it.
 *
 * They are not duplicates. They are three review modes: one creates memory,
 * one creates comprehension, one creates participation. That distinction was
 * real and entirely undocumented, which is the same as it not existing.
 *
 * The current route is shown as a statement rather than a link — a nav item
 * that navigates to the page you are on is a small lie about what will happen
 * when you click it.
 */

interface Mode {
  href: string;
  name: string;
  /** What this route does that the other two cannot. */
  promise: string;
  /**
   * Who should open this one first.
   *
   * This replaced an outcome line — "Feel the problem", "Touch the proof" —
   * which told a reader what they would experience but not whether it was meant
   * for them. Three routes onto one story is a choice, and a reviewer with
   * twenty minutes needs the choice made on the axis they actually have: what
   * they are here to judge.
   */
  audience: string;
  accent: Accent;
}

const MODES: Mode[] = [
  {
    href: "/story",
    name: "Feel the incident",
    promise: "Follow one move from provider uncertainty to verified recovery.",
    audience: "Founders, first look",
    accent: "solar",
  },
  {
    href: "/theater",
    name: "Trigger the failures",
    promise: "Attack the guarantees and watch unsafe outcomes get refused.",
    audience: "Product, ops, engineering",
    accent: "conflict",
  },
  {
    href: "/demo",
    name: "Inspect system truth",
    promise: "Review state transitions, returned rows, and the evidence behind every refusal.",
    audience: "Technical review",
    accent: "verified",
  },
];

export function RouteDistinction() {
  const pathname = usePathname();

  return (
    <section
      aria-label="Three ways to review the same move"
      className="border-y"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.015)" }}
    >
      <div className="mx-auto max-w-[1400px] px-5 py-6 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
          The same move, three ways to review it
        </p>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
          {MODES.map((m) => {
            const here = pathname === m.href;

            const inner = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: here ? accentInk(m.accent) : "rgba(255,255,255,0.9)" }}
                  >
                    {m.name}
                  </span>
                  {/*
                    11px, not 9. At 9 this was the smallest type on any of the
                    three routes it appears on, and it carries the one thing the
                    strip exists to say — which of the three you are looking at.
                    Tracking that tight needs the extra size to stay readable.
                  */}
                  <span
                    className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: here ? accentInk(m.accent) : "rgba(255,255,255,0.38)" }}
                  >
                    {here ? "You are here" : m.audience}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-white/55">{m.promise}</p>
              </>
            );

            const style = {
              borderColor: here ? accentColor(m.accent, 0.5) : "rgba(255,255,255,0.1)",
              background: here ? accentColor(m.accent, 0.07) : "transparent",
            };

            /*
              The current route is a <div>, not a <Link>. Rendering it as a link
              would promise navigation and deliver a no-op, and a keyboard user
              would tab onto a control that does nothing.
            */
            return here ? (
              <div key={m.href} aria-current="page" className="rounded-xl border p-4" style={style}>
                {inner}
              </div>
            ) : (
              <Link
                key={m.href}
                href={m.href as never}
                className="rounded-xl border p-4 transition-colors hover:bg-white/[0.04]"
                style={style}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
