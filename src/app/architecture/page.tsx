import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, InViewBurst, MagneticLink, Pill, Tilt3DCard } from "@/components/cinematic";
import { accentColor, accentInk } from "@/lib/accents";
import { DECISIONS, type Decision } from "@/lib/decisions";
import { DecisionScene } from "@/components/architecture/DecisionScenes";
import { AuroraCanvas } from "@/components/ui/cosmic-aurora";
import { TrustMapBackdrop } from "@/components/architecture/TrustMapBackdrop";

/**
 * The architecture page — written for a CTO. It states the decisions that carry
 * risk and the reason each was made, and points at the tests that prove them.
 */
export default function Architecture() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      {/*
        A flow field, on the page about constraining where data may go. Paths
        that are unpredictable in detail and plainly governed in aggregate are
        what every decision listed below is trying to produce.
      */}
      <AuroraCanvas />
      <FilmGrain id="arch" />

      {/*
        The content gets its own stacking context above the canvas. A fixed,
        positioned element paints above non-positioned block content regardless
        of source order, so without this the field would cover the page.
      */}
      <div className="relative" style={{ zIndex: 1 }}>

      {/*
        An architecture page is usually a diagram nobody can disagree with. This
        one is a list of decisions that could have gone the other way, each with
        the reason it did not — because a decision with no rejected alternative
        was never a decision. Every entry names the constraint or the test that
        enforces it, so the document cannot drift away from the code without
        something going red.
      */}
      <CineHero
        /*
          The mechanism, not a photograph of a house.

          This was `/renders/arrival.webp` — a 3D render of a driveway — on a
          page about partial unique indexes, CHECK constraints and authority
          boundaries. A reader met a picture of a home and learned nothing from
          the largest element on the screen. The strongest hero for a page about
          a mechanism is the mechanism, running.
        */
        backdrop={<TrustMapBackdrop />}
        accent="verified"
        pills={
          <>
            <Pill accent="verified">Six load-bearing decisions</Pill>
            <Pill accent="recovered">Each one enforced by a test</Pill>
          </>
        }
        headline={
          <>
            Opinions are cheap.
            <br />
            <span className="cine-shimmer">Constraints are not.</span>
          </>
        }
        sub="Six decisions that carry real risk, the reason each was made this way, and the constraint or test that stops it quietly becoming untrue. Documentation drifts; a failing build does not."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "verified",
            body: "Give a reviewer the decisions worth arguing with, rather than a diagram nobody can disagree with.",
          },
          {
            eyebrow: "Proof",
            accent: "recovered",
            body: "Twelve schema guarantees are proven by SQL that must be rejected, and fitness tests fail the build if a module crosses a boundary this page claims it does not.",
          },
          {
            eyebrow: "Code",
            accent: "unknown",
            body: "Idempotency persisted in Postgres rather than Redis, so correctness survives cache eviction. Audit is append-only by rule, not by discipline.",
          },
        ]}
        actions={
          <MagneticLink
            href="/demo"
            className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white"
            {...{ style: { background: accentColor("verified", 1) } }}
          >
            See it running <ArrowRight className="h-4 w-4" />
          </MagneticLink>
        }
      />

      <ChapterMarker n="01" label="Six decisions" />
      <div className="mx-auto max-w-[1400px] px-5 pb-4 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          A decision with no rejected alternative{" "}
          <span style={{ color: accentInk("verified") }}>was never a decision</span>.
        </h2>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/60">
          Each of these could have gone the other way, and the other way is usually the
          default. So every one names what was rejected, what it would have cost, and the
          constraint that enforces the choice — because a claim about a guarantee is worth
          nothing without the line that makes it one.
        </p>
      </div>

      {DECISIONS.map((dec, i) => (
        <DecisionSection key={dec.slug} d={dec} index={i} />
      ))}

      <ChapterMarker n="02" label="Check it yourself" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <div className="cine-glass max-w-2xl rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/90">Nothing here needs Docker</h3>
          <p className="mt-2 text-sm leading-relaxed text-white/60">
            The suite runs against an embedded Postgres, so the guarantees on this page can be
            verified on a laptop in under a minute.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/50 p-4 font-mono text-xs leading-relaxed text-white/75">
{`npm install
npm run verify   # 12 schema guarantees + the behaviour suite`}
          </pre>
        </div>
      </section>
      </div>
    </main>
  );
}

/**
 * One decision, argued rather than asserted.
 *
 * Four parts, in the order a sceptic reads them: the drawing, because the
 * mechanism is a shape before it is a sentence; the claim; the alternative that
 * was rejected and what it would have cost; and the constraint itself, because
 * every sentence above it is only as good as that line of SQL.
 *
 * Sides alternate so a page of six does not read as a column, and the diagram
 * leads on the first one — a reviewer who reads nothing else should still have
 * seen a mechanism refuse something.
 */
function DecisionSection({ d, index }: { d: Decision; index: number }) {
  const flip = index % 2 === 1;

  return (
    <section className="relative mx-auto max-w-[1400px] px-5 py-12 sm:px-8 sm:py-16">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className={`min-w-0 ${flip ? "lg:order-2" : "lg:order-1"}`}>
          <span className="font-mono text-[11px] font-semibold text-white/55">
            {String(index + 1).padStart(2, "0")}
          </span>

          <h3 className="mt-2 text-[clamp(20px,2.6vw,32px)] font-semibold leading-[1.1] tracking-tight text-white">
            {d.title}
          </h3>

          {/* The one sentence this decision may say loudly. */}
          <p className="mt-3.5 max-w-xl text-[clamp(15px,1.7vw,19px)] font-semibold leading-[1.35] tracking-tight text-white/95">
            {d.line}
          </p>

          <p className="mt-3.5 max-w-xl text-sm leading-relaxed text-white/60">{d.body}</p>

          {/*
            The rejected alternative, given its own frame rather than a clause.
            It is the half of a decision that is normally left out, and leaving
            it out is what turns an argument into an assertion.
          */}
          <div
            className="mt-5 max-w-xl rounded-xl p-4"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: accentInk("conflict") }}
            >
              Rejected
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-white/70">{d.rejected.option}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/50">{d.rejected.cost}</p>
          </div>

          {/* The line that actually holds. */}
          <div className="mt-4 max-w-xl overflow-hidden rounded-xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
            <div
              className="flex items-center justify-between px-3.5 py-2 font-mono text-[10px]"
              style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.5)" }}
            >
              <span>{d.code.source}</span>
              <span>{d.code.lang}</span>
            </div>
            <pre className="overflow-x-auto bg-black/40 px-3.5 py-3 font-mono text-[11px] leading-relaxed text-white/75">
{d.code.snippet}
            </pre>
          </div>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-white/45">
            <span className="font-semibold text-white/65">Why this is not the default. </span>
            {d.unusual}
          </p>

          <p
            className="mt-3 border-l-2 pl-3 font-mono text-[11px] leading-relaxed"
            style={{ borderColor: accentColor(d.accent, 0.7), color: accentInk(d.accent) }}
          >
            {d.proof}
          </p>
        </div>

        <div className={`relative min-w-0 ${flip ? "lg:order-1" : "lg:order-2"}`}>
          <Tilt3DCard max={4}>
            <div className="cine-glass relative overflow-hidden rounded-2xl p-4 sm:p-6">
              <InViewBurst accent={d.accent} />
              <div className="aspect-[420/260] w-full"><DecisionScene slug={d.slug} /></div>
            </div>
          </Tilt3DCard>
        </div>
      </div>
    </section>
  );
}
