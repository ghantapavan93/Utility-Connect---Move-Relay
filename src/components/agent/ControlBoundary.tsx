"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { stageLabel } from "@/lib/agent/narrative";
import type { AgentRun } from "@/lib/agent/case-agent";

/**
 * The authority boundary, drawn for this run rather than in general.
 *
 * The old page had a static diagram of the tiers; it was true before the
 * button was pressed and identically true after, which is how a reader learns
 * to stop looking at it. This one is a function of the run: the reads that
 * actually completed flow into the decision node, the proposal travels down
 * and *stops at the line*, and the tool the agent reached for and was refused
 * hits the same line and is severed. No run, no drawing — the empty state says
 * so instead of showing a diagram of nothing.
 *
 * ## Geometry
 *
 * Vertical by construction. Evidence at the top, the decision in the middle,
 * the boundary as a literal horizontal line, and the executor's side below it.
 * That reads correctly at 320px without a horizontal squeeze, because the
 * narrow dimension was never carrying the meaning.
 *
 * The lines that animate are solid and animate `pathLength`; the boundary
 * itself is dashed and deliberately static — Framer draws `pathLength` by
 * writing `stroke-dasharray`, which would clobber the dash pattern, a clash
 * this repository has already been bitten by once.
 */

const W = 360;
const NODE_X = 44;
const LABEL_X = 60;
const TOP = 28;
const ROW = 44;

export function ControlBoundary({ run }: { run: AgentRun | null }) {
  const still = useStillness();

  if (!run) {
    return (
      <p
        className="rounded-lg border border-dashed p-3 text-[11px]"
        style={{ borderColor: "rgba(255,255,255,0.14)", color: "var(--color-text-lo)" }}
      >
        The boundary is drawn from a real run. Investigate the case and the paths appear as the
        results return.
      </p>
    );
  }

  const reads = run.steps.filter((s) => s.authority === "read_only");
  const refused = run.refusal;
  const proposal = run.proposal;
  /*
    The one crossing this diagram is allowed to show. A proposal is "held" only
    while the run awaits its decision; once a named person approves, it crossed
    the line legitimately, and a drawing that still showed it stopped would be
    describing a state the database has already left. Rejected runs keep the
    proposal above the line, which is exactly where a rejection leaves it.
  */
  const crossed = run.state === "completed" && proposal !== null;

  const decisionY = TOP + reads.length * ROW + 34;
  const boundaryY = decisionY + 64;
  const executorY = boundaryY + 46;
  const height = executorY + 34;

  const draw = (delay: number) =>
    still
      ? { initial: { pathLength: 1 }, animate: { pathLength: 1 }, transition: { duration: 0 } }
      : {
          initial: { pathLength: 0 },
          animate: { pathLength: 1 },
          transition: { duration: 0.5, delay, ease: "easeOut" as const },
        };

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      role="img"
      aria-label={`Authority boundary for this run: ${reads.length} reads completed, ${proposal ? (crossed ? "one action approved by a named person and executed" : "one action proposed and held at the boundary") : "no action proposed"}${refused ? `, ${stageLabel(refused.tool)} refused` : ""}`}
      className="w-full"
      style={{ maxWidth: 420 }}
    >
      {/* ── Evidence: each completed read, flowing toward the decision ── */}
      {reads.map((s, i) => {
        const y = TOP + i * ROW;
        const ok = s.outcome === "ok";
        const color = ok ? accentInk("internet") : accentInk("failed");
        return (
          <g key={`${s.tool}-${i}`}>
            <circle cx={NODE_X} cy={y} r={5} fill={color} />
            <text x={LABEL_X} y={y - 2} fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.88)">
              {stageLabel(s.tool)}
            </text>
            <text x={LABEL_X} y={y + 11} fontSize={8.5} fontFamily="monospace" fill="rgba(255,255,255,0.4)">
              {s.tool} · {ok ? "returned" : s.outcome}
            </text>
            {/* The result travelling to the decision node — only if it returned. */}
            {ok && (
              <motion.path
                d={`M ${NODE_X} ${y + 6} C ${NODE_X} ${y + 24}, ${NODE_X} ${decisionY - 24}, ${NODE_X} ${decisionY - 12}`}
                fill="none"
                stroke={accentColor("internet", 0.55)}
                strokeWidth={1.6}
                {...draw(0.1 + i * 0.12)}
              />
            )}
          </g>
        );
      })}

      {/* ── The decision node ── */}
      <circle cx={NODE_X} cy={decisionY} r={7} fill="none" stroke={accentInk("security")} strokeWidth={2} />
      <text x={LABEL_X} y={decisionY - 2} fontSize={11.5} fontWeight={700} fill="rgba(255,255,255,0.92)">
        Decision package prepared
      </text>
      <text x={LABEL_X} y={decisionY + 11} fontSize={8.5} fill="rgba(255,255,255,0.45)">
        evidence assembled · nothing written
      </text>

      {/* ── The proposal, travelling down and stopping AT the line ── */}
      {proposal && (
        <>
          <motion.path
            d={`M ${NODE_X} ${decisionY + 8} L ${NODE_X} ${boundaryY - 3}`}
            fill="none"
            stroke={accentInk("security")}
            strokeWidth={2}
            {...draw(reads.length * 0.12 + 0.3)}
          />
          <circle cx={NODE_X} cy={boundaryY - 6} r={4} fill={accentInk(crossed ? "verified" : "security")} />
          <text x={LABEL_X} y={boundaryY - 10} fontSize={10.5} fontWeight={600} fill={accentInk(crossed ? "verified" : "security")}>
            {stageLabel(proposal.tool)} — {crossed ? "crossed with named approval" : "held here"}
          </text>
          {/* The crossing itself: drawn only after the backend confirmed it. */}
          {crossed && (
            <motion.path
              d={`M ${NODE_X} ${boundaryY + 3} L ${NODE_X} ${executorY - 8}`}
              fill="none"
              stroke={accentInk("verified")}
              strokeWidth={2}
              {...draw(0.2)}
            />
          )}
        </>
      )}

      {/* ── The refused branch: reaches the line and is severed ── */}
      {refused && (
        <>
          <motion.path
            d={`M ${W - 70} ${decisionY} L ${W - 70} ${boundaryY - 8}`}
            fill="none"
            stroke={accentInk("failed")}
            strokeWidth={1.8}
            {...draw(reads.length * 0.12 + 0.45)}
          />
          {/* The severance mark, at the exact point policy stopped it. */}
          <path
            d={`M ${W - 76} ${boundaryY - 14} L ${W - 64} ${boundaryY - 2} M ${W - 64} ${boundaryY - 14} L ${W - 76} ${boundaryY - 2}`}
            stroke={accentInk("failed")}
            strokeWidth={2}
            fill="none"
          />
          <text x={W - 70} y={decisionY - 12} fontSize={10} fontWeight={600} fill={accentInk("failed")} textAnchor="middle">
            refused
          </text>
        </>
      )}

      {/* ── The boundary itself. Dashed, static, labelled. ── */}
      <line x1={16} y1={boundaryY} x2={W - 16} y2={boundaryY} stroke={accentColor("security", 0.7)} strokeWidth={1.5} strokeDasharray="6 4" />
      <text x={16} y={boundaryY + 14} fontSize={9} fontWeight={700} letterSpacing="0.14em" fill={accentInk("security")}>
        AUTHORITY BOUNDARY — CROSSED ONLY BY A NAMED PERSON
      </text>

      {/* ── Below the line: the executor's territory ── */}
      <circle cx={NODE_X} cy={executorY} r={5} fill={crossed ? accentInk("verified") : "none"} stroke={accentInk("verified")} strokeWidth={1.8} />
      <text x={LABEL_X} y={executorY - 2} fontSize={11} fontWeight={600} fill="rgba(255,255,255,0.85)">
        {crossed
          ? "Executed under named approval"
          : proposal
            ? "Awaiting an authorized decision"
            : "No consequential action was proposed"}
      </text>
      <text x={LABEL_X} y={executorY + 11} fontSize={8.5} fill="rgba(255,255,255,0.45)">
        {proposal
          ? "the same service the console's own button calls"
          : "nothing below the line was asked for"}
      </text>
    </svg>
  );
}
