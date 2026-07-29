"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * The handoff map, drawn from the selected move's own projection.
 *
 * What this replaces was a 3D constellation whose five node states were
 * hardcoded literals — `{ label: "Microsite", state: "transit" }` — on a page
 * whose entire argument is that every figure traces to a row. Four of the five
 * never changed whatever the tenant contained. It also rendered a channel, a
 * lead source and a human being as three identical spheres, which is a category
 * error before it is a visual one.
 *
 * Everything here comes from the concierge projection of the selected move:
 * channels are the distinct `source` values on its field versions, the operator
 * is whoever `selected_by` names, provider operations are its service rows with
 * whatever the provider has actually said. If a move has one channel, one node
 * is drawn.
 *
 * ## Different concepts, different shapes
 *
 * Rounded rectangles are channels, the person marker is a human actor, the
 * centre circle is the canonical record, capsules are provider operations, and
 * the trailing lens is an audience projection. Drawing them identically is what
 * made the previous version read as a network diagram of nothing in particular.
 *
 * No canvas. This is SVG, and there is no second WebGL surface on the site.
 */

export interface MapChannel {
  /** The channel name as stored on the field version, e.g. `partner_api`. */
  name: string;
  /** True when at least one of its values survived as canonical. */
  committed: boolean;
  /** True when this channel contributed to a field that is still contested. */
  contested: boolean;
}

export interface MapOperation {
  serviceType: string;
  /** The provider submission state, verbatim. `null` when never submitted. */
  state: string | null;
  orderId: string | null;
}

export interface DomainMapData {
  reference: string | null;
  channels: MapChannel[];
  /** Whoever committed a canonical value on this move. */
  operator: string | null;
  operations: MapOperation[];
  /** Open conflicts, from the move row. */
  contestedFields: number;
}

const W = 900;
const H = 320;
const CENTRE_X = 420;
const CENTRE_Y = 160;

/** How a provider submission state reads as a line. */
function operationTone(state: string | null): { accent: Accent; label: string; broken: boolean } {
  switch (state) {
    case "confirmed":
      return { accent: "verified", label: "confirmed", broken: false };
    case "reconciled":
      return { accent: "recovered", label: "recovered", broken: false };
    case "unknown":
      return { accent: "conflict", label: "outcome unknown", broken: true };
    case "failed":
      return { accent: "failed", label: "failed", broken: true };
    case "submitted":
    case "pending":
      return { accent: "internet", label: state, broken: false };
    default:
      return { accent: "verified", label: "not submitted", broken: false };
  }
}

export function DomainMap({ data, onSelect }: { data: DomainMapData; onSelect?: (id: string) => void }) {
  const still = useStillness();
  const { channels, operator, operations, contestedFields, reference } = data;

  const laneY = (i: number, n: number) => (n <= 1 ? CENTRE_Y : 60 + (i * (H - 140)) / (n - 1));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      fill="none"
      strokeLinecap="round"
      role="img"
      aria-label={
        reference
          ? `${reference}: ${channels.length} intake channels converging on one canonical record, with ${operations.length} provider operations`
          : "No move selected"
      }
    >
      {/* ---------------- intake channels ---------------- */}
      {channels.map((c, i) => {
        const y = laneY(i, channels.length);
        const tone: Accent = c.contested ? "conflict" : c.committed ? "verified" : "internet";
        const path = `M150 ${y} C 250 ${y}, 300 ${CENTRE_Y}, ${CENTRE_X - 46} ${CENTRE_Y}`;
        return (
          <g key={c.name} onClick={() => onSelect?.(`channel:${c.name}`)} style={{ cursor: onSelect ? "pointer" : undefined }}>
            {/* Rounded rectangle: a channel, not a person and not a record. */}
            <rect x={26} y={y - 17} width={122} height={34} rx={9} stroke={accentColor(tone, 0.75)} strokeWidth={1.5} />
            <text x={87} y={y + 4} fontSize={13} textAnchor="middle" fill={accentInk(tone)} fontFamily="monospace">
              {c.name}
            </text>
            <motion.path
              d={path}
              stroke={accentColor(tone, c.committed ? 0.8 : 0.45)}
              strokeWidth={1.5}
              /* Dashed means supplied but not surviving as canonical. */
              strokeDasharray={c.committed ? undefined : "5 5"}
              initial={false}
              animate={{ opacity: 1 }}
              transition={{ duration: still ? 0 : 0.4 }}
            />
          </g>
        );
      })}

      {/* ---------------- the canonical record ---------------- */}
      <circle
        cx={CENTRE_X}
        cy={CENTRE_Y}
        r={44}
        stroke={accentColor(contestedFields > 0 ? "conflict" : "verified", 0.95)}
        strokeWidth={2}
        fill={accentColor(contestedFields > 0 ? "conflict" : "verified", 0.1)}
      />
      <text x={CENTRE_X} y={CENTRE_Y - 6} fontSize={11} textAnchor="middle" fill="rgba(255,255,255,0.55)" letterSpacing="0.1em">
        CANONICAL
      </text>
      <text x={CENTRE_X} y={CENTRE_Y + 12} fontSize={13} textAnchor="middle" fill="#fff" fontFamily="monospace">
        {reference ?? "—"}
      </text>

      {/* ---------------- the human who decided ---------------- */}
      {operator && (
        <g onClick={() => onSelect?.(`actor:${operator}`)} style={{ cursor: onSelect ? "pointer" : undefined }}>
          {/*
            A person marker, not a node. The purple lock is this project's
            colour for a decision under human control, and the only element on
            the map entitled to it.
          */}
          <circle cx={CENTRE_X} cy={52} r={11} stroke={accentColor("security", 0.95)} strokeWidth={1.8} />
          <path
            d={`M${CENTRE_X - 16} 84 a16 14 0 0 1 32 0`}
            stroke={accentColor("security", 0.95)}
            strokeWidth={1.8}
          />
          <path
            d={`M${CENTRE_X} 92 V${CENTRE_Y - 48}`}
            stroke={accentColor("security", 0.6)}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <text x={CENTRE_X + 26} y={70} fontSize={12} fill={accentInk("security")} fontFamily="monospace">
            {operator}
          </text>
        </g>
      )}

      {/* ---------------- provider operations ---------------- */}
      {operations.map((op, i) => {
        const y = laneY(i, operations.length);
        const tone = operationTone(op.state);
        const startX = CENTRE_X + 46;
        const capsuleX = 700;

        return (
          <g key={op.serviceType} onClick={() => onSelect?.(`operation:${op.serviceType}`)} style={{ cursor: onSelect ? "pointer" : undefined }}>
            {/* Outbound: the request. It always reaches the provider. */}
            <motion.path
              d={`M${startX} ${CENTRE_Y} C ${560} ${CENTRE_Y}, ${620} ${y}, ${capsuleX - 8} ${y}`}
              stroke={accentColor(tone.accent, 0.8)}
              strokeWidth={1.5}
              initial={false}
              animate={{ opacity: 1 }}
            />

            {/*
              The reply, and the break in it. `unknown` is not slow progress —
              it is a loss of certainty, so it is drawn severed rather than
              dimmed.
            */}
            {tone.broken && (
              <>
                {[`M${capsuleX - 70} ${y - 16} l10 12`, `M${capsuleX - 52} ${y - 16} l-10 12`].map((d) => (
                  <path key={d} d={d} stroke={accentColor("failed", 0.95)} strokeWidth={2.2} />
                ))}
              </>
            )}

            {/* Operation capsule: a provider operation, distinct from a record. */}
            <rect
              x={capsuleX}
              y={y - 18}
              width={150}
              height={36}
              rx={18}
              stroke={accentColor(tone.accent, 0.9)}
              strokeWidth={1.6}
              fill={accentColor(tone.accent, 0.08)}
            />
            <text x={capsuleX + 75} y={y - 2} fontSize={12} textAnchor="middle" fill={accentInk(tone.accent)} fontFamily="monospace">
              {op.serviceType}
            </text>
            <text x={capsuleX + 75} y={y + 12} fontSize={10} textAnchor="middle" fill="rgba(255,255,255,0.45)">
              {op.orderId ? `${op.orderId} · ${tone.label}` : tone.label}
            </text>
          </g>
        );
      })}

      {operations.length === 0 && (
        <text x={CENTRE_X + 120} y={CENTRE_Y + 4} fontSize={12} fill="rgba(255,255,255,0.3)">
          no provider operations yet
        </text>
      )}
    </svg>
  );
}
