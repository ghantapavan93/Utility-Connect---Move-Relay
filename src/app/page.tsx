import Link from "next/link";
import { Constellation3D } from "@/components/Constellation3D";
import { Reveal } from "@/components/Reveal";
import { MarketingHeader } from "@/components/MarketingHeader";
import { HowItWorks } from "@/components/HowItWorks";
import { Industries } from "@/components/Industries";
import { FrontDoor } from "@/components/FrontDoor";
import { HomeScene } from "@/components/HomeScene";
import { TrustStrip } from "@/components/TrustStrip";
import { CountUp } from "@/components/CountUp";
import { SITE_COPY, getLang } from "@/lib/site-copy";

/**
 * A faithful clone of the Utility Connect marketing site, in their own light
 * theme, Open Sans, navy header and hero, cyan pill buttons — then their features
 * added on top: the Platform (working Move Relay), the front-door modernization,
 * and the provenance hook. Structure, palette, and section order mirror theirs;
 * the additions are the parts their public site does not have.
 *
 * The page wraps in .theme-light so the shared components render on white.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const lang = getLang((await searchParams).lang);
  const copy = SITE_COPY[lang];

  return (
    <div className="theme-light">
      <MarketingHeader lang={lang} />
      <main>
        {/* ── Hero — navy, mirroring their photo-overlay hero ──── */}
        <section className="relative overflow-hidden" style={{ background: "var(--uc-navy-1)" }}>
          <HomeScene />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-6 py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
            <div>
              <Reveal>
                <h1 className="text-4xl font-extrabold uppercase leading-[1.05] tracking-tight text-white sm:text-5xl">
                  {copy.hero.h1a}{" "}
                  <span style={{ color: "var(--color-state-verified)" }}>{copy.hero.h1accent}</span>{" "}
                  {lang === "es" ? "en un solo lugar" : "in one place"}
                </h1>
              </Reveal>
              <Reveal delay={0.08}>
                <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">{copy.hero.p}</p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/connect-flow" className="rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)" }}>
                    {copy.hero.ctaPrimary}
                  </Link>
                  <Link href="/connect-flow" className="rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white" style={{ borderColor: "rgba(255,255,255,0.3)" }}>
                    {copy.hero.ctaSecondary}
                  </Link>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.2}>
              <Constellation3D
                converged
                height={400}
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
          <div className="relative">
            <TrustStrip />
          </div>
        </section>

        {/* ── How it works — white ─────────────────────────────── */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <Center eyebrow={copy.how.eyebrow} title={<>{copy.how.title} <Accent>{copy.how.titleAccent}</Accent></>} />
            </Reveal>
            <div className="mt-10"><HowItWorks lang={lang} /></div>
          </div>
        </section>

        {/* ── Stats — count-up band, mirroring theirs ──────────── */}
        <section style={{ background: "var(--uc-navy-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-14">
            <div className="grid grid-cols-2 gap-6 text-center text-white sm:grid-cols-4">
              {[
                { value: 846714, label: copy.stats.happy },
                { value: 3851, label: copy.stats.partners },
                { value: 14073, label: copy.stats.reviews },
                { value: 2347485, label: copy.stats.connections },
              ].map((s, i) => (
                <Reveal key={s.label} delay={i * 0.05}>
                  <div>
                    <div className="text-3xl font-extrabold sm:text-4xl" style={{ color: "var(--color-state-verified)" }}>
                      <CountUp to={s.value} />
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/70">
                      {s.label}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-center text-[11px] text-white/40">{copy.stats.attribution}</p>
          </div>
        </section>

        {/* ── Features — light ─────────────────────────────────── */}
        <section style={{ background: "var(--color-ground-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <Center eyebrow={copy.features.eyebrow} title={<>{copy.features.title} <Accent>{copy.features.titleAccent}</Accent></>} />
            </Reveal>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.05}>
                  <div className="h-full rounded-2xl border bg-white p-6" style={{ borderColor: "var(--color-ground-3)" }}>
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl text-2xl" style={{ background: "color-mix(in oklab, var(--color-state-verified) 12%, white)", color: "var(--color-state-verified)" }} aria-hidden>{f.glyph}</div>
                    <h3 className="mb-1.5 text-base font-bold" style={{ color: "var(--color-text-hi)" }}>{f.title}</h3>
                    <p className="text-sm leading-relaxed">{f.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Provenance hook (added) ──────────────────────────── */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <Reveal>
              <div className="grid items-center gap-8 rounded-3xl border p-8 sm:p-12 lg:grid-cols-2" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-conflict)" }}>Why the platform</div>
                  <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl" style={{ color: "var(--color-text-hi)" }}>Which number is the source of truth?</h2>
                  <p className="mt-3 text-sm leading-relaxed">Two pages of a single site can show the same metric with different values. When one fact arrives from many places, what matters is not the value but where it came from. That is the platform this redesign adds.</p>
                  <p className="mt-3 text-xs" style={{ color: "var(--color-text-lo)" }}>A public marketing-page observation only. Not a claim about any internal system.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-white p-5 text-center" style={{ borderColor: "var(--color-ground-3)" }}>
                    <div className="text-3xl font-extrabold" style={{ color: "var(--color-text-hi)" }}>1,503</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>on one page</div>
                  </div>
                  <div className="rounded-xl border bg-white p-5 text-center" style={{ borderColor: "var(--color-ground-3)" }}>
                    <div className="text-3xl font-extrabold" style={{ color: "var(--color-state-conflict)" }}>846,714</div>
                    <div className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>on another</div>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── The Platform (added — Move Relay) — navy ─────────── */}
        <section style={{ background: "var(--uc-navy-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>The platform · built and functioning</span>
              <h2 className="mt-3 max-w-3xl text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">Every move becomes a living, <Accent>verified</Accent> record.</h2>
              <p className="mt-3 max-w-2xl text-lg text-white/70">Behind the concierge is a working system: a move arrives from many channels, conflicts are resolved by a human, and a provider timeout is recovered without ever creating a duplicate order. Real code, real database, 175 tests.</p>
            </Reveal>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORM.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <Link href={p.href as never} className="group block h-full rounded-xl border p-5 transition-colors hover:border-white/40" style={{ borderColor: "rgba(255,255,255,0.15)", background: "var(--uc-navy-2)" }}>
                    <div className="mb-2 h-1 w-8 rounded-full" style={{ background: "var(--color-state-verified)" }} />
                    <h3 className="mb-1 text-sm font-bold text-white">{p.title}</h3>
                    <p className="text-xs leading-relaxed text-white/60">{p.body}</p>
                    <span className="mt-3 inline-block text-xs font-bold" style={{ color: "var(--color-state-verified)" }}>Open →</span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Front door modernization (added) — white ─────────── */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20"><FrontDoor /></div>
        </section>

        {/* ── Industries — light ───────────────────────────────── */}
        <section id="industries" className="scroll-mt-20" style={{ background: "var(--color-ground-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <Center eyebrow="Let us add value" title={<>Industries we <Accent>work with</Accent></>} />
            </Reveal>
            <div className="mt-10"><Industries /></div>
          </div>
        </section>

        {/* ── Reviews — white ──────────────────────────────────── */}
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal><Center eyebrow="What movers say" title={<>Recent customer <Accent>reviews</Accent></>} /></Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {REVIEWS.map((r, i) => (
                <Reveal key={r.name} delay={i * 0.06}>
                  <figure className="h-full rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
                    <div className="mb-3" style={{ color: "var(--color-state-conflict)" }}>★★★★★</div>
                    <blockquote className="text-sm leading-relaxed" style={{ color: "var(--color-text-hi)" }}>&ldquo;{r.quote}&rdquo;</blockquote>
                    <figcaption className="mt-3 text-xs font-bold" style={{ color: "var(--color-text-lo)" }}>— {r.name}</figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA — navy ───────────────────────────────────────── */}
        <section style={{ background: "var(--uc-navy-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <Reveal>
              <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">{copy.cta.title}</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/70">{copy.cta.p}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/connect-flow" className="rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--color-state-verified)" }}>{copy.cta.primary}</Link>
                <Link href="/demo" className="rounded-full border px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white" style={{ borderColor: "rgba(255,255,255,0.3)" }}>{copy.cta.secondary}</Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Footer — deep navy ───────────────────────────────── */}
        <footer style={{ background: "var(--uc-navy-0)" }}>
          <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 text-white/70 sm:grid-cols-4">
            <div>
              <div className="text-sm font-extrabold uppercase tracking-tight text-white">Utility<span style={{ color: "var(--color-state-verified)" }}>Connect</span></div>
              <p className="mt-2 text-xs leading-relaxed text-white/50">A redesign with the platform made visible. Not affiliated with Utility Connect.</p>
            </div>
            {FOOTER.map((col) => (
              <div key={col.head}>
                <div className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">{col.head}</div>
                <ul className="space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l.label}><Link href={l.href as never} className="transition-colors hover:text-white">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t px-6 py-5 text-center text-xs text-white/40" style={{ borderColor: "rgba(255,255,255,0.1)" }}>All demo data is synthetic. A hypothesis-driven, additive redesign based on public workflows.</div>
        </footer>
      </main>
    </div>
  );
}

function Center({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight sm:text-4xl" style={{ color: "var(--color-text-hi)" }}>{title}</h2>
      <div className="mx-auto mt-4 h-1 w-16 rounded-full" style={{ background: "var(--color-state-verified)" }} />
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
