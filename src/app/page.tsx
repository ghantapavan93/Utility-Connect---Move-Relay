import Link from "next/link";
import { Constellation3D } from "@/components/Constellation3D";
import { Reveal } from "@/components/Reveal";
import { SiteNav } from "@/components/SiteNav";
import { HowItWorks } from "@/components/HowItWorks";
import { Industries } from "@/components/Industries";
import { FrontDoor } from "@/components/FrontDoor";
import { HeroBackdrop } from "@/components/HeroBackdrop";

/**
 * The redesigned Utility Connect experience.
 *
 * It mirrors their real marketing site section-for-section — hero, how it works
 * (customer/partner), the numbers, the features, the industries they name, the
 * reviews, the about — and elevates each with the project's motion language and
 * the 3D handoff network. Woven into the middle is the one thing their public
 * site does not show: the Platform. That is where the working Move Relay product
 * lives, so the redesign is simultaneously a faithful marketing site and an
 * interactive product demonstration.
 */
export default function Home() {
  return (
    <>
      <SiteNav />
      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative mx-auto flex min-h-[92vh] max-w-6xl flex-col justify-center px-6 pt-20">
          <HeroBackdrop />
          <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <Reveal>
                <span className="inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-state-verified)" }}>
                  Concierge · Technology · Verified handoffs
                </span>
              </Reveal>
              <Reveal delay={0.05}>
                <h1 className="mt-5 text-5xl font-bold uppercase leading-[1.02] tracking-tight sm:text-6xl">
                  Compare all home services{" "}
                  <span style={{ color: "var(--color-state-verified)" }}>in one place.</span>
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-xl text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                  Simplify your move and save time. Compare providers, hear special offers,
                  and connect every essential service — with a dedicated concierge and a
                  platform that keeps every handoff visible, attributable, and verified.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/connect-flow" className="rounded-full px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)", color: "white" }}>
                    Set up services
                  </Link>
                  <Link href="/dashboard" className="rounded-full border px-6 py-3 text-sm font-semibold uppercase tracking-wide transition-colors hover:border-white" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}>
                    Explore the platform
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <Constellation3D
                converged
                height={440}
                sources={[
                  { id: "1", label: "Partner API", state: "verified" },
                  { id: "2", label: "CSV", state: "conflict" },
                  { id: "3", label: "Customer form", state: "verified" },
                  { id: "4", label: "Microsite", state: "transit" },
                  { id: "5", label: "Concierge", state: "pending" },
                ]}
              />
            </Reveal>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <SectionHead eyebrow="Get started today" title={<>How Utility Connect <Accent>works</Accent></>} />
          </Reveal>
          <div className="mt-10">
            <HowItWorks />
          </div>
        </section>

        {/* ── Stat band ────────────────────────────────────────── */}
        <section className="border-y" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
            {[
              { n: "18", l: "Home services" },
              { n: "9", l: "Partner industries" },
              { n: "1", l: "Verified move record" },
              { n: "0", l: "Duplicate orders" },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 0.05}>
                <div>
                  <div className="text-4xl font-bold" style={{ color: "var(--color-state-verified)" }}>{s.n}</div>
                  <div className="mt-1 text-xs uppercase tracking-wide" style={{ color: "var(--color-text-lo)" }}>{s.l}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <SectionHead eyebrow="Just to list a few" title={<>Features Utility Connect <Accent>offers</Accent></>} />
          </Reveal>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.05}>
                <div className="h-full rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                  <div className="mb-2 text-xl" aria-hidden style={{ color: "var(--color-state-verified)" }}>{f.glyph}</div>
                  <h3 className="mb-1.5 text-sm font-semibold">{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── The provenance hook — a real observation ──────────── */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <div className="rounded-3xl border p-8 sm:p-12" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_1fr]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-conflict)" }}>
                    Why provenance
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Which number is the source of truth?
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                    Two pages of a single site show the same metric — happy customers —
                    with very different values. When one fact can arrive from several
                    places, the question that matters is not <em>what</em> the value is, but{" "}
                    <em>where it came from</em>. That is the whole idea behind Move Relay.
                  </p>
                  <p className="mt-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
                    A public marketing-page observation only. Not a claim about any internal
                    system.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border p-5 text-center" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}>
                    <div className="text-3xl font-bold" style={{ color: "var(--color-text-hi)" }}>1,503</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>on one page</div>
                  </div>
                  <div className="rounded-xl border p-5 text-center" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}>
                    <div className="text-3xl font-bold" style={{ color: "var(--color-state-conflict)" }}>846,714</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>on another</div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── The Platform — Move Relay woven in ───────────────── */}
        <section className="border-y" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                The platform · built and functioning
              </span>
              <h2 className="mt-3 max-w-3xl text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                Every move becomes a living, <Accent>verified</Accent> record.
              </h2>
              <p className="mt-3 max-w-2xl text-lg" style={{ color: "var(--color-text-mid)" }}>
                Behind the concierge is Move Relay — a working system where a move arrives from
                many channels, conflicts are resolved by a human, and a provider timeout is
                recovered without ever creating a duplicate order. Real code, real database, 51 tests.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORM.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <Link href={p.href as never} className="group block h-full rounded-xl border p-5 transition-colors hover:border-white" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}>
                    <div className="mb-2 h-1 w-8 rounded-full" style={{ background: "var(--color-state-verified)" }} />
                    <h3 className="mb-1 text-sm font-semibold">{p.title}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>{p.body}</p>
                    <span className="mt-3 inline-block text-xs font-semibold" style={{ color: "var(--color-state-verified)" }}>
                      Open →
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Front door modernization ─────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <FrontDoor />
        </section>

        {/* ── Industries ───────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <SectionHead eyebrow="Let us add value" title={<>Industries we <Accent>work with</Accent></>} />
          </Reveal>
          <div className="mt-10">
            <Industries />
          </div>
        </section>

        {/* ── Reviews ──────────────────────────────────────────── */}
        <section className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <SectionHead eyebrow="What movers say" title={<>Recent customer <Accent>reviews</Accent></>} />
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r, i) => (
                <Reveal key={r.name} delay={i * 0.06}>
                  <figure className="h-full rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                    <div className="mb-3" style={{ color: "var(--color-state-verified)" }}>★★★★★</div>
                    <blockquote className="text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>&ldquo;{r.quote}&rdquo;</blockquote>
                    <figcaption className="mt-3 text-xs font-semibold" style={{ color: "var(--color-text-lo)" }}>— {r.name}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal>
            <div className="grid place-items-center rounded-3xl border px-6 py-16 text-center" style={{ borderColor: "var(--color-ground-3)", background: "radial-gradient(80% 120% at 50% 0%, color-mix(in oklab, var(--color-state-verified) 14%, var(--color-ground-1)), var(--color-ground-1))" }}>
              <h2 className="max-w-2xl text-3xl font-bold uppercase tracking-tight sm:text-4xl">
                Get your own Utility Connect account.
              </h2>
              <p className="mt-3 max-w-xl" style={{ color: "var(--color-text-mid)" }}>
                Ready to get the ball rolling? Bring the concierge and the verified platform to
                your brand.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/connect-flow" className="rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)", color: "white" }}>
                  Get started
                </Link>
                <Link href="/demo" className="rounded-full border px-8 py-3.5 text-sm font-semibold uppercase tracking-wide" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}>
                  Watch the live demo
                </Link>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── Footer ───────────────────────────────────────────── */}
        <footer className="border-t" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-4">
            <div className="sm:col-span-1">
              <div className="text-sm font-bold tracking-tight">MOVE<span style={{ color: "var(--color-state-verified)" }}>RELAY</span></div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                A redesign of Utility Connect, with the platform made visible.
              </p>
            </div>
            {FOOTER.map((col) => (
              <div key={col.head}>
                <div className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-lo)" }}>{col.head}</div>
                <ul className="space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link href={l.href as never} style={{ color: "var(--color-text-mid)" }} className="transition-colors hover:text-white">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t px-6 py-5 text-center text-xs" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
            A hypothesis-driven, additive redesign based on public workflows. Not affiliated with
            Utility Connect. All demo data is synthetic.
          </div>
        </footer>
      </main>
    </>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-bold uppercase tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--color-state-verified)" }}>{children}</span>;
}

const FEATURES = [
  { glyph: "☎", title: "Concierge", body: "A trained moving expert who supports you through the whole journey." },
  { glyph: "✦", title: "Promotions & specials", body: "The best products and offers for your new home, tailored to your lifestyle." },
  { glyph: "✉", title: "USPS mail forwarding", body: "Your concierge forwards your mail on your behalf." },
  { glyph: "◈", title: "Community resources", body: "Get to know your new schools, parks, and neighborhood." },
  { glyph: "✓", title: "Moving checklist", body: "A detailed checklist so nothing slips before moving day." },
  { glyph: "▤", title: "Provider summary", body: "A written summary of selections and account numbers for your records." },
];

const PLATFORM = [
  { title: "Operator dashboard", body: "Live figures from real database counts.", href: "/dashboard" },
  { title: "Live workflow", body: "Ten steps: ingest → conflict → merge → timeout → recover.", href: "/demo" },
  { title: "Three audiences", body: "One record, safely projected for each viewer.", href: "/views" },
  { title: "Architecture", body: "Six risk-bearing decisions, each enforced by a test.", href: "/architecture" },
];

const REVIEWS = [
  { name: "Heather M.", quote: "Professional and very friendly. So easy to get our utilities set up. Fantastic service." },
  { name: "Alli M.", quote: "Amazing to work with. Explained all our options in detail so we knew everything available." },
  { name: "Justin S.", quote: "Buying a home and moving is stressful — this made it so much easier. Much appreciated." },
];

const FOOTER = [
  { head: "Company", links: [ { label: "About", href: "/future" }, { label: "Careers", href: "/future" }, { label: "Become a vendor", href: "/future" }, { label: "Branding", href: "/architecture" } ] },
  { head: "Platform", links: [ { label: "Dashboard", href: "/dashboard" }, { label: "Live demo", href: "/demo" }, { label: "Audiences", href: "/views" } ] },
  { head: "Get started", links: [ { label: "Set up services", href: "/connect-flow" }, { label: "Partner with us", href: "/connect-flow" }, { label: "Future vision", href: "/future" } ] },
];
