"use client";

import { motion } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";

/**
 * A line of copy that rolls up into place, word by word.
 *
 * Each word sits in a clipped box and travels from below it, so the sentence
 * assembles rather than fading in as a block. Fading a paragraph in is motion
 * that announces itself and says nothing; rolling reads as the words arriving
 * in the order they are meant to be read, which is the one thing motion can
 * usefully do to a sentence.
 *
 * Fast on purpose. A visitor gives an opening line a second at most, so the
 * whole line is in place in well under one: 22ms between words, 300ms each.
 * Slower than that and the reader is waiting for the sentence rather than
 * reading it.
 *
 * Words, not characters. Character-level rolls look impressive on three words
 * and unreadable on thirty, and this line is thirty.
 */

export interface RollSegment {
  text: string;
  /** Carries the brand cyan. Used for the phrase the sentence is built around. */
  accent?: boolean;
}

export function TextRoll({
  segments,
  className = "",
  wordDelay = 0.022,
  startDelay = 0,
}: {
  segments: RollSegment[];
  className?: string;
  wordDelay?: number;
  startDelay?: number;
}) {
  const still = useStillness();

  /*
    Flattened to words up front, so the stagger index is continuous across
    segments. Indexing per segment would restart the delay at each colour
    change and the line would arrive in visible chunks.
  */
  const words = segments.flatMap((segment) =>
    segment.text.split(" ").filter(Boolean).map((word) => ({ word, accent: segment.accent })),
  );

  return (
    <span className={className}>
      {words.map(({ word, accent }, i) => (
        <span
          key={`${word}-${i}`}
          /*
            `overflow-hidden` is what makes it a roll rather than a slide: the
            word is genuinely clipped by its own box on the way up. Inline-flex
            keeps the box on the text baseline so descenders are not shaved.
          */
          className="inline-flex overflow-hidden align-bottom"
          style={{ marginRight: "0.28em" }}
        >
          <motion.span
            initial={still ? false : { y: "110%" }}
            animate={{ y: 0 }}
            transition={{
              duration: 0.3,
              delay: still ? 0 : startDelay + i * wordDelay,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={accent ? { color: "var(--uc-cyan-ink)" } : undefined}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
