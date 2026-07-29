"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { Frame, Pulse, Record, Refused, Row, useScene, n } from "@/components/diagram/primitives";

/**
 * One drawing per architectural decision.
 *
 * The architecture page was six paragraphs in a grid — every word true, none of
 * it legible. A reviewer met six equal-weight blocks of prose with no way to
 * tell which claim was load-bearing or what the enforcement actually looked
 * like. These drawings carry the part prose is worst at: the shape of a
 * mechanism, and the moment it refuses something.
 *
 * Every one of them ends in a refusal or a single surviving row, because that
 * is what each decision is *for*. A diagram of a happy path would be the
 * decoration this design system bans; the interesting frame is the one where
 * the system says no.
 */

/* ── 01 · The database is the source of truth ───────────────────────────────
   Two concurrent approvals. One index. One survivor. */

export function TruthScene() {
  const { ref, play, d } = useScene();
  return (
    <Frame svgRef={ref} label="Two concurrent approvals meeting one partial unique index, and only one surviving">
      <text x={16} y={28} fontSize={7.5} fill="rgba(255,255,255,0.5)" letterSpacing="0.1em">
        TWO CONCIERGES, ONE FIELD, SAME MOMENT
      </text>

      {[
        { y: 62, who: "concierge-7", accent: "verified" as const },
        { y: 200, who: "concierge-3", accent: "verified" as const },
      ].map((w, i) => (
        <g key={w.who}>
          <Row x={16} y={w.y} label={w.who} value="is_canonical" accent={w.accent} dim />
          <motion.path
            d={`M150 ${w.y} C 196 ${w.y}, 200 131, 236 131`}
            stroke={accentColor("verified", 0.5)}
            strokeWidth={1.3}
            {...d(0.2 + i * 0.12, 0.7)}
          />
          <Pulse
            d={`M150 ${w.y} C 196 ${w.y}, 200 131, 236 131`}
            accent="verified"
            play={play}
            delay={1.3 + i * 0.08}
            duration={1.3}
            r={2.4}
          />
        </g>
      ))}

      {/* The index. Not a service, not a code path — an index. */}
      <motion.g
        initial={{ opacity: 0, scale: 0.92 }}
        animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.7 }}
        style={{ transformOrigin: "266px 131px" }}
      >
        <rect x={240} y={98} width={54} height={66} rx={7} fill={accentColor("verified", 0.1)} stroke={accentColor("verified", 0.85)} strokeWidth={1.4} />
        <text x={267} y={122} fontSize={6.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.06em">
          UNIQUE
        </text>
        <text x={267} y={134} fontSize={6.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.06em">
          WHERE
        </text>
        <text x={267} y={146} fontSize={6.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.06em">
          is_canonical
        </text>
      </motion.g>

      {/* One gets through. */}
      <motion.path d="M294 118 H340" stroke={accentColor("verified", 0.8)} strokeWidth={1.5} {...d(1.9, 0.4)} />
      <Record x={362} y={118} r={12} />
      <motion.text
        x={362} y={142} fontSize={6.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.2 }}
      >
        CANONICAL
      </motion.text>

      {/* The other is refused by the database itself. */}
      <motion.path d="M294 148 H332" stroke={accentColor("failed", 0.7)} strokeWidth={1.4} strokeDasharray="3 4" {...d(2.1, 0.35)} />
      <Refused x={348} y={148} play={play} delay={2.5} size={7} />
      <motion.text
        x={348} y={172} fontSize={6.5} textAnchor="middle" fill={accentInk("failed")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.7 }}
      >
        23505
      </motion.text>
    </Frame>
  );
}

/* ── 02 · A canonical value needs a human ───────────────────────────────────
   The AI proposal and the human's differ by one column. */

export function HumanScene() {
  const { ref, play, d } = useScene();
  return (
    <Frame svgRef={ref} label="An AI proposal without a named actor rejected by a CHECK constraint, a human-signed one accepted">
      {[
        { y: 70, who: "ai:run-8fc2", actor: "selected_by = NULL", ok: false, accent: "internet" as const },
        { y: 186, who: "user:concierge-7", actor: "selected_by = SET", ok: true, accent: "security" as const },
      ].map((w, i) => (
        <g key={w.who}>
          <Row x={14} y={w.y - 14} w={150} label={w.who} accent={w.accent} />
          <Row x={14} y={w.y + 14} w={150} label={w.actor} accent={w.accent} dim={!w.ok} />
          <motion.path
            d={`M168 ${w.y} H228`}
            stroke={accentColor(w.accent, 0.5)}
            strokeWidth={1.3}
            {...d(0.25 + i * 0.15, 0.5)}
          />
          <Pulse d={`M168 ${w.y} H228`} accent={w.accent} play={play} delay={1.4 + i * 0.5} duration={1} r={2.3} />
        </g>
      ))}

      {/* The constraint, sitting between the proposal and the table. */}
      <motion.path d="M240 26 V234" stroke="rgba(255,255,255,0.2)" strokeWidth={1.2} strokeDasharray="3 5" {...d(0, 0.6)} />
      <text x={240} y={20} fontSize={6.5} textAnchor="middle" fill="rgba(255,255,255,0.42)" letterSpacing="0.12em">
        CHECK canonical_requires_actor
      </text>

      <Refused x={240} y={70} play={play} delay={2.3} size={8} />
      <motion.text
        x={258} y={73} fontSize={7} fill={accentInk("failed")} letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.5 }}
      >
        REJECTED BY POSTGRES
      </motion.text>

      <motion.path d="M252 186 H330" stroke={accentColor("verified", 0.7)} strokeWidth={1.4} {...d(2.2, 0.45)} />
      <Pulse d="M252 186 H330" accent="verified" play={play} delay={3.2} duration={1} r={2.4} />
      <Record x={356} y={186} r={12} />
      <motion.text
        x={356} y={210} fontSize={6.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.8 }}
      >
        CANONICAL
      </motion.text>
    </Frame>
  );
}

/* ── 03 · UNKNOWN, not failed ───────────────────────────────────────────────
   The only diagram here with three outcomes instead of two. */

export function UnknownScene() {
  const { ref, play, d } = useScene();
  return (
    <Frame svgRef={ref} label="A lost provider reply held as UNKNOWN, a blind retry refused, and the existing order recovered">
      <Row x={14} y={131} w={104} label="submit" accent="verified" />
      <motion.path d="M122 131 H186" stroke={accentColor("verified", 0.7)} strokeWidth={1.4} {...d(0.2, 0.5)} />
      <Pulse d="M122 131 H186" accent="verified" play={play} delay={1.4} duration={1} r={2.4} />

      <motion.g initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 0.7 }}>
        <rect x={188} y={112} width={58} height={38} rx={6} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.2)" strokeWidth={1.2} />
        <text x={217} y={136} fontSize={7} textAnchor="middle" fill="rgba(255,255,255,0.65)" letterSpacing="0.08em">
          PROVIDER
        </text>
      </motion.g>

      {/* The order exists on their side. That is the whole problem. */}
      <motion.text
        x={217} y={104} fontSize={6.5} textAnchor="middle" fill={accentInk("recovered")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1.1 }}
      >
        ORDER CREATED
      </motion.text>

      {/* The reply that never came. */}
      <motion.path d="M246 131 H300" stroke={accentColor("failed", 0.85)} strokeWidth={1.4} strokeDasharray="3 5" {...d(1, 0.45)} />
      <motion.text
        x={273} y={122} fontSize={6.5} textAnchor="middle" fill={accentInk("failed")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1.5 }}
      >
        REPLY LOST
      </motion.text>

      <Row x={302} y={131} w={100} label="state = unknown" accent="unknown" />

      {/* The retry that must not happen, and the reconciliation that must. */}
      <motion.path d="M352 148 V196" stroke={accentColor("failed", 0.6)} strokeWidth={1.3} strokeDasharray="3 4" {...d(1.9, 0.4)} />
      <Refused x={352} y={210} play={play} delay={2.4} size={8} />
      <motion.text
        x={340} y={236} fontSize={6.5} textAnchor="end" fill={accentInk("failed")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.6 }}
      >
        BLIND RETRY REFUSED
      </motion.text>

      <motion.path
        d="M302 116 C 262 96, 250 74, 217 74"
        stroke={accentColor("recovered", 0.85)}
        strokeWidth={1.6}
        {...d(2.8, 0.6)}
      />
      <Pulse d="M302 116 C 262 96, 250 74, 217 74" accent="recovered" play={play} delay={3.9} duration={1.3} r={2.6} />
      <motion.text
        x={258} y={62} fontSize={6.5} textAnchor="middle" fill={accentInk("recovered")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 3.4 }}
      >
        RECONCILE · ONE ORDER
      </motion.text>
    </Frame>
  );
}

/* ── 04 · Persisted idempotency ─────────────────────────────────────────────
   Two lanes. One survives a restart. */

export function IdempotencyScene() {
  const { ref, play, d } = useScene();
  return (
    <Frame svgRef={ref} label="A Redis lock lost to eviction producing a duplicate, against a unique index that refuses one">
      {/* The restart, drawn once, crossing both lanes. */}
      <motion.path d="M214 20 V240" stroke="rgba(255,255,255,0.2)" strokeWidth={1.2} strokeDasharray="3 5" {...d(0, 0.6)} />
      <text x={214} y={14} fontSize={6.5} textAnchor="middle" fill="rgba(255,255,255,0.42)" letterSpacing="0.12em">
        RESTART · EVICTION · DEPLOY
      </text>

      {/* Redis: the key is gone, so the second submit succeeds. */}
      <Row x={14} y={74} w={110} label="SETNX lock" accent="failed" dim />
      <motion.path d="M128 74 H208" stroke={accentColor("failed", 0.45)} strokeWidth={1.3} strokeDasharray="4 4" {...d(0.3, 0.5)} />
      <motion.text
        x={168} y={64} fontSize={6.5} textAnchor="middle" fill="rgba(255,255,255,0.4)" letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 0.9 }}
      >
        key evicted
      </motion.text>
      <motion.path d="M220 74 H316" stroke={accentColor("failed", 0.6)} strokeWidth={1.3} {...d(1.1, 0.5)} />
      <Pulse d="M220 74 H316" accent="failed" play={play} delay={2} duration={1.1} r={2.4} />
      <motion.text
        x={324} y={77} fontSize={7} fill={accentInk("failed")} letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1.6 }}
      >
        DUPLICATE
      </motion.text>

      {/* Postgres: the row is still there. */}
      <Row x={14} y={186} w={110} label="operation_key" accent="electricity" />
      <motion.path d="M128 186 H208" stroke={accentColor("electricity", 0.6)} strokeWidth={1.3} {...d(0.5, 0.5)} />
      <motion.text
        x={168} y={176} fontSize={6.5} textAnchor="middle" fill={accentInk("electricity")} letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1 }}
      >
        row survives
      </motion.text>
      <motion.path d="M220 186 H300" stroke={accentColor("electricity", 0.6)} strokeWidth={1.3} {...d(1.3, 0.5)} />
      <Pulse d="M220 186 H300" accent="electricity" play={play} delay={2.4} duration={1.1} r={2.4} />
      <Refused x={318} y={186} play={play} delay={2.9} size={8} />
      <motion.text
        x={334} y={189} fontSize={7} fill={accentInk("electricity")} letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 3.1 }}
      >
        REFUSED
      </motion.text>
    </Frame>
  );
}

/* ── 05 · Append-only audit ─────────────────────────────────────────────────
   The trigger raises. A correction is a new row. */

export function AuditScene() {
  const { ref, play, d } = useScene();
  const rows = ["referral.received", "duplicate.attached", "merge.approved"];
  return (
    <Frame svgRef={ref} label="UPDATE and DELETE against the audit trail raising, and a correction appended as a new row">
      <text x={14} y={26} fontSize={7} fill="rgba(255,255,255,0.45)" letterSpacing="0.1em">
        audit_events
      </text>

      {rows.map((r, i) => (
        <motion.g
          key={r}
          initial={{ opacity: 0, x: -8 }}
          animate={play ? { opacity: 1, x: 0 } : { opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 * i }}
        >
          <Row x={14} y={54 + i * 34} w={168} label={r} accent="conflict" dim />
        </motion.g>
      ))}

      {/* Two attempts to change history. Both raise. */}
      {[
        { label: "UPDATE", y: 74 },
        { label: "DELETE", y: 122 },
      ].map((a, i) => (
        <g key={a.label}>
          <motion.path
            d={`M300 ${a.y} H208`}
            stroke={accentColor("failed", 0.6)}
            strokeWidth={1.3}
            strokeDasharray="3 4"
            {...d(0.9 + i * 0.2, 0.45)}
          />
          <motion.text
            x={308} y={a.y + 3} fontSize={7.5} fill={accentInk("failed")} letterSpacing="0.06em"
            initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1 + i * 0.2 }}
          >
            {a.label}
          </motion.text>
          <Refused x={196} y={a.y} play={play} delay={1.6 + i * 0.2} size={7} />
        </g>
      ))}

      <motion.text
        x={300} y={162} fontSize={6.5} textAnchor="middle" fill={accentInk("failed")} letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.1 }}
      >
        RAISE EXCEPTION
      </motion.text>

      {/* The only way to change the record: append. */}
      <motion.g
        initial={{ opacity: 0, y: 10 }}
        animate={play ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 2.5 }}
      >
        <Row x={14} y={200} w={168} label="merge.corrected" accent="recovered" />
      </motion.g>
      <motion.text
        x={192} y={203} fontSize={7} fill={accentInk("recovered")} letterSpacing="0.06em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 2.8 }}
      >
        A CORRECTION IS A NEW EVENT
      </motion.text>
      <Pulse d="M300 224 H100" accent="recovered" play={play} delay={3.4} duration={1.4} r={2.4} />
    </Frame>
  );
}

/* ── 06 · Grounded, not retrieved ───────────────────────────────────────────
   Claims that cite a row survive. One that does not is dropped. */

export function GroundedScene() {
  const { ref, play, d } = useScene();
  const claims = [
    { text: "move.date = Aug 16", cites: "fv:2c1a", ok: true },
    { text: "customer confirmed", cites: "fv:9d40", ok: true },
    { text: "waived the deposit", cites: "fv:0000", ok: false },
  ];
  return (
    <Frame svgRef={ref} label="Model output checked against supplied field ids, with an uncited claim dropped after generation">
      <text x={14} y={26} fontSize={7} fill="rgba(255,255,255,0.45)" letterSpacing="0.1em">
        field_versions supplied
      </text>
      {["fv:2c1a", "fv:9d40"].map((f, i) => (
        <Row key={f} x={14} y={56 + i * 32} w={92} label={f} accent="verified" />
      ))}

      <motion.path d="M110 72 C 150 72, 152 130, 186 130" stroke={accentColor("verified", 0.45)} strokeWidth={1.2} {...d(0.3, 0.6)} />
      <motion.g initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 0.7 }}>
        <rect x={188} y={110} width={48} height={40} rx={6} fill={accentColor("internet", 0.1)} stroke={accentColor("internet", 0.7)} strokeWidth={1.2} />
        <text x={212} y={134} fontSize={7} textAnchor="middle" fill={accentInk("internet")} letterSpacing="0.06em">
          MODEL
        </text>
      </motion.g>

      {claims.map((c, i) => {
        const y = 70 + i * 60;
        return (
          <g key={c.text}>
            <motion.path
              d={`M236 130 C 268 130, 272 ${y}, 300 ${y}`}
              stroke={accentColor(c.ok ? "recovered" : "failed", 0.5)}
              strokeWidth={1.2}
              {...d(1.2 + i * 0.15, 0.55)}
            />
            <Pulse
              d={`M236 130 C 268 130, 272 ${y}, 300 ${y}`}
              accent={c.ok ? "recovered" : "failed"}
              play={play}
              delay={2.2 + i * 0.35}
              duration={1.2}
              r={2.2}
            />
            <motion.text
              x={306} y={y - 3} fontSize={7} fill={c.ok ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)"}
              initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1.6 + i * 0.15 }}
            >
              {c.text}
            </motion.text>
            <motion.text
              x={306} y={y + 8} fontSize={6.5} fontFamily="monospace"
              fill={c.ok ? accentInk("recovered") : accentInk("failed")}
              initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 1.7 + i * 0.15 }}
            >
              {c.ok ? `cites ${c.cites}` : "cites an id nobody supplied"}
            </motion.text>
            {!c.ok && <Refused x={288} y={y} play={play} delay={3.3} size={7} />}
          </g>
        );
      })}

      <motion.text
        x={14} y={230} fontSize={6.5} fill="rgba(255,255,255,0.45)" letterSpacing="0.08em"
        initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 1 }} transition={{ delay: 3.6 }}
      >
        CHECKED AFTER THE MODEL SPEAKS, NOT ASKED FOR BEFOREHAND
      </motion.text>
    </Frame>
  );
}

/** Keyed by slug, so the page carries no switch statement. */
export const DECISION_SCENES: Record<string, () => React.JSX.Element> = {
  "database-is-truth": TruthScene,
  "human-merges": HumanScene,
  "unknown-not-failed": UnknownScene,
  "persisted-idempotency": IdempotencyScene,
  "append-only-audit": AuditScene,
  "deferred-on-purpose": GroundedScene,
};

/**
 * Resolve a scene by slug, on the client side of the boundary.
 *
 * The architecture page is a server component, and `DECISION_SCENES` is a value
 * exported from a `"use client"` module — so indexing it from the server gets a
 * client-reference proxy rather than the record, the lookup returns undefined,
 * and every diagram silently renders as nothing. Which is exactly what
 * happened: six decisions, six empty frames, and no error anywhere.
 *
 * Passing a slug across the boundary and resolving here keeps the map on the
 * side that owns it. A string serialises; a component does not.
 */
export function DecisionScene({ slug }: { slug: string }) {
  const Scene = DECISION_SCENES[slug];
  return Scene ? <Scene /> : null;
}
