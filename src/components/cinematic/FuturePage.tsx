"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  GitBranch,
  Layers,
  LineChart,
  Network,
  Rocket,
  ShieldCheck,
  Wallet,
  Waypoints,
} from "lucide-react";
import { EASE } from "@/lib/motion";
import {
  ChapterMarker,
  FilmGrain,
  InViewBurst,
  MagneticLink,
  Pill,
  RevealHeading,
  Tilt3DCard,
  accentColor,
  type Accent,
} from "./index";
import {
  ConciergeVisual,
  ContinuityVisual,
  ContinuumVisual,
  LaunchpadVisual,
  RelayVisual,
  ReliabilityVisual,
  ScenarioVisual,
  WalletVisual,
} from "./FutureVisuals";

/**
 * The Continuum — the future-vision page as a cinematic scroll.
 *
 * The previous version was eight stacked paragraphs. Everything true was in
 * there and nobody would ever have read it, because a wall of confident prose
 * about software that does not exist is the least persuasive artefact in
 * product work. This is the same eight modules with the same claims and the
 * same honesty labels, rebuilt as a narrative: one act per module, the copy on
 * one side, a live mockup of the mechanism on the other, sides alternating so
 * the eye keeps moving down the page.
 *
 * Two rules hold it to this project's standards rather than letting it become a
 * showreel. First, the labels never blur — BUILT AND FUNCTIONING, INTERACTIVE
 * CONCEPT and FUTURE HYPOTHESIS are printed on every act, and the one module
 * that is actually built says so loudest. Second, every accent names a utility
 * state; there is no colour here chosen because a card needed to look different
 * from the one above it.
 */

type Label = "BUILT AND FUNCTIONING" | "INTERACTIVE CONCEPT" | "FUTURE HYPOTHESIS";

interface Module {
  icon: typeof Network;
  title: string;
  kicker: string;
  body: string;
  bullets: string[];
  visual: ReactNode;
  accent: Accent;
  label: Label;
}

const LABEL_ACCENT: Record<Label, Accent> = {
  "BUILT AND FUNCTIONING": "recovered",
  "INTERACTIVE CONCEPT": "internet",
  "FUTURE HYPOTHESIS": "solar",
};

const MODULES: Module[] = [
  {
    icon: Waypoints,
    title: "Move Relay",
    kicker: "THE SPINE EVERYTHING ELSE STANDS ON",
    body: "Multi-channel ingestion, deterministic duplicate detection, a canonical record no machine may write alone, a grounded briefing, a provider timeout that resolves to UNKNOWN rather than a guess, and reconciliation that finds the order which existed all along.",
    bullets: [
      "Real code over real Postgres, not a mock",
      "Every field carries who supplied it, through which channel, and when",
      "A blind retry is refused — the count of retries not attempted is the headline metric",
    ],
    visual: <RelayVisual />,
    accent: "verified",
    label: "BUILT AND FUNCTIONING",
  },
  {
    icon: GitBranch,
    title: "Concierge Compiler",
    kicker: "A CONVERSATION BECOMES EVIDENCE",
    body: "Every concierge call compiles into facts, and each fact stays tied to the utterance it came from. The AI proposes; a human confirms; the record updates through the same approval path Move Relay already enforces.",
    bullets: [
      "Each extracted fact links back to its transcript moment",
      "Preferences are not facts, and the compiler says so",
      "Demo replays a synthetic call — no live telephony",
    ],
    visual: <ConciergeVisual />,
    accent: "internet",
    label: "INTERACTIVE CONCEPT",
  },
  {
    icon: Wallet,
    title: "Move Wallet & Offer Graph",
    kicker: "ONE TRANSPARENT PLACE FOR EVERY BENEFIT",
    body: "Eligibility is decided by rules against verified campaign data, and the reason is always shown next to the answer. An offer withheld is as legible as an offer granted.",
    bullets: [
      "Eligibility carries its own justification",
      "AI may explain an offer; it may never invent a discount",
      "No secret ranking of providers by who paid",
    ],
    visual: <WalletVisual />,
    accent: "electricity",
    label: "INTERACTIVE CONCEPT",
  },
  {
    icon: Rocket,
    title: "Network Launchpad",
    kicker: "PARTNER ONBOARDING AT NETWORK SCALE",
    body: "Sample data becomes an AI-assisted mapping, which becomes deterministic validation, contract tests, synthetic referrals, a human approval, and only then a live channel — with drift monitoring behind it.",
    bullets: [
      "Credible at LeadingRE scale: ~550 firms, ~135k associates",
      "AI suggests the mapping; it never activates the channel",
      "Drift after launch is surfaced, not silently absorbed",
    ],
    visual: <LaunchpadVisual />,
    accent: "verified",
    label: "INTERACTIVE CONCEPT",
  },
  {
    icon: Layers,
    title: "Scenario Compiler",
    kicker: "DESCRIBE A FAILURE, WATCH IT RUN",
    body: "State a scenario in plain language; the system generates synthetic referrals, injects the failure, runs the permission tests, and returns a pass/fail replay you can step through.",
    bullets: [
      "Duplicate across channels · provider timeout · blocked retry · cross-partner read",
      "The same engine that runs the scenario runs production",
      "scenario.test.ts is a working seed of exactly this",
    ],
    visual: <ScenarioVisual />,
    accent: "recovered",
    label: "INTERACTIVE CONCEPT",
  },
  {
    icon: LineChart,
    title: "Home Continuum",
    kicker: "THE MOVE IS THE ACQUISITION, NOT THE PRODUCT",
    body: "A permissioned home profile that stays useful after move-in: activation checks, plan reviews, renewal windows, life events. The retention engine that turns a one-time acquisition into a relationship.",
    bullets: [
      "Consent re-checked at every beat, never assumed from the first",
      "The direct answer to lifetime-concierge positioning",
      "Same provenance kernel, longer time horizon",
    ],
    visual: <ContinuumVisual />,
    accent: "solar",
    label: "FUTURE HYPOTHESIS",
  },
  {
    icon: ShieldCheck,
    title: "Provider Reliability Graph",
    kicker: "LEARN FROM WHAT ACTUALLY HAPPENED",
    body: "Latency, timeout rate, unknown-outcome rate, reconciliation success — measured across every handoff. No model decides which provider is best; the operational record does.",
    bullets: [
      "Measured, never predicted",
      "The prototype already emits the raw material",
      "An unknown outcome is a fact about a provider, not an error to hide",
    ],
    visual: <ReliabilityVisual />,
    accent: "unknown",
    label: "FUTURE HYPOTHESIS",
  },
  {
    icon: Network,
    title: "Service Continuity Graph",
    kicker: "TWO PRODUCTS, SHARED PRIMITIVES",
    body: "Authorized home-service needs flowing into a verified vendor workflow. Move Relay and a vendor hub stay separate products sharing one kernel — provenance, consent, attribution, workflow state, human approval, audit.",
    bullets: [
      "Portfolio thinking without assuming anyone's private roadmap",
      "The dashed edge is the part that is not built",
      "Authorization is relationship-based, not a role string",
    ],
    visual: <ContinuityVisual />,
    accent: "security",
    label: "FUTURE HYPOTHESIS",
  },
];

/* ── hero ─────────────────────────────────────────────────────────────────── */

function Hero({ onScroll }: { onScroll: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div ref={ref} className="relative flex min-h-[86vh] items-center overflow-hidden">
      {/* One wash of verified blue from below — the only colour in the frame. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 50% 120%, ${accentColor("verified", 0.16)}, transparent 60%)` }}
      />
      <motion.div style={{ y, opacity: fade }} className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        <Pill accent="verified">The continuum</Pill>
        <h1 className="mt-6 max-w-4xl text-[clamp(34px,6vw,76px)] font-extrabold uppercase leading-[1.02] tracking-tight text-white">
          The move is the acquisition.
          <br />
          <span style={{ color: accentColor("verified", 1) }}>The home is the product.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
          Move Relay makes the first handoffs trustworthy. Everything below extends the same
          provenance, consent and attribution kernel across the rest of the home relationship —
          one act at a time, each labelled for exactly what it is.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <button
            onClick={onScroll}
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
            style={{ background: accentColor("verified", 1) }}
          >
            Walk the continuum <ArrowDown className="h-4 w-4" />
          </button>
          <MagneticLink
            href="/story"
            className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
            {...{ style: { borderColor: "rgba(255,255,255,0.28)" } }}
          >
            See the built proof <ArrowRight className="h-4 w-4" />
          </MagneticLink>
        </div>

        {/* Honesty legend, stated before the first claim rather than after the last. */}
        <div className="mt-12 flex flex-wrap gap-2">
          {(Object.keys(LABEL_ACCENT) as Label[]).map((l) => (
            <span
              key={l}
              className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: accentColor(LABEL_ACCENT[l], 0.35),
                background: accentColor(LABEL_ACCENT[l], 0.08),
                color: accentColor(LABEL_ACCENT[l], 0.95),
              }}
            >
              {l}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ── one act ──────────────────────────────────────────────────────────────── */

function StoryRow({ m, index }: { m: Module; index: number }) {
  const Icon = m.icon;
  const flip = index % 2 === 1;

  return (
    <section className="relative">
      <div className="relative mx-auto grid max-w-[1400px] gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.25fr] lg:items-center">
        <span className="absolute left-4 top-14 hidden h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#04070b] font-mono text-[11px] font-semibold text-white/55 sm:flex">
          {String(index + 1).padStart(2, "0")}
        </span>

        <motion.div
          initial={{ opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }}
          transition={{ duration: 0.7, ease: EASE.outQuart }}
          className={`min-w-0 ${flip ? "lg:order-2" : "lg:order-1"}`}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{
                borderColor: accentColor(m.accent, 0.3),
                background: accentColor(m.accent, 0.08),
                color: accentColor(m.accent, 1),
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: accentColor(m.accent, 0.9) }}>
              {m.kicker}
            </span>
          </div>

          <h3 className="mt-5 text-[clamp(26px,3.4vw,46px)] font-semibold leading-[1.06] tracking-tight text-white">
            {m.title}
          </h3>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65">{m.body}</p>

          <ul className="mt-6 space-y-2.5">
            {m.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/70">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accentColor(m.accent, 1) }}
                />
                {b}
              </li>
            ))}
          </ul>

          {/* The label sits with the claim, not in a key at the bottom of the page. */}
          <div className="mt-6">
            <span
              className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{
                borderColor: accentColor(LABEL_ACCENT[m.label], 0.4),
                background: accentColor(LABEL_ACCENT[m.label], 0.1),
                color: accentColor(LABEL_ACCENT[m.label], 1),
              }}
            >
              {m.label}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE.outQuart }}
          className={`relative min-w-0 ${flip ? "lg:order-1" : "lg:order-2"}`}
        >
          <Tilt3DCard max={4}>
            <div className="relative">
              <InViewBurst accent={m.accent} />
              {m.visual}
            </div>
          </Tilt3DCard>
        </motion.div>
      </div>

      <div className="absolute left-[33px] top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-white/8 to-transparent sm:block" />
    </section>
  );
}

/* ── page ─────────────────────────────────────────────────────────────────── */

export default function FuturePage() {
  const storyRef = useRef<HTMLDivElement>(null);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <FilmGrain id="future" />

      <Hero onScroll={() => storyRef.current?.scrollIntoView({ behavior: "smooth" })} />

      <div ref={storyRef} className="scroll-mt-8">
        <ChapterMarker n="01" label="Eight modules, one kernel" />
        <div className="mx-auto max-w-[1400px] px-5 pb-4 sm:px-8">
          <RevealHeading className="max-w-3xl text-[clamp(26px,4vw,52px)] font-semibold leading-[1.06] tracking-tight text-white">
            Preserve · resolve · attribute · verify —{" "}
            <span style={{ color: accentColor("verified", 1) }}>the same primitives, a wider surface.</span>
          </RevealHeading>
        </div>

        {MODULES.map((m, i) => (
          <StoryRow key={m.title} m={m} index={i} />
        ))}
      </div>

      <ChapterMarker n="02" label="The thread" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
          <blockquote className="max-w-3xl text-[clamp(20px,2.6vw,32px)] font-medium leading-[1.3] tracking-tight text-white/90">
            Utility Connect should not only connect the home. It can become the intelligence
            layer that keeps the home, customer, partner, concierge, provider and vendor
            relationship <span style={{ color: accentColor("verified", 1) }}>connected over time</span>.
          </blockquote>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/55">
            One module on this page is built and covered by tests. Five are explorable concepts.
            Two are hypotheses that have been reasoned about and not written. That ratio is
            deliberate, and it is printed on every act above rather than left for you to guess.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <MagneticLink
              href="/story"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
              {...{ style: { background: accentColor("verified", 1) } }}
            >
              Walk the built proof <ArrowRight className="h-4 w-4" />
            </MagneticLink>
            <MagneticLink
              href="/demo"
              className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.25)" } }}
            >
              Run the live demo <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </div>
        </div>
      </section>
    </main>
  );
}
