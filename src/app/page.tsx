import Link from "next/link";
import { Constellation3D } from "@/components/Constellation3D";
import { Reveal } from "@/components/Reveal";
import { MarketingHeader } from "@/components/MarketingHeader";
import { HowItWorks } from "@/components/HowItWorks";
import { Industries } from "@/components/Industries";
import { FrontDoor } from "@/components/FrontDoor";
import { HomeScene } from "@/components/HomeScene";
import { PhotoBand } from "@/components/PhotoBand";
import { BlurReveal } from "@/components/BlurReveal";
import { ReviewWall } from "@/components/ReviewWall";
import { PartnerWall } from "@/components/PartnerWall";
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
        {/*
          ── Hero ────────────────────────────────────────────────

          Rebuilt, because it was the weakest thing on the site and the first
          thing anyone sees.

          Three problems, all structural. It was a two-column grid with the
          headline on the left and the constellation on the right, which put a
          diagram of the data model directly on top of a photograph of a
          kitchen — two subjects fighting over one frame, and neither winning.
          It sat in `max-w-6xl` with `py-20`, so a hero meant to feel like a
          room felt like a content block. And the type topped out at 48px,
          which is a heading, not a hero.

          Now: the photograph gets the frame to itself at full viewport height,
          the headline scales with the viewport, and the constellation moves
          below the fold where it can be looked at deliberately instead of
          competing. A scroll cue does the work the collision used to.
        */}
        <section
          className="relative flex min-h-[92svh] flex-col overflow-hidden"
          style={{ background: "var(--uc-navy-1)" }}
        >
          <HomeScene />

          <div className="relative flex flex-1 items-center">
            <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
              {/*
                Word by word, out of blur.

                A hero that fades in as one block is motion that announces
                itself and says nothing. Focus pulling across a sentence reads
                as a camera finding its subject, and the accent words land last
                so the line resolves onto its own point.
              */}
              <BlurReveal
                as="h1"
                className="max-w-4xl font-extrabold uppercase leading-[0.98] tracking-tight text-white"
                text={`${copy.hero.h1a} ${copy.hero.h1accent} ${lang === "es" ? "en un solo lugar" : "in one place"}`}
                emphasis={copy.hero.h1accent.split(" ")}
                style={{ fontSize: "clamp(40px,6.6vw,86px)" }}
              />
              {/*
                Their signature rule.

                A short cyan bar sits under every heading on their site,
                including the hero, and it is doing more than decoration: it is
                the one repeated mark that ties otherwise unrelated sections
                into a single identity. We already used it on section headings
                and had omitted it from the one place it matters most.
              */}
              <Reveal delay={0.06}>
                <div
                  className="mt-6 h-1 w-16 rounded-full"
                  style={{ background: "var(--color-state-verified)" }}
                />
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75 sm:text-xl">
                  {copy.hero.p}
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link
                    href="/connect-flow"
                    className="rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
                    style={{ background: "var(--uc-cyan-fill)" }}
                  >
                    {copy.hero.ctaPrimary}
                  </Link>
                  <Link
                    href="/connect-flow"
                    className="rounded-full border px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white backdrop-blur-sm transition-colors hover:bg-white/10"
                    style={{ borderColor: "rgba(255,255,255,0.34)" }}
                  >
                    {copy.hero.ctaSecondary}
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>

          <div className="relative">
            <TrustStrip />
          </div>
        </section>

        {/*
          The constellation, given its own room.

          It is the signature graphic of the whole platform — sources
          converging into one record — and on top of the hero photograph nobody
          could read it. On its own band, with a line of copy telling you what
          you are looking at, it does the job it was drawn for.
        */}
        <section className="relative overflow-hidden" style={{ background: "var(--uc-navy-2, #12181e)" }}>
          {/*
            `min-w-0` on the grid children is load-bearing on a phone.

            A grid track sizes to `min-content` by default, so a child that
            reports a wide intrinsic size — the constellation canvas does —
            stretches its column past the container. The section clips at 375px,
            so nothing scrolled sideways to give the problem away: the heading
            simply ended mid-word and the copy ran off the edge. Overflow you
            cannot scroll to is the kind that ships.
          */}
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <Reveal>
              <div className="min-w-0">
                <div
                  className="text-[11px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "var(--uc-cyan-ink)" }}
                >
                  {lang === "es" ? "Una sola ficha" : "One record"}
                </div>
                <h2 className="mt-3 text-[clamp(26px,3.4vw,42px)] font-semibold leading-[1.1] tracking-tight text-white">
                  {lang === "es"
                    ? "Una mudanza llega por varios canales. Ninguno coincide."
                    : "One move arrives through several channels. No two agree."}
                </h2>
                <p className="mt-4 max-w-lg text-base leading-relaxed text-white/65">
                  {lang === "es"
                    ? "Cada valor conserva quién lo aportó, por qué canal y cuándo. Las diferencias se resuelven con una persona, nunca en silencio."
                    : "Every value keeps who supplied it, through which channel, and when. Where sources disagree, a named person decides — never the system, and never silently."}
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.12}>
              <div className="min-w-0 overflow-hidden">
              <Constellation3D
                converged
                height={420}
                sources={[
                  { id: "1", label: "Partner API", state: "verified" },
                  { id: "2", label: "CSV", state: "conflict" },
                  { id: "3", label: "Customer form", state: "verified" },
                  { id: "4", label: "Microsite", state: "transit" },
                  { id: "5", label: "Concierge", state: "pending" },
                ]}
              />
              </div>
            </Reveal>
          </div>
        </section>

        {/*
          The photograph the whole product is about.

          Everything else on this page is a claim about systems. This is the
          moment those systems exist for — a family carrying boxes through a
          door on a day when nothing in the house is switched on yet. Placed
          before "how it works" so the mechanism is read as serving something,
          rather than as the point.
        */}
        <PhotoBand
          src="/photos/moving-in.jpg"
          alt=""
          eyebrow={lang === "es" ? "El día de la mudanza" : "Moving day"}
          title={
            lang === "es" ? (
              <>Una dirección se convierte en hogar cuando <span style={{ color: "var(--color-state-verified)" }}>todo empieza a funcionar</span>.</>
            ) : (
              <>An address becomes a home only when <span style={{ color: "var(--color-state-verified)" }}>everything begins working together</span>.</>
            )
          }
          body={
            lang === "es"
              ? "La electricidad, el internet, el agua y la seguridad no llegan solos. Alguien los coordina — y cada paso queda registrado."
              : "Power, internet, water and security do not arrive on their own. Someone coordinates them — and every handoff is recorded, attributable, and reversible."
          }
        />

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
              <p className="mt-3 max-w-2xl text-lg text-white/70">Behind the concierge is a working system: a move arrives from many channels, conflicts are resolved by a human, and a provider timeout is recovered without ever creating a duplicate order. Real code, real database, 229 tests.</p>
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

        {/*
          The partner side, given a face.

          "Industries" is an abstract word for brokers, property managers and
          builders whose actual work is handing someone the keys to a house like
          this one. The photograph does the explaining the label cannot.
        */}
        <PhotoBand
          src="/photos/suburban-house.jpg"
          alt=""
          height="short"
          align="center"
          eyebrow={lang === "es" ? "Para socios" : "For partners"}
          title={
            lang === "es" ? (
              <>Cada llave entregada es <span style={{ color: "var(--color-state-verified)" }}>una mudanza que empieza</span>.</>
            ) : (
              <>Every set of keys handed over is <span style={{ color: "var(--color-state-verified)" }}>a move about to begin</span>.</>
            )
          }
          body={
            lang === "es"
              ? "Agentes, administradores de propiedades y constructores: la atribución se conserva de principio a fin."
              : "Agents, property managers and builders. Attribution is preserved end to end — who introduced the customer is never lost in the handoff."
          }
        />

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
            {/*
              A wall, not three cards.

              Their feed runs dozens of reviews with timestamps to the minute,
              and the volume is the argument: any single review is just an
              opinion, but a wall that keeps moving says this is happening now.
              Three testimonials in a row cannot make that claim.
            */}
            <Reveal><Center eyebrow="What movers say" title={<>Recent customer <Accent>reviews</Accent></>} /></Reveal>
            <div className="mt-10"><ReviewWall /></div>
          </div>
        </section>

        {/* ── Who we work with — light ─────────────────────────── */}
        <section style={{ background: "var(--color-ground-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20">
            <Reveal>
              <Center
                eyebrow={lang === "es" ? "Con quién trabajamos" : "Who we work with"}
                title={
                  lang === "es" ? (
                    <>Dejemos que <Accent>sumemos valor</Accent></>
                  ) : (
                    <>Let us <Accent>add value</Accent></>
                  )
                }
              />
            </Reveal>
            <div className="mt-10"><PartnerWall /></div>
          </div>
        </section>

        {/* ── About — white ────────────────────────────────────── */}
        <section className="bg-white">
          <div className="mx-auto max-w-3xl px-6 py-20 text-center">
            <Reveal>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                {lang === "es" ? "Acerca de" : "About"}
              </div>
              <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight sm:text-4xl" style={{ color: "var(--color-text-hi)" }}>
                {lang === "es" ? <>Qué es <Accent>esto</Accent></> : <>What this <Accent>is</Accent></>}
              </h2>
              <div className="mx-auto mt-4 h-1 w-16 rounded-full" style={{ background: "var(--color-state-verified)" }} />
              {/*
                Their About paragraph describes their company. This one
                describes this project, because writing theirs here — in their
                voice, on a site that is not theirs — is the line between a
                concept and an impersonation.
              */}
              <p className="mt-6 text-base leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                {lang === "es"
                  ? "Este es un rediseño conceptual del sitio público de Utility Connect, con una plataforma funcional debajo: una mudanza llega por varios canales, una persona resuelve los conflictos, y el tiempo de espera de un proveedor se recupera sin crear jamás un pedido duplicado."
                  : "This is a concept redesign of Utility Connect's public site with a working platform underneath it: one move arrives through several channels, a named person resolves the disagreements, and a provider timeout is recovered without ever creating a duplicate order."}
              </p>
              <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                {lang === "es"
                  ? "Construido por un candidato, no por la empresa. No afiliado a Utility Connect. Todos los datos son sintéticos."
                  : "Built by a candidate, not by the company. Not affiliated with Utility Connect, and every customer, partner and provider record on it is synthetic."}
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Link href="/demo" className="rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--uc-cyan-fill)" }}>
                  {lang === "es" ? "Ver la plataforma" : "See the platform"}
                </Link>
                <a href="https://utilityconnect.net" target="_blank" rel="noopener noreferrer" className="rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide transition-colors" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}>
                  {lang === "es" ? "El sitio real" : "The real Utility Connect"}
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/*
          The closing image. The house is ready and the story is over — which is
          the emotional shape of a move that went well, and the right note to
          leave someone on before the final call to action.
        */}
        <PhotoBand
          src="/photos/living-room-tv.jpg"
          alt=""
          height="short"
          align="center"
          eyebrow={lang === "es" ? "Listo para mudarse" : "Move-in ready"}
          title={
            lang === "es" ? (
              <>Todo funcionando <span style={{ color: "var(--color-state-verified)" }}>antes de que llegues</span>.</>
            ) : (
              <>Everything working <span style={{ color: "var(--color-state-verified)" }}>before you arrive</span>.</>
            )
          }
        />

        {/* ── CTA — navy ───────────────────────────────────────── */}
        <section style={{ background: "var(--uc-navy-1)" }}>
          <div className="mx-auto max-w-6xl px-6 py-20 text-center">
            <Reveal>
              <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white sm:text-4xl">{copy.cta.title}</h2>
              <p className="mx-auto mt-3 max-w-xl text-white/70">{copy.cta.p}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/connect-flow" className="rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--uc-cyan-fill)" }}>{copy.cta.primary}</Link>
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
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                A concept redesign with a working platform underneath. Built by a candidate.
                Not affiliated with Utility Connect.
              </p>
              <p className="mt-3 text-xs leading-relaxed text-white/40">
                Looking for the real company? Their service centre is in The Colony, Texas.
              </p>
              <a
                href="https://utilityconnect.net"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold transition-colors hover:text-white"
                style={{ color: "var(--color-state-verified)" }}
              >
                utilityconnect.net →
              </a>
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


/**
 * Footer columns, mirroring their information architecture.
 *
 * Their footer runs Contact Us / Careers / Become A Vendor / Branding /
 * Internships alongside a service-centre address, a sales phone number and a
 * sales email. The structure is worth mirroring — it is how a company of this
 * kind organises its front door, and reproducing that organisation is the
 * point of a redesign.
 *
 * The contact details are deliberately not reproduced. Their address, phone
 * number and inbox reach real people at a real desk; putting them on a page
 * that is not theirs would route genuine customers to a company that never
 * agreed to receive them through it, and would make a concept indistinguishable
 * from the real thing at exactly the moment it matters. Anyone who wants to
 * contact Utility Connect is sent to Utility Connect.
 */
const FOOTER = [
  { head: "Company", links: [ { label: "About", href: "/future" }, { label: "Careers", href: "/future" }, { label: "Become a vendor", href: "/connect-flow" }, { label: "Branding", href: "/architecture" }, { label: "Internships", href: "/future" } ] },
  { head: "Platform", links: [ { label: "Live demo", href: "/demo" }, { label: "Failure theater", href: "/theater" }, { label: "Three audiences", href: "/views" }, { label: "Operator console", href: "/dashboard" }, { label: "Architecture", href: "/architecture" } ] },
  { head: "Get started", links: [ { label: "Set up services", href: "/connect-flow" }, { label: "Partner with us", href: "/connect-flow" }, { label: "The Living Move", href: "/story" }, { label: "Future vision", href: "/future" } ] },
];
