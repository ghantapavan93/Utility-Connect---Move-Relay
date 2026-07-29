"use client";

/**
 * Line icons for the six concierge features.
 *
 * These were typographic glyphs — ☎ ✦ ✉ ◈ ✓ ▤ — pulled from whatever the
 * system font happened to have. That is fragile in a way that is easy to miss:
 * the same character renders as a different picture on Windows, macOS and
 * Android, and two of those six are emoji-presented by default on some
 * platforms, which drops a colour cartoon into a monochrome set.
 *
 * Drawn paths render identically everywhere and can share a stroke weight with
 * the industry marks, so the whole page reads as one hand.
 */

const PATHS: Record<string, string[]> = {
  // A headset: a person you can actually reach.
  concierge: [
    "M4 13v-1a8 8 0 0 1 16 0v1",
    "M4 13h2.5a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z",
    "M20 13h-2.5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z",
    "M17 19v1a2 2 0 0 1-2 2h-3",
  ],
  // A tag with its eyelet.
  offers: ["M3 12.5V4a1 1 0 0 1 1-1h8.5L21 11.5 12.5 20z", "M7.5 7.5h.01"],
  // An envelope, forwarded.
  mail: ["M3 6.5h13v11H3z", "M3 7l6.5 5L16 7", "M15 12h6", "M18.5 9.5 21 12l-2.5 2.5"],
  // Blocks around a shared green.
  community: [
    "M3 20V9l5-4 5 4v11",
    "M13 20V12l4-3 4 3v8",
    "M3 20h18",
    "M7 20v-4h2v4",
    "M16.5 20v-3h2v3",
  ],
  // A list with the first item done.
  checklist: [
    "M9 5h11M9 12h11M9 19h11",
    "M3 5l1.5 1.5L7.5 3.5",
    "M3.5 11.5h2.5M3.5 18.5h2.5",
  ],
  // A page of records under a seal.
  summary: [
    "M6 3h8l4 4v14H6z",
    "M14 3v4h4",
    "M9 12h6M9 16h4",
    "M17.5 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z",
  ],
};

export type FeatureIconName = keyof typeof PATHS;

export function FeatureIcon({ name }: { name: string }) {
  const paths = PATHS[name] ?? [];
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
