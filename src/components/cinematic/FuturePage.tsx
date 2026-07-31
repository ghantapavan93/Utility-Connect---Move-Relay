"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowDown, ArrowRight } from "lucide-react";

import { EASE } from "@/lib/motion";
import { CONTINUUM, labelCounts, type ContinuumModule } from "@/lib/continuum";
import { accentColor, accentInk } from "@/lib/accents";
import { ParticleCanvas } from "@/components/ui/particle-canvas";
import { SCENES, AuthorityStackScene } from "@/components/continuum/Scenes";
import { asRoute } from "@/lib/routes";
import {
  ChapterMarker,
  FilmGrain,
  InViewBurst,
  MagneticLink,
  Pill,
  RevealHeading,
  Tilt3DCard,
} from "./index";

/**
 * The Continuum — one verified handoff becoming a living home relationship.
 *
 * Rebuilt from a catalogue into a sequence. The previous version was eight
 * modules arguing for themselves in parallel, several of them arguing the same
 * thing: two sections about getting data in, three about surfacing what needs
 * attention. Read end to end it was a list, and a list has no thesis.
 *
 * Now the order carries the argument. Everything enters through one door, a
 * human is helped rather than replaced, what needs attention explains itself,
 * the partner who sent it can see it, the relationship outlives the move, and
 * an external agent is let near it last and least.
 *
 * Two rules hold it to this project's standards. The honesty labels never
 * blur — one built, four concepts, two hypotheses, printed on every act and
 * counted by a test. And each section is allowed exactly one bold sentence,
 * because a page where everything is emphasised has emphasised nothing.
 *
 * No competitor is named anywhere on this page. The market reasoning behind
 * these sections, with sources, is in `research/competitive-landscape.md`.
 */

const WORD: Record<number, string> = {
  1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six", 7: "Seven", 8: "Eight",
};

function StorySection({ m, index }: { m: ContinuumModule; index: number }) {
  const Scene = SCENES[m.slug];
  // Sides alternate so the eye keeps travelling down the page rather than
  // running a column.
  const flip = index % 2 === 1;

  return (
    <section className="relative mx-auto max-w-[1400px] px-5 py-16 sm:px-8 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: EASE.outQuart }}
          className={`min-w-0 ${flip ? "lg:order-2" : "lg:order-1"}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Pill accent={m.accent}>{m.label}</Pill>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
              {m.kicker}
            </span>
          </div>

          <h3 className="mt-5 text-[clamp(26px,3.4vw,44px)] font-semibold leading-[1.06] tracking-tight text-white">
            {m.title}
          </h3>

          {/*
            The one sentence this section may say loudly. Everything else on the
            page is body weight, which is what lets this land at all.
          */}
          <p className="mt-4 max-w-xl text-[clamp(17px,1.9vw,22px)] font-semibold leading-[1.35] tracking-tight text-white/95">
            {m.line}
          </p>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">{m.body}</p>

          <ul className="mt-6 space-y-2.5">
            {m.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm leading-relaxed text-white/70">
                <span
                  aria-hidden
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accentColor(m.accent, 1) }}
                />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-5">
            <Link
              href={asRoute(`/future/${m.slug}`)}
              className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em]"
              style={{ color: accentInk(m.accent) }}
            >
              The full case
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
            {m.proof && (
              <Link
                href={asRoute(m.proof.href)}
                className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/55 transition-colors hover:text-white/90"
              >
                {m.proof.label}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
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
            <div className="cine-glass relative overflow-hidden rounded-2xl p-4 sm:p-6">
              <InViewBurst accent={m.accent} />
              <div className="aspect-[420/260] w-full">{Scene ? <Scene /> : null}</div>
            </div>
          </Tilt3DCard>
        </motion.div>
      </div>
    </section>
  );
}

export default function FuturePage() {
  const storyRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const counts = labelCounts();

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroFade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      {/*
        The same field the demo runs on.

        The beams were doing an honest job — encoding the built/concept/
        hypothesis ratio as colour — and reading badly: a coloured wash with no
        detail, competing with the diagrams rather than sitting behind them.
        The particle field is the vocabulary this project already uses for
        records in transit, so the background of a page about a record's life
        is now made of records.

        Fixed at `arrival` rather than wired to state, and that is deliberate:
        this page reads no database, and driving the field from a phase it
        cannot observe would be the decoration the demo's version specifically
        avoids. Arrival is the phase this whole page is about.
      */}
      <div className="cine-aurora" aria-hidden />
      <ParticleCanvas phase="arrival" />
      <FilmGrain id="future" />

      <div className="relative" style={{ zIndex: 1 }}>
        <section ref={heroRef} className="mx-auto max-w-[1400px] px-5 pb-16 pt-24 sm:px-8 sm:pb-24 sm:pt-32">
          <motion.div style={{ opacity: heroFade }}>
            <div className="flex flex-wrap items-center gap-2">
              <Pill accent="verified">The Continuum</Pill>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                An additive hypothesis
              </span>
            </div>

            <RevealHeading className="mt-6 max-w-4xl text-[clamp(34px,6vw,76px)] font-semibold leading-[1.02] tracking-tight text-white">
              From one verified handoff to a living home relationship
            </RevealHeading>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-white/70">
              Move Relay begins at one difficult moment: three sources disagreeing about a
              household, and a provider whose reply never arrives. Once that foundation is
              trustworthy, the same verified record can carry everything that comes after it.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <button
                onClick={() => storyRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
                style={{ background: "var(--uc-cyan-fill)" }}
              >
                Walk the continuum <ArrowDown className="h-4 w-4" />
              </button>
              <MagneticLink
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
                {...{ style: { borderColor: "rgba(255,255,255,0.25)" } }}
              >
                See the built proof <ArrowRight className="h-4 w-4" />
              </MagneticLink>
            </div>

            {/*
              The ratio, at the top rather than buried at the bottom. It is the
              most important thing on the page and the easiest to skim past.
            */}
            <div className="mt-10 flex flex-wrap gap-2">
              <Pill accent="recovered">{counts["BUILT AND FUNCTIONING"] ?? 0} built and functioning</Pill>
              <Pill accent="internet">{counts["INTERACTIVE CONCEPT"] ?? 0} interactive concepts</Pill>
              <Pill accent="solar">{counts["FUTURE HYPOTHESIS"] ?? 0} future hypotheses</Pill>
            </div>
          </motion.div>
        </section>

        <div ref={storyRef} className="scroll-mt-8">
          <ChapterMarker n="01" label="Seven sections, one record" />
          <div className="mx-auto max-w-[1400px] px-5 pb-2 sm:px-8">
            <p className="max-w-2xl text-base leading-relaxed text-white/60">
              The order is the argument. Everything enters through one door, a person is helped
              rather than replaced, what needs attention explains itself, the partner who sent it
              can see it, the relationship outlives the move — and an external agent is let near
              it last, and least.
            </p>
          </div>

          {CONTINUUM.map((m, i) => (
            <StorySection key={m.slug} m={m} index={i} />
          ))}
        </div>

        <ChapterMarker n="02" label="The boundary that holds it together" />
        <section className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div className="min-w-0">
              <h2 className="max-w-xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.06] tracking-tight text-white">
                Not an autonomous assistant.
                <br />
                <span style={{ color: accentInk("verified") }}>
                  A human-led system where every intelligent action stays grounded.
                </span>
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-relaxed text-white/60">
                Read it from the bottom. Nothing above a layer is safe until the layer beneath it
                exists: intelligence is only worth having over a record you can verify, and
                authority is only meaningful over intelligence you can constrain.
              </p>
            </div>
            <div className="min-w-0">
              <div className="cine-glass relative overflow-hidden rounded-2xl p-4 sm:p-6">
                <div className="aspect-[420/260] w-full">
                  <AuthorityStackScene />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12">
            <blockquote className="max-w-3xl text-[clamp(20px,2.6vw,32px)] font-medium leading-[1.3] tracking-tight text-white/90">
              Utility Connect should not only connect the home. It can become the layer that keeps
              the home, customer, partner, concierge and provider relationship{" "}
              <span style={{ color: accentInk("verified") }}>connected over time</span>.
            </blockquote>

            <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/55">
              {WORD[counts["BUILT AND FUNCTIONING"] ?? 0]} section on this page is built and covered
              by tests. {WORD[counts["INTERACTIVE CONCEPT"] ?? 0]} are explorable concepts.{" "}
              {WORD[counts["FUTURE HYPOTHESIS"] ?? 0]} are hypotheses that have been reasoned about
              and not written. That ratio is deliberate, and it is printed on every act above
              rather than left for you to guess.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticLink
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
                {...{ style: { background: "var(--uc-cyan-fill)" } }}
              >
                Open the operator console <ArrowRight className="h-4 w-4" />
              </MagneticLink>
              <MagneticLink
                href="/architecture"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
                {...{ style: { borderColor: "rgba(255,255,255,0.25)" } }}
              >
                Read the decisions <ArrowRight className="h-4 w-4" />
              </MagneticLink>
            </div>

            {/*
              The disclosure, quiet and unavoidable. This is a portfolio piece
              reasoning from public workflows, not anyone's internal roadmap,
              and a page of confident future-tense product copy has to say so
              somewhere a reader will actually reach.
            */}
            <p className="mt-8 max-w-2xl text-xs leading-relaxed text-white/40">
              Future hypotheses reasoned from publicly observable moving and home-service
              workflows. Not affiliated with Utility Connect, and not presented as its internal
              roadmap. Every customer, partner and provider record in this project is synthetic.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
