"use client";

import { Fragment, useMemo } from "react";
import { motion } from "framer-motion";
import { useStillness } from "@/lib/use-stillness";
import { EASE } from "@/lib/motion";

/**
 * Word-level blur-to-sharp reveal.
 *
 * The marketing headings faded in as single blocks, which is motion that
 * announces itself and says nothing. This animates each word in sequence out of
 * a blur, so a sentence arrives the way it is read — left to right, one idea at
 * a time — and the emphasised words land last and hardest.
 *
 * Two details do most of the work. The blur is what separates this from a
 * fade: focus pulling reads as a camera finding its subject rather than as a
 * div appearing. And the tokeniser preserves the original whitespace, so the
 * line occupies exactly the space it will end in and nothing reflows as words
 * arrive — a heading that shifts while it animates is worse than one that does
 * not animate at all.
 *
 * Reduced motion renders the finished sentence with no transforms. Not a faster
 * animation: none.
 */

type Tag = "h1" | "h2" | "h3" | "p";

/** Split into words while keeping the trailing whitespace attached. */
function tokenize(text: string) {
  const out: { word: string; trailing: string }[] = [];
  const re = /(\S+)(\s*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push({ word: m[1]!, trailing: m[2] ?? "" });
  return out;
}

export function BlurReveal({
  text,
  emphasis = [],
  marker = false,
  as: Tag = "h2",
  className,
  style,
  stagger = 0.055,
  delay = 0,
  once = true,
}: {
  text: string;
  /** Words rendered in the verified accent, landing at the end of the cascade. */
  emphasis?: string[];
  /**
   * Draw a highlighter bar behind the emphasised run instead of colouring it.
   *
   * The two are alternatives, never both: cyan type on a cyan marker is type
   * you cannot read. When this is on, the emphasised words stay white and the
   * accent moves from the glyphs to the mark behind them, so the colour still
   * carries its one meaning and the phrase still separates from the line.
   */
  marker?: boolean;
  as?: Tag;
  className?: string;
  /** Fluid type sizes belong on the element, not in a utility class. */
  style?: React.CSSProperties;
  stagger?: number;
  delay?: number;
  once?: boolean;
}) {
  const reduce = useStillness();
  const tokens = useMemo(() => tokenize(text), [text]);

  // Compared case- and punctuation-insensitively, so `emphasis={["verified"]}`
  // still matches "verified," at the end of a clause.
  const emphasised = useMemo(
    () => new Set(emphasis.map((w) => w.toLowerCase().replace(/[^a-z0-9]/gi, ""))),
    [emphasis],
  );
  const isEmphasis = (w: string) => emphasised.has(w.toLowerCase().replace(/[^a-z0-9]/gi, ""));

  /** Colour the glyphs only when no bar is going to sit behind them. */
  const accentStyle = (word: string) =>
    isEmphasis(word) && !marker ? { color: "var(--color-state-verified)" } : undefined;

  /*
    Marker geometry, in em so it tracks the type size at every breakpoint.

    One bar per *word*, not one per phrase. A single rect over the phrase is
    correct only while the phrase stays on one line; the moment a heading wraps
    mid-phrase, that rect becomes the union of two line boxes and paints a solid
    block across the gap between them. Per-word bars wrap the way the words do.

    The bleed is what keeps them reading as one stroke: each bar overruns its
    word by 0.18em on both sides, and adjacent bars therefore overlap by 0.36em
    across a space roughly 0.26em wide. No seam on a line, and a clean break
    wherever the browser chose to wrap.
  */
  const BLEED = "-0.18em";
  const barClass = "pointer-events-none absolute bottom-[0.04em] top-[0.12em] rounded-[0.1em]";
  /*
    No negative z-index. The word is not a stacking context, so `-z-10` sends
    the bar behind the *section's* background image rather than behind the
    glyphs. Painting order does the job instead: the bar is emitted first and
    the positioned text after it.
  */
  const barStyle = { left: BLEED, right: BLEED, background: "rgba(0,135,181,0.32)" } as const;

  /** Position of each emphasised word within the emphasised sequence. */
  const emphasisOrder = useMemo(() => {
    const order = new Map<number, number>();
    let n = 0;
    tokens.forEach((t, i) => {
      if (isEmphasis(t.word)) order.set(i, n++);
    });
    return order;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, emphasised]);

  if (reduce) {
    return (
      <Tag className={className} style={style}>
        {tokens.map((t, i) => (
          <Fragment key={i}>
            {marker && isEmphasis(t.word) ? (
              <span className="relative inline-block">
                <span aria-hidden className={barClass} style={barStyle} />
                <span className="relative">{t.word}</span>
              </span>
            ) : (
              <span style={accentStyle(t.word)}>{t.word}</span>
            )}
            {t.trailing}
          </Fragment>
        ))}
      </Tag>
    );
  }

  /*
    The stroke starts once the last emphasised word has mostly arrived, then
    crosses one word at a time. A highlighter that reaches a word before the
    word exists reads as two unrelated animations sharing a box.

    Each segment is short and its successor begins exactly as it ends, so the
    phrase is crossed by one continuous drag rather than by several bars
    inflating at once. Linear easing, because eased segments visibly slow at
    every word boundary.
  */
  const lastEmphasisIndex = tokens.reduce((acc, t, i) => (isEmphasis(t.word) ? i : acc), -1);
  const markerStart = delay + lastEmphasisIndex * stagger + 0.12 + 0.34;
  const SEGMENT = 0.16;

  return (
    <Tag className={className} style={style}>
      {tokens.map((t, i) => {
        /*
          `inline-block` is required for transform to apply to an inline run,
          and `whitespace-pre` on the trailing space keeps the gap from
          collapsing now that each word is its own box.
        */
        const glyphs = (
          <motion.span
            className="inline-block"
            style={{ willChange: "transform, filter, opacity", ...accentStyle(t.word) }}
            initial={{ opacity: 0, y: "0.35em", filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: "0em", filter: "blur(0px)" }}
            viewport={{ once, margin: "-12% 0px" }}
            transition={{
              duration: 0.62,
              // Emphasis words wait for the rest of the line, so the sentence
              // resolves onto its own point rather than past it.
              delay: delay + i * stagger + (isEmphasis(t.word) ? 0.12 : 0),
              ease: EASE.outQuart,
            }}
          >
            {t.word}
          </motion.span>
        );

        return (
          <Fragment key={i}>
            {marker && isEmphasis(t.word) ? (
              <span className="relative inline-block">
                {/* Grown from the left, the way a highlighter is dragged.
                    Fading a coloured block in behind words looks like a
                    rendering artefact; growing it reads as someone marking the
                    part of the line that matters. */}
                <motion.span
                  aria-hidden
                  className={barClass}
                  style={{ ...barStyle, transformOrigin: "left center" }}
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once, margin: "-12% 0px" }}
                  transition={{
                    duration: SEGMENT,
                    delay: markerStart + (emphasisOrder.get(i) ?? 0) * SEGMENT,
                    ease: "linear",
                  }}
                />
                <span className="relative">{glyphs}</span>
              </span>
            ) : (
              glyphs
            )}
            {t.trailing && <span className="whitespace-pre">{t.trailing}</span>}
          </Fragment>
        );
      })}
    </Tag>
  );
}
