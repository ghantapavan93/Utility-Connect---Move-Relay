"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useStillness } from "@/lib/use-stillness";

/**
 * The review wall.
 *
 * Their site carries a continuous feed of customer reviews — dozens of them,
 * each with a timestamp to the minute and a first name — and it is the single
 * strongest trust signal on the page. Not because any one review is
 * persuasive, but because the volume and the timestamps together say *this is
 * happening right now*. Three testimonials in a row cannot make that claim; a
 * wall that keeps moving makes it without saying anything.
 *
 * Every review here is invented. Theirs belong to real customers who wrote
 * them about a real service, and reproducing those on a concept site would put
 * words in the mouths of named people who never said them to us — a worse
 * problem than the copyright one, and the reason this generates rather than
 * scrapes.
 *
 * Two things keep it honest. The copy stays plausible and unremarkable rather
 * than glowing, because invented praise that reads like marketing is exactly
 * what a reviewer would smell. And the section is labelled synthetic on the
 * page, not only in this comment.
 */

interface Review {
  quote: string;
  name: string;
  minutesAgo: number;
}

/**
 * Written to sound like people, not like a brand.
 *
 * Short where real reviews are short, specific where they are specific, and
 * occasionally lukewarm — a wall of five-star superlatives is less believable
 * than a wall that includes "did what it said".
 */
const REVIEWS: Review[] = [
  { quote: "Had electricity and internet sorted in one call. I had budgeted a whole afternoon for it.", name: "Janelle R.", minutesAgo: 12 },
  { quote: "The rep compared four electricity plans and told me which one was worse for my usage. Did not expect that.", name: "Marcus T.", minutesAgo: 34 },
  { quote: "Straightforward. Did what it said.", name: "Priya N.", minutesAgo: 58 },
  { quote: "Moving with two kids under four. Not having to sit on hold with the utility company was worth it on its own.", name: "Dana K.", minutesAgo: 96 },
  { quote: "They caught that my install date was the day before my lease started and flagged it. I would have missed that.", name: "Chris O.", minutesAgo: 143 },
  { quote: "Took two days to hear back about the security quote, but everything else moved quickly.", name: "Alicia M.", minutesAgo: 187 },
  { quote: "Our agent set this up for us before closing. Showed up to a house that already had power on.", name: "Ben H.", minutesAgo: 241 },
  { quote: "Got a written summary of everything ordered with the account numbers. Filed it and forgot about it.", name: "Sofia L.", minutesAgo: 298 },
  { quote: "Used a different service last move and spent a week untangling a double order. This was not that.", name: "Wes A.", minutesAgo: 355 },
  { quote: "Very patient with me changing the move date twice.", name: "Marguerite D.", minutesAgo: 402 },
  { quote: "Internet was live when we walked in. That is the whole review.", name: "Tom V.", minutesAgo: 470 },
  { quote: "Asked for the fibre option specifically and they found the one provider in our area that had it.", name: "Ife A.", minutesAgo: 523 },
];

function ago(minutes: number): string {
  if (minutes < 60) return `${minutes} min ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function Card({ r }: { r: Review }) {
  return (
    <figure
      className="w-[340px] shrink-0 rounded-2xl border p-5"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
    >
      <div className="flex items-center justify-between">
        <div style={{ color: "var(--color-state-conflict)" }} aria-label="5 out of 5">
          ★★★★★
        </div>
        <time className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>
          {ago(r.minutesAgo)}
        </time>
      </div>
      <blockquote
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--color-text-hi)" }}
      >
        &ldquo;{r.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-3 text-xs font-bold" style={{ color: "var(--color-text-lo)" }}>
        — {r.name}
      </figcaption>
    </figure>
  );
}

/**
 * One row, drifting. Two rows run in opposite directions so the wall reads as
 * a body of activity rather than a single belt going past.
 */
function Row({ items, reverse }: { items: Review[]; reverse?: boolean }) {
  const still = useStillness();
  // Duplicated so the strip can translate exactly one set-width and land where
  // it started — the seam is what makes the loop invisible.
  const doubled = useMemo(() => [...items, ...items], [items]);

  if (still) {
    // No marquee at all: a horizontally scrollable row the visitor drives.
    return (
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map((r, i) => (
          <Card key={i} r={r} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <motion.div
        className="flex gap-4"
        style={{ width: "max-content", willChange: "transform" }}
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: 64, repeat: Infinity, ease: "linear" }}
      >
        {doubled.map((r, i) => (
          <Card key={i} r={r} />
        ))}
      </motion.div>
    </div>
  );
}

export function ReviewWall() {
  const half = Math.ceil(REVIEWS.length / 2);
  return (
    <div className="space-y-4">
      <Row items={REVIEWS.slice(0, half)} />
      <Row items={REVIEWS.slice(half)} reverse />
      <p className="pt-2 text-center text-[11px]" style={{ color: "var(--color-text-lo)" }}>
        Every review on this page is synthetic, written for this concept. No real customer
        wrote any of them.
      </p>
    </div>
  );
}
