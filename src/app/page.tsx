import Link from "next/link";
import Image from "next/image";
import { Constellation3D } from "@/components/Constellation3D";
import { Reveal } from "@/components/Reveal";
import { MarketingHeader } from "@/components/MarketingHeader";
import { HowItWorks } from "@/components/HowItWorks";
import { Industries } from "@/components/Industries";
import { HomeScene } from "@/components/HomeScene";
import { PhotoBand } from "@/components/PhotoBand";
import { BlurReveal } from "@/components/BlurReveal";
import { ReviewWall } from "@/components/ReviewWall";
import { PartnerWall } from "@/components/PartnerWall";
import { TrustStrip } from "@/components/TrustStrip";
import { CountUp } from "@/components/CountUp";
import { ScrollExpandMedia } from "@/components/blocks/scroll-expansion-hero";
import { MarketingVideoBand } from "@/components/MarketingVideoBand";
import { AmbientVideoStage } from "@/components/AmbientVideoStage";
import { Typewriter } from "@/components/ui/typewriter";
import { RevealHeadline } from "@/components/RevealHeadline";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { ConvergeText } from "@/components/ui/converge-text";
import { FeatureCard } from "@/components/ui/feature-card";
import { TiltCard } from "@/components/ui/tilt-card";
import { RelayConstellation } from "@/components/home/RelayConstellation";
import { resolveMarketingVideo, hasMarketingMedia } from "@/lib/marketing-video.server";
import { SITE_COPY, getLang } from "@/lib/site-copy";
import { asRoute } from "@/lib/routes";

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

  /*
    Marketing footage, resolved from disk rather than declared.

    Each slot renders nothing at all when its file is missing, so the page
    degrades to exactly the page it was before video existed. Which file fills
    which slot is declared in `src/lib/marketing-video.ts`; the reasoning for
    each placement is there, next to the decision.
  */
  const openerMedia = resolveMarketingVideo("opener");
  const invitationMedia = resolveMarketingVideo("invitation");
  /*
    Utility Connect's own films. Gitignored, so these resolve to nothing in a
    clone and both sections simply do not render — no black frame, no gap that
    reads as a mistake. See the `bundled: false` note in marketing-video.ts.
  */
  const brandFilm = resolveMarketingVideo("brandFilm");
  const channels = resolveMarketingVideo("channels");

  return (
    <div className="theme-light">
      <MarketingHeader lang={lang} />
      <main>
        {/*
          ── The opener ──────────────────────────────────────────

          A clip that opens into the viewport as you scroll past it, then hands
          the page over to the site proper. It sits above the hero rather than
          replacing it because the hero is what a returning visitor and a
          search engine both need, and because a page whose first screen is a
          video is a page with no readable claim until the video loads.

          It costs roughly two screens of scrolling, which is a real price. It
          is charged exactly once, for the one sentence the whole platform
          exists to make true, and the section disappears completely if its
          files ever go missing.

          No eyebrow above the title. A category label over a full-screen film
          is a caption on a photograph that already says what it is — it adds a
          line of type competing with the headline and tells the visitor
          nothing the header has not already told them.
        */}
        {hasMarketingMedia(openerMedia) ? (
          <ScrollExpandMedia
            sources={openerMedia.sources}
            posterSrc={openerMedia.poster}
            bgImageSrc={openerMedia.slot.backdrop}
            loop={openerMedia.slot.loop}
            /*
              One word, not a sentence.

              "Three channels. One verified record." is accurate and it is a
              *mechanism* — it explains how the system works to someone who has
              not yet been told why they should care. The first screen has to
              earn the second, and a homeowner, a broker and a provider all
              want the same thing from it before any detail: the lights are on
              when you walk in.
            */
            headline={
              <RevealHeadline
                kicker={lang === "es" ? "Día de mudanza" : "Move in day"}
                word={lang === "es" ? "CONECTADO" : "CONNECTED"}
                /*
                  No dashes anywhere. A dash invites a clause, and a clause is
                  how a promise turns into an explanation. Two plain sentences:
                  the first is what the customer feels, the second is what a
                  partner needs to trust.
                */
                subline={
                  lang === "es"
                    ? [
                        {
                          text: "Abres la puerta y la luz ya está encendida, el agua ya corre, el internet ya funciona. Cada traspaso detrás de ese momento queda",
                        },
                        { text: "con origen, con nombre y con prueba.", accent: true },
                      ]
                    : [
                        {
                          text: "You open the door and the lights are already on, the water already runs, the internet already works. Every handoff behind that moment is",
                        },
                        { text: "sourced, signed and provable.", accent: true },
                      ]
                }
              />
            }
            title={lang === "es" ? "Conectado" : "Connected"}
            scrollToExpand={lang === "es" ? "Desplázate para abrir" : "Scroll to open"}
          />
        ) : null}

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
                marker
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
                {/*
                  The two calls to action, each with a cyan arc that travels
                  its edge on hover. A flat colour change tells you the pointer
                  is somewhere; a border that lights and moves tells you which
                  control you are about to commit to.
                */}
                <div className="mt-9 flex flex-wrap gap-3">
                  <HoverBorderGradient href="/connect-flow">
                    {copy.hero.ctaPrimary}
                  </HoverBorderGradient>
                  <HoverBorderGradient href="/connect-flow" variant="ghost">
                    {copy.hero.ctaSecondary}
                  </HoverBorderGradient>
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
            The grid this section used to be is gone, and with it the track
            blowout that needed constraining at every breakpoint: a track sizes
            to max-content, the constellation canvas reports a wide intrinsic
            size, and a phone ended up with `grid-template-columns: 555px`
            inside a 375px box. One centred column cannot reproduce it.

            The measurement lesson survives the layout, and the mobile spec
            still enforces it: an element's own scrollWidth against its
            clientWidth reports this page clean while the box is oversized and
            its text fits inside it exactly. It has to be the bounding rect
            against the viewport.
          */}
          {/*
            The section is now centred on a film of the service itself.

            It used to be a two-column split: prose and three photographs on the
            left, the constellation on the right. That layout gave equal billing
            to a claim and its illustration, and the reader's eye had to choose.
            Centring resolves it — one column, one axis, the sentence first and
            the evidence beneath it — and the footage carries the width the
            second column used to occupy.

            The three photographs are gone. They were the single real house that
            three channels were each describing, which is a good idea that
            needed a caption to land; the channel names now do that work
            directly, in the brand's colour, sitting on the record they
            disagree about.
          */}
          <AmbientVideoStage media={channels} scrim={0.66} tint={0.2} minHeight="min-h-[680px]">
            <div className="mx-auto flex max-w-4xl flex-col items-center px-6 py-24 text-center">
              <Reveal>
                {/*
                  The label performs what the section says. Its letters start
                  scattered across the three states a field can arrive in and
                  settle onto one colour, which is the same claim the prose
                  makes and the constellation below it draws.
                */}
                <ConvergeText
                  text={lang === "es" ? "Una sola ficha" : "One record"}
                  className="text-[11px] font-bold uppercase tracking-[0.2em]"
                />
              </Reveal>

              {/*
                The headline types itself, once, when it is looked at.

                This is the one place on the page that earns the effect: the
                sentence is about a record being assembled from sources arriving
                one at a time, so the words assembling one at a time is the same
                claim in the same grammar rather than an ornament laid over it.
                Everything below holds still while it runs.
              */}
              <h2
                className="mt-4 max-w-3xl text-[clamp(28px,4vw,50px)] font-semibold leading-[1.08] tracking-tight text-white"
                style={{ textShadow: "0 2px 30px rgba(9,14,19,0.85)" }}
              >
                <Typewriter
                  text={
                    lang === "es"
                      ? "Una mudanza llega por varios canales. Ninguno coincide."
                      : "One move arrives through several channels. No two agree."
                  }
                  speed={26}
                />
              </h2>

              <Reveal delay={0.1}>
                <p
                  className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/[0.88]"
                  style={{ textShadow: "0 1px 18px rgba(9,14,19,0.9)" }}
                >
                  {lang === "es"
                    ? "Cada valor conserva quién lo aportó, por qué canal y cuándo. Cuando las fuentes no coinciden, decide una persona con nombre. Nunca el sistema, y nunca en silencio."
                    : "Every value keeps who supplied it, through which channel, and when. Where sources disagree, a named person decides. Never the system, and never silently."}
                </p>
              </Reveal>

              {/*
                The channels, named rather than illustrated.

                Cyan is this system's only saturated colour and it means
                verified, so these are deliberately *not* state chips — they name
                the routes a value can arrive by, which is channel identity, not
                a verdict on any field. The verdicts stay where they have always
                been: in the constellation below, where a source can be amber and
                contested without the label lying about it.

                `--uc-cyan-ink` rather than the raw brand blue: the design system
                records that #0087B5 is 3.97:1 on this navy, under the 4.5 these
                sizes need.

                The chip's own background is 0.82 rather than a tasteful wash,
                and that number is measured, not chosen. Contrast over video has
                to hold against the *brightest frame the clip can produce*, not
                the frame that happens to be showing — this film cuts to near
                white. At 0.55 the cyan measured 3.84:1 composited over a white
                frame and would have been unreadable for exactly as long as that
                shot lasts, which is the kind of defect no screenshot catches.
                At 0.82 it is 5.12:1 at its worst.
              */}
              <Reveal delay={0.16}>
                <ul className="mt-9 flex list-none flex-wrap items-center justify-center gap-2.5">
                  {[
                    lang === "es" ? "API del socio" : "Partner API",
                    lang === "es" ? "Carga CSV" : "CSV upload",
                    lang === "es" ? "Formulario del cliente" : "Customer form",
                  ].map((label) => (
                    <li
                      key={label}
                      className="rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] backdrop-blur-sm"
                      style={{
                        color: "var(--uc-cyan-ink)",
                        borderColor: "rgba(36,152,191,0.55)",
                        background: "rgba(9,14,19,0.82)",
                        // Offset and blur, so this reads as the chip sitting
                        // above the film rather than as a halo drawn around it.
                        boxShadow: "0 2px 18px rgba(9,14,19,0.55), 0 0 26px rgba(0,135,181,0.2)",
                      }}
                    >
                      {label}
                    </li>
                  ))}
                </ul>
              </Reveal>

              {/*
                The constellation, lifted out of the old right-hand column and
                given the full measure. It is the part that shows the
                disagreement rather than stating it, so it reads better wide —
                and on the film it needs no panel of its own.
              */}
              <Reveal delay={0.22}>
                <div className="mt-10 w-full min-w-0 overflow-hidden">
                  <Constellation3D
                    converged
                    height={380}
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
          </AmbientVideoStage>
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
          eyebrowLiquid
          title={
            lang === "es" ? (
              <>Una dirección se convierte en hogar cuando <span style={{ color: "var(--color-state-verified)" }}>todo empieza a funcionar</span>.</>
            ) : (
              <>An address becomes a home only when <span style={{ color: "var(--color-state-verified)" }}>everything begins working together</span>.</>
            )
          }
          body={
            lang === "es"
              ? "La electricidad, el internet, el agua y la seguridad no llegan solos. Alguien los coordina, y cada paso queda registrado."
              : "Power, internet, water and security do not arrive on their own. Someone coordinates them, and every handoff is recorded, attributable and reversible."
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
            {/*
              Lit from behind rather than outlined. Six flat white boxes on a
              near-white ground had almost no separation from the page; the glow
              gives each card an edge without adding a border heavy enough to
              turn the grid into a table.
            */}
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={(i % 3) * 0.05}>
                  <FeatureCard icon={f.icon} title={f.title} body={f.body} />
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
              <p className="mt-3 max-w-2xl text-lg text-white/70">Behind the concierge is a working system: a move arrives from many channels, conflicts are resolved by a human, and a provider timeout is recovered without ever creating a duplicate order. Real code, real database, 582 tests.</p>
            </Reveal>
            {/*
              These four are the only cards on the page that open something
              real, so they are the only ones that get the tilt. Spending the
              heaviest interaction on the links that lead to working software is
              the point; spreading it everywhere would say nothing.
            */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PLATFORM.map((p, i) => (
                <Reveal key={p.title} delay={i * 0.05}>
                  <TiltCard href={p.href} title={p.title} body={p.body} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/*
          ── The brand film, where the front-door comparison used to be ──

          `FrontDoor` argued by diagram: the same front door on the old stack
          and on this one, side by side. The argument was fair and it was in the
          wrong place. A comparison is a closing statement, and this sits a
          third of the way down a page where the visitor is still deciding
          whether any of it is for them — so it asked them to evaluate an
          architecture claim before they had a reason to care about the
          architecture.

          What replaces it is quieter and does more: the company's own film,
          full bleed, with one sentence over it, handing off to /architecture
          for anyone who now wants the detail.

          `src/components/FrontDoor.tsx` is retained and unmounted rather than
          deleted — the section may come back, and the reasoning written into it
          is worth keeping legible. Nothing imports it today, so read it as
          parked, not as wiring you have missed.
        */}
        {hasMarketingMedia(brandFilm) && (
          <section>
          <AmbientVideoStage media={brandFilm} scrim={0.58} tint={0.14} minHeight="min-h-[560px]">
            <div className="mx-auto flex max-w-3xl flex-col items-center px-6 py-28 text-center">
              <Reveal>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: "var(--uc-cyan-ink)" }}
                >
                  {lang === "es" ? "La misma puerta" : "The same front door"}
                </p>
              </Reveal>
              <Reveal delay={0.08}>
                <h2
                  className="mt-5 text-[clamp(28px,4.2vw,54px)] font-semibold leading-[1.06] tracking-tight text-white"
                  style={{ textShadow: "0 2px 34px rgba(9,14,19,0.9)" }}
                >
                  {lang === "es" ? (
                    <>El servicio es real. Lo que hay <span style={{ color: "var(--color-state-verified)" }}>debajo</span> es lo que se reconstruyó.</>
                  ) : (
                    <>The service is real. What was rebuilt is <span style={{ color: "var(--color-state-verified)" }}>everything underneath it</span>.</>
                  )}
                </h2>
              </Reveal>
              <Reveal delay={0.14}>
                <p
                  className="mt-6 max-w-xl text-base leading-relaxed text-white/[0.88]"
                  style={{ textShadow: "0 1px 18px rgba(9,14,19,0.9)" }}
                >
                  {lang === "es"
                    ? "Este es el material de Utility Connect. La plataforma que corre debajo de esta página es una reconstrucción independiente: mismo trabajo, con cada traspaso atribuible y demostrable."
                    : "This footage is Utility Connect's own. The platform running beneath this page is an independent rebuild of the work it describes — same job, with every handoff attributable and provable."}
                </p>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-8">
                  <HoverBorderGradient href="/architecture">
                    {lang === "es" ? "Ver la arquitectura" : "See the architecture"}
                  </HoverBorderGradient>
                </div>
              </Reveal>
            </div>
          </AmbientVideoStage>
          </section>
        )}

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

        {/*
          ── About, with the film in it — white ─────────────────

          These were two stacked blocks: a centred column of prose explaining
          what this project is, and further down a video sitting on its own
          above the closing buttons. Neither supported the other. The prose had
          nothing to look at and the film had nothing to read, so the page
          asked the visitor to make the connection between them across half a
          screen of scrolling.

          One composition now. The paragraph that says what this is sits beside
          the film that shows it, and because that film resolves onto "set up
          your services" and "partner with us", the closing buttons follow
          immediately — the last frame hands over to controls a few
          centimetres below, rather than to a photograph.

          The text is left-aligned rather than centred for the same reason it
          is beside the film and not above it: centred prose next to a hard
          rectangular frame has no shared edge, and the two read as two things
          that happen to be adjacent.
        */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2">
            <Reveal>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                {lang === "es" ? "Acerca de" : "About"}
              </div>
              <h2 className="mt-2 text-3xl font-extrabold uppercase tracking-tight sm:text-4xl" style={{ color: "var(--color-text-hi)" }}>
                {lang === "es" ? <>Qué es <Accent>esto</Accent></> : <>What this <Accent>is</Accent></>}
              </h2>
              <div className="mt-4 h-1 w-16 rounded-full" style={{ background: "var(--color-state-verified)" }} />
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
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/demo" className="rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5" style={{ background: "var(--uc-cyan-fill)" }}>
                  {lang === "es" ? "Ver la plataforma" : "See the platform"}
                </Link>
                <a href="https://utilityconnect.net" target="_blank" rel="noopener noreferrer" className="rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide transition-colors" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}>
                  {lang === "es" ? "El sitio real" : "The real Utility Connect"}
                </a>
              </div>
            </Reveal>

            {/*
              The film, or the closing photograph in its place. Never a gap:
              a two-column layout with one empty column is worse than a
              single column, so the fallback is a real image rather than null.
            */}
            <Reveal delay={0.08}>
              {hasMarketingMedia(invitationMedia) ? (
                <MarketingVideoBand media={invitationMedia} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- art-directed still, sized by the same 16:9 frame as the film it replaces
                <img
                  src="/photos/living-room-tv.jpg"
                  alt=""
                  className="aspect-video w-full rounded-xl object-cover"
                />
              )}
            </Reveal>
          </div>
        </section>

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

        {/*
          ── The proof layer ─────────────────────────────────────

          The last band before the footer, and the only one that leads anywhere
          deep. Everything above is the marketing site doing its own job; a
          reviewer who stops there never learns that twelve further routes carry
          the actual working system, because route names are the worst possible
          invitation to click.

          Inserted here rather than woven into the sections above, so nothing
          existing moves. It is dark on a light page on purpose: the shift from
          claim to evidence should be felt before it is read.
        */}
        <RelayConstellation />

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
                    <li key={l.label}><Link href={asRoute(l.href)} className="transition-colors hover:text-white">{l.label}</Link></li>
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
  { icon: "concierge", title: "Concierge", body: "A trained moving expert who supports you through the whole journey." },
  { icon: "offers", title: "Promotions & specials", body: "The best products and offers for your new home, tailored to your lifestyle." },
  { icon: "mail", title: "USPS mail forwarding", body: "Your concierge forwards your mail on your behalf." },
  { icon: "community", title: "Community resources", body: "Get to know your new schools, parks, and neighborhood." },
  { icon: "checklist", title: "Moving checklist", body: "A detailed checklist so nothing slips before moving day." },
  { icon: "summary", title: "Provider summary", body: "A written summary of selections and account numbers for your records." },
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
