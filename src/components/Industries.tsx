"use client";

import { INDUSTRIES } from "@/lib/industries-data";
import { InfoCard } from "@/components/ui/info-card";

/**
 * "Industries we work with" — Utility Connect names nine partner industries on
 * their own site, each with its own page and its own accent colour.
 *
 * This was a grid of glyph-and-two-lines tiles: correct, and completely
 * forgettable. Nine near-identical boxes make nine different businesses look
 * like one undifferentiated list, which is the opposite of what a page headed
 * "who we work with" is for. Each card now carries a drawn mark of that
 * industry's actual work and lights in that industry's colour.
 */
export function Industries() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {INDUSTRIES.map((ind, i) => (
        <InfoCard
          key={ind.slug}
          href={`/industries/${ind.slug}`}
          slug={ind.slug}
          name={ind.name}
          note={ind.note}
          accent={ind.accent}
          delay={(i % 3) * 0.05}
        />
      ))}
    </div>
  );
}
