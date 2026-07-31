"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { Pulse } from "@/components/diagram/primitives";
import { asRoute } from "@/lib/routes";

/**
 * The last thing on the home page, and the only one that leads anywhere deep.
 *
 * A reviewer arriving here has read a marketing site. They have no idea there
 * are twelve further routes carrying the actual proof, and no reason to guess
 * that `/theater` or `/views` are worth a click — route names are the worst
 * possible invitation. Every deep page could be excellent and still never be
 * opened.
 *
 * So this band does two things in order. It plays the whole product as six
 * states in about eight seconds — three sources, a disagreement, a person, a
 * lost reply, a refusal, a recovery — and then turns those states into six
 * questions a reviewer might actually have. The navigation becomes a
 * consequence of the story rather than an interruption of it.
 *
 * It sits between the closing call to action and the footer, and changes
 * nothing above it. The marketing site keeps its light theme and its own job;
 * this is a dark band because the shift from *claim* to *evidence* deserves to
 * be felt before it is read.
 *
 * The links are real anchors, present in the DOM from first paint, reachable by
 * keyboard, and unaffected by whether any of the animation runs. A page whose
 * navigation depends on a canvas is a page that is broken for the people least
 * able to report it.
 */

interface Moment {
  label: string;
  line: string;
  accent: Accent;
  /** Where the strand sits on the rail, 0 to 1. */
  at: number;
  dashed?: boolean;
  broken?: boolean;
}

const MOMENTS: Moment[] = [
  { label: "INTAKE", line: "Three sources. One accountable move.", accent: "verified", at: 0.06 },
  { label: "CONFLICT", line: "Disagreement stays visible.", accent: "conflict", at: 0.24, dashed: true },
  { label: "APPROVAL", line: "A human owns the decision.", accent: "security", at: 0.42 },
  { label: "SUBMITTED", line: "The provider created the order. The reply disappeared.", accent: "failed", at: 0.6, broken: true },
  { label: "REFUSED", line: "The system refused to guess.", accent: "unknown", at: 0.78, dashed: true },
  { label: "RECOVERED", line: "Evidence returned. The move continued.", accent: "recovered", at: 0.95 },
];

interface Portal {
  question: string;
  href: string;
  answer: string;
  accent: Accent;
  /** Exactly one. A page where everything is recommended recommends nothing. */
  recommended?: boolean;
}

const PORTALS: Portal[] = [
  {
    question: "What happened to the move?",
    href: "/demo",
    answer: "Run the nine steps against a real database.",
    accent: "verified",
    recommended: true,
  },
  {
    question: "Can I inspect the actual record?",
    href: "/moves",
    answer: "Every field, and where each value came from.",
    accent: "internet",
  },
  {
    question: "What proves the system is safe?",
    href: "/theater",
    answer: "Six attacks. Six refusals, with the rows.",
    accent: "conflict",
  },
  {
    question: "Why was it designed this way?",
    href: "/architecture",
    answer: "Six decisions, and what each one rejected.",
    accent: "recovered",
  },
  {
    question: "What is AI allowed to do?",
    href: "/agent",
    answer: "Read and propose. Never decide.",
    accent: "security",
  },
  {
    question: "What could this become?",
    href: "/future",
    answer: "Built, concept and hypothesis, kept apart.",
    accent: "solar",
  },
];

/** The rail the move travels. One path, so every strand shares its geometry. */
const RAIL = "M60 96 H1140";

export function RelayConstellation() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const still = useStillness();
  const play = inView && !still;

  return (
    <section
      ref={ref}
      aria-labelledby="relay-constellation-heading"
      className="relative overflow-hidden"
      style={{ background: "var(--uc-navy-0, #12171c)" }}
    >
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accentInk("verified") }}>
            One move, end to end
          </span>
          <h2
            id="relay-constellation-heading"
            className="mt-3 text-[clamp(26px,3.6vw,44px)] font-extrabold uppercase leading-[1.05] tracking-tight text-white"
          >
            You have seen the outcome.
            <br />
            <span style={{ color: accentInk("verified") }}>Now inspect the proof.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Everything above is the front door. Underneath it is a working system that keeps a
            disagreement visible, refuses to guess when a provider goes quiet, and can show you the
            row behind every claim on this page.
          </p>
        </div>

        {/*
          The story, as one rail.

          Hidden from assistive technology because the six lines are repeated as
          real text below — a screen reader should hear the sentences once, in
          order, not narrate a diagram of them.
        */}
        <div aria-hidden className="mt-12 hidden sm:block">
          <svg viewBox="0 0 1200 192" className="h-auto w-full" fill="none" strokeLinecap="round">
            <motion.path
              d={RAIL}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1.2}
              initial={{ pathLength: 0 }}
              animate={play ? { pathLength: 1 } : { pathLength: still ? 1 : 0 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
            />

            {MOMENTS.map((m, i) => {
              const x = 60 + m.at * 1080;
              return (
                <g key={m.label}>
                  {/* The strand rising to its label. Dashed where the state is
                      unresolved, which is the same rule the rest of the site
                      uses for a pending line. */}
                  <motion.path
                    d={`M${x} 96 V 58`}
                    stroke={accentColor(m.accent, 0.6)}
                    strokeWidth={1.3}
                    strokeDasharray={m.dashed ? "4 4" : undefined}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={play || still ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                    transition={{ duration: 0.4, delay: still ? 0 : 0.6 + i * 0.5 }}
                  />
                  <motion.circle
                    cx={x}
                    cy={96}
                    r={m.broken ? 6 : 5}
                    fill={accentColor(m.accent, 1)}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={play || still ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                    transition={{ duration: 0.3, delay: still ? 0 : 0.65 + i * 0.5 }}
                    style={{ transformOrigin: `${x}px 96px` }}
                  />
                  <motion.text
                    x={x}
                    y={48}
                    fontSize={9}
                    textAnchor="middle"
                    letterSpacing="0.14em"
                    fill={accentInk(m.accent)}
                    initial={{ opacity: 0 }}
                    animate={play || still ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.35, delay: still ? 0 : 0.75 + i * 0.5 }}
                  >
                    {m.label}
                  </motion.text>
                </g>
              );
            })}

            {/* The break, drawn where certainty was lost. It is the only mark on
                the rail that interrupts it rather than sitting on it. */}
            <motion.path
              d="M708 96 H772"
              stroke="var(--uc-navy-0, #12171c)"
              strokeWidth={5}
              initial={{ opacity: 0 }}
              animate={play || still ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.2, delay: still ? 0 : 2.6 }}
            />
            <motion.path
              d="M708 96 H772"
              stroke={accentColor("failed", 0.85)}
              strokeWidth={1.4}
              strokeDasharray="3 5"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={play || still ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.4, delay: still ? 0 : 2.7 }}
            />

            {/* The move itself, travelling the rail on a loop once the story has
                told itself. Motion that says the system is running, not that
                something needs attention. */}
            <Pulse d={RAIL} accent="verified" play={play} delay={3.6} duration={5.4} r={3.4} />
          </svg>
        </div>

        {/* The six sentences, as text. This is the story on mobile, the caption
            on desktop, and the only version a screen reader hears. */}
        <ol className="mt-8 grid gap-2.5 sm:mt-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOMENTS.map((m, i) => (
            <motion.li
              key={m.label}
              className="flex items-start gap-3"
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: still ? 0 : i * 0.06 }}
            >
              <span
                aria-hidden
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: accentColor(m.accent, 1) }}
              />
              <span className="text-sm leading-relaxed text-white/70">{m.line}</span>
            </motion.li>
          ))}
        </ol>

        {/*
          Questions, not route names.

          A reviewer does not want to visit `/theater`; they want to know
          whether the safety claims are real. Labelling the door with the
          question behind it is the whole difference between a nav and an
          invitation.
        */}
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PORTALS.map((p, i) => (
            <motion.div
              key={p.href}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: still ? 0 : i * 0.05 }}
            >
              <Link
                href={asRoute(p.href)}
                className="group relative block h-full overflow-hidden rounded-xl border p-5 transition-colors"
                style={{
                  borderColor: p.recommended ? accentColor(p.accent, 0.55) : "rgba(255,255,255,0.12)",
                  background: p.recommended ? accentColor(p.accent, 0.07) : "rgba(255,255,255,0.02)",
                }}
              >
                {/* One breathing outline, on one card. Every card glowing is
                    every card shouting, which is the same as silence. */}
                {p.recommended && !still && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-xl"
                    style={{ boxShadow: `0 0 0 1px ${accentColor(p.accent, 0.5)}` }}
                    animate={{ opacity: [0.25, 0.9, 0.25] }}
                    transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                <div className="relative flex items-start justify-between gap-3">
                  <span className="text-sm font-semibold leading-snug text-white">{p.question}</span>
                  <ArrowRight
                    className="mt-0.5 h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                    style={{ color: accentInk(p.accent) }}
                  />
                </div>
                <p className="relative mt-2 text-xs leading-relaxed text-white/55">{p.answer}</p>
                {p.recommended && (
                  <span
                    className="relative mt-3 inline-block text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: accentInk(p.accent) }}
                  >
                    Start here · 90 seconds
                  </span>
                )}
              </Link>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-xs leading-relaxed text-white/40">
          Every record behind these pages is synthetic. This is an independent proof of work, not an
          official Utility Connect product.
        </p>
      </div>
    </section>
  );
}
