"use client";

import { motion } from "framer-motion";

import { accentColor } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * Six failures, drawn six ways.
 *
 * The temptation with a set like this is one animation parameterised by colour,
 * which is cheaper to write and says nothing: a reviewer learns that six things
 * happened, not what any of them was. These share a vocabulary — a lane is a
 * path, a filled node is committed state, a gate is a refusal — and beyond that
 * each is shaped by the failure it represents, because a duplicate batch and a
 * cross-tenant read do not look alike in the system and should not look alike
 * here.
 *
 * Every glyph is textless. An SVG scales rather than reflows, so type inside one
 * shrinks with its container; marks stay legible at any size, and the labels
 * live in the HTML around the stage where they wrap.
 *
 * ## The four states
 *
 * `idle` is the attack described but not run. `running` is in flight. `held` is
 * the invariant surviving — and is the only state that may draw committed cyan.
 * `violated` is drawn too, in full: a set of glyphs that could only depict
 * success would make the page structurally incapable of showing the one result
 * that matters.
 */

export type GlyphState = "idle" | "running" | "held" | "violated";

const W = 260;
const H = 120;

interface P {
  state: GlyphState;
}

/** Shared timing so six different drawings still feel like one system. */
function useBeats(state: GlyphState) {
  const still = useStillness();
  const live = state === "running";
  const settled = state === "held" || state === "violated";
  const bad = state === "violated";
  const t = (d: number) => (still ? 0 : d);
  return { still, live, settled, bad, t, on: live || settled };
}

/** A node: hollow is a candidate, filled is committed. */
function Node({
  cx,
  cy,
  r = 8,
  accent,
  filled,
  delay = 0,
  still,
}: {
  cx: number;
  cy: number;
  r?: number;
  accent: Parameters<typeof accentColor>[0];
  filled: boolean;
  delay?: number;
  still: boolean;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} stroke={accentColor(accent, 0.9)} strokeWidth={1.8} />
      {filled && (
        <motion.circle
          cx={cx}
          cy={cy}
          r={r - 4}
          fill={accentColor(accent, 1)}
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : delay }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
      )}
    </>
  );
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" fill="none" strokeLinecap="round" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ *
 * 1 — the same batch delivered twice, collapsing to one fingerprint.  *
 * ------------------------------------------------------------------ */
function DuplicateCsv({ state }: P) {
  const { still, settled, bad, on } = useBeats(state);
  /* Held: the second layer folds onto the first. Violated: it stays separate
     and a second record exists — the duplicate this scenario exists to deny. */
  const collapsed = settled && !bad;

  return (
    <Frame label="Two identical uploads collapsing into one batch">
      {[0, 1].map((i) => (
        <motion.rect
          key={i}
          x={22 + i * 10}
          y={30 + i * 10}
          width={46}
          height={56}
          rx={5}
          stroke={accentColor(i === 1 && bad ? "failed" : "conflict", i === 1 ? 0.75 : 0.5)}
          strokeWidth={1.5}
          animate={collapsed && i === 1 ? { x: 22, y: 30, opacity: 0.35 } : { opacity: 1 }}
          transition={{ duration: still ? 0 : 0.6, delay: still ? 0 : 0.5 }}
        />
      ))}
      {[0, 1].map((i) => (
        <motion.path
          key={i}
          d={`M${76 + i * 10} ${58 + i * 10} C 130 ${58 + i * 10}, 150 60, 186 60`}
          stroke={accentColor(i === 1 && bad ? "failed" : "verified", i === 1 ? 0.45 : 0.8)}
          strokeWidth={1.4}
          strokeDasharray={i === 1 && collapsed ? "4 5" : undefined}
          animate={{ opacity: on ? 1 : 0.35 }}
          transition={{ duration: still ? 0 : 0.4 }}
        />
      ))}
      <Node cx={196} cy={60} accent={bad ? "failed" : "verified"} filled={settled} still={still} delay={0.7} />
      {/* Violated means a second batch persisted. It is drawn, not hidden. */}
      {bad && <Node cx={196} cy={94} accent="failed" filled still={still} delay={0.8} />}
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — two deliveries, one business action.                            *
 * ------------------------------------------------------------------ */
function WebhookTwice({ state }: P) {
  const { still, live, settled, bad, on } = useBeats(state);
  const lane = `M20 60 H108`;

  return (
    <Frame label="One event delivered twice, acted on once">
      <motion.path d={lane} stroke={accentColor("conflict", 0.75)} strokeWidth={1.5} animate={{ opacity: on ? 1 : 0.4 }} />
      {/* Two deliveries. Both reach the consumer — that is the transport's right. */}
      {!still &&
        (live || settled) &&
        [0, 0.5].map((d) => (
          <motion.circle
            key={d}
            cy={60}
            r={3.4}
            fill={accentColor("conflict", 1)}
            animate={{ cx: [20, 104], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: d, times: [0, 0.15, 0.8, 1] }}
          />
        ))}
      <Node cx={118} cy={60} accent="verified" filled={settled} still={still} />

      {/* Acknowledged — both get this. */}
      <motion.path d="M132 44 H210" stroke={accentColor("verified", 0.55)} strokeWidth={1.3} animate={{ opacity: on ? 1 : 0.3 }} />
      {/* The business action — only one may pass. */}
      <motion.path
        d="M132 78 H210"
        stroke={accentColor(bad ? "failed" : "verified", 0.85)}
        strokeWidth={1.6}
        animate={{ opacity: on ? 1 : 0.3 }}
      />
      {/*
        The deflection: the second delivery is turned away from the business
        lane, not from the door. Drawing it blocked at the consumer would depict
        a dropped event, which is a different and worse behaviour.
      */}
      {settled && !bad && (
        <motion.path
          d="M150 78 l-9 -9 M150 78 l-9 9"
          stroke={accentColor("conflict", 0.95)}
          strokeWidth={2}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.4 }}
        />
      )}
      <Node cx={220} cy={44} r={6} accent="verified" filled={settled} still={still} />
      <Node cx={220} cy={78} r={6} accent={bad ? "failed" : "verified"} filled={settled} still={still} delay={0.2} />
      {bad && <Node cx={220} cy={100} r={6} accent="failed" filled still={still} delay={0.4} />}
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — a crash after a checkpoint, resuming at the next safe step.     *
 * ------------------------------------------------------------------ */
function WorkerCrash({ state }: P) {
  const { still, settled, bad, on } = useBeats(state);
  const xs = [40, 110, 180, 230];

  return (
    <Frame label="A workflow crashing after a checkpoint and resuming">
      <motion.path d={`M${xs[0]} 60 H${xs[1]}`} stroke={accentColor("verified", 0.8)} strokeWidth={1.6} animate={{ opacity: on ? 1 : 0.35 }} />
      {/* The fracture, between step one and step two. */}
      {(settled || state === "running") && (
        <>
          <motion.path
            d={`M${xs[1]! + 12} 48 L${xs[1]! + 20} 72`}
            stroke={accentColor("failed", 0.95)}
            strokeWidth={2.2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: still ? 0 : 0.25 }}
          />
          <motion.path
            d={`M${xs[1]! + 30} 48 L${xs[1]! + 22} 72`}
            stroke={accentColor("failed", 0.95)}
            strokeWidth={2.2}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: still ? 0 : 0.25 }}
          />
        </>
      )}
      {/* Resumption picks up after the fracture — it does not run step one again. */}
      <motion.path
        d={`M${xs[1]! + 42} 60 H${xs[3]}`}
        stroke={accentColor(bad ? "failed" : "recovered", 0.85)}
        strokeWidth={1.6}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: settled ? 1 : 0 }}
        transition={{ duration: still ? 0 : 0.6, delay: still ? 0 : 0.4 }}
      />
      {/* Step one stays committed throughout. That is the invariant. */}
      <Node cx={xs[0]!} cy={60} accent="verified" filled={on} still={still} />
      <Node cx={xs[2]!} cy={60} accent={bad ? "failed" : "recovered"} filled={settled} still={still} delay={0.6} />
      {/* Violated would mean step one ran twice — a second commit on the same node. */}
      {bad && <Node cx={xs[0]!} cy={92} r={6} accent="failed" filled still={still} delay={0.7} />}
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * 4 — a request from outside the relationship graph.                  *
 * ------------------------------------------------------------------ */
function CrossTenant({ state }: P) {
  const { still, settled, bad, on } = useBeats(state);
  const BOUNDARY = 150;

  return (
    <Frame label="A cross-tenant read stopped at the boundary">
      {/* The owner's path, inside the graph, unaffected. */}
      <motion.path d={`M20 36 H${BOUNDARY - 8}`} stroke={accentColor("verified", 0.75)} strokeWidth={1.5} animate={{ opacity: on ? 1 : 0.35 }} />
      <motion.path
        d={`M${BOUNDARY + 8} 36 H236`}
        stroke={accentColor("verified", 0.75)}
        strokeWidth={1.5}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: settled ? 1 : 0 }}
        transition={{ duration: still ? 0 : 0.5 }}
      />
      {/* The rival's path, which must not cross. */}
      <motion.path
        d={`M20 88 H${bad ? 236 : BOUNDARY - 14}`}
        stroke={accentColor(bad ? "failed" : "conflict", 0.85)}
        strokeWidth={1.6}
        animate={{ opacity: on ? 1 : 0.35 }}
      />
      {/* The boundary and its lock. */}
      <path d={`M${BOUNDARY} 10 V110`} stroke="rgba(255,255,255,0.3)" strokeWidth={1.4} strokeDasharray="3 5" />
      {settled && !bad && (
        <motion.g initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: still ? 0 : 0.3 }} style={{ transformOrigin: `${BOUNDARY}px 88px` }}>
          <rect x={BOUNDARY - 9} y={82} width={18} height={14} rx={3} stroke={accentColor("conflict", 1)} strokeWidth={1.8} />
          <path d={`M${BOUNDARY - 4} 82 V77 a4 4 0 0 1 8 0 V82`} stroke={accentColor("conflict", 1)} strokeWidth={1.8} />
        </motion.g>
      )}
      <Node cx={244} cy={36} r={6} accent="verified" filled={settled} still={still} delay={0.4} />
      {bad && <Node cx={244} cy={88} r={6} accent="failed" filled still={still} delay={0.5} />}
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * 5 — two writers, one record, one winner.                            *
 * ------------------------------------------------------------------ */
function StaleWrite({ state }: P) {
  const { still, settled, bad, on } = useBeats(state);

  return (
    <Frame label="Two concurrent writes against one record">
      <motion.path d="M22 32 C 90 32, 110 54, 150 58" stroke={accentColor("verified", 0.85)} strokeWidth={1.6} animate={{ opacity: on ? 1 : 0.35 }} />
      <motion.path
        d="M22 96 C 90 96, 110 70, 150 64"
        stroke={accentColor(bad ? "failed" : "conflict", 0.85)}
        strokeWidth={1.6}
        strokeDasharray={settled && !bad ? "4 5" : undefined}
        animate={{ opacity: on ? 1 : 0.35 }}
      />
      {/* The record. One version, and the first write owns it. */}
      <Node cx={166} cy={60} r={11} accent={bad ? "failed" : "verified"} filled={settled} still={still} delay={0.3} />
      {/*
        The stale write turns aside and becomes a conflict a person can see —
        it does not vanish. A rejected write that left no trace would be a
        silent loss, which is the same harm as the overwrite.
      */}
      {settled && !bad && (
        <motion.g initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: still ? 0 : 0.35, delay: still ? 0 : 0.5 }}>
          <path d="M186 92 H232" stroke={accentColor("conflict", 0.9)} strokeWidth={1.5} strokeDasharray="4 4" />
          <Node cx={240} cy={92} r={6} accent="conflict" filled still={still} />
        </motion.g>
      )}
      {bad && <Node cx={240} cy={60} r={6} accent="failed" filled still={still} delay={0.6} />}
    </Frame>
  );
}

/* ------------------------------------------------------------------ *
 * 6 — fields that no longer match the contract.                       *
 * ------------------------------------------------------------------ */
function SchemaDrift({ state }: P) {
  const { still, settled, bad, on } = useBeats(state);
  const GATE = 138;
  /* Rows two and four are the drifted ones — a renamed field and a dropped one. */
  const rows = [30, 50, 70, 90];
  const drifted = [1, 3];

  return (
    <Frame label="A drifted payload separated at the contract and quarantined">
      <path d={`M${GATE} 12 V108`} stroke="rgba(255,255,255,0.3)" strokeWidth={1.4} strokeDasharray="3 5" />
      {rows.map((y, i) => {
        const bends = drifted.includes(i) && settled && !bad;
        return (
          <motion.path
            key={y}
            d={bends ? `M24 ${y} H${GATE - 16} C ${GATE - 4} ${y}, ${GATE - 4} 100, ${GATE + 4} 100` : `M24 ${y} H${bad || !drifted.includes(i) ? 232 : GATE - 16}`}
            stroke={accentColor(drifted.includes(i) ? (bad ? "failed" : "conflict") : "verified", 0.8)}
            strokeWidth={1.5}
            animate={{ opacity: on ? 1 : 0.35 }}
            transition={{ duration: still ? 0 : 0.4 }}
          />
        );
      })}
      {/* Quarantine: held, with reasons — not dropped, not coerced through. */}
      {settled && !bad && (
        <motion.rect
          x={GATE + 6}
          y={86}
          width={54}
          height={28}
          rx={5}
          stroke={accentColor("conflict", 1)}
          strokeWidth={1.8}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: still ? 0 : 0.35, delay: still ? 0 : 0.5 }}
          style={{ transformOrigin: `${GATE + 33}px 100px` }}
        />
      )}
      {[0, 2].map((i) => (
        <Node key={i} cx={242} cy={rows[i]!} r={5} accent="verified" filled={settled} still={still} delay={0.3} />
      ))}
    </Frame>
  );
}

const STAGE_GLYPHS: Record<string, (p: P) => React.ReactElement> = {
  duplicate_csv: DuplicateCsv,
  webhook_twice: WebhookTwice,
  worker_crash: WorkerCrash,
  cross_tenant: CrossTenant,
  stale_write: StaleWrite,
  schema_drift: SchemaDrift,
};

export function StageGlyph({ scenario, state }: { scenario: string; state: GlyphState }) {
  const G = STAGE_GLYPHS[scenario];
  return G ? <G state={state} /> : null;
}

/**
 * The motif on each instrument.
 *
 * A miniature of the stage drawing would be unreadable at 24px, so each tab
 * carries three marks that are distinct at a glance instead — enough to make
 * the six controls tell each other apart without pretending to explain
 * themselves.
 */
const MOTIFS: Record<string, React.ReactElement> = {
  duplicate_csv: (
    <>
      <rect x={4} y={5} width={10} height={13} rx={2} />
      <rect x={9} y={8} width={10} height={13} rx={2} />
    </>
  ),
  webhook_twice: (
    <>
      <path d="M5 7 l6 5 -6 5" />
      <path d="M13 7 l6 5 -6 5" />
    </>
  ),
  worker_crash: (
    <>
      <path d="M3 12 H9" />
      <path d="M11 6 L14 18" />
      <path d="M16 12 H21" />
    </>
  ),
  cross_tenant: (
    <>
      <path d="M12 3 V21" strokeDasharray="2 3" />
      <path d="M3 12 H8" />
      <rect x={15} y={9} width={7} height={6} rx={1.5} />
    </>
  ),
  stale_write: (
    <>
      <path d="M3 6 L11 11" />
      <path d="M3 18 L11 13" />
      <circle cx={16} cy={12} r={4} />
    </>
  ),
  schema_drift: (
    <>
      <path d="M3 7 H15" />
      <path d="M3 12 H11" />
      <path d="M3 17 H18" />
      <path d="M18 5 L21 8" />
    </>
  ),
};

export function TabMotif({ scenario, accent }: { scenario: string; accent: Parameters<typeof accentColor>[0] }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke={accentColor(accent, 1)} strokeWidth={1.6} strokeLinecap="round" aria-hidden>
      {MOTIFS[scenario]}
    </svg>
  );
}
