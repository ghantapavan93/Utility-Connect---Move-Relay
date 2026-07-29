"use client";

import {
  Zap, Flame, Droplets, Wifi, Tv, Phone, ShieldCheck, Sun, Umbrella, Truck,
  Boxes, Sparkles, Leaf, Bug, Wrench, Recycle, BatteryCharging, House,
  type LucideIcon,
} from "lucide-react";

import { Marquee } from "@/components/ui/marquee";

/**
 * The strip beneath the hero: what this connects, and who it connects to.
 *
 * The static wrapped list this replaced showed eight categories and stopped.
 * A count of eighteen services and thousands of vendors is a claim about
 * *breadth*, and breadth is the one thing a fixed list cannot show — the row
 * has to keep arriving to mean anything. Opposing directions on adjacent rows
 * keep the eye from locking onto a single item and following it.
 *
 * ## Two rows, not three
 *
 * A third row used to run here naming the stack — Next.js, PostgreSQL, Vitest —
 * in the brand cyan, on the reasoning that it was the only row making a
 * checkable claim and so the only one that had earned colour. The reasoning was
 * sound and the placement was wrong. This strip sits directly under the hero,
 * where the question a visitor is holding is "what is this for", and answering
 * it with a build manifest changes the subject to how the site was made.
 *
 * Worth being exact about the cost, because it is real: this was the only place
 * in the rendered site that named the stack. It is now stated in README.md and
 * docs/ARCHITECTURE_REVIEW.md and nowhere a visitor will land. /architecture
 * explains the *system* — the boundaries, the invariants, the trust map — and
 * never lists the dependencies. If a reviewer should meet the stack without
 * opening the repository, it needs a home on that page rather than a return
 * ticket to this one.
 *
 * Removing it also frees the cyan. With the stack row gone, colour can do the
 * job it should have been doing all along: marking the eighteen services this
 * platform actually connects.
 *
 * No coloured chips beyond that. The reference implementation assigns a
 * different background to every badge — pink, purple, orange — which is exactly
 * the palette this project treats as a generic-AI tell.
 */

/**
 * The eighteen the heading counts, each with the mark that names it.
 *
 * The icons are not decoration filling space to the left of a word. This row
 * scrolls, so a reader meets each chip for about a second — long enough to
 * recognise a shape, not always long enough to finish reading a phrase like
 * "Trash and recycling". The glyph is what survives that second, and the word
 * confirms it.
 *
 * Lucide, drawn on one grid at one stroke weight, so eighteen marks read as a
 * single set rather than as eighteen images from eighteen places.
 */
const SERVICES: Array<{ label: string; Icon: LucideIcon }> = [
  { label: "Electric", Icon: Zap },
  { label: "Natural gas", Icon: Flame },
  { label: "Water", Icon: Droplets },
  { label: "Internet", Icon: Wifi },
  { label: "Television", Icon: Tv },
  { label: "Home phone", Icon: Phone },
  { label: "Home security", Icon: ShieldCheck },
  { label: "Solar", Icon: Sun },
  { label: "Insurance", Icon: Umbrella },
  { label: "Moving", Icon: Truck },
  { label: "Storage", Icon: Boxes },
  { label: "Cleaning", Icon: Sparkles },
  { label: "Lawn care", Icon: Leaf },
  { label: "Pest control", Icon: Bug },
  { label: "Home warranty", Icon: Wrench },
  { label: "Trash and recycling", Icon: Recycle },
  { label: "EV charging", Icon: BatteryCharging },
  { label: "Smart home", Icon: House },
];

/**
 * Providers, as their real marks where a freely-licensed one exists.
 *
 * ## Where these came from, and why only some of them
 *
 * Every file in `public/brands/` is public domain or CC0. Four are Wikimedia
 * Commons files carrying `PD-textlogo` — a wordmark below the threshold of
 * originality is not copyrightable in the US — and the rest are Simple Icons,
 * a CC0 set built for exactly this. Nothing here was lifted off a press page or
 * traced. The brand hex values are the ones those sources publish, not colours
 * picked by eye off a screenshot.
 *
 * Two providers have no mark, and that is a finding rather than an omission.
 * **Direct Energy** returns nothing usable: the closest Commons results are
 * *Direct Énergie*, a different French company, and two unrelated firms.
 * **Frontier Utilities** is a Texas retail electricity provider and a different
 * company from **Frontier** Communications, whose logo is here — shipping one
 * for the other would put the wrong company's mark on the page. Both keep a
 * wordmark until a correct asset exists, which is what `logo?` being optional
 * is for.
 *
 * ## The claim this row must not make
 *
 * A wall of correctly-coloured trademarks is the visual grammar of a
 * partnership page, and these are not partners. The disclaimer under the row
 * says so in words; the marks say the opposite in the language read first. The
 * honest resolution is not to hide the logos but to name what the row is —
 * which is why the caption below states these are illustrative of the provider
 * categories a platform like this integrates with, on a build that is
 * unaffiliated and synthetic throughout.
 */
interface Provider {
  name: string;
  /** Filename in `public/brands/`. Optional: absent means no correct asset exists. */
  logo?: string;
}

const PROVIDERS: Provider[] = [
  { name: "Direct Energy" },
  { name: "Frontier Utilities" },
  { name: "Spectrum", logo: "spectrum.svg" },
  { name: "ADT", logo: "adt.svg" },
  { name: "Frontier", logo: "frontier.svg" },
  { name: "Xfinity", logo: "xfinity.svg" },
  { name: "AT&T", logo: "atandt.svg" },
  { name: "Vivint", logo: "vivint.svg" },
];

/** A service: the mark first, then the word it names. */
function ServiceChip({ label, Icon }: { label: string; Icon: LucideIcon }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-4 py-2 text-sm font-semibold"
      /*
        The plate is 0.06, not the 0.10 this started at, and the number was
        measured rather than picked. `--uc-cyan-ink` is the token the design
        system defines for small cyan text *on a dark ground*; a cyan wash
        behind it lightens that ground and quietly spends the contrast the token
        was chosen to provide. At 0.10 this measured 4.39:1 at 14px — under the
        4.5 it needs, and failing for the same reason the system already
        documents for the raw brand blue. Thinning the wash restores the ground
        the token assumes and reads at 4.59:1; the border carries the chip's
        edge instead.
      */
      style={{
        borderColor: "rgba(0,135,181,0.5)",
        background: "rgba(0,135,181,0.06)",
        color: "var(--uc-cyan-ink)",
      }}
    >
      {/*
        `aria-hidden`, because the word beside it already says this. An icon
        announced next to its own label is the same noun read out twice.
      */}
      <Icon size={15} strokeWidth={2} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
}

/**
 * A provider, on the light plate its mark was drawn for.
 *
 * Every one of these logos is specified against white — ADT's blue, Xfinity's
 * violet and Vivint's near-black all sit somewhere between weak and invisible
 * on this navy, and Vivint at #212721 would effectively disappear. Recolouring
 * them to fix that is the one thing a brand asset may not do. So the row gives
 * each mark the ground it expects, which is also simply how partner walls are
 * built on dark sites.
 *
 * The plate does a second job: it makes one row out of two different kinds of
 * object. Four of these are square glyphs on a 24-unit grid and two are wide
 * wordmarks — Xfinity's box is 1000×326 — so sizing by width would render the
 * glyphs as postage stamps beside billboards. Height is fixed and width runs
 * free, the way a logo wall is set, and the plate gives every entry the same
 * silhouette regardless of what is inside it.
 *
 * A provider with no correct asset gets its name set on the same plate in the
 * same dark ink. That keeps the row uniform and, more usefully, keeps it honest:
 * a missing mark reads as a wordmark rather than as a gap.
 */
function ProviderMark({ provider }: { provider: Provider }) {
  return (
    <span
      className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg px-4"
      style={{
        // Not pure white: a flat #fff plate on navy glares and pulls the eye
        // off the services row above it, which is the row that carries meaning.
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      {provider.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- public-domain brand asset, intrinsic ratio varies per mark
        <img
          src={`/brands/${provider.logo}`}
          alt={provider.name}
          className="h-5 w-auto max-w-[120px] object-contain"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span
          className="whitespace-nowrap text-sm font-bold tracking-[-0.01em]"
          style={{ color: "#12181e" }}
        >
          {provider.name}
        </span>
      )}
    </span>
  );
}

export function TrustStrip() {
  return (
    <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
          Connecting 18 home services across 3,500+ vendors nationwide
        </div>

        <div className="mt-5 space-y-4">
          {/* What gets connected. */}
          <Marquee speed="slow">
            {SERVICES.map((s) => (
              <ServiceChip key={s.label} label={s.label} Icon={s.Icon} />
            ))}
          </Marquee>

          {/* Who it connects to, running the other way. */}
          <Marquee reverse>
            {PROVIDERS.map((p) => (
              <ProviderMark key={p.name} provider={p} />
            ))}
          </Marquee>
        </div>

        {/*
          Raised from white/35, which measured 3.19:1 at 11px and was the least
          legible text on the page. That is the wrong thing to make hard to read:
          it is the notice that these are not real partners and this data is not
          real data, and a disclaimer nobody can read is decoration standing
          where a disclosure should be. At 0.55 it is 5.82:1 and still recessive.
        */}
        <p className="mx-auto mt-5 max-w-3xl text-center text-[11px] leading-relaxed text-white/55">
          Provider marks are shown to illustrate the categories of integration partner a
          platform like this connects to. They are public-domain and CC0 files, and each
          remains the trademark of its owner. This is an unaffiliated concept build with no
          partnership, endorsement or relationship implied, and every customer, partner and
          provider record on it is synthetic.
        </p>
      </div>
    </div>
  );
}
