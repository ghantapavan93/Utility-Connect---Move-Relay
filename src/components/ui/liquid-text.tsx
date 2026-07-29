"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useInView } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";

/**
 * A word that fills with cyan from the bottom, like a level rising.
 *
 * The reference draws a blue-to-purple gradient wave behind SVG text. The
 * gradient is out, but the mechanic earns its place here: this label sits above
 * the line "an address becomes a home only when everything begins working
 * together", and a level rising through the word is that sentence. Services
 * come on one at a time until the word is full.
 *
 * Built as SVG text with a clip path rather than a background on an HTML
 * element, because the fill has to follow the glyph outlines. Two <text> nodes:
 * the outline underneath, always readable, and the filled copy clipped to a
 * rectangle that rises. If the animation never runs, the outline is still a
 * word — the failure mode is "not filled", never "not there".
 *
 * SMIL rather than CSS keyframes: `y` and `height` on an SVG rect are geometry
 * attributes, and animating them in CSS is not supported everywhere the site
 * has to work. SMIL animates the attribute itself, and pausing it under
 * reduced motion is a matter of not rendering it.
 */

export function LiquidText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const still = useStillness();
  const uid = useId().replace(/:/g, "");
  const clipId = `liquid-clip-${uid}`;

  const ref = useRef<SVGSVGElement>(null);
  const anim = useRef<SVGAnimateElement>(null);

  /*
    The fill starts when the word is on screen, not when the document loads.

    This band is most of a page down, so a `begin="0.2s"` animation would be
    finished and frozen before anyone reached it — the level would never appear
    to rise. SMIL cannot express "when visible", so the animation begins
    indefinite and is started by hand on entry.
  */
  const inView = useInView(ref, { once: true, margin: "-20% 0px" });

  useEffect(() => {
    if (still || !inView) return;
    anim.current?.beginElement();
  }, [still, inView]);

  /*
    The viewBox is fitted to the glyphs, not fixed.

    A constant width silently clips anything longer than it was sized for, and
    this component takes translated copy — "Moving day" is ten characters and
    "El día de la mudanza" is twice that. The first render uses a per-character
    estimate so the server and the client agree on markup, then the real ink
    width is measured and the box is corrected. `meet` scales the word down to
    whatever CSS width the caller gave it.
  */
  const H = 150;
  const FONT = H * 0.78;
  const inkRef = useRef<SVGTextElement>(null);
  const [W, setW] = useState(() => Math.ceil(text.length * FONT * 0.56));

  useEffect(() => {
    const el = inkRef.current;
    if (!el) return;
    /*
      After the webfont resolves, not before. Measuring against the fallback
      face gives a width for type nobody will see, and the correction would be
      wrong in whichever direction the two faces differ.
    */
    let cancelled = false;
    const measure = () => {
      if (cancelled || !inkRef.current) return;
      const ink = inkRef.current.getComputedTextLength();
      if (ink > 0) setW(Math.ceil(ink + FONT * 0.08));
    };
    document.fonts?.ready.then(measure) ?? measure();
    return () => {
      cancelled = true;
    };
  }, [text, FONT]);

  return (
    <svg
      ref={ref}
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={text}
      preserveAspectRatio="xMinYMid meet"
    >
      <defs>
        <clipPath id={clipId}>
          {/*
            The level. Starts below the baseline and rises past the cap height,
            so the word goes from empty to completely full.

            Reduced motion gets a static full rect: the word is filled, it just
            never animates getting there. Rendering nothing would leave only the
            outline, which is a different — and worse — design.
          */}
          <rect x="0" y={still ? 0 : H} width={W} height={H}>
            {!still && (
              <animate
                ref={anim}
                attributeName="y"
                from={H}
                to="0"
                dur="1.6s"
                begin="indefinite"
                fill="freeze"
                calcMode="spline"
                keySplines="0.16 1 0.3 1"
                keyTimes="0;1"
              />
            )}
          </rect>
        </clipPath>
      </defs>

      {/* The empty word. Cyan at low opacity so it reads as the unfilled state
          of the same thing, not as a second, greyer label. */}
      <text
        ref={inkRef}
        x="0"
        y={H * 0.74}
        fontSize={FONT}
        fontWeight={800}
        letterSpacing="-0.02em"
        fill="rgba(0,135,181,0.22)"
      >
        {text}
      </text>

      {/* The filled word, revealed by the rising level. */}
      <text
        x="0"
        y={H * 0.74}
        fontSize={FONT}
        fontWeight={800}
        letterSpacing="-0.02em"
        fill="var(--color-state-verified)"
        clipPath={`url(#${clipId})`}
      >
        {text}
      </text>
    </svg>
  );
}
