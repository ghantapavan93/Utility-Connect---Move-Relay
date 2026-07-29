"use client";

/**
 * A soft light that sits behind a card and leaks past its edges.
 *
 * The reference runs four unrelated hues round the element — blue, magenta,
 * red, orange. That is the exact thing this design system names as a
 * generated-page tell, and it would also be the only colour on the site that
 * refers to nothing. The mechanic is kept and the palette is not: the cone
 * travels through one hue, from the brand cyan out to its two accessible
 * derivatives and back, so what you get is depth rather than a rainbow.
 *
 * Only the static mode exists. The reference also offers a rotating one, and on
 * a rounded rectangle it is wrong however it is built: spin the element and its
 * corners sweep, replace it with a spinning square and the silhouette pulses at
 * every corner, replace that with a circle and it stops hugging a wide card.
 * Intensity on hover carries the interaction instead, and it carries it better —
 * light that responds to the pointer says something, light that turns forever
 * says only that someone knew how to make it turn.
 *
 * Inert to the pointer and invisible to assistive technology: it is neither
 * content nor a control.
 */

export type GlowBlur = "soft" | "medium" | "strong";

const BLUR: Record<GlowBlur, string> = {
  soft: "blur(14px)",
  medium: "blur(22px)",
  strong: "blur(34px)",
};

/*
  One hue, four stops.

  #0087b5 is the brand; #007aa3 and #2498bf are the two measured-accessible
  derivatives either side of it, and #4da8c8 is the transit tone. Closing on the
  colour it opened with is what keeps the cone from showing a seam.
*/
const CONE =
  "conic-gradient(from 180deg at 50% 50%, #0087b5, #4da8c8, #2498bf, #007aa3, #0087b5)";

export function GlowEffect({
  blur = "medium",
  /** How far the light spills past the element it sits behind, in pixels. */
  spread = 6,
  /** Raised on hover by the card that owns this. */
  intensity = 0.42,
}: {
  blur?: GlowBlur;
  spread?: number;
  intensity?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-[inherit]"
      style={{
        inset: -spread,
        background: CONE,
        filter: BLUR[blur],
        opacity: intensity,
        transition: "opacity 260ms var(--ease-out-relay)",
      }}
    />
  );
}
