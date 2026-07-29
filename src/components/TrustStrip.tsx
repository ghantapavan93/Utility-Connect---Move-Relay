"use client";

import { Marquee } from "@/components/ui/marquee";

/**
 * The strip beneath the hero: what this connects, who it connects to, and what
 * it is built from. Three tracks, moving in opposite directions.
 *
 * The static wrapped list this replaced showed eight categories and stopped.
 * A count of eighteen services and thousands of vendors is a claim about
 * *breadth*, and breadth is the one thing a fixed list cannot show — the row
 * has to keep arriving to mean anything. Opposing directions on adjacent rows
 * keep the eye from locking onto a single item and following it.
 *
 * No coloured chips. The reference implementation assigns a different
 * background to every badge — pink, purple, orange — which is exactly the
 * palette this project treats as a generic-AI tell. Here the chips are neutral
 * and the only colour is the brand cyan, used on the row that names the stack,
 * because that row is the one making a verifiable claim.
 */

/** The eighteen the heading counts. Categories, not brands. */
const SERVICES = [
  "Electric",
  "Natural gas",
  "Water",
  "Internet",
  "Television",
  "Home phone",
  "Home security",
  "Solar",
  "Insurance",
  "Moving",
  "Storage",
  "Cleaning",
  "Lawn care",
  "Pest control",
  "Home warranty",
  "Trash and recycling",
  "EV charging",
  "Smart home",
];

/**
 * Provider names, as plain wordmarks.
 *
 * No logo files: those are other companies' trademarks and this repository does
 * not carry them. Rendering the names as type keeps the row honest about what
 * it is — a list of the kinds of provider a platform like this integrates with,
 * on a site whose every page states it is unaffiliated and synthetic.
 */
const PROVIDERS = [
  "Direct Energy",
  "Frontier Utilities",
  "Spectrum",
  "ADT",
  "Frontier",
  "Xfinity",
  "AT&T",
  "Vivint",
];

/**
 * What the thing under the marketing site is actually built from.
 *
 * The only row here making a checkable claim, so it is the only one wearing the
 * brand colour. Every entry is in `package.json` or the schema.
 */
const STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Tailwind 4",
  "PostgreSQL",
  "PGlite",
  "Framer Motion",
  "React Three Fiber",
  "Vitest",
];

function Chip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-semibold"
      style={{
        borderColor: accent ? "rgba(0,135,181,0.45)" : "rgba(255,255,255,0.14)",
        background: accent ? "rgba(0,135,181,0.12)" : "rgba(255,255,255,0.04)",
        color: accent ? "var(--uc-cyan-ink)" : "rgba(255,255,255,0.72)",
      }}
    >
      {label}
    </span>
  );
}

export function TrustStrip() {
  return (
    <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Connecting 18 home services across 3,500+ vendors nationwide
        </div>

        <div className="mt-5 space-y-3">
          {/* What gets connected. */}
          <Marquee speed="slow">
            {SERVICES.map((s) => (
              <Chip key={s} label={s} />
            ))}
          </Marquee>

          {/* Who it connects to, running the other way. */}
          <Marquee reverse>
            {PROVIDERS.map((p) => (
              <Chip key={p} label={p} />
            ))}
          </Marquee>

          {/* What it is built from. The row that can be verified. */}
          <Marquee speed="fast">
            {STACK.map((t) => (
              <Chip key={t} label={t} accent />
            ))}
          </Marquee>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/35">
          Provider names are shown as categories of integration partner. This is an
          unaffiliated concept build and every customer, partner and provider record on
          it is synthetic.
        </p>
      </div>
    </div>
  );
}
