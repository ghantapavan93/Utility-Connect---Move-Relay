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
 */

export type Accent =
  | "verified"
  | "conflict"
  | "unknown"
  | "recovered"
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
  electricity: "240,180,41",
  internet: "77,168,200",
  security: "139,123,216",
  solar: "245,196,81",
};

export const accentRgb = (a: Accent) => ACCENT_RGB[a];
export const accentColor = (a: Accent, alpha = 1) => `rgba(${ACCENT_RGB[a]},${alpha})`;
