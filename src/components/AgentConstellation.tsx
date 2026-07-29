"use client";

import { useState } from "react";

import { useStillness } from "@/lib/use-stillness";

/**
 * The agent, drawn as the thing it actually is.
 *
 * The page used to explain the authority boundary in prose and a list. Both
 * were accurate and neither showed the shape of the idea: that there is a
 * *membrane* between the agent and the domain, that some tools pass through it
 * freely, one passes only through a human, and several do not pass at all.
 *
 * So the membrane is the diagram. It is the vertical line down the middle, and
 * every visual decision is anchored to it:
 *
 *   read-only        the line crosses, solid, in verified cyan
 *   requires approval the line reaches a locked gate ON the membrane and stops
 *   forbidden        the line is severed at the membrane and never reaches the tool
 *
 * Nothing here is decoration. The line states are the ones already defined in
 * the design system — solid is verified, dashed is pending, a locked node is
 * human approval required, rejoined is recovered — and they mean the same thing
 * here as they mean in the hero, the audit timeline and the conflict view. A
 * reviewer who has understood one of those screens has already understood this
 * one.
 *
 * When a run is supplied the diagram becomes live: each tool the agent actually
 * reached for lights along its own path, in sequence, and the severed line is
 * the one carrying the refusal. Approving the proposal turns the gate green.
 *
 * Deliberately not: glow, gradient fills, particles, or a palette that says
 * "AI". Those would make this look like every other agent diagram, and the
 * whole claim of the page is that this one is not like the others.
 */

export interface ConstellationTool {
  name: string;
  authority: string;
  description: string;
  refusal: string | null;
}

export interface ConstellationStep {
  seq: number;
  tool: string;
  authority: string;
  outcome: string;
}

const W = 940;
const H = 560;
const AGENT_X = 132;
const MEMBRANE_X = 452;
const TOOL_X = 610;

/** Where each authority band sits vertically, and what it means. */
const BANDS = {
  read_only: { top: 74, label: "Crosses freely", colour: "var(--color-state-verified)" },
  requires_approval: { top: 286, label: "Crosses through a person", colour: "var(--color-state-conflict)" },
  forbidden: { top: 372, label: "Does not cross", colour: "var(--color-state-locked)" },
} as const;

const ROW_HEIGHT = 34;

/**
 * A path from the agent to a tool row.
 *
 * A cubic with both control points pushed horizontally keeps every line
 * leaving the core at the same angle and arriving flat — so the eye reads the
 * *bundle* first and the individual strand second, which is the right order for
 * a diagram about a boundary rather than about any one tool.
 */
function pathTo(y: number, endX: number): string {
  const midX = (AGENT_X + endX) / 2;
  return `M ${AGENT_X} ${H / 2} C ${midX} ${H / 2}, ${midX} ${y}, ${endX} ${y}`;
}

export function AgentConstellation({
  tools,
  steps = [],
  proposalTool = null,
  approved = false,
}: {
  tools: ConstellationTool[];
  steps?: ConstellationStep[];
  proposalTool?: string | null;
  approved?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const still = useStillness();

  const grouped = (["read_only", "requires_approval", "forbidden"] as const).map((authority) => ({
    authority,
    band: BANDS[authority],
    rows: tools.filter((t) => t.authority === authority),
  }));

  /** Vertical position of each tool, computed once so paths and labels agree. */
  const positions = new Map<string, { y: number; authority: keyof typeof BANDS }>();
  for (const group of grouped) {
    group.rows.forEach((tool, i) => {
      positions.set(tool.name, {
        y: group.band.top + i * ROW_HEIGHT,
        authority: group.authority,
      });
    });
  }

  const stepFor = (name: string) => steps.find((s) => s.tool === name);
  const active = hovered ? tools.find((t) => t.name === hovered) ?? null : null;

  return (
    <figure className="mt-8">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label="The agent's authority boundary. Five read-only tools cross it freely, one crosses only through a human gate, and five are severed at the boundary and never reach the agent."
        >
          {/*
            The membrane. Drawn before everything so the lines sit on top of it
            — a boundary you can see through is a boundary, whereas one drawn
            over the top would read as a wall.
          */}
          <line
            x1={MEMBRANE_X}
            y1={28}
            x2={MEMBRANE_X}
            y2={H - 28}
            stroke="var(--color-ground-3)"
            strokeWidth={2}
          />
          <text
            x={MEMBRANE_X}
            y={18}
            textAnchor="middle"
            className="text-[11px] font-bold uppercase"
            style={{ fill: "var(--color-text-lo)", letterSpacing: "0.18em" }}
          >
            Authority boundary
          </text>

          {/* ── The paths ─────────────────────────────────────────── */}
          {tools.map((tool) => {
            const position = positions.get(tool.name);
            if (!position) return null;

            const step = stepFor(tool.name);
            const ran = step?.outcome === "ok";
            const refused = step?.outcome === "refused";
            const dim = hovered !== null && hovered !== tool.name;

            if (position.authority === "forbidden") {
              /*
                Severed at the membrane. The stub on the far side is drawn in
                muted grey and never joins — the gap *is* the information, so it
                has to be visible rather than implied by colour alone.
              */
              const severedAt = MEMBRANE_X - 26;
              return (
                <g key={tool.name} opacity={dim ? 0.25 : 1} style={{ transition: "opacity 160ms ease-out" }}>
                  <path
                    d={pathTo(position.y, severedAt)}
                    fill="none"
                    stroke={refused ? "var(--color-state-locked)" : "var(--color-ground-3)"}
                    strokeWidth={refused ? 2.4 : 1.4}
                  />
                  {/* The break mark, in the locked colour: this is a boundary
                      holding, not a system failing. Failure red would be a lie. */}
                  <line
                    x1={MEMBRANE_X - 12}
                    y1={position.y - 9}
                    x2={MEMBRANE_X + 12}
                    y2={position.y + 9}
                    stroke={refused ? "var(--color-state-locked)" : "var(--color-ground-3)"}
                    strokeWidth={refused ? 2.4 : 1.4}
                  />
                  <line
                    x1={MEMBRANE_X - 12}
                    y1={position.y + 9}
                    x2={MEMBRANE_X + 12}
                    y2={position.y - 9}
                    stroke={refused ? "var(--color-state-locked)" : "var(--color-ground-3)"}
                    strokeWidth={refused ? 2.4 : 1.4}
                  />
                  <line
                    x1={MEMBRANE_X + 30}
                    y1={position.y}
                    x2={TOOL_X - 14}
                    y2={position.y}
                    stroke="var(--color-ground-3)"
                    strokeWidth={1.4}
                    strokeDasharray="3 5"
                  />
                </g>
              );
            }

            const gated = position.authority === "requires_approval";
            const colour = gated
              ? approved
                ? "var(--color-state-recovered)"
                : "var(--color-state-conflict)"
              : "var(--color-state-verified)";
            const proposed = gated && proposalTool === tool.name;

            return (
              <g key={tool.name} opacity={dim ? 0.25 : 1} style={{ transition: "opacity 160ms ease-out" }}>
                <path
                  d={pathTo(position.y, TOOL_X - 14)}
                  fill="none"
                  stroke={colour}
                  strokeWidth={ran || proposed ? 2.4 : 1.4}
                  /* Dashed is pending: an approval-gated line has not been
                     travelled until a human says so. */
                  strokeDasharray={gated && !approved ? "6 5" : undefined}
                  opacity={ran || proposed || gated ? 1 : 0.4}
                />

                {/*
                  In transit. The design system reserves pulsing for exactly
                  this, so a travelling dot appears only on paths the agent
                  really used in this run — never as ambient movement.
                */}
                {ran && !still && (
                  <circle r={3.5} fill={colour}>
                    {/*
                      SMIL rather than a CSS motion path. `offset-path` on an
                      SVG element is not universally honoured, and where it is
                      not the circle renders at the origin — a stray dot in the
                      corner of the diagram, which is worse than no animation at
                      all. `animateMotion` either runs or draws nothing.
                    */}
                    <animateMotion
                      dur="1.4s"
                      begin={`${(step!.seq - 1) * 0.18}s`}
                      repeatCount="indefinite"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="spline"
                      keySplines="0.4 0 0.2 1"
                      path={pathTo(position.y, TOOL_X - 14)}
                    />
                  </circle>
                )}

                {/* The human gate, sitting on the membrane itself. */}
                {gated && (
                  <>
                    <rect
                      x={MEMBRANE_X - 11}
                      y={position.y - 11}
                      width={22}
                      height={22}
                      rx={4}
                      fill={approved ? "var(--color-state-recovered)" : "var(--color-ground-1)"}
                      stroke={approved ? "var(--color-state-recovered)" : "var(--color-state-conflict)"}
                      strokeWidth={2}
                    />
                    {/* A shackle, so the node reads as locked without a legend. */}
                    <path
                      d={`M ${MEMBRANE_X - 5} ${position.y - 2} v -4 a 5 5 0 0 1 10 0 v 4`}
                      fill="none"
                      stroke={approved ? "var(--color-ground-1)" : "var(--color-state-conflict)"}
                      strokeWidth={2}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* ── The agent core ────────────────────────────────────── */}
          <circle cx={AGENT_X} cy={H / 2} r={44} fill="var(--color-ground-2)" stroke="var(--color-ground-3)" strokeWidth={2} />
          <circle cx={AGENT_X} cy={H / 2} r={9} fill="var(--color-state-verified)" />
          <text
            x={AGENT_X}
            y={H / 2 + 66}
            textAnchor="middle"
            className="text-[12px] font-bold uppercase"
            style={{ fill: "var(--color-text-hi)", letterSpacing: "0.14em" }}
          >
            Case agent
          </text>
          <text
            x={AGENT_X}
            y={H / 2 + 84}
            textAnchor="middle"
            className="text-[11px]"
            style={{ fill: "var(--color-text-lo)" }}
          >
            deterministic plan
          </text>

          {/* ── Band labels and tool rows ─────────────────────────── */}
          {grouped.map((group) =>
            group.rows.length === 0 ? null : (
              <g key={group.authority}>
                <text
                  x={TOOL_X}
                  y={group.band.top - 20}
                  className="text-[10px] font-bold uppercase"
                  style={{ fill: group.band.colour, letterSpacing: "0.18em" }}
                >
                  {group.band.label}
                </text>
                {group.rows.map((tool) => {
                  const position = positions.get(tool.name)!;
                  const step = stepFor(tool.name);
                  const dim = hovered !== null && hovered !== tool.name;
                  const lit = step?.outcome === "ok" || step?.outcome === "refused";
                  return (
                    <g
                      key={tool.name}
                      opacity={dim ? 0.3 : 1}
                      style={{ transition: "opacity 160ms ease-out", cursor: "pointer" }}
                      onMouseEnter={() => setHovered(tool.name)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(tool.name)}
                      onBlur={() => setHovered(null)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${tool.name} — ${tool.authority.replace("_", " ")}`}
                    >
                      <circle
                        cx={TOOL_X - 4}
                        cy={position.y}
                        r={4}
                        fill={lit ? group.band.colour : "transparent"}
                        stroke={group.band.colour}
                        strokeWidth={1.6}
                      />
                      <text
                        x={TOOL_X + 12}
                        y={position.y + 4}
                        className="font-mono text-[13px]"
                        style={{ fill: lit ? "var(--color-text-hi)" : "var(--color-text-mid)" }}
                      >
                        {tool.name}
                      </text>
                    </g>
                  );
                })}
              </g>
            ),
          )}
        </svg>

        {/*
          The inspector rail. Hovering a strand is how you read a bundle, and a
          diagram that shows structure but withholds the reason for it is half a
          diagram. Fixed height so the layout does not jump as the pointer moves.
        */}
        <div
          className="min-h-[92px] border-t px-6 py-4"
          style={{ borderColor: "var(--color-ground-3)" }}
        >
          {active ? (
            <>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <code className="text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
                  {active.name}
                </code>
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: BANDS[active.authority as keyof typeof BANDS]?.colour }}
                >
                  {active.authority.replace("_", " ")}
                </span>
              </div>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                {active.refusal ?? active.description}
              </p>
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-text-lo)" }}>
              Hover or tab through a tool to see what it returns, or why it will never run.
            </p>
          )}
        </div>
      </div>

      <figcaption className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
        The same line language as the rest of the site: solid is verified, dashed is pending, a
        locked node is human approval required, green is recovered. The severed strands are not a
        failure — they are the boundary holding.
      </figcaption>
    </figure>
  );
}
