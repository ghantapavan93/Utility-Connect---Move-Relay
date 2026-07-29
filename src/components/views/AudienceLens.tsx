"use client";

import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * One record, one gate, and whichever fields the asker is entitled to.
 *
 * Switching audience used to change a border colour. That is a UI event, and
 * the thing it stands for is a server decision — a different actor, a different
 * relationship path, a different set of fields permitted to leave. Drawing the
 * colour and not the decision meant the page asserted least privilege and
 * demonstrated a stylesheet.
 *
 * So the same canonical record sits on the left in every state. What moves is
 * the request line, the gate, and how many tokens cross it. The record never
 * changes, because it never does.
 *
 * ## What the withheld tokens do
 *
 * They stop at the boundary and stay drawn. A projection is not a deletion:
 * those fields exist, on the server, and were not sent. Fading them out would
 * illustrate the wrong mechanism — and the wrong mechanism is the one this page
 * exists to say it does not use.
 *
 * ## Denial is drawn as a success
 *
 * When the actor has no relationship, the line reaches the gate and retracts,
 * and nothing is built beyond it. It is deliberately the calmest state in the
 * component: a refusal working correctly should not look like a page that
 * broke.
 */

export type LensState =
  | { kind: "empty" }
  | { kind: "loading" }
  /** Authorized. `sent` and `held` are counted from real payloads. */
  | { kind: "granted"; audience: "concierge" | "customer" | "partner"; sent: number; held: number; via: string }
  /** Refused before any projection ran. */
  | { kind: "denied"; actor: string };

const W = 640;
const H = 200;
const RECORD_X = 34;
const GATE_X = 300;
const OUT_X = 470;

const TONE: Record<"concierge" | "customer" | "partner", Accent> = {
  concierge: "verified",
  customer: "solar",
  partner: "internet",
};

/** Rows are lanes, not data. Eight reads as "a set" without implying a count. */
const LANES = [34, 62, 90, 118, 146, 174];

export function AudienceLens({ state }: { state: LensState }) {
  const still = useStillness();
  const denied = state.kind === "denied";
  const granted = state.kind === "granted";
  const tone: Accent = denied ? "conflict" : granted ? TONE[state.audience] : "verified";

  /*
    How many lanes cross, derived from the real ratio rather than picked.

    The concierge receives everything the page has to compare against, so it
    fills; the others fill in proportion to what the server actually sent. A
    fixed number per audience would be a drawing that agrees with the copy by
    coincidence and keeps agreeing after the projection changes.
  */
  const crossing = granted
    ? Math.max(1, Math.round((state.sent / Math.max(1, state.sent + state.held)) * LANES.length))
    : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      fill="none"
      strokeLinecap="round"
      role="img"
      aria-label={
        denied
          ? "The request reaches the relationship gate and stops. No view is built."
          : granted
            ? `${state.audience} view: ${state.sent} fields crossed the server boundary, ${state.held} stayed behind it`
            : "One canonical record behind a relationship gate"
      }
    >
      {/* ---------- the canonical record, unchanged in every state ---------- */}
      <motion.rect
        x={RECORD_X}
        y={62}
        width={92}
        height={76}
        rx={10}
        stroke={accentColor("verified", 0.9)}
        strokeWidth={1.8}
        fill={accentColor("verified", 0.12)}
        initial={false}
        animate={{ opacity: 1 }}
      />
      {LANES.slice(0, 4).map((y, i) => (
        <line
          key={y}
          x1={RECORD_X + 14}
          x2={RECORD_X + 78}
          y1={78 + i * 14}
          y2={78 + i * 14}
          stroke={accentColor("verified", 0.45)}
          strokeWidth={1.2}
        />
      ))}

      {/* ---------- the request, from the asker to the gate ---------- */}
      <motion.path
        d={`M${RECORD_X + 100} 100 H${GATE_X - 12}`}
        stroke={accentColor(tone, 0.8)}
        strokeWidth={1.6}
        initial={false}
        animate={{ opacity: state.kind === "empty" ? 0.3 : 1 }}
        transition={{ duration: still ? 0 : 0.3 }}
      />

      {/* ---------- the gate ---------- */}
      <path d={`M${GATE_X} 14 V186`} stroke="rgba(255,255,255,0.28)" strokeWidth={1.4} strokeDasharray="3 5" />
      <AnimatePresence mode="wait">
        {denied && (
          /* Closed, and the request turns back. Amber: a boundary holding, not a fault. */
          <motion.g
            key="shut"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: still ? 0 : 0.3 }}
          >
            {[`M${GATE_X} 14 V92`, `M${GATE_X} 186 V108`].map((d) => (
              <motion.path
                key={d}
                d={d}
                stroke={accentColor("conflict", 1)}
                strokeWidth={3}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: still ? 0 : 0.35 }}
              />
            ))}
            <motion.path
              d={`M${GATE_X - 26} 100 l14 -9 M${GATE_X - 26} 100 l14 9`}
              stroke={accentColor("conflict", 1)}
              strokeWidth={2}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.3 }}
            />
          </motion.g>
        )}
      </AnimatePresence>

      {/* ---------- what crosses, and what does not ---------- */}
      {!denied &&
        LANES.map((y, i) => {
          const crosses = i < crossing;
          return (
            <g key={y}>
              <motion.path
                d={`M${GATE_X + 12} ${y} H${crosses ? OUT_X - 10 : GATE_X + 26}`}
                stroke={accentColor(crosses ? tone : "conflict", crosses ? 0.85 : 0.6)}
                strokeWidth={1.5}
                initial={false}
                animate={{ opacity: state.kind === "empty" ? 0.25 : 1 }}
                transition={{ duration: still ? 0 : 0.35, delay: still ? 0 : i * 0.05 }}
              />
              {/*
                Held back, and still drawn. The field exists and was not sent;
                erasing it would depict deletion, which is the mechanism this
                page exists to say it does not use.
              */}
              {!crosses && granted && (
                <motion.circle
                  cx={GATE_X + 34}
                  cy={y}
                  r={3.2}
                  stroke={accentColor("conflict", 0.95)}
                  strokeWidth={1.5}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: still ? 0 : 0.25, delay: still ? 0 : 0.2 }}
                />
              )}
            </g>
          );
        })}

      {/* ---------- the view that was built, or the space where none was ---------- */}
      <AnimatePresence mode="wait">
        {granted && (
          <motion.rect
            key={state.audience}
            x={OUT_X}
            y={62}
            width={132}
            height={76}
            rx={10}
            stroke={accentColor(tone, 0.9)}
            strokeWidth={1.8}
            fill={accentColor(tone, 0.1)}
            initial={{ opacity: 0, scale: still ? 1 : 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: still ? 0 : 0.3 }}
            style={{ transformOrigin: `${OUT_X + 66}px 100px` }}
          />
        )}
      </AnimatePresence>

      {/* Travelling request, only while a decision is in flight. */}
      {!still && state.kind === "loading" && (
        <motion.circle
          cy={100}
          r={4}
          fill={accentColor("verified", 1)}
          animate={{ cx: [RECORD_X + 100, GATE_X - 16] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </svg>
  );
}

/** The readouts beside the lens. HTML, so they wrap instead of scaling. */
export function LensReadout({ state }: { state: LensState }) {
  if (state.kind === "denied") {
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("conflict") }}>
          Relationship
        </p>
        <p className="mt-1 font-mono text-lg font-semibold" style={{ color: accentInk("conflict") }}>
          none
        </p>
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">no view was built</p>
      </div>
    );
  }

  if (state.kind !== "granted") {
    return (
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Fields sent</p>
        <p className="mt-1 font-mono text-lg font-semibold text-white/25">—</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">Fields sent</p>
      <p className="mt-1 font-mono text-lg font-semibold" style={{ color: accentInk(TONE[state.audience]) }}>
        {state.sent}
      </p>
      <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">
        {state.held} held on the server
      </p>
    </div>
  );
}
