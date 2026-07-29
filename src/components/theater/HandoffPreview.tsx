"use client";

import { motion } from "framer-motion";

import { accentColor } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * A handoff, drawn at the size of a line of text, inside the button that
 * attacks it.
 *
 * The convention this replaces is a call to action that glows or lifts to say
 * *press me*. That says nothing except that it is a button, which the reader
 * already knew. This one shows the thing it is about to do: a committed signal
 * crosses the strip, breaks short of the far side, and stays broken. The break
 * is the page's subject rendered at 12px.
 *
 * It is not a loop. The strip reflects the page's real state — it stays broken
 * until scenarios actually run and hold, and only then rejoins in committed
 * cyan. A preview that resolved on its own would be animation pretending to be
 * a result, on a page whose entire argument is the difference between the two.
 */

export type HandoffState =
  /** Nothing has run. The break is unresolved, as it would be in production. */
  | "idle"
  /** Attacks in flight. */
  | "running"
  /** Every scenario that ran returned its invariant intact. */
  | "held"
  /** At least one invariant did not hold. */
  | "breached";

const W = 168;
const MID = 12;
/** Where the signal stops. Short of the far side, deliberately. */
const BREAK_L = 96;
const BREAK_R = 116;

export function HandoffPreview({ state }: { state: HandoffState }) {
  const still = useStillness();
  const joined = state === "held";

  const lead = `M4 ${MID} H${joined ? W - 4 : BREAK_L}`;
  const tail = `M${BREAK_R} ${MID} H${W - 4}`;

  const leadAccent = state === "breached" ? "failed" : state === "running" ? "conflict" : "verified";

  return (
    <svg
      viewBox={`0 0 ${W} ${MID * 2}`}
      className="h-3 w-[168px] shrink-0"
      fill="none"
      strokeLinecap="round"
      aria-hidden
    >
      {/* The committed leg. It reaches the far side only once something proved it could. */}
      <motion.path
        d={lead}
        stroke={accentColor(leadAccent, 0.95)}
        strokeWidth={2}
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: still ? 0 : 0.4 }}
      />

      {/*
        The break. Two ticks pulling apart rather than a gap in a line: an
        absence reads as something not yet drawn, and this is something that
        was severed.
      */}
      {!joined && (
        <>
          <motion.path
            d={`M${BREAK_L + 2} ${MID - 5} L${BREAK_L + 6} ${MID + 5}`}
            stroke={accentColor("failed", 0.95)}
            strokeWidth={2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.5 }}
          />
          <motion.path
            d={`M${BREAK_R - 6} ${MID - 5} L${BREAK_R - 2} ${MID + 5}`}
            stroke={accentColor("failed", 0.95)}
            strokeWidth={2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.5 }}
          />
          {/* Beyond the break: never reached, so never committed. */}
          <motion.path
            d={tail}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={1.6}
            strokeDasharray="3 5"
            initial={false}
            animate={{ opacity: 1 }}
          />
        </>
      )}

      {/*
        The travelling signal, animated on `x` rather than `offsetPath`.
        `offsetPath` would need the dot to follow the whole strip including the
        severed half, which is precisely the journey that does not happen.
      */}
      {!still && state !== "idle" && (
        <motion.circle
          cy={MID}
          r={2.6}
          fill={accentColor(joined ? "verified" : state === "breached" ? "failed" : "conflict", 1)}
          animate={{ cx: joined ? [4, W - 4] : [4, BREAK_L], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear", times: [0, 0.1, 0.85, 1] }}
        />
      )}
    </svg>
  );
}
