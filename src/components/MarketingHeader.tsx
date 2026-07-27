"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { INDUSTRIES } from "@/lib/industries-data";
import type { Lang } from "@/lib/site-copy";

/**
 * The marketing header — a faithful match to Utility Connect's own: a dark navy
 * bar, the orbiting-particle mark, a "Who we work with" dropdown, the EN/ES
 * language selector their site carries, the phone number, and cyan pill
 * buttons. On mobile it collapses to a hamburger, as theirs does.
 */
export function MarketingHeader({ lang = "en" }: { lang?: Lang }) {
  const [industriesOpen, setIndustriesOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const t =
    lang === "es"
      ? { who: "Con quién trabajamos", platform: "Plataforma", company: "Compañía", setup: "Configurar servicios", partner: "Sea nuestro socio" }
      : { who: "Who we work with", platform: "Platform", company: "Company", setup: "Set up services", partner: "Partner with us" };

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--uc-navy-1)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <OrbitMark />
          <span className="text-base font-extrabold uppercase tracking-tight text-white">
            Utility<span style={{ color: "var(--color-state-verified)" }}>Connect</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          <div className="relative" onMouseEnter={() => setIndustriesOpen(true)} onMouseLeave={() => setIndustriesOpen(false)}>
            <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
              {t.who} <span className="text-xs" aria-hidden>▾</span>
            </button>
            <AnimatePresence>
              {industriesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-full grid w-[520px] grid-cols-2 gap-1 rounded-xl border bg-white p-2 shadow-2xl"
                  style={{ borderColor: "#e3e6ea" }}
                >
                  {INDUSTRIES.map((i) => (
                    <Link
                      key={i.slug}
                      href={`/industries/${i.slug}` as never}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#f1f1f1]"
                      style={{ color: "#1a2128" }}
                    >
                      <span style={{ color: i.accent }}>{i.glyph}</span>
                      {i.name}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
            {t.platform}
          </Link>
          <Link href="/future" className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
            {t.company}
          </Link>

          {/* Language selector — theirs is an EN dropdown; so is this. */}
          <div className="relative" onMouseEnter={() => setLangOpen(true)} onMouseLeave={() => setLangOpen(false)}>
            <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
              <span aria-hidden>🌐</span> {lang.toUpperCase()} <span className="text-xs" aria-hidden>▾</span>
            </button>
            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.16 }}
                  className="absolute right-0 top-full w-32 rounded-xl border bg-white p-1 shadow-2xl"
                  style={{ borderColor: "#e3e6ea" }}
                >
                  <Link href={{ pathname: "/", query: {} }} className="block rounded-lg px-3 py-2 text-sm hover:bg-[#f1f1f1]" style={{ color: "#1a2128", fontWeight: lang === "en" ? 700 : 400 }}>
                    English
                  </Link>
                  <Link href={{ pathname: "/", query: { lang: "es" } }} className="block rounded-lg px-3 py-2 text-sm hover:bg-[#f1f1f1]" style={{ color: "#1a2128", fontWeight: lang === "es" ? 700 : 400 }}>
                    Español
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/*
            Not a dial link, deliberately.

            This was `tel:8775879566` — Utility Connect's real, live sales
            line — as a one-tap call from a page that is not theirs. A visitor
            who tapped it reached a real person at a real desk, routed there by
            a concept site the company never agreed to. The footer already
            documented avoiding exactly this; the header never got the memo.

            The number stays visible because removing it would misrepresent the
            page it clones, and it points at the company instead of dialling
            them on our behalf.
          */}
          <a
            href="https://utilityconnect.net"
            target="_blank"
            rel="noopener noreferrer"
            title="Utility Connect's published number — this concept does not route calls"
            className="ml-1 text-sm font-semibold text-white/70 transition-colors hover:text-white"
          >
            (877) 587-9566
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/connect-flow"
            className="hidden rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px sm:block sm:text-sm"
            style={{ background: "var(--color-state-verified)" }}
          >
            {t.setup}
          </Link>
          <Link
            href="/connect-flow"
            className="hidden rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide text-white lg:block"
            style={{ borderColor: "rgba(255,255,255,0.3)" }}
          >
            {t.partner}
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="grid h-10 w-10 place-items-center rounded-lg text-white lg:hidden"
          >
            <span aria-hidden className="text-xl">{mobileOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t lg:hidden"
            style={{ borderColor: "rgba(255,255,255,0.12)", background: "var(--uc-navy-1)" }}
          >
            <div className="space-y-1 px-6 py-4">
              {[
                { href: "/connect-flow", label: t.setup },
                { href: "/dashboard", label: t.platform },
                { href: "/story", label: lang === "es" ? "La historia" : "The story" },
                { href: "/future", label: t.company },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href as never}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-white/85"
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-2 text-xs font-semibold uppercase tracking-widest text-white/40">{t.who}</div>
              <div className="grid grid-cols-2 gap-1">
                {INDUSTRIES.slice(0, 6).map((i) => (
                  <Link
                    key={i.slug}
                    href={`/industries/${i.slug}` as never}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-white/75"
                  >
                    {i.name}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Link href={{ pathname: "/", query: {} }} className="text-sm font-bold text-white/85">EN</Link>
                <Link href={{ pathname: "/", query: { lang: "es" } }} className="text-sm font-bold text-white/85">ES</Link>
                {/* Same reasoning as the desktop nav: shown, never dialled. */}
                <a
                  href="https://utilityconnect.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Utility Connect's published number — this concept does not route calls"
                  className="ml-auto text-sm font-semibold text-white/70"
                >
                  (877) 587-9566
                </a>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function OrbitMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="2.5" fill="var(--color-state-verified)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" stroke="var(--color-state-verified)" strokeWidth="1.4" opacity="0.9" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" stroke="white" strokeWidth="1.2" opacity="0.5" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4" stroke="var(--color-state-verified)" strokeWidth="1.4" opacity="0.9" transform="rotate(120 12 12)" />
    </svg>
  );
}
