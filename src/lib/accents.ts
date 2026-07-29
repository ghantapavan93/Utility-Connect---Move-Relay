/**
 * The accent palette.
 *
 * Lives in `lib` rather than beside the cinematic components because it is a
 * pure lookup with no React in it, and a server component has every right to
 * ask what colour "verified" is. It sat inside a `"use client"` module until
 * the architecture page — which is static and rendered on the server — tried to
 * call it and the build refused.
 *
 * The rule this encodes is the design system's: an accent names a *utility
 * state*, never a decoration. There is no entry here chosen because a card
 * needed to look different from the one above it. Verified is Utility
 * Connect's own blue; a conflict is amber because a disagreement needs
 * judgement rather than alarm; an unknown outcome is held amber; a recovery is
 * green; and the service colours belong to the services that own them.
 *
 * `failed` is the one red, and it is deliberately hard to reach. Amber covers
 * everything that needs a person; red is reserved for a break — an invariant
 * that did not hold. Reaching for it when amber would do is how a palette stops
 * meaning anything.
 */

export type Accent =
  | "verified"
  | "conflict"
  | "unknown"
  | "recovered"
  | "failed"
  | "electricity"
  | "internet"
  | "security"
  | "solar";

/** rgb triples, so tint, glow and particle can all be derived at any alpha. */
const ACCENT_RGB: Record<Accent, string> = {
  verified: "0,135,181",
  conflict: "232,163,61",
  unknown: "217,140,63",
  recovered: "61,167,106",
  failed: "229,72,77", // #e5484d — matches --color-state-failed
  electricity: "240,180,41",
  internet: "77,168,200",
  security: "139,123,216",
  solar: "245,196,81",
};

export const accentRgb = (a: Accent) => ACCENT_RGB[a];
export const accentColor = (a: Accent, alpha = 1) => `rgba(${ACCENT_RGB[a]},${alpha})`;

/**
 * The same accents, lightened enough to be read at small sizes.
 *
 * The design system already documents this trap for the brand cyan: `#0087b5`
 * is 3.97:1 as text on navy, under the 4.5 it needs at the sizes actually used,
 * which is why `--uc-cyan-ink` exists. Every other accent has the same problem
 * and had no equivalent — so `accentColor(...)` was being used directly for
 * 10px uppercase labels all over the cinematic pages.
 *
 * Measured on a module page, against the brightest composite the beams
 * produce: verified 3.03, failed 3.17, security 3.50, recovered 4.10. All
 * failing, and the amber ones passing only because amber is bright to begin
 * with.
 *
 * Each value here is the accent mixed toward white by the smallest amount that
 * clears 4.5:1 against three grounds at once — the page ground `#04070b`, and
 * the two brightest composites the beams reach. Amber and gold needed nothing
 * and are unchanged, which is the point of computing it rather than lightening
 * everything by a fixed step: the hue keeps its identity, and only the ones
 * that were failing move.
 *
 * Reserve this for small text. Fills, rules, dots and glows should stay on
 * `accentColor` — they are not read, and lightening them would wash out the
 * one saturated colour this palette owns.
 */
const ACCENT_INK: Record<Accent, string> = {
  verified: "#4dabcb",
  conflict: "#e8a33d", // already 5.75:1 — unchanged
  unknown: "#da8e43",
  recovered: "#54b27c",
  failed: "#ed7f82",
  electricity: "#f0b429", // already 6.65:1 — unchanged
  internet: "#52abca",
  security: "#a295e0",
  solar: "#f5c451", // already 7.62:1 — unchanged
};

/** An accent at a size someone has to actually read. */
export const accentInk = (a: Accent) => ACCENT_INK[a];
