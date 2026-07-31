"use client";

import { motion } from "framer-motion";
import { EASE } from "@/lib/motion";
import {
  DataBadge,
  PhaseScrubber,
  Stage,
  accentColor,
  useInteractivePhase,
  useLiveData,
  type Accent,
} from "./index";

/**
 * The operable mockups for the Continuum modules.
 *
 * A vision page fails in one specific way: it becomes paragraphs of confident
 * prose about things that do not exist. The fix is to show each idea *running*
 * — a small, honest, moving diagram of the mechanism — so a reader can judge
 * whether the thing is coherent instead of whether the sentence is. Each one is
 * deliberately a mechanism rather than a screenshot of an imagined UI:
 * screenshots of software that does not exist are the least honest thing a
 * vision page can contain, while a diagram of how something would work is a
 * claim you can argue with.
 *
 * They autoplay so a visitor who scrolls past gets the mechanism for free, and
 * the moment anyone clicks a dot or presses an arrow key the autoplay stops for
 * good and they are driving. A control that keeps moving under your hand is
 * worse than one that never moved.
 *
 * ## What the badges mean, and why they were wrong
 *
 * Two of these read a real endpoint of the shipped system and name it on the
 * badge: the relay diagram counts real rows, and the copilot diagram lists the
 * evaluation cases the agent is actually held to. The rest say CONCEPT · NOT
 * WIRED and animate a timer.
 *
 * That distinction is the whole point of the badge, and until now none of it
 * was true. This file was imported by nothing — 500 lines of diagrams no route
 * rendered — while its own header claimed three of them read live endpoints.
 * Every one wore a hardcoded `LIVE · INGEST` chip driven by `setInterval`, and
 * the reliability diagram printed invented provider latencies under the caption
 * "measured, not predicted". Dead code is where claims go to stop being
 * checked. The diagrams are on the module pages now, the chips are gone, and
 * the two that say "live" are the two that can prove it.
 */

/* ── shared bits ──────────────────────────────────────────────────────────── */

/**
 * The smallest type any of these diagrams is allowed to use.
 *
 * An SVG scales rather than reflows, so this is a size in viewBox units and
 * what a reader gets is that number times the fit scale. These boxes are 520 ×
 * 400 in a 380px-tall stage, which pins the scale near 0.95 once `Diagram`
 * stops them shrinking below 1:1 — so 11 lands just over ten physical pixels
 * and 9, the previous value, landed under it on every screen size including
 * desktop. The mobile sweep measures the rendered figure rather than this one.
 */
const LABEL_PX = 11;

/**
 * A diagram that stays legible instead of staying fully visible.
 *
 * Below about 550px the honest options are unreadable type or a sideways
 * scroll inside the frame, and the second one is the only one a person can
 * actually use. The stage clips, so the scroll has to live here rather than on
 * a parent.
 */
function Diagram({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full w-full overflow-x-auto">
      <svg viewBox={VB} className="h-full w-full min-w-[520px]">
        {children}
      </svg>
    </div>
  );
}

function Label({ children, x, y, dim }: { children: string; x: number; y: number; dim?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className="font-mono"
      style={{
        fontSize: LABEL_PX,
        fill: dim ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.75)",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </text>
  );
}

function Node({ cx, cy, r = 9, accent, on }: { cx: number; cy: number; r?: number; accent: Accent; on: boolean }) {
  return (
    <>
      {on && <circle cx={cx} cy={cy} r={r + 7} fill={accentColor(accent, 0.16)} />}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={on ? accentColor(accent, 0.9) : "rgba(255,255,255,0.10)"}
        stroke={on ? accentColor(accent, 1) : "rgba(255,255,255,0.22)"}
        strokeWidth={1.5}
      />
    </>
  );
}

function Wire({ d, accent, on, dashed }: { d: string; accent: Accent; on: boolean; dashed?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={on ? accentColor(accent, 0.8) : "rgba(255,255,255,0.14)"}
      strokeWidth={on ? 2 : 1.2}
      strokeDasharray={dashed ? "4 4" : undefined}
    />
  );
}

const VB = "0 0 520 400";

/* ── what a live read has to look like before a badge may say "live" ──────── */

/**
 * The shape guards, one per wired diagram.
 *
 * `useLiveData` will not report `ready` without one, which is the point: the
 * badge is a claim that a real payload arrived, and the only way to keep that
 * claim honest is to make the diagram state what "real" means for it before it
 * is allowed to say so.
 */

export interface RelayCounts {
  activeMoves: number;
  canonicalMoves: number;
  providerSubmissions: number;
  duplicatesPrevented: number;
}

function isStatsBody(b: unknown): b is { stats: RelayCounts } {
  if (typeof b !== "object" || b === null || !("stats" in b)) return false;
  const s = (b as { stats: unknown }).stats;
  if (typeof s !== "object" || s === null) return false;
  return (["activeMoves", "canonicalMoves", "providerSubmissions", "duplicatesPrevented"] as const).every(
    (k) => typeof (s as Record<string, unknown>)[k] === "number",
  );
}

export interface EvalCase {
  name: string;
  hypothesis: string;
  adversarial: boolean;
}

function isEvalBody(b: unknown): b is { cases: EvalCase[] } {
  if (typeof b !== "object" || b === null || !("cases" in b)) return false;
  const c = (b as { cases: unknown }).cases;
  return (
    Array.isArray(c) &&
    c.length > 0 &&
    c.every((x) => typeof x?.name === "string" && typeof x?.hypothesis === "string")
  );
}

/* ── 1 · Move Relay — the shipped spine ───────────────────────────────────── */

export function RelayVisual() {
  const ctl = useInteractivePhase(4, 1500);
  const p = ctl.phase;
  /*
    The one module of the Continuum that is not a proposal. So its diagram
    reads the tenant it is drawing: the counts below are `SELECT count(*)`
    over the same tables the dashboard renders, and if the demo has never
    been run they are zeroes rather than illustrative figures.
  */
  const live = useLiveData<{ stats: RelayCounts }>("/api/v1/stats", isStatsBody);
  const s = live.data?.stats;
  return (
    <Stage
      accent="verified"
      height={380}
      stageRef={live.ref}
      badge={<DataBadge endpoint="/api/v1/stats" state={live.state} reason={live.reason} />}
    >
      <Diagram>
        {[
          { y: 90, label: "PARTNER API" },
          { y: 175, label: "CSV UPLOAD" },
          { y: 260, label: "CUSTOMER FORM" },
        ].map((s, i) => (
          <g key={s.label}>
            <Node cx={90} cy={s.y} accent="verified" on={p >= 1} />
            <Label x={90} y={s.y - 22}>{s.label}</Label>
            <Wire d={`M100 ${s.y} C 180 ${s.y}, 200 175, 250 175`} accent="verified" on={p >= 1 + (i === 2 ? 0 : 0)} />
          </g>
        ))}
        {/* the canonical record */}
        <Node cx={264} cy={175} r={16} accent={p >= 3 ? "verified" : "conflict"} on={p >= 2} />
        <Label x={264} y={218} dim={p < 2}>CANONICAL RECORD</Label>
        {p === 2 && <Label x={264} y={140}>CONFLICT · AWAITING HUMAN</Label>}
        {p >= 3 && <Label x={264} y={140}>VERIFIED</Label>}
        <Wire d="M282 175 L 400 175" accent="verified" on={p >= 3} />
        <Node cx={412} cy={175} accent="verified" on={p >= 3} />
        <Label x={412} y={218} dim={p < 3}>PROVIDER</Label>

        {/*
          The counts, rendered only once a validated body arrived. A diagram
          that drew "0" while the read was still in flight would be making the
          claim it exists to avoid - and a zero is a real answer here, so it
          cannot double as a placeholder.
        */}
        {s && (
          <g>
            <Label x={90} y={330}>{`${s.providerSubmissions} SUBMISSIONS`}</Label>
            <Label x={264} y={330}>{`${s.canonicalMoves} OF ${s.activeMoves} CANONICAL`}</Label>
            <Label x={412} y={330}>{`${s.duplicatesPrevented} DUPLICATES BLOCKED`}</Label>
            <text
              x={260}
              y={362}
              textAnchor="middle"
              style={{ fontSize: LABEL_PX, fill: "rgba(255,255,255,0.42)" }}
            >
              counted from the live tenant, not illustrated
            </text>
          </g>
        )}
      </Diagram>

      <PhaseScrubber
        count={4}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="verified"
          labels={["Idle", "Three channels arrive", "Conflict held", "Human verified"]}
      />
    </Stage>
  );
}

/* ── 2 · Concierge Compiler ───────────────────────────────────────────────── */

export function ConciergeVisual() {
  const ctl = useInteractivePhase(4, 1500);
  const p = ctl.phase;
  const lines = [
    { t: "“We move in on the 14th.”", fact: "move_date = Aug 14", ok: true },
    { t: "“…actually the 16th, sorry.”", fact: "move_date = Aug 16", ok: true },
    { t: "“Put us on the cheapest plan.”", fact: "no fact — preference", ok: false },
  ];
  /*
    The transcript above is illustrative and says so; the panel below it is
    not. It reads the guardrail cases the shipped copilot is evaluated
    against, so the claim "the AI proposes, it never commits" is followed
    immediately by the list of tests that would fail if it ever did.
  */
  const live = useLiveData<{ cases: EvalCase[] }>("/api/v1/agent/evals", isEvalBody);
  return (
    <Stage
      accent="internet"
      height={380}
      stageRef={live.ref}
      badge={<DataBadge endpoint="/api/v1/agent/evals" state={live.state} reason={live.reason} />}
    >
      <div className="flex h-full flex-col gap-2 p-5">
        {lines.map((l, i) => (
          <motion.div
            key={i}
            animate={{ opacity: p > i ? 1 : 0.25 }}
            transition={{ duration: 0.4, ease: EASE.outCubic }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <div className="text-[12px] text-white/80">{l.t}</div>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-px w-4" style={{ background: accentColor("internet", 0.6) }} />
              <span
                className="font-mono text-[10px]"
                style={{ color: l.ok ? accentColor("verified", 0.95) : "rgba(255,255,255,0.4)" }}
              >
                {l.fact}
              </span>
            </div>
          </motion.div>
        ))}
        <motion.div
          animate={{ opacity: p >= 3 ? 1 : 0.2 }}
          className="mt-auto rounded-xl border p-3"
          style={{ borderColor: accentColor("conflict", 0.4), background: accentColor("conflict", 0.08) }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentColor("conflict", 0.95) }}>
            Human confirms before the record moves
          </div>
          <div className="mt-1 text-[11px] text-white/60">
            Every fact carries the utterance it came from. The AI proposes; it never commits.
          </div>
          {live.data && (
            <div className="mt-2 border-t border-white/10 pt-2 font-mono text-[9px] leading-relaxed text-white/50">
              held to {live.data.cases.length} guardrail case
              {live.data.cases.length === 1 ? "" : "s"} today
              {live.data.cases.some((c) => c.adversarial) && ", including planted instructions"} —{" "}
              {live.data.cases[0]!.name}
            </div>
          )}
        </motion.div>
      </div>

      <PhaseScrubber
        count={4}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="internet"
          labels={["Silent", "First fact", "Correction", "Human confirms"]}
      />
    </Stage>
  );
}

/* ── 3 · Move Wallet & Offer Graph ────────────────────────────────────────── */

export function WalletVisual() {
  const ctl = useInteractivePhase(3, 1800);
  const p = ctl.phase;
  const offers = [
    { name: "Electricity · 12mo fixed", why: "eligible: verified address", ok: true },
    { name: "Internet · 500Mb", why: "eligible: serviceable", ok: true },
    { name: "Security monitoring", why: "not eligible: no consent on file", ok: false },
  ];
  return (
    <Stage accent="electricity" height={380} badge={<DataBadge />}>
      <div className="flex h-full flex-col gap-2.5 p-5">
        {offers.map((o, i) => (
          <motion.div
            key={o.name}
            animate={{ opacity: p >= i ? 1 : 0.2, x: p >= i ? 0 : -6 }}
            transition={{ duration: 0.45, ease: EASE.outQuart }}
            className="flex items-center justify-between rounded-xl border p-3"
            style={{
              borderColor: o.ok ? accentColor("verified", 0.3) : "rgba(255,255,255,0.10)",
              background: o.ok ? accentColor("verified", 0.06) : "rgba(255,255,255,0.02)",
            }}
          >
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-white/85">{o.name}</div>
              <div className="mt-0.5 font-mono text-[9px] text-white/45">{o.why}</div>
            </div>
            <span
              className="ml-3 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                background: o.ok ? accentColor("verified", 0.15) : "rgba(255,255,255,0.06)",
                color: o.ok ? accentColor("verified", 1) : "rgba(255,255,255,0.45)",
              }}
            >
              {o.ok ? "eligible" : "withheld"}
            </span>
          </motion.div>
        ))}
        <div className="mt-auto font-mono text-[10px] leading-relaxed text-white/45">
          Rules decide eligibility. AI may explain an offer.
          <br />
          It may never invent a discount or rank providers by who paid.
        </div>
      </div>
    
      <PhaseScrubber
        count={3}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="electricity"
          labels={["Electricity", "Internet", "Security withheld"]}
      />
    </Stage>
  );
}

/* ── 4 · Network Launchpad ────────────────────────────────────────────────── */

export function LaunchpadVisual() {
  const steps = ["SAMPLE", "MAP", "VALIDATE", "CONTRACT", "DRY RUN", "APPROVE", "LIVE"];
  const ctl = useInteractivePhase(steps.length + 1, 900);
  const p = ctl.phase;
  return (
    <Stage accent="verified" height={380} badge={<DataBadge />}>
      <div className="flex h-full flex-col justify-center gap-6 p-6">
        <div className="flex items-center">
          {steps.map((s, i) => {
            const done = p > i;
            const isApprove = s === "APPROVE";
            return (
              <div key={s} className="flex min-w-0 flex-1 items-center">
                <div className="flex flex-col items-center gap-2">
                  <motion.span
                    animate={{ scale: p === i + 1 ? 1.18 : 1 }}
                    transition={{ duration: 0.3, ease: EASE.outQuart }}
                    className="flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold"
                    style={{
                      borderColor: done ? accentColor(isApprove ? "conflict" : "verified", 0.8) : "rgba(255,255,255,0.18)",
                      background: done ? accentColor(isApprove ? "conflict" : "verified", 0.18) : "transparent",
                      color: done ? accentColor(isApprove ? "conflict" : "verified", 1) : "rgba(255,255,255,0.4)",
                    }}
                  >
                    {i + 1}
                  </motion.span>
                  <span className="font-mono text-[8px] tracking-wide text-white/50">{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <span
                    className="mx-1 h-px flex-1"
                    style={{ background: p > i + 1 ? accentColor("verified", 0.6) : "rgba(255,255,255,0.12)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
        <motion.div
          animate={{ opacity: p >= 6 ? 1 : 0.3 }}
          className="rounded-xl border p-3 text-center"
          style={{ borderColor: accentColor("conflict", 0.35), background: accentColor("conflict", 0.07) }}
        >
          <span className="text-[11px] text-white/75">
            Step 6 is a person. Nothing reaches <span className="font-semibold text-white">LIVE</span> without one.
          </span>
        </motion.div>
      </div>
    
      <PhaseScrubber
        count={steps.length + 1}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="verified"
      />
    </Stage>
  );
}

/* ── 5 · Scenario Compiler ────────────────────────────────────────────────── */

export function ScenarioVisual() {
  const ctl = useInteractivePhase(4, 1400);
  const p = ctl.phase;
  const rows = [
    { name: "duplicate across 3 channels", state: "pass" },
    { name: "provider timeout → UNKNOWN", state: "pass" },
    { name: "blind retry attempted", state: "blocked" },
    { name: "partner reads another partner", state: "denied" },
  ];
  return (
    <Stage accent="recovered" height={380} badge={<DataBadge />}>
      <div className="flex h-full flex-col p-5">
        <div className="rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[10px] text-white/70">
          <span className="text-white/40">$</span> compile &quot;a partner sends a duplicate, the provider times out&quot;
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {rows.map((r, i) => {
            const shown = p > i;
            const tone: Accent = r.state === "pass" ? "recovered" : r.state === "blocked" ? "unknown" : "security";
            return (
              <motion.div
                key={r.name}
                animate={{ opacity: shown ? 1 : 0.18, x: shown ? 0 : -8 }}
                transition={{ duration: 0.35, ease: EASE.outQuart }}
                className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
              >
                <span className="truncate text-[11px] text-white/75">{r.name}</span>
                <span
                  className="ml-3 shrink-0 font-mono text-[9px] font-bold uppercase"
                  style={{ color: accentColor(tone, 1) }}
                >
                  {r.state}
                </span>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-auto font-mono text-[10px] text-white/45">
          scenario.test.ts already runs this shape against a real database.
        </div>
      </div>
    
      <PhaseScrubber
        count={4}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="recovered"
          labels={["Compile", "Duplicate", "Timeout", "Retry blocked"]}
      />
    </Stage>
  );
}

/* ── 6 · Home Continuum ───────────────────────────────────────────────────── */

export function TimelineVisual() {
  const ctl = useInteractivePhase(5, 1500);
  const p = ctl.phase;
  const beats = [
    { t: "MOVE-IN", d: "day 0" },
    { t: "ACTIVATION CHECK", d: "day 3" },
    { t: "PLAN REVIEW", d: "month 6" },
    { t: "RENEWAL WINDOW", d: "month 11" },
    { t: "NEXT MOVE", d: "year 2" },
  ];
  return (
    <Stage accent="solar" height={380} badge={<DataBadge />}>
      <Diagram>
        <line x1="60" y1="200" x2="460" y2="200" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" />
        <motion.line
          x1="60"
          y1="200"
          x2={60 + (400 * Math.min(p, 4)) / 4}
          y2="200"
          stroke={accentColor("solar", 0.85)}
          strokeWidth="2.5"
          transition={{ duration: 0.6, ease: EASE.outQuart }}
        />
        {beats.map((b, i) => {
          const x = 60 + (400 * i) / 4;
          const on = p >= i;
          return (
            <g key={b.t}>
              <Node cx={x} cy={200} r={on ? 8 : 5} accent="solar" on={on} />
              <Label x={x} y={i % 2 ? 240 : 175} dim={!on}>{b.t}</Label>
              <Label x={x} y={i % 2 ? 254 : 161} dim>{b.d}</Label>
            </g>
          );
        })}
        <text x="260" y="330" textAnchor="middle" style={{ fontSize: LABEL_PX, fill: "rgba(255,255,255,0.45)" }}>
          Consent is re-checked at every beat, not assumed from the first.
        </text>
      </Diagram>
    
      <PhaseScrubber
        count={5}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="solar"
          labels={["Move-in", "Activation", "Plan review", "Renewal", "Next move"]}
      />
    </Stage>
  );
}

/*
  ── 7 · Provider Reliability Graph — removed, on purpose ───────────────────

  This slot held a bar chart of three providers with hardcoded latencies and
  unknown-outcome rates, captioned "measured, not predicted" and "the numbers
  are what actually happened on real handoffs". None of it had ever touched a
  database. It survived because nothing rendered it, which is the argument
  against keeping unreachable code: a claim no one can see is a claim no one
  checks.

  There is no honest version of it here. The real objectives are computed by
  `lib/slo.ts` and already rendered live on /reliability, breaches and all, so
  a second drawing of the same thing could only be a worse copy. Deleted rather
  than rewritten.
*/

/* ── 7 · Service Continuity Graph ─────────────────────────────────────────── */

export function ContinuityVisual() {
  const ctl = useInteractivePhase(4, 1500);
  const p = ctl.phase;
  return (
    <Stage accent="security" height={380} badge={<DataBadge />}>
      <Diagram>
        <Node cx={110} cy={200} r={14} accent="verified" on={p >= 0} />
        <Label x={110} y={240}>MOVE RECORD</Label>

        {[
          { y: 100, label: "AUTHORIZED NEED" },
          { y: 200, label: "CONSENT CHECK" },
          { y: 300, label: "VENDOR WORKFLOW" },
        ].map((row, i) => (
          <g key={row.label}>
            <Wire d={`M126 200 C 190 200, 200 ${row.y}, 260 ${row.y}`} accent="security" on={p > i} dashed={i === 2} />
            <Node cx={274} cy={row.y} accent="security" on={p > i} />
            <Label x={274} y={row.y - 22} dim={p <= i}>{row.label}</Label>
          </g>
        ))}

        <Wire d="M290 200 L 400 200" accent="security" on={p >= 3} dashed />
        <rect
          x={392}
          y={168}
          width={72}
          height={64}
          rx={10}
          fill={p >= 3 ? accentColor("security", 0.12) : "rgba(255,255,255,0.03)"}
          stroke={p >= 3 ? accentColor("security", 0.5) : "rgba(255,255,255,0.14)"}
        />
        <Label x={428} y={196} dim={p < 3}>VENDOR</Label>
        <Label x={428} y={210} dim={p < 3}>HUB</Label>
        <text x="260" y="365" textAnchor="middle" style={{ fontSize: LABEL_PX, fill: "rgba(255,255,255,0.45)" }}>
          Two products, shared primitives. The dashed edge is the one not built.
        </text>
      </Diagram>
    
      <PhaseScrubber
        count={4}
        phase={ctl.phase}
        goTo={ctl.goTo}
        next={ctl.next}
        prev={ctl.prev}
        accent="security"
          labels={["Need", "Consent", "Workflow", "Vendor hub"]}
      />
    </Stage>
  );
}
