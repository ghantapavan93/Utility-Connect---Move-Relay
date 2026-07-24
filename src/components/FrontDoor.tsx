"use client";

import { motion } from "framer-motion";

/**
 * "Modernizing the front door" — the before/after comparison.
 *
 * This surfaces a real, public, verifiable fact — the marketing site's front-end
 * stack — in the one framing that is fair and additive. It compares FRONT DOORS,
 * never platforms, and the copy is explicit about that line. It never claims the
 * internal system is dated, never implies a security finding, never judges the
 * team. Handled any other way this observation would violate the project's core
 * constraint; handled this way it is simply "here is the same front door,
 * rebuilt on a current stack."
 */

const ROWS = [
  { layer: "Framework", then: "PHP 5.6 templates", now: "Next.js 16 · React 19" },
  { layer: "Styling", then: "Bootstrap 3.3.1", now: "Tailwind 4 · brand tokens" },
  { layer: "Interactivity", then: "jQuery 1.11.3", now: "Typed React · TypeScript" },
  { layer: "Motion", then: "OWL Carousel", now: "Framer Motion · reduced-motion" },
  { layer: "Signature", then: "Slider banners", now: "WebGL handoff network" },
];

export function FrontDoor() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
          Modernizing the front door
        </div>
        <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight sm:text-4xl">
          Same front door.{" "}
          <span style={{ color: "var(--color-state-verified)" }}>Current stack.</span>
        </h2>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The public site is a capable, well-measured build — and the first thing a partner
          or customer touches. It is delivered on a front-end stack from the early 2010s.
          This redesign shows what that same front door looks like rebuilt on a modern
          component stack.
        </p>
        <p className="mt-3 rounded-lg border p-3 text-xs leading-relaxed" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
          A front-end comparison only. It says nothing about the internal platform — a
          different system this never touches, replaces, or judges.
        </p>
      </div>

      <div className="rounded-2xl border p-2" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-px text-xs">
          <Cell head>Layer</Cell>
          <Cell head>Public site</Cell>
          <Cell head accent>This redesign</Cell>
          {ROWS.map((r, i) => (
            <RowGroup key={r.layer} row={r} delay={i * 0.05} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RowGroup({ row, delay }: { row: { layer: string; then: string; now: string }; delay: number }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.24, delay }}
        className="contents"
      >
        <Cell>{row.layer}</Cell>
        <Cell muted>{row.then}</Cell>
        <Cell accent>{row.now}</Cell>
      </motion.div>
    </>
  );
}

function Cell({
  children,
  head,
  muted,
  accent,
}: {
  children: React.ReactNode;
  head?: boolean;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className="px-4 py-3"
      style={{
        background: "var(--color-ground-0)",
        color: head
          ? "var(--color-text-lo)"
          : accent
            ? "var(--color-state-verified)"
            : muted
              ? "var(--color-text-lo)"
              : "var(--color-text-hi)",
        fontWeight: head ? 600 : accent ? 600 : 400,
        textTransform: head ? "uppercase" : "none",
        letterSpacing: head ? "0.08em" : "normal",
      }}
    >
      {children}
    </div>
  );
}
