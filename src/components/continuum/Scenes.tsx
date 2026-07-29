"use client";

import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { Frame, Pulse, Record, useScene, n } from "@/components/diagram/primitives";

/**
 * One drawing per section of the Continuum.
 *
 * Each scene has to make its section's mechanic legible in about two seconds,
 * because a reader who has to study a diagram to learn what a section is about
 * has already read the heading and moved on. So every one of these animates a
 * single claim — sources converging, a fact stopping at a lock, a signal naming
 * its own evidence — and none of them animates for the sake of it.
 *
 * They share one vocabulary, which is the design system's: a solid line is
 * verified, a dashed line is pending, an amber path needs judgement, a red
 * break is a failure, a rejoin is a recovery, a violet lock is human approval
 * required. The same marks mean the same things here as on the demo and the
 * architecture pages, so learning them once pays off six more times.
 *
 * Framer Motion only. GSAP was considered for the more elaborate ones and
 * rejected: nothing here needs a timeline this project cannot already express,
 * and a second animation library earns its weight in bundle size only if it
 * does something the first cannot.
 *
 * The marks themselves live in `components/diagram/primitives` and are shared
 * with the architecture page, so a solid line cannot come to mean one thing
 * here and something slightly different there.
 */

/* ── 1 · Move Relay ─────────────────────────────────────────────────────────
   Three sources converge. One line breaks and rejoins: the whole product in
   one mark. */

export function RelayScene() {
  const { ref, play, d } = useScene();
  const sources = [
    { y: 46, label: "PARTNER API", accent: "verified" as Accent },
    { y: 130, label: "CSV", accent: "conflict" as Accent },
    { y: 214, label: "CUSTOMER FORM", accent: "verified" as Accent },
  ];
  return (
    <Frame svgRef={ref} label="Three channels converging into one record, with a provider reply lost and recovered">
      {sources.map((s, i) => (
        <g key={s.label}>
          <circle cx={40} cy={s.y} r={5} fill={accentColor(s.accent, 1)} />
          <text x={52} y={s.y + 3} fontSize={8} fill={accentInk(s.accent)} letterSpacing="0.08em">
            {s.label}
          </text>
          <motion.path
            d={`M46 ${s.y} C 110 ${s.y}, 130 130, 186 130`}
            stroke={accentColor(s.accent, 0.55)}
            strokeWidth={1.4}
            strokeDasharray={s.accent === "conflict" ? "4 4" : undefined}
            {...d(0.1 + i * 0.16)}
          />
          {/* Referrals keep arriving. The staggered delays mean the three
              channels never pulse in unison, which is the point — they are
              independent sources, not a synchronised feed. */}
          <Pulse
            d={`M46 ${s.y} C 110 ${s.y}, 130 130, 186 130`}
            accent={s.accent}
            play={play}
            delay={1.1 + i * 0.75}
            duration={2.2}
          />
        </g>
      ))}

      <Record x={202} y={130} />
      <text x={202} y={166} fontSize={8} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.1em">
        ONE RECORD
      </text>

      {/* The submission, its lost reply, and the recovery. */}
      <motion.path d="M218 130 H300" stroke={accentColor("verified", 0.7)} strokeWidth={1.4} {...d(0.7, 0.5)} />
      <motion.path
        d="M300 130 H330"
        stroke={accentColor("failed", 0.9)}
        strokeWidth={1.4}
        strokeDasharray="3 5"
        {...d(1.15, 0.4)}
      />
      <motion.g
        initial={{ opacity: 0 }}
        animate={play ? { opacity: [0, 1, 1] } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      >
        <text x={315} y={120} fontSize={7.5} textAnchor="middle" fill={accentInk("unknown")} letterSpacing="0.1em">
          UNKNOWN
        </text>
      </motion.g>
      <motion.path
        d="M330 130 C 352 130, 358 130, 376 130"
        stroke={accentColor("recovered", 0.95)}
        strokeWidth={1.8}
        {...d(1.85, 0.5)}
      />
      <circle cx={382} cy={130} r={5} fill={accentColor("recovered", 1)} />
      <text x={382} y={150} fontSize={7.5} textAnchor="middle" fill={accentInk("recovered")} letterSpacing="0.1em">
        RECOVERED
      </text>

      {/*
        The submission runs to the provider and stops dead where the reply was
        lost. Then, separately and later, the recovery completes the journey.
        Two pulses rather than one continuous run, because they are two
        different events with a human decision between them.
      */}
      <Pulse d="M218 130 H300" accent="verified" play={play} delay={2.6} duration={1.1} />
      <Pulse d="M330 130 C 352 130, 358 130, 376 130" accent="recovered" play={play} delay={4.2} duration={1} />
    </Frame>
  );
}

/* ── 2 · Adaptive Front Door ───────────────────────────────────────────────
   Six ways in, one gate, one record. The gate is the point. */

export function FrontDoorScene() {
  const { ref, play, d } = useScene();
  const entries = ["CUSTOMER", "AGENT", "PROPERTY MGR", "BUILDER", "MORTGAGE", "ASSISTANT"];
  return (
    <Frame svgRef={ref} label="Six entry paths converging on one provenance-preserving intake gate">
      {entries.map((label, i) => {
        const y = 26 + i * 42;
        return (
          <g key={label}>
            <text x={8} y={y + 3} fontSize={7.5} fill="rgba(255,255,255,0.55)" letterSpacing="0.08em">
              {label}
            </text>
            <motion.path
              d={`M84 ${y} C 140 ${y}, 150 130, 196 130`}
              stroke={accentColor("internet", 0.45)}
              strokeWidth={1.2}
              {...d(0.08 * i, 0.8)}
            />
            {/* Six doors, all in use, none of them synchronised. */}
            <Pulse
              d={`M84 ${y} C 140 ${y}, 150 130, 196 130`}
              accent="internet"
              play={play}
              delay={1.2 + i * 0.42}
              duration={2}
              r={2.2}
            />
          </g>
        );
      })}

      {/* The gate every path must pass. */}
      <motion.g
        initial={{ opacity: 0, scale: 0.9 }}
        animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        style={{ transformOrigin: "230px 130px" }}
      >
        <rect x={206} y={78} width={48} height={104} rx={8} fill={accentColor("internet", 0.1)} stroke={accentColor("internet", 0.8)} strokeWidth={1.4} />
        {["KEY", "SCHEMA", "DUPE", "SOURCE"].map((t, i) => (
          <text key={t} x={230} y={100 + i * 22} fontSize={7} textAnchor="middle" fill={accentInk("internet")} letterSpacing="0.06em">
            {t}
          </text>
        ))}
      </motion.g>

      <motion.path d="M254 130 H316" stroke={accentColor("verified", 0.6)} strokeWidth={1.4} {...d(1.1, 0.5)} />
      {/* Whatever went in, one thing comes out. */}
      <Pulse d="M254 130 H316" accent="verified" play={play} delay={2.4} duration={1.1} />
      <Record x={334} y={130} />
      <text x={334} y={166} fontSize={7.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.1em">
        ONE RECORD
      </text>
    </Frame>
  );
}

/* ── 3 · Verified Concierge Copilot ────────────────────────────────────────
   A sentence becomes a source token, and the token stops at a lock. That stop
   is the entire section. */

export function CopilotScene() {
  const { ref, play, d } = useScene();
  const bars = Array.from({ length: 34 }, (_, i) => i);
  return (
    <Frame svgRef={ref} label="A spoken sentence becoming a source-linked proposal, held at a human approval lock">
      {/* The waveform, lighting left to right as the sentence is spoken. */}
      {bars.map((i) => {
        const h = n(10 + Math.abs(Math.sin(i * 1.1)) * 30);
        return (
          <motion.rect
            key={i}
            x={n(16 + i * 5.4)}
            y={n(52 - h / 2)}
            width={2.4}
            height={h}
            rx={1.2}
            fill={accentColor("security", 0.75)}
            initial={{ opacity: 0.18 }}
            animate={play ? { opacity: [0.18, 1, 0.35, 0.18] } : { opacity: 0.4 }}
            /*
              Looping, because a call is a continuous thing and a waveform that
              lights once and stops reads as a recording that already ended.
              The per-bar delay makes the light travel left to right, which is
              how someone speaking actually sounds when you draw it.
            */
            transition={{
              duration: 1.6,
              delay: i * 0.028,
              repeat: Infinity,
              repeatDelay: 2.2,
              ease: "easeInOut",
            }}
          />
        );
      })}
      <text x={16} y={82} fontSize={8} fill="rgba(255,255,255,0.6)">
        “Yes, August 16.”
      </text>

      {/* The extracted fact, with the second it was said. */}
      <motion.g
        initial={{ opacity: 0, y: -10 }}
        animate={play ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.1 }}
      >
        <rect x={16} y={104} width={150} height={46} rx={7} fill={accentColor("security", 0.1)} stroke={accentColor("security", 0.6)} strokeWidth={1.2} />
        <text x={26} y={120} fontSize={8} fill={accentInk("security")} fontFamily="monospace">
          move.date = 2026-08-16
        </text>
        <text x={26} y={133} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="monospace">
          source: call 01:14
        </text>
        <text x={26} y={144} fontSize={7} fill="rgba(255,255,255,0.5)" fontFamily="monospace">
          customer-confirmed
        </text>
      </motion.g>

      {/* It travels — and stops. */}
      <motion.path d="M170 127 H236" stroke={accentColor("security", 0.6)} strokeWidth={1.4} strokeDasharray="4 4" {...d(1.6, 0.5)} />
      {/*
        The proposal arrives at the lock over and over. It never crosses on its
        own — the second pulse, past the lock, is the *human's* action, and the
        gap between the two is the whole argument of this section.
      */}
      <Pulse d="M170 127 H236" accent="security" play={play} delay={3} duration={1.2} />

      <motion.g
        initial={{ opacity: 0, scale: 0.8 }}
        animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 2.05 }}
        style={{ transformOrigin: "256px 127px" }}
      >
        {/*
          The violet is `--color-state-locked` from the design system, written
          literally because "locked" is a *line state* in the constellation
          vocabulary rather than an entry in the `Accent` union, which names
          utility states. Two vocabularies, deliberately not merged.
        */}
        <rect x={242} y={112} width={28} height={30} rx={5} fill="rgba(167,139,250,0.14)" stroke="#a78bfa" strokeWidth={1.4} />
        <path d="M250 122 v-4 a6 6 0 0 1 12 0 v4" stroke="#a78bfa" strokeWidth={1.4} />
        <rect x={248} y={122} width={16} height={12} rx={2} fill="#a78bfa" opacity={0.9} />
      </motion.g>
      <text x={256} y={158} fontSize={7} textAnchor="middle" fill="#c4b5fd" letterSpacing="0.08em">
        HUMAN
      </text>

      {/* Only after the lock. */}
      <motion.path d="M276 127 H330" stroke={accentColor("verified", 0.6)} strokeWidth={1.4} {...d(2.5, 0.5)} />
      <Pulse d="M276 127 H330" accent="verified" play={play} delay={4.6} duration={1} />
      <Record x={350} y={127} />
      <text x={350} y={163} fontSize={7.5} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.1em">
        CANONICAL
      </text>
    </Frame>
  );
}

/* ── 4 · Move Intelligence ─────────────────────────────────────────────────
   Signals orbiting the record, each naming itself. No score anywhere. */

export function IntelligenceScene() {
  const { ref, play, d } = useScene();
  const signals: { label: string; accent: Accent; angle: number; dashed?: boolean }[] = [
    { label: "CONFLICT OPEN", accent: "conflict", angle: -150 },
    { label: "AGEING UNKNOWN", accent: "unknown", angle: -95, dashed: true },
    { label: "CONSENT MISSING", accent: "security", angle: -40 },
    { label: "MALFORMED INPUT", accent: "failed", angle: 40 },
    { label: "INSTALL UNCONFIRMED", accent: "internet", angle: 95, dashed: true },
    { label: "RECOVERED", accent: "recovered", angle: 150 },
  ];
  const cx = 150;
  const cy = 130;
  return (
    <Frame svgRef={ref} label="Operational signals orbiting the record, each naming what produced it">
      <circle cx={cx} cy={cy} r={78} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="2 6" />
      <Record x={cx} y={cy} r={17} />

      {signals.map((s, i) => {
        const rad = (s.angle * Math.PI) / 180;
        const x = n(cx + Math.cos(rad) * 78);
        const y = n(cy + Math.sin(rad) * 78);
        const labelRight = x >= cx;
        return (
          <g key={s.label}>
            <motion.path
              d={`M${n(cx + Math.cos(rad) * 18)} ${n(cy + Math.sin(rad) * 18)} L${x} ${y}`}
              stroke={accentColor(s.accent, 0.5)}
              strokeWidth={1.2}
              strokeDasharray={s.dashed ? "3 4" : undefined}
              {...d(0.2 + i * 0.12, 0.5)}
            />
            {/* Each signal fires from the record outward, because that is the
                direction the causation runs: a row produced it. */}
            <Pulse
              d={`M${n(cx + Math.cos(rad) * 18)} ${n(cy + Math.sin(rad) * 18)} L${x} ${y}`}
              accent={s.accent}
              play={play}
              delay={1.4 + i * 0.55}
              duration={1.5}
              r={2.2}
            />
            <motion.circle
              cx={x}
              cy={y}
              r={5}
              fill={accentColor(s.accent, 1)}
              initial={{ opacity: 0, scale: 0 }}
              animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.12 }}
            />
            <motion.text
              x={labelRight ? x + 10 : x - 10}
              y={y + 3}
              fontSize={7}
              textAnchor={labelRight ? "start" : "end"}
              fill={accentInk(s.accent)}
              letterSpacing="0.06em"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.6 + i * 0.12 }}
            >
              {s.label}
            </motion.text>
          </g>
        );
      })}

      {/* What replaces the number nobody can interrogate. */}
      <motion.text
        x={cx}
        y={236}
        fontSize={8}
        textAnchor="middle"
        fill="rgba(255,255,255,0.45)"
        letterSpacing="0.1em"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.4 }}
      >
        EVERY SIGNAL NAMES ITS OWN EVIDENCE
      </motion.text>
    </Frame>
  );
}

/* ── 5 · Partner Growth & Move Wallet ──────────────────────────────────────
   One referral branches into services and reunites as a packet. The
   attribution line never detaches. */

export function PartnerScene() {
  const { ref, play, d } = useScene();
  const services = ["ELECTRIC", "INTERNET", "SECURITY", "WARRANTY"];
  return (
    <Frame svgRef={ref} label="A partner referral branching into services and reuniting as one evidenced packet">
      <circle cx={30} cy={130} r={6} fill={accentColor("electricity", 1)} />
      <text x={12} y={152} fontSize={7.5} fill={accentInk("electricity")} letterSpacing="0.08em">
        PARTNER
      </text>

      {services.map((s, i) => {
        const y = 52 + i * 52;
        return (
          <g key={s}>
            <motion.path
              d={`M38 130 C 90 130, 96 ${y}, 150 ${y}`}
              stroke={accentColor("electricity", 0.4)}
              strokeWidth={1.2}
              {...d(0.15 * i, 0.7)}
            />
            <motion.rect
              x={150}
              y={y - 12}
              width={90}
              height={24}
              rx={5}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth={1}
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.15 }}
            />
            <motion.text
              x={162}
              y={y + 3}
              fontSize={7.5}
              fill="rgba(255,255,255,0.7)"
              letterSpacing="0.06em"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.55 + i * 0.15 }}
            >
              {s}
            </motion.text>
            <motion.path
              d={`M240 ${y} C 286 ${y}, 292 130, 330 130`}
              stroke={accentColor("verified", 0.4)}
              strokeWidth={1.2}
              {...d(0.9 + 0.12 * i, 0.6)}
            />
            <Pulse
              d={`M38 130 C 90 130, 96 ${y}, 150 ${y}`}
              accent="electricity"
              play={play}
              delay={2.4 + i * 0.3}
              duration={1.5}
              r={2.2}
            />
            <Pulse
              d={`M240 ${y} C 286 ${y}, 292 130, 330 130`}
              accent="verified"
              play={play}
              delay={4.1 + i * 0.3}
              duration={1.5}
              r={2.2}
            />
          </g>
        );
      })}

      {/* The attribution line, running the whole width and never detaching. */}
      <motion.path
        d="M30 214 H340"
        stroke={accentColor("electricity", 0.8)}
        strokeWidth={1.2}
        strokeDasharray="5 4"
        {...d(1.5, 0.9)}
      />
      <Pulse d="M30 214 H340" accent="electricity" play={play} delay={2.6} duration={5.2} r={2.4} />
      <motion.text
        x={186}
        y={228}
        fontSize={7}
        textAnchor="middle"
        fill={accentInk("electricity")}
        letterSpacing="0.1em"
        initial={{ opacity: 0 }}
        animate={play ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.4, delay: 2.1 }}
      >
        ATTRIBUTION HOLDS THE WHOLE WAY
      </motion.text>

      <motion.g
        initial={{ opacity: 0, scale: 0.9 }}
        animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1.7 }}
        style={{ transformOrigin: "360px 130px" }}
      >
        <rect x={332} y={104} width={56} height={52} rx={7} fill={accentColor("verified", 0.1)} stroke={accentColor("verified", 0.8)} strokeWidth={1.3} />
        <text x={360} y={124} fontSize={7} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.06em">
          MOVE
        </text>
        <text x={360} y={136} fontSize={7} textAnchor="middle" fill={accentInk("verified")} letterSpacing="0.06em">
          PACKET
        </text>
      </motion.g>
    </Frame>
  );
}

/* ── 6 · Home Continuum ────────────────────────────────────────────────────
   The move is one segment of a circle, not the whole circle. */

export function ContinuumScene() {
  const { ref, play, d } = useScene();
  const stages = ["MOVE", "ACTIVATION", "FIRST BILL", "WARRANTY", "RENEWAL", "NEXT MOVE"];
  const cx = 210;
  const cy = 130;
  const r = 86;
  return (
    <Frame svgRef={ref} label="The move as the first segment of a longer home relationship">
      {/* The house at the centre, holding the record. */}
      <path d="M186 138 L210 118 L234 138" stroke={accentColor("solar", 0.8)} strokeWidth={1.5} />
      <path d="M192 134 V152 H228 V134" stroke={accentColor("solar", 0.8)} strokeWidth={1.5} />
      <circle cx={210} cy={144} r={4} fill={accentColor("verified", 1)} />

      {stages.map((s, i) => {
        const a0 = (-90 + i * 60) * (Math.PI / 180);
        const a1 = (-90 + (i + 1) * 60) * (Math.PI / 180);
        const x0 = n(cx + Math.cos(a0) * r);
        const y0 = n(cy + Math.sin(a0) * r);
        const x1 = n(cx + Math.cos(a1) * r);
        const y1 = n(cy + Math.sin(a1) * r);
        const mid = (-90 + i * 60 + 30) * (Math.PI / 180);
        const lx = n(cx + Math.cos(mid) * (r + 20));
        const ly = n(cy + Math.sin(mid) * (r + 20));
        // Only the first segment is built. The rest are drawn as intent.
        const built = i === 0;
        return (
          <g key={s}>
            <motion.path
              d={`M${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
              stroke={built ? accentColor("verified", 0.95) : accentColor("solar", 0.45)}
              strokeWidth={built ? 2.4 : 1.3}
              strokeDasharray={built ? undefined : "4 5"}
              {...d(0.2 + i * 0.18, 0.7)}
            />
            <Pulse
              d={`M${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`}
              accent={built ? "verified" : "solar"}
              play={play}
              /* The built segment goes first and the rest follow round the
                 circle, so the eye reads a lifetime rather than six unrelated
                 arcs. */
              delay={2 + i * 0.5}
              duration={1.4}
              r={built ? 3 : 2.2}
            />
            <motion.text
              x={lx}
              y={ly + 3}
              fontSize={7}
              textAnchor="middle"
              fill={built ? accentInk("verified") : "rgba(255,255,255,0.5)"}
              letterSpacing="0.07em"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.45 + i * 0.18 }}
            >
              {s}
            </motion.text>
          </g>
        );
      })}
    </Frame>
  );
}

/* ── 7 · Agent Gateway ─────────────────────────────────────────────────────
   Four lanes. The one that is blocked is the product. */

export function GatewayScene() {
  const { ref, play, d } = useScene();
  const lanes: { verb: string; verdict: string; accent: Accent; blocked?: boolean; lock?: boolean }[] = [
    { verb: "READ", verdict: "ALLOWED", accent: "recovered" },
    { verb: "DRAFT", verdict: "ALLOWED", accent: "recovered" },
    { verb: "PROPOSE", verdict: "NEEDS APPROVAL", accent: "security", lock: true },
    { verb: "DECIDE", verdict: "BLOCKED", accent: "failed", blocked: true },
  ];
  return (
    <Frame svgRef={ref} label="An agent gateway allowing reads and drafts, gating proposals, and blocking decisions">
      <circle cx={26} cy={130} r={6} fill="rgba(255,255,255,0.6)" />
      <text x={8} y={152} fontSize={7} fill="rgba(255,255,255,0.55)" letterSpacing="0.08em">
        AGENT
      </text>

      {/* The boundary every lane must cross. */}
      <motion.path
        d="M214 20 V240"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={1.2}
        strokeDasharray="3 5"
        {...d(0, 0.7)}
      />
      <text x={214} y={14} fontSize={6.5} textAnchor="middle" fill="rgba(255,255,255,0.4)" letterSpacing="0.14em">
        AUTHORITY BOUNDARY
      </text>

      {lanes.map((l, i) => {
        const y = 52 + i * 52;
        return (
          <g key={l.verb}>
            <text x={40} y={y + 3} fontSize={8} fill="rgba(255,255,255,0.75)" letterSpacing="0.08em">
              {l.verb}
            </text>
            {/* Up to the boundary, always. */}
            <motion.path
              d={`M92 ${y} H208`}
              stroke={accentColor(l.accent, 0.55)}
              strokeWidth={1.3}
              strokeDasharray={l.lock ? "4 4" : undefined}
              {...d(0.3 + i * 0.14, 0.5)}
            />
            {/* Past it, only if permitted. */}
            {!l.blocked && (
              <motion.path
                d={`M220 ${y} H316`}
                stroke={accentColor(l.accent, 0.55)}
                strokeWidth={1.3}
                strokeDasharray={l.lock ? "4 4" : undefined}
                {...d(0.7 + i * 0.14, 0.5)}
              />
            )}

            {/*
              The pulses are the argument, not decoration.

              Every lane sends one at the boundary. READ and DRAFT continue
              through. PROPOSE continues only after a pause, which is the
              approval. DECIDE gets a pulse that reaches the boundary and stops
              — it is emitted, so a viewer sees the attempt, and it never
              crosses, so they see the refusal. Drawing no pulse at all would
              have looked like a lane nobody uses rather than one that is
              blocked.
            */}
            <Pulse
              d={`M92 ${y} H208`}
              accent={l.accent}
              play={play}
              delay={1.6 + i * 0.4}
              duration={1.3}
              r={2.3}
            />
            {!l.blocked && (
              <Pulse
                d={`M220 ${y} H316`}
                accent={l.accent}
                play={play}
                delay={(l.lock ? 3.4 : 3) + i * 0.4}
                duration={1.2}
                r={2.3}
              />
            )}
            {/* The stop. A cross on the boundary, not a line that fades out. */}
            {l.blocked && (
              <motion.g
                initial={{ opacity: 0, scale: 0.6 }}
                animate={play ? { opacity: 1, scale: 1 } : { opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 1.1 }}
                style={{ transformOrigin: `214px ${y}px` }}
              >
                <path d={`M206 ${y - 8} L222 ${y + 8} M222 ${y - 8} L206 ${y + 8}`} stroke={accentColor("failed", 1)} strokeWidth={2.2} />
              </motion.g>
            )}
            <motion.text
              x={l.blocked ? 232 : 324}
              y={y + 3}
              fontSize={7}
              fill={accentInk(l.accent)}
              letterSpacing="0.08em"
              initial={{ opacity: 0 }}
              animate={play ? { opacity: 1 } : { opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.9 + i * 0.14 }}
            >
              {l.verdict}
            </motion.text>
          </g>
        );
      })}
    </Frame>
  );
}

/* ── Closing · the three layers ────────────────────────────────────────────
   The whole argument, stacked. Read bottom to top. */

export function AuthorityStackScene() {
  const { ref, play, d } = useScene();
  const layers = [
    { label: "HUMAN AUTHORITY", note: "decides", accent: "security" as Accent, y: 30 },
    { label: "CONTROLLED INTELLIGENCE", note: "proposes", accent: "internet" as Accent, y: 108 },
    { label: "VERIFIED OPERATIONAL TRUTH", note: "records", accent: "verified" as Accent, y: 186 },
  ];
  return (
    <Frame svgRef={ref} label="Three layers: verified truth beneath controlled intelligence beneath human authority">
      {layers.map((l, i) => (
        <g key={l.label}>
          <motion.rect
            x={40}
            y={l.y}
            width={340}
            height={48}
            rx={9}
            fill={accentColor(l.accent, 0.09)}
            stroke={accentColor(l.accent, 0.65)}
            strokeWidth={1.3}
            initial={{ opacity: 0, y: 12 }}
            animate={play ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
            /* Bottom layer first: nothing above it is safe until it exists. */
            transition={{ duration: 0.5, delay: (layers.length - 1 - i) * 0.22 }}
          />
          <motion.text
            x={60}
            y={l.y + 29}
            fontSize={10}
            fill={accentInk(l.accent)}
            letterSpacing="0.12em"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : { opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2 + (layers.length - 1 - i) * 0.22 }}
          >
            {l.label}
          </motion.text>
          <motion.text
            x={360}
            y={l.y + 29}
            fontSize={8}
            textAnchor="end"
            fill="rgba(255,255,255,0.45)"
            letterSpacing="0.1em"
            initial={{ opacity: 0 }}
            animate={play ? { opacity: 1 } : { opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 + (layers.length - 1 - i) * 0.22 }}
          >
            {l.note}
          </motion.text>
        </g>
      ))}

      {/* Authority flows upward. Evidence flows down. */}
      {[78, 156].map((y, i) => (
        <g key={y}>
          <motion.path
            d={`M210 ${y + 30} V ${y + 2}`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.2}
            {...d(0.7 + i * 0.15, 0.35)}
          />
          {/*
            Travelling upward, and the lower connector fires first. Evidence
            rises from the record into intelligence, and from intelligence to
            the person who decides — which is the direction this whole stack is
            read in, and the reason it animates bottom-up.
          */}
          <Pulse
            d={`M210 ${y + 30} V ${y + 2}`}
            accent={i === 1 ? "verified" : "internet"}
            play={play}
            delay={1.4 + (1 - i) * 0.9}
            duration={0.9}
            r={2.4}
          />
        </g>
      ))}
    </Frame>
  );
}

/** Keyed by slug, so the page never carries a switch statement. */
export const SCENES: Record<string, () => React.JSX.Element> = {
  "move-relay": RelayScene,
  "adaptive-front-door": FrontDoorScene,
  "concierge-copilot": CopilotScene,
  "move-intelligence": IntelligenceScene,
  "partner-growth": PartnerScene,
  "home-continuum": ContinuumScene,
  "agent-gateway": GatewayScene,
};
