"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { INDUSTRIES } from "@/lib/industries-data";

/**
 * The marketing header — a faithful match to Utility Connect's own: a dark navy
 * bar, the orbiting-particle mark, a "Who we work with" dropdown, a phone number,
 * and cyan pill buttons. Their nav collapses to a menu; on desktop it lays the
 * items out. This keeps their structure and adds an animated dropdown.
 */
export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--uc-navy-1)" }}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <OrbitMark />
          <span className="text-base font-extrabold uppercase tracking-tight text-white">
            Utility<span style={{ color: "var(--color-state-verified)" }}>Connect</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
              Who we work with
              <span className="text-xs">▾</span>
            </button>
            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 top-full grid w-[520px] grid-cols-2 gap-1 rounded-xl border p-2 shadow-2xl"
                  style={{ background: "white", borderColor: "#e3e6ea" }}
                >
                  {INDUSTRIES.map((i) => (
                    <Link
                      key={i.slug}
                      href={`/industries/${i.slug}` as never}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[#f1f1f1]"
                      style={{ color: "#1a2128" }}
                    >
                      <span style={{ color: "var(--color-state-verified)" }}>{i.glyph}</span>
                      {i.name}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
            Platform
          </Link>
          <Link href="/future" className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white/80 hover:text-white">
            Company
          </Link>

          <a href="tel:8775879566" className="ml-2 text-sm font-semibold text-white/70">
            (877) 587-9566
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/connect-flow"
            className="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px sm:text-sm"
            style={{ background: "var(--color-state-verified)" }}
          >
            Set up services
          </Link>
          <Link
            href="/connect-flow"
            className="hidden rounded-full border px-4 py-2 text-sm font-bold uppercase tracking-wide text-white sm:block"
            style={{ borderColor: "rgba(255,255,255,0.3)" }}
          >
            Partner with us
          </Link>
        </div>
      </div>
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
