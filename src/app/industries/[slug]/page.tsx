import Link from "next/link";
import { notFound } from "next/navigation";
import { MarketingHeader } from "@/components/MarketingHeader";
import { Reveal } from "@/components/Reveal";
import { INDUSTRIES, getIndustry } from "@/lib/industries-data";
import { RelayForIndustry } from "@/components/industries/RelayForIndustry";
import { asRoute } from "@/lib/routes";

/**
 * A dedicated page per industry, mirroring Utility Connect's own "Who we work
 * with" pages: a bold headline, a value proposition, a how-it-works, and their
 * signature "Your Branded Microsite" section — the white-label promise their
 * site makes to partners, here made concrete with the measured brand tokens.
 *
 * Statically generated for all nine industries.
 */

export function generateStaticParams() {
  return INDUSTRIES.map((i) => ({ slug: i.slug }));
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();

  const others = INDUSTRIES.filter((i) => i.slug !== slug).slice(0, 6);

  return (
    // Reskin the whole page to this industry's accent by overriding the
    // verified-state token locally. Utility Connect color-themes each industry
    // page; this is that, driven by one variable. The state semantics elsewhere
    // in the app are untouched — this override is scoped to this page.
    <div
      className="theme-light"
      style={{ background: "var(--color-ground-0)", minHeight: "100dvh", ["--color-state-verified" as string]: industry.accent }}
    >
      <MarketingHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16">
        {/* Hero */}
        <Reveal>
          {/*
            As a bare line of text this was 16px tall — the smallest tap target
            on the page and the first one a phone user reaches for.

            `py-3.5` grows the hit area to 44px (16px line box plus 14px each
            side) and the matching `-my-3.5` cancels it out of the flow, so the
            target triples without the hero moving a pixel. The area it claims
            above and below is empty space, not another control.
          */}
          <Link href="/#industries" className="-my-3.5 inline-block py-3.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
            ← Who we work with
          </Link>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ background: "color-mix(in oklab, var(--color-state-verified) 14%, transparent)", color: "var(--color-state-verified)" }} aria-hidden>
              {industry.glyph}
            </span>
            <div className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--color-text-lo)" }}>
              {industry.name}
            </div>
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold uppercase leading-[1.05] tracking-tight sm:text-5xl">
            {industry.headline}
            {industry.verbatim && <span className="align-super text-xs" style={{ color: "var(--color-text-lo)" }}> ¹</span>}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            {industry.valueProp}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/connect-flow" className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)", color: "white" }}>
              Partner with us
            </Link>
            <Link href="/demo" className="rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}>
              See the platform
            </Link>
          </div>
        </Reveal>

        {/* Benefits */}
        <section className="mt-16">
          <Reveal>
            <h2 className="text-2xl font-bold uppercase tracking-tight">
              Why <span style={{ color: "var(--color-state-verified)" }}>{industry.name}</span> choose us
            </h2>
          </Reveal>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {industry.benefits.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.06}>
                <div className="h-full rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                  <div className="mb-3 grid h-9 w-9 place-items-center rounded-full text-sm font-bold" style={{ background: "color-mix(in oklab, var(--color-state-verified) 16%, transparent)", color: "var(--color-state-verified)" }}>
                    {i + 1}
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold">{b.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>{b.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Your Branded Microsite — the four-feature block their pages carry */}
        <section className="mt-16">
          <Reveal>
            <div className="text-center">
              <h2 className="text-2xl font-extrabold uppercase tracking-tight" style={{ color: "var(--color-text-hi)" }}>
                Your <Accent>branded</Accent> microsite
              </h2>
              <div className="mx-auto mt-3 h-1 w-14 rounded-full" style={{ background: "var(--color-state-verified)" }} />
              <p className="mt-3 text-sm" style={{ color: "var(--color-text-lo)" }}>Extend your brand</p>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MICROSITE_FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 4) * 0.05}>
                <div className="text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl text-xl" style={{ background: "color-mix(in oklab, var(--color-state-verified) 12%, white)", color: "var(--color-state-verified)" }} aria-hidden>{f.glyph}</div>
                  <h3 className="mb-1.5 text-sm font-bold" style={{ color: "var(--color-text-hi)" }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* The branded microsite, shown live */}
        <section className="mt-12">
          <Reveal>
            <div className="overflow-hidden rounded-3xl border" style={{ borderColor: "var(--color-ground-3)" }}>
              <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1fr_1fr]" style={{ background: "radial-gradient(90% 120% at 0% 0%, color-mix(in oklab, var(--color-state-verified) 14%, var(--color-ground-1)), var(--color-ground-1))" }}>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                    Your branded microsite
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Your brand on the front. Verified handoffs behind it.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                    Refer a client through a microsite on your own domain, in your colors,
                    with your logo. Every referral that arrives keeps its source, its
                    channel, and its attribution — so a handoff through your brand stays
                    traceable all the way to a scheduled install.
                  </p>
                </div>
                {/* A tiny mock browser showing the partner's branded microsite */}
                <div className="rounded-xl border" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}>
                  <div className="flex items-center gap-1.5 border-b px-3 py-2" style={{ borderColor: "var(--color-ground-3)" }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-state-failed)" }} />
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-state-conflict)" }} />
                    <span className="h-2 w-2 rounded-full" style={{ background: "var(--color-state-recovered)" }} />
                    <span className="ml-2 text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                      move.{industry.slug.replace(/-/g, "")}.com
                    </span>
                  </div>
                  <div className="p-5">
                    <div className="mb-2 h-2 w-24 rounded-full" style={{ background: "var(--color-state-verified)" }} />
                    <div className="mb-4 text-sm font-semibold">{industry.name} · move concierge</div>
                    <div className="space-y-2">
                      {["Address", "Services", "Contact"].map((f) => (
                        <div key={f} className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>{f}</div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-full px-3 py-2 text-center text-xs font-semibold" style={{ background: "var(--color-state-verified)", color: "white" }}>
                      Start my move
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/*
          The engine, in this industry's words. It sits after the microsite and
          before the cross-links: the reader has seen what they get, and this is
          why it can be trusted.
        */}
        <RelayForIndustry
          moment={industry.relay.moment}
          risk={industry.relay.risk}
          guarantee={industry.relay.guarantee}
          actor={industry.name}
        />

        {/* Other industries */}
        <section className="mt-16">
          <Reveal>
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-lo)" }}>
              Explore more industries we serve
            </h2>
          </Reveal>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o, i) => (
              <Reveal key={o.slug} delay={(i % 3) * 0.05}>
                <Link href={asRoute(`/industries/${o.slug}`)} className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-white" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                  <span className="text-lg" style={{ color: "var(--color-state-verified)" }} aria-hidden>{o.glyph}</span>
                  <span className="text-sm font-medium">{o.name}</span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {industry.verbatim && (
          <p className="mt-12 text-xs" style={{ color: "var(--color-text-lo)" }}>
            ¹ Headline as published on utilityconnect.net. Other copy is written in the same
            voice for this redesign. All data is synthetic; not affiliated with Utility Connect.
          </p>
        )}
      </main>
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-state-verified)" }}>{children}</span>;
}

const MICROSITE_FEATURES = [
  { glyph: "◎", title: "Use your company branding", body: "Bolt the concierge onto your existing offering and add value under your brand." },
  { glyph: "✎", title: "Color theme your page", body: "Style the microsite in your company colors so the two systems look identical." },
  { glyph: "▣", title: "Customize background", body: "Choose any background you want to put the spotlight on your business." },
  { glyph: "☎", title: "Unique phone number", body: "A private-labeled, custom-branded phone number routed through our systems." },
];
