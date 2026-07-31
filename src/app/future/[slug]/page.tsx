import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { CONTINUUM, continuumModule } from "@/lib/continuum";
import { accentColor, accentInk } from "@/lib/accents";
import { ChapterMarker, FilmGrain, Pill } from "@/components/cinematic";
import { ParticleCanvas } from "@/components/ui/particle-canvas";
import { asRoute } from "@/lib/routes";

/**
 * One module of the Continuum, in full.
 *
 * The index page listed eight of these as cards and stopped, which left the
 * only question anyone senior actually asks — *what would you build, and what
 * would have to be true* — unanswered anywhere on the site. A vision that
 * cannot be interrogated is a slogan, and a slogan is exactly what a reviewer
 * is expecting to find here.
 *
 * So every module gets the same five sections, in the same order, including the
 * one most decks omit: the open questions. A module page that only argued for
 * itself would be marketing; the section that says what is unmeasured, unproven
 * or commercially undecided is what makes the rest of it worth reading.
 *
 * One route rather than eight files. The sections are identical by design —
 * comparing two modules should be reading the same headings twice, not
 * discovering that one of them declined to state its risks.
 */

export function generateStaticParams() {
  return CONTINUUM.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const m = continuumModule((await params).slug);
  if (!m) return { title: "Not found" };
  return {
    title: `${m.title} — The Continuum`,
    description: m.body.slice(0, 180),
  };
}

export default async function ContinuumModulePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const m = continuumModule((await params).slug);
  if (!m) notFound();

  const index = CONTINUUM.findIndex((x) => x.slug === m.slug);
  const next = CONTINUUM[(index + 1) % CONTINUUM.length]!;

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <ParticleCanvas phase="arrival" />
      <FilmGrain id={`continuum-${m.slug}`} />

      <div className="relative" style={{ zIndex: 1 }}>
        <section className="mx-auto max-w-[1100px] px-5 pt-16 sm:px-8 sm:pt-24">
          <Link
            href="/future"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/55 transition-colors hover:text-white/90"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> The Continuum
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {/*
              The label first, before the name. Which of the three tiers this
              sits in changes how every sentence below should be read, and a
              reader who scrolls past it has been misled by the layout.
            */}
            <Pill accent={m.accent}>{m.label}</Pill>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
              {m.kicker}
            </span>
          </div>

          <h1
            className="mt-4 font-semibold leading-[1.03] tracking-tight"
            style={{ fontSize: "clamp(34px,5.4vw,68px)" }}
          >
            {m.title}
          </h1>
          <div
            className="mt-5 h-1 w-16 rounded-full"
            style={{ background: accentColor(m.accent, 1) }}
          />
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">{m.body}</p>

          {m.proof && (
            <Link
              href={asRoute(m.proof.href)}
              className="mt-7 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: accentColor(m.accent, 1) }}
            >
              {m.proof.label} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>

        <ChapterMarker n="01" label="The problem" />
        <Section>
          <p className="max-w-3xl text-[clamp(17px,2vw,22px)] leading-[1.5] text-white/85">
            {m.problem}
          </p>
        </Section>

        <ChapterMarker n="02" label="How it would work" />
        <Section>
          <ol className="grid gap-4 sm:grid-cols-2">
            {m.mechanism.map((s, i) => (
              <li
                key={s.step}
                className="cine-glass rounded-2xl p-6"
                /* Numbered because the order *is* the design — several of these
                   are safe only because the step before them already ran. */
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: accentInk(m.accent) }}
                >
                  Step {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-2 text-base font-semibold leading-snug">{s.step}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">{s.detail}</p>
              </li>
            ))}
          </ol>

          <ul className="mt-6 grid gap-2">
            {m.bullets.map((b) => (
              <li key={b} className="flex gap-3 text-sm text-white/65">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accentColor(m.accent, 1) }}
                />
                {b}
              </li>
            ))}
          </ul>
        </Section>

        <ChapterMarker n="03" label="What it stands on" />
        <Section>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-white/55">
            Nothing here proposes a second system. Each of these is a primitive that already
            exists in the built kernel, is covered by tests, and would carry this module without
            being modified for it.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {m.reuses.map((r) => (
              <div key={r.primitive} className="cine-hairline rounded-xl p-5">
                <code className="font-mono text-xs" style={{ color: accentInk("verified") }}>
                  {r.primitive}
                </code>
                <p className="mt-2 text-xs leading-relaxed text-white/55">{r.why}</p>
              </div>
            ))}
          </div>
        </Section>

        <ChapterMarker n="04" label="Where the AI stops" />
        <Section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Boundary
              title="It may"
              items={m.aiBoundary.may}
              tone={accentInk("recovered")}
            />
            {/*
              The right-hand column is the one that matters. Every system claims
              a capability list; the projects that stay trustworthy are the ones
              that wrote the refusal list first and did not quietly shorten it
              when a demo needed something.
            */}
            <Boundary
              title="It must never"
              items={m.aiBoundary.mayNot}
              tone={accentInk("failed")}
            />
          </div>
        </Section>

        <ChapterMarker n="05" label="What would have to be true" />
        <Section>
          <p className="mb-5 max-w-2xl text-sm leading-relaxed text-white/55">
            The section a roadmap usually omits. These are unresolved — some are unmeasured, some
            are commercial rather than technical, and one or two might be reasons not to build
            this at all.
          </p>
          {/*
            The same dot the bullets and the boundary lists use, in amber.

            This was a coloured left border per item, which put a row of amber
            tabs down the page — the stack of side-tabs that reads as generated
            rather than designed. The page does carry a left rule elsewhere, on
            a blockquote, where it is a pullquote convention and marks one
            passage; repeated down every item of a list it stops marking
            anything and becomes texture.

            Amber because this system gives it one meaning: needs judgement.
            These are open questions, which is exactly that. The emphasis this
            section deserves comes from the chapter marker and the paragraph
            above it, not from eight coloured edges.
          */}
          <ul className="grid gap-3">
            {m.openQuestions.map((q) => (
              <li key={q} className="flex gap-3 text-sm leading-relaxed text-white/70">
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accentColor("conflict", 1) }}
                />
                {q}
              </li>
            ))}
          </ul>
        </Section>

        <section className="mx-auto max-w-[1100px] px-5 pb-24 sm:px-8">
          <Link
            href={asRoute(`/future/${next.slug}`)}
            className="cine-glass group flex items-center justify-between gap-4 rounded-2xl p-6 transition-colors hover:bg-white/[0.06]"
          >
            <span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                Next module
              </span>
              <span className="mt-1 block text-lg font-semibold">{next.title}</span>
              <span className="text-xs text-white/55">{next.label}</span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </section>
      </div>
    </main>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <section className="mx-auto max-w-[1100px] px-5 pb-10 sm:px-8">{children}</section>;
}

function Boundary({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="cine-glass rounded-2xl p-6">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: tone }}>
        {title}
      </div>
      <ul className="mt-3 grid gap-2.5">
        {items.map((i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/70">
            <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}
