"use client";

import { motion } from "framer-motion";

import { accentColor } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * The wire between us and the provider, and the one operation travelling it.
 *
 * This is the page's protagonist. One capsule leaves our side, the provider
 * creates an order, and the reply dies somewhere in the return lane — after
 * which the two systems hold different truths and the whole incident is about
 * closing that gap without guessing.
 *
 * ## Two lanes, not one
 *
 * A single line cannot express this failure. The request arrived and the reply
 * did not, so the outbound lane must survive while the return lane breaks —
 * drawn on one line, the break would read as "the request never landed", which
 * is the wrong diagnosis and precisely the guess that creates a second order.
 *
 * ## Why it carries no text
 *
 * Every label lives in the HTML around it. An SVG scales rather than reflows,
 * so type inside one shrinks with its container; the same fault rendered the
 * reliability hero at 2.8px on a phone. Marks are legible at any size, so this
 * holds only marks and the readouts sit in a grid that wraps.
 */

export type CapsulePhase =
  /** Nothing has run. */
  | "idle"
  /** The submit call is in flight. */
  | "submitting"
  /** Server returned: our state UNKNOWN, provider holds an order. */
  | "unknown"
  /** The retry call is in flight. */
  | "retrying"
  /** Server returned: retry refused, provider never contacted. */
  | "blocked"
  /** The reconcile call is in flight. */
  | "reconciling"
  /** Server returned: the existing order was found and adopted. */
  | "confirmed";

const W = 600;
const OUT_Y = 30;
const BACK_Y = 62;
const L = 58;
const R = 542;
/** Where the reply dies. The return lane travels right to left. */
const BREAK_R = 330;
const BREAK_L = 268;
/** Where a blind retry would be stopped. */
const GATE_X = 250;

const OUT = `M${L} ${OUT_Y} H${R}`;

/** Phases in which the server has confirmed the provider holds an order. */
const PROVIDER_HAS_ORDER: CapsulePhase[] = ["unknown", "retrying", "blocked", "reconciling", "confirmed"];

export function HandoffCapsule({ phase }: { phase: CapsulePhase }) {
  const still = useStillness();

  const started = phase !== "idle";
  const providerLit = PROVIDER_HAS_ORDER.includes(phase);
  const replyLost = providerLit && phase !== "confirmed";
  const whole = phase === "confirmed";
  const gateShut = phase === "blocked" || phase === "retrying";

  /*
    Our side is amber for exactly as long as we do not know. It is not red —
    nothing failed — and it is not cyan until the server says reconciliation
    adopted the order. Colouring it cyan on `reconciling` would be the page
    claiming a result while the request was still in flight.
  */
  const ourAccent = whole ? "verified" : replyLost ? "conflict" : "verified";

  return (
    <svg
      viewBox={`0 0 ${W} 92`}
      className="h-24 w-full"
      fill="none"
      strokeLinecap="round"
      role="img"
      aria-label="The link between Move Relay and the provider, and the operation travelling it"
    >
      {/* ---- outbound lane: the request. It always arrives. ---- */}
      <motion.path
        d={OUT}
        stroke={accentColor("verified", started ? 0.7 : 0.2)}
        strokeWidth={1.6}
        animate={{ opacity: 1 }}
        transition={{ duration: still ? 0 : 0.4 }}
      />

      {/* ---- return lane: the reply. This is what breaks. ---- */}
      <motion.path
        d={whole ? `M${R} ${BACK_Y} H${L}` : `M${R} ${BACK_Y} H${BREAK_R}`}
        stroke={accentColor(whole ? "verified" : replyLost ? "failed" : "verified", started ? 0.75 : 0.18)}
        strokeWidth={1.6}
        animate={{ opacity: 1 }}
        transition={{ duration: still ? 0 : 0.4 }}
      />
      {!whole && (
        <motion.path
          d={`M${BREAK_L} ${BACK_Y} H${L}`}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={1.4}
          strokeDasharray="3 6"
          animate={{ opacity: 1 }}
        />
      )}

      {/* The severance itself: two marks pulling apart, not a gap. */}
      {replyLost && (
        <>
          {[BREAK_L + 6, BREAK_R - 6].map((x, i) => (
            <motion.path
              key={x}
              d={`M${x} ${BACK_Y - 7} L${x + (i ? -5 : 5)} ${BACK_Y + 7}`}
              stroke={accentColor("failed", 0.95)}
              strokeWidth={2.2}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.15 }}
              style={{ transformOrigin: `${x}px ${BACK_Y}px` }}
            />
          ))}
        </>
      )}

      {/* ---- the gate that refuses a blind retry ---- */}
      {gateShut && (
        <>
          {[
            { d: `M${GATE_X} 6 V${OUT_Y - 4}` },
            { d: `M${GATE_X} 54 V${OUT_Y + 4}` },
          ].map((leaf) => (
            <motion.path
              key={leaf.d}
              d={leaf.d}
              stroke={accentColor("conflict", 1)}
              strokeWidth={3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: still ? 0 : 0.35, ease: "easeOut" }}
            />
          ))}
        </>
      )}

      {/* ---- endpoints ---- */}
      <circle cx={40} cy={46} r={9} stroke={accentColor(ourAccent, started ? 0.95 : 0.3)} strokeWidth={2} />
      <circle
        cx={560}
        cy={46}
        r={9}
        stroke={accentColor(providerLit ? "verified" : "verified", providerLit ? 0.95 : 0.3)}
        strokeWidth={2}
      />
      {/* Filled means the order is real on that side. The provider's fills at
          submit; ours only when reconciliation has adopted it. */}
      {providerLit && <circle cx={560} cy={46} r={4} fill={accentColor("verified", 1)} />}
      {whole && <circle cx={40} cy={46} r={4} fill={accentColor("verified", 1)} />}

      {/* ---- the capsule in flight ---- */}
      {!still && phase === "submitting" && (
        <motion.circle
          cy={OUT_Y}
          r={4.5}
          fill={accentColor("verified", 1)}
          animate={{ cx: [L, R] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {/* A retry that gets as far as the gate and no further. */}
      {!still && phase === "retrying" && (
        <motion.circle
          cy={OUT_Y}
          r={4.5}
          fill={accentColor("conflict", 1)}
          animate={{ cx: [L, GATE_X - 10], opacity: [0, 1, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
        />
      )}
      {/* The reconciliation query — a question, so it goes out and comes back. */}
      {!still && phase === "reconciling" && (
        <motion.circle
          r={4.5}
          fill={accentColor("security", 1)}
          animate={{ cx: [L, R, R, L], cy: [OUT_Y, OUT_Y, BACK_Y, BACK_Y] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.55, 1] }}
        />
      )}
      {/* Settled traffic, once the loop is closed. */}
      {!still && whole && (
        <motion.circle
          cy={OUT_Y}
          r={4}
          fill={accentColor("verified", 1)}
          animate={{ cx: [L, R], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "linear", times: [0, 0.1, 0.9, 1] }}
        />
      )}
    </svg>
  );
}
