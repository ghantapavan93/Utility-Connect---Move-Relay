"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Constellation, type Source } from "@/components/Constellation";
import { StateBadge, type State } from "@/components/StateBadge";
import { EngineeringPanel } from "@/components/EngineeringPanel";

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
}

const STEPS: StepDef[] = [
  { key: "reset", label: "Reset", blurb: "Wipe to a clean pre-ingestion state." },
  { key: "ingest", label: "1 · Ingest 3 channels", blurb: "Partner API, CSV, and the customer form arrive." },
  { key: "detect", label: "2 · Detect duplicate", blurb: "Deterministic scoring across the three submissions." },
  { key: "create_move", label: "3 · Create Move Record", blurb: "One canonical record; every value keeps its source." },
  { key: "conflicts", label: "4 · Surface conflicts", blurb: "Only the fields where sources disagree." },
  { key: "merge", label: "5 · Human approves merge", blurb: "A named concierge decides. AI cannot." },
  { key: "briefing", label: "6 · Grounded briefing", blurb: "Every claim cites a source row." },
  { key: "submit", label: "7 · Submit to provider", blurb: "The response is lost after the order is created." },
  { key: "retry", label: "8 · Retry is blocked", blurb: "UNKNOWN outcome — a blind retry is refused." },
  { key: "reconcile", label: "9 · Reconcile", blurb: "Ask the provider. Recover the existing order." },
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

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[320px_1fr]">
      {/* Step rail */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <h1 className="mb-1 text-lg font-semibold tracking-tight">Move Relay — live demo</h1>
        <p className="mb-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
          Maya Patel · North Texas Realty · synthetic data
        </p>
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
        <ol className="space-y-1.5">
          {STEPS.map((s) => {
            const complete = done.has(s.key);
            return (
              <li key={s.key}>
                <button
                  onClick={() => run(s.key)}
                  disabled={busy !== null}
                  className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
                  style={{
                    borderColor: complete ? "var(--color-state-verified)" : "var(--color-ground-3)",
                    background: complete ? "color-mix(in oklab, var(--color-state-verified) 10%, transparent)" : "var(--color-ground-1)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.label}</span>
                    {complete && <span style={{ color: "var(--color-state-verified)" }}>✓</span>}
                    {busy === s.key && <span className="animate-pulse">…</span>}
                  </div>
                  <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>
                    {s.blurb}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Stage */}
      <section className="space-y-6">
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

        {/* Live field provenance */}
        {move?.fields && move.fields.length > 0 && (
          <Panel title="Canonical Move Record — every value keeps its source">
            <FieldTable fields={move.fields} />
          </Panel>
        )}

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
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function FieldTable({ fields }: { fields: Array<Record<string, unknown>> }) {
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
            <tr key={i} className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
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
