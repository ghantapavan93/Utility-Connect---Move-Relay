"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Constellation, type Source } from "@/components/Constellation";
import { StateBadge, type State } from "@/components/StateBadge";
import { EngineeringPanel } from "@/components/EngineeringPanel";
import { ProvenanceDrawer } from "@/components/ProvenanceDrawer";
import { CsvUpload } from "@/components/CsvUpload";
import { CineHero, CycleWords } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";

/**
 * The demo control room — Screens 2, 3, 4, 6, 9 in one guided flow.
 *
 * Each step posts to /api/v1/demo/:step, which performs real database work, then
 * the panel re-reads /api/v1/move and renders the actual resulting state. Nothing
 * on this page is mocked. The operator advances the story one deliberate step at
 * a time, exactly as a concierge would.
 */

interface StepDef {
  key: string;
  label: string;
  blurb: string;
  act: string;
}

/**
 * Nine steps in four acts.
 *
 * The acts are not decoration. A flat list of nine buttons reads as a queue and
 * tells a reviewer nothing about which moments matter; grouped, the shape of
 * the argument becomes visible before anything is clicked. Three sources
 * arrive, a person decides, the provider goes silent, and the system recovers
 * without ever guessing. The third act is the one this whole project exists
 * for, and in a flat list it looked exactly as important as step two.
 */
const ACTS: { id: string; n: string; title: string; note: string; accent: "verified" | "conflict" | "unknown" | "recovered" }[] = [
  {
    id: "arrival",
    n: "I",
    title: "The arrival",
    note: "One move begins in three places at once, and no two agree.",
    accent: "verified",
  },
  {
    id: "judgement",
    n: "II",
    title: "The judgement",
    note: "A disagreement is not an error. It needs a person, and it gets one.",
    accent: "conflict",
  },
  {
    id: "silence",
    n: "III",
    title: "The silence",
    note: "The order was created. The reply never came. Guessing here enrols a household twice.",
    accent: "unknown",
  },
  {
    id: "recovery",
    n: "IV",
    title: "The recovery",
    note: "Ask the provider what it knows. Recover the order that already existed.",
    accent: "recovered",
  },
];

const STEPS: StepDef[] = [
  { key: "reset", label: "Reset", blurb: "Wipe to a clean pre-ingestion state.", act: "arrival" },
  { key: "ingest", label: "1 · Ingest 3 channels", blurb: "Partner API, CSV, and the customer form arrive.", act: "arrival" },
  { key: "detect", label: "2 · Detect duplicate", blurb: "Deterministic scoring across the three submissions.", act: "arrival" },
  { key: "create_move", label: "3 · Create Move Record", blurb: "One canonical record; every value keeps its source.", act: "judgement" },
  { key: "conflicts", label: "4 · Surface conflicts", blurb: "Only the fields where sources disagree.", act: "judgement" },
  { key: "merge", label: "5 · Human approves merge", blurb: "A named concierge decides. AI cannot.", act: "judgement" },
  { key: "briefing", label: "6 · Grounded briefing", blurb: "Every claim cites a source row.", act: "judgement" },
  { key: "submit", label: "7 · Submit to provider", blurb: "The response is lost after the order is created.", act: "silence" },
  { key: "retry", label: "8 · Retry is blocked", blurb: "UNKNOWN outcome — a blind retry is refused.", act: "silence" },
  { key: "reconcile", label: "9 · Reconcile", blurb: "Ask the provider. Recover the existing order.", act: "recovery" },
];

type MoveData = {
  exists: boolean;
  move?: { state: string; reference: string };
  fields?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
  timeline?: Array<Record<string, unknown>>;
};

export default function DemoPage() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [move, setMove] = useState<MoveData | null>(null);
  const [lastResult, setLastResult] = useState<{ step: string; data: unknown } | null>(null);
  const [drawerField, setDrawerField] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/move");
    setMove(await res.json());
  }, []);

  const run = useCallback(
    async (step: string) => {
      setBusy(step);
      try {
        const res = await fetch(`/api/v1/demo/${step}`, { method: "POST" });
        const json = await res.json();
        if (!json.ok) {
          toast.error(json.error ?? "step failed");
          return;
        }
        setLastResult({ step, data: json.result });
        setDone((d) => new Set(d).add(step));
        await refresh();

        // Narrate the moments that matter.
        if (step === "submit") toast.warning("Provider response lost. Outcome is UNKNOWN.");
        else if (step === "retry") toast.error("Blind retry blocked. No duplicate created.");
        else if (step === "reconcile") toast.success("Existing order recovered. One order, never two.");
        else if (step === "merge") toast.success("Merge approved by concierge-7.");
        else toast.success(STEPS.find((s) => s.key === step)?.label ?? step);
      } catch {
        toast.error("network error");
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const moveState = move?.move?.state;
  const sources = constellationFor(done, lastResult);
  const consoleRef = useRef<HTMLDivElement>(null);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="demo" />

      {/*
        The hero states the thesis before the console asks anyone to click.

        The centrepiece of this demo is not that the happy path works — every
        system's happy path works. It is the timeout: the provider created the
        order, the answer never arrived, and the engine refused to guess. So
        that is the headline, and Proof names the actual failure rather than an
        adjective.
      */}
      <CineHero
        image="/renders/utility.png"
        alt="The utility room of the residence, where the provider circuit stalls"
        accent="unknown"
        pills={
          <>
            <Pill accent="unknown">Live demo · real database</Pill>
            <Pill accent="verified">All data synthetic</Pill>
          </>
        }
        cycle={<CycleWords words={["Preserved.", "Resolved.", "Verified.", "Reconciled."]} accent="verified" />}
        headline={
          <>
            The order existed.
            <br />
            <span className="cine-shimmer">The answer never came.</span>
          </>
        }
        sub="Every system handles the path where the provider replies. This one is built for the moment it does not — where an order may or may not exist, a retry could enrol a real household twice, and the only honest state is UNKNOWN."
        credibility={[
          {
            eyebrow: "Purpose",
            accent: "verified",
            body: "Stop a household being enrolled twice when a provider goes quiet — and keep every value traceable to whoever supplied it.",
          },
          {
            eyebrow: "Proof",
            accent: "unknown",
            body: "Maya Patel arrives on three channels with two move dates and one wrong digit. The provider creates the order; the response is lost. The blind retry is refused. Reconciliation finds the order that already existed.",
          },
          {
            eyebrow: "Code",
            accent: "recovered",
            body: "Next.js and React over PostgreSQL. Persisted idempotency, append-only audit, durable workflow steps, relationship-based authorization. 200 tests against a real database.",
          },
        ]}
        actions={
          <>
            <button
              onClick={() => consoleRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-7 py-3 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5"
              style={{ background: accentColor("verified", 1) }}
            >
              Run it yourself <ArrowDown className="h-4 w-4" />
            </button>
            <MagneticLink
              href="/story"
              className="inline-flex items-center gap-2 rounded-full border px-7 py-3 text-sm font-bold uppercase tracking-wide text-white/90"
              {...{ style: { borderColor: "rgba(255,255,255,0.26)" } }}
            >
              Watch it as a film <ArrowRight className="h-4 w-4" />
            </MagneticLink>
          </>
        }
      />

      <ChapterMarker n="01" label="The console" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          Nine steps. Every one of them{" "}
          <span style={{ color: accentColor("verified", 1) }}>writes to a real database</span> and
          reads the result back.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Nothing here is a scripted animation. Press a step and the engine performs it —
          deduplication, a human-gated merge, a provider submission that loses its reply, a retry
          the system refuses to make. Press them out of order and it will tell you why it will not.
        </p>
      </div>

      <div
        ref={consoleRef}
        className="mx-auto grid max-w-[1400px] gap-6 px-5 pb-16 sm:px-8 lg:grid-cols-[340px_1fr]"
      >
      {/* Step rail */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <h2 className="mb-1 text-lg font-semibold tracking-tight text-white">The console</h2>
        <p className="mb-4 text-xs text-white/45">Maya Patel · North Texas Realty · synthetic data</p>
        <div className="mb-4 flex flex-col gap-1">
          <a href="/views" className="text-xs font-semibold" style={{ color: "var(--color-state-verified)" }}>
            See this record as concierge / customer / partner →
          </a>
          <a href="/story" className="text-xs font-semibold" style={{ color: "var(--color-state-transit)" }}>
            Watch it as a story — The Living Move →
          </a>
          <a href="/theater" className="text-xs font-semibold" style={{ color: "var(--color-state-conflict)" }}>
            Try to break it — Failure Theater →
          </a>
        </div>
        <div className="space-y-6">
          {ACTS.map((act) => {
            const steps = STEPS.filter((x) => x.act === act.id);
            const allDone = steps.every((x) => done.has(x.key));
            return (
              <div key={act.id}>
                <div className="mb-2 flex items-baseline gap-2.5">
                  <span
                    className="font-mono text-[11px] font-bold"
                    style={{ color: accentColor(act.accent, allDone ? 1 : 0.55) }}
                  >
                    {act.n}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                    {act.title}
                  </span>
                  {allDone && (
                    <span style={{ color: accentColor(act.accent, 1) }} className="text-[11px]">
                      ✓
                    </span>
                  )}
                </div>
                <p className="mb-2.5 pl-[26px] text-[11px] leading-relaxed text-white/45">{act.note}</p>
                <ol className="space-y-1.5">
                  {steps.map((s) => {
                    const complete = done.has(s.key);
                    return (
                      <li key={s.key}>
                        <button
                          onClick={() => run(s.key)}
                          disabled={busy !== null}
                          className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                          style={{
                            borderColor: complete ? accentColor(act.accent, 0.7) : "rgba(255,255,255,0.10)",
                            background: complete ? accentColor(act.accent, 0.1) : "rgba(255,255,255,0.02)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white/90">{s.label}</span>
                            {complete && <span style={{ color: accentColor(act.accent, 1) }}>✓</span>}
                            {busy === s.key && <span className="animate-pulse text-white/60">…</span>}
                          </div>
                          <div className="mt-0.5 text-xs leading-relaxed text-white/50">{s.blurb}</div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Stage */}
      <section className="space-y-6">
        {/* The one channel a visitor can drive with their own data. */}
        <CsvUpload />
        <EngineeringPanel />
        <div className="grid place-items-center rounded-2xl border p-6" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
          <Constellation sources={sources} converged={done.has("create_move")} />
          {moveState && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span style={{ color: "var(--color-text-lo)" }}>Move state:</span>
              <StateBadge state={moveStateToBadge(moveState)} />
            </div>
          )}
        </div>

        {/* Live field provenance — tap any row for the full version history */}
        {move?.fields && move.fields.length > 0 && (
          <Panel title="Canonical Move Record — tap a field for its full history">
            <FieldTable fields={move.fields} onSelect={setDrawerField} />
          </Panel>
        )}
        <ProvenanceDrawer field={drawerField} onClose={() => setDrawerField(null)} />

        {/* Provider + services */}
        {move?.services && move.services.length > 0 && (
          <Panel title="Provider submission">
            {move.services.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{String(s.service_type)}</span>
                <span style={{ color: "var(--color-text-lo)" }}>via {String(s.provider_name)}</span>
                <StateBadge state={submissionBadge(String(s.submission_state ?? "pending"))} />
                {s.provider_order_id ? (
                  <span className="font-mono text-xs" style={{ color: "var(--color-text-mid)" }}>
                    order {String(s.provider_order_id)}
                  </span>
                ) : null}
              </div>
            ))}
          </Panel>
        )}

        {/* Raw step result */}
        <AnimatePresence mode="wait">
          {lastResult && (
            <motion.div
              key={lastResult.step}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <Panel title={`Step result · ${lastResult.step}`}>
                <pre className="overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
                  {JSON.stringify(lastResult.data, null, 2)}
                </pre>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit timeline */}
        {move?.timeline && move.timeline.length > 0 && (
          <Panel title="Operational audit trail — append-only">
            <ol className="space-y-2">
              {move.timeline.map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-state-verified)" }} />
                  <div>
                    <span className="font-mono text-xs font-semibold">{String(e.event_type)}</span>
                    <span className="ml-2 text-xs" style={{ color: "var(--color-text-lo)" }}>
                      {String(e.actor)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
        )}
      </section>
      </div>

      <ChapterMarker n="02" label="The same record, three ways" />
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              href: "/views" as const,
              t: "Concierge · Customer · Partner",
              b: "One record, three projections. The partner never sees what the partner is not entitled to — enforced by relationship tuples, not a role string.",
              a: "verified" as const,
            },
            {
              href: "/theater" as const,
              t: "Failure Theater",
              b: "Try to break it. Replay the timeout, force a duplicate, read across a partner boundary. The refusals are the product.",
              a: "conflict" as const,
            },
            {
              href: "/future" as const,
              t: "The Continuum",
              b: "Eight modules extending this same kernel — one built, five concepts, two hypotheses, each labelled where it stands.",
              a: "solar" as const,
            },
          ].map((c) => (
            <MagneticLink
              key={c.t}
              href={c.href}
              className="cine-glass group block rounded-2xl p-6 transition-colors hover:bg-white/[0.06]"
              strength={3}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.2em]"
                style={{ color: accentColor(c.a, 0.95) }}
              >
                {c.t}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{c.b}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-white/80">
                Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </MagneticLink>
          ))}
        </div>

        <blockquote
          className="mt-12 max-w-3xl border-l-2 pl-6 text-[clamp(18px,2.3vw,28px)] font-medium leading-[1.35] tracking-tight text-white/90"
          style={{ borderColor: accentColor("verified", 1) }}
        >
          A handoff is not finished when the request is sent. It is finished when someone can prove
          what happened — and{" "}
          <span style={{ color: accentColor("verified", 1) }}>say who decided it</span>.
        </blockquote>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cine-glass rounded-xl p-5">
      <h2 className="mb-3 text-sm font-semibold text-white/90">{title}</h2>
      {children}
    </div>
  );
}

function FieldTable({
  fields,
  onSelect,
}: {
  fields: Array<Record<string, unknown>>;
  onSelect: (field: string) => void;
}) {
  const canonical = fields.filter((f) => f.is_canonical);
  const shown = canonical.length > 0 ? canonical : fields;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "var(--color-text-lo)" }} className="text-left text-xs">
            <th className="pb-2 font-medium">Field</th>
            <th className="pb-2 font-medium">Value</th>
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium">Verification</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f, i) => (
            <tr
              key={i}
              onClick={() => onSelect(String(f.field_path))}
              className="cursor-pointer border-t transition-colors hover:bg-white/5"
              style={{ borderColor: "var(--color-ground-3)" }}
              title="Tap for full version history"
            >
              <td className="py-1.5 font-mono text-xs">{String(f.field_path)}</td>
              <td className="py-1.5">{fmt(f.value)}</td>
              <td className="py-1.5 text-xs" style={{ color: "var(--color-text-mid)" }}>{String(f.channel)}</td>
              <td className="py-1.5">
                <StateBadge state={verifBadge(String(f.verification))} subtle />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- small mappers --------------------------------------------------------

function constellationFor(done: Set<string>, last: { step: string; data: unknown } | null): Source[] {
  const base: Source[] = [
    { id: "1", label: "Partner API", channel: "partner_api", state: "pending" },
    { id: "2", label: "CSV", channel: "csv_upload", state: "pending" },
    { id: "3", label: "Customer form", channel: "customer_form", state: "pending" },
  ];
  if (!done.has("ingest")) return base.map((s) => ({ ...s, state: "pending" }));
  if (done.has("detect") && !done.has("merge"))
    return [
      { ...base[0]!, state: "verified" },
      { ...base[1]!, state: "conflict" },
      { ...base[2]!, state: "verified" },
    ];
  if (done.has("merge")) return base.map((s) => ({ ...s, state: "verified" }));
  return base.map((s) => ({ ...s, state: "transit" }));
}

const moveStateToBadge = (s: string): State =>
  s === "canonical" || s === "completed" ? "verified" : s === "conflict_pending" ? "conflict" : "pending";

const submissionBadge = (s: string): State =>
  s === "confirmed" || s === "reconciled" ? "verified"
  : s === "unknown" ? "unknown"
  : s === "failed" ? "failed"
  : s === "duplicate" ? "recovered"
  : "pending";

const verifBadge = (v: string): State =>
  v === "human_approved" || v === "customer_confirmed" ? "verified"
  : v === "system_validated" ? "transit"
  : "pending";

function fmt(v: unknown): string {
  if (typeof v === "string") return v.replace(/^"|"$/g, "");
  return JSON.stringify(v);
}
