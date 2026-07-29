"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The application sidebar — the product shell.
 *
 * This turns Move Relay from a linear demo into something that reads as a real
 * operator console. Items that are wired to live data are marked; items that are
 * future surfaces are labelled, never presented as working. Honesty about what is
 * real is the whole brand.
 */

const NAV = [
  { href: "/dashboard", label: "Overview", glyph: "◇", live: true },
  { href: "/demo", label: "Live workflow", glyph: "⟐", live: true },
  { href: "/moves", label: "Move queue", glyph: "☰", live: true },
  { href: "/agent", label: "Case agent", glyph: "⌥", live: true },
  { href: "/story", label: "The Living Move", glyph: "▶", live: true },
  { href: "/theater", label: "Failure Theater", glyph: "⚡", live: true },
  { href: "/views", label: "Audiences", glyph: "◈", live: true },
  { href: "/reliability", label: "Reliability", glyph: "▥", live: true },
  { href: "/architecture", label: "Architecture", glyph: "⊞", live: true },
  { href: "/future", label: "Future platform", glyph: "✦", live: true },
] as const;

const FUTURE = [
  { label: "Concierge Compiler", glyph: "❋" },
  { label: "Move Wallet", glyph: "◉" },
  { label: "Network Launchpad", glyph: "⇲" },
  { label: "Provider Graph", glyph: "⌘" },
] as const;

export function AppSidebar() {
  const path = usePathname();

  return (
    <aside
      /*
        Hidden below `lg`, not shrunk.

        A 240px rail inside a 320px viewport leaves 80px for the console, which
        is how every panel on this page ended up clipped past the right edge and
        how thirty-four navigation links ended up as 40px touch targets. The
        routes are all reachable from the site header on small screens, so the
        rail is a desktop affordance rather than the only way through.
      */
      className="hidden w-60 shrink-0 flex-col border-r lg:flex"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <OrbitMark />
        <span className="text-sm font-bold tracking-tight">
          MOVE<span style={{ color: "var(--color-state-verified)" }}>RELAY</span>
        </span>
      </div>

      <nav className="flex-1 px-3 py-2">
        <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-lo)" }}>
          Operate
        </div>
        {NAV.map((item) => {
          const active = path === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className="mb-0.5 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={{
                background: active ? "color-mix(in oklab, var(--color-state-verified) 14%, transparent)" : "transparent",
                color: active ? "var(--color-state-verified)" : "var(--color-text-mid)",
              }}
            >
              <span className="text-base" aria-hidden>{item.glyph}</span>
              {item.label}
            </Link>
          );
        })}

        <div className="mb-1 mt-5 px-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-lo)" }}>
          Future · concept
        </div>
        {FUTURE.map((item) => (
          <div
            key={item.label}
            className="mb-0.5 flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm"
            style={{ color: "var(--color-text-lo)" }}
          >
            <span className="text-base" aria-hidden>{item.glyph}</span>
            {item.label}
            <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ background: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
              soon
            </span>
          </div>
        ))}
      </nav>

      <div className="border-t px-4 py-4" style={{ borderColor: "var(--color-ground-3)" }}>
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full text-xs font-bold" style={{ background: "var(--color-state-verified)", color: "white" }}>
            PK
          </div>
          <div className="text-xs">
            <div className="font-semibold">Concierge · demo</div>
            <div style={{ color: "var(--color-text-lo)" }}>synthetic tenant</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function OrbitMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="2.5" fill="var(--color-state-verified)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-verified)" strokeWidth="1.3" opacity="0.7" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-transit)" strokeWidth="1.3" opacity="0.7" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="4" stroke="var(--color-state-transit)" strokeWidth="1.3" opacity="0.7" transform="rotate(120 12 12)" />
    </svg>
  );
}
