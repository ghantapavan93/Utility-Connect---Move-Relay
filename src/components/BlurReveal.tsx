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

  if (reduce) {
    return (
      <Tag className={className} style={style}>
        {tokens.map((t, i) => (
          <Fragment key={i}>
            <span style={isEmphasis(t.word) ? { color: "var(--color-state-verified)" } : undefined}>
              {t.word}
            </span>
            {t.trailing}
          </Fragment>
        ))}
      </Tag>
    );
  }

  return (
    <Tag className={className} style={style}>
      {tokens.map((t, i) => (
        <Fragment key={i}>
          {/*
            `inline-block` is required for transform to apply to an inline run,
            and `whitespace-pre` on the trailing space keeps the gap from
            collapsing now that each word is its own box.
          */}
          <motion.span
            className="inline-block"
            style={{
              willChange: "transform, filter, opacity",
              ...(isEmphasis(t.word) ? { color: "var(--color-state-verified)" } : {}),
            }}
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
          {t.trailing && <span className="whitespace-pre">{t.trailing}</span>}
        </Fragment>
      ))}
    </Tag>
  );
}
