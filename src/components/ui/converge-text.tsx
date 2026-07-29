"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";

/**
 * A short label whose letters begin in the source states and settle into one.
 *
 * The reference this replaces cycles every letter through a rainbow forever.
 * That is colour with no referent, and this system gives colour meaning:
 * cyan is verified, amber is a conflict awaiting judgement, grey is pending.
 * So the letters start scattered across those three states and resolve to a
 * single colour, which is the same sentence the section makes in prose and the
 * constellation makes in geometry — several disagreeing sources becoming one
 * record.
 *
 * It resolves once and stays resolved. A label that keeps re-scattering would
 * be saying the record never settles.
 */

/** The three states a field can arrive in, in the order the demo produces them. */
const SOURCE_STATES = [
  "var(--color-state-verified)",
  "var(--color-state-conflict)",
  "var(--color-state-pending)",
];

export function ConvergeText({
  text,
  className = "",
  /** Colour every letter ends on. Defaults to the accent the section uses. */
  resolved = "var(--uc-cyan-ink)",
}: {
  text: string;
  className?: string;
  resolved?: string;
}) {
  const still = useStillness();
  const ref = useRef<HTMLSpanElement>(null);
  /*
    Timed from when the label is actually on screen, not from mount.

    This section sits well below the fold, so a timer started at mount resolves
    long before anyone scrolls to it and the visitor only ever sees the settled
    state. `once` keeps it settled afterwards.
  */
  const inView = useInView(ref, { once: true, margin: "-15% 0px" });
  const [settled, setSettled] = useState(false);

  const letters = useMemo(() => Array.from(text), [text]);
  const count = letters.length;

  useEffect(() => {
    if (still || !inView) return;
    // Long enough that the scattered state is legible as a state, not a flash.
    const id = window.setTimeout(() => setSettled(true), 900);
    return () => window.clearTimeout(id);
  }, [still, inView, count]);

  if (still) {
    return (
      <span className={className} style={{ color: resolved }}>
        {text}
      </span>
    );
  }

  return (
    <span ref={ref} className={className} aria-label={text}>
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          className="inline-block whitespace-pre"
          initial={false}
          animate={{
            // Deterministic assignment, not random: the same label renders the
            // same way on the server and on every visit, and nothing shifts
            // under a reader who scrolls back to it.
            color: settled ? resolved : SOURCE_STATES[i % SOURCE_STATES.length],
          }}
          transition={{
            duration: 0.28,
            // Settling left to right reads as a sweep resolving the line,
            // rather than the whole label changing colour at once.
            delay: settled ? i * 0.028 : 0,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  );
}
