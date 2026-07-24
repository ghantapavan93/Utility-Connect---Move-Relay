"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";

/**
 * Screens 5, 7, 8 — the same Move Record seen by three audiences.
 *
 * One toggle, three projections, all fetched from /api/v1/views. The point the
 * screen makes visually: identical underlying data, deliberately different
 * surfaces, and the differences are enforced on the server. Flip between tabs on
 * the same move and watch the provider account number and the SSN simply not be
 * there for the customer and the partner.
 */

type Audience = "concierge" | "customer" | "partner";

const TABS: Array<{ key: Audience; label: string; blurb: string }> = [
  { key: "concierge", label: "Concierge", blurb: "The trusted operator. Full context, every source, every unknown." },
  { key: "customer", label: "Customer", blurb: "Their move, in plain terms. No internal machinery." },
  { key: "partner", label: "Partner", blurb: "Attributed engagement only. Nothing cross-partner, no provider internals." },
];

export default function ViewsPage() {
  const [audience, setAudience] = useState<Audience>("concierge");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (a: Audience) => {
    setLoading(true);
    const res = await fetch(`/api/v1/views?audience=${a}`);
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(audience);
  }, [audience, load]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">One record, three audiences</h1>
      <p className="mt-2 text-lg" style={{ color: "var(--color-text-mid)" }}>
        The same Move Record, projected safely for each audience on the server. Run the
        demo first so there is a record to project.
      </p>

      <div className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setAudience(t.key)}
            className="rounded-lg border px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              borderColor: audience === t.key ? "var(--color-state-verified)" : "var(--color-ground-3)",
              background: audience === t.key ? "color-mix(in oklab, var(--color-state-verified) 12%, transparent)" : "var(--color-ground-1)",
              color: audience === t.key ? "var(--color-state-verified)" : "var(--color-text-mid)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm" style={{ color: "var(--color-text-lo)" }}>
        {TABS.find((t) => t.key === audience)?.blurb}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={audience}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6"
        >
          {loading && <p style={{ color: "var(--color-text-lo)" }}>Loading…</p>}
          {!loading && (data?.exists as boolean) === false && (
            <Panel title="No record yet">
              <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
                Run the demo from the start to create a Move Record, then return here.
              </p>
            </Panel>
          )}
          {!loading && data?.exists === true && audience === "concierge" && <ConciergeView d={data} />}
          {!loading && data?.exists === true && audience === "customer" && <CustomerView d={data} />}
          {!loading && data?.exists === true && audience === "partner" && <PartnerView d={data} />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function ConciergeView({ d }: { d: Record<string, unknown> }) {
  const verified = (d.verified as Array<{ field: string; value: unknown; source: string; by: string | null }>) ?? [];
  const priority = (d.priority as { unknownsToReconcile: number; conflictsToResolve: number }) ?? { unknownsToReconcile: 0, conflictsToResolve: 0 };
  const services = (d.services as Array<Record<string, unknown>>) ?? [];
  const briefing = d.briefing as { claims?: Array<{ text: string; kind: string }>; openQuestions?: string[] } | null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Conflicts to resolve" value={priority.conflictsToResolve} tone={priority.conflictsToResolve ? "conflict" : "verified"} />
        <Stat label="Unknown outcomes to reconcile" value={priority.unknownsToReconcile} tone={priority.unknownsToReconcile ? "conflict" : "verified"} />
      </div>

      {briefing?.claims && (
        <Panel title="Source-grounded briefing — every claim cites a record">
          <ul className="space-y-1.5 text-sm">
            {briefing.claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden style={{ color: c.kind === "conflict" ? "var(--color-state-conflict)" : c.kind === "unknown" ? "var(--color-state-pending)" : "var(--color-state-verified)" }}>
                  {c.kind === "conflict" ? "⚠" : c.kind === "unknown" ? "?" : "✓"}
                </span>
                <span style={{ color: "var(--color-text-mid)" }}>{c.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Verified facts">
        <table className="w-full text-sm">
          <tbody>
            {verified.map((v, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
                <td className="py-1.5 font-mono text-xs">{v.field}</td>
                <td className="py-1.5">{String(v.value)}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.source}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.by ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="font-medium">{String(s.service_type)}</span>
            <span style={{ color: "var(--color-text-lo)" }}>{String(s.provider_name)}</span>
            <span className="font-mono text-xs" style={{ color: "var(--color-text-mid)" }}>{String(s.submission_state ?? "pending")}</span>
            {s.provider_order_id ? <span className="font-mono text-xs" style={{ color: "var(--color-text-lo)" }}>order {String(s.provider_order_id)}</span> : null}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function CustomerView({ d }: { d: Record<string, unknown> }) {
  const details = (d.details as Array<{ label: string; value: unknown }>) ?? [];
  const services = (d.services as Array<{ service: string; status: string }>) ?? [];
  const needsYou = (d.needsYou as string[]) ?? [];
  const timeline = (d.timeline as Array<{ headline: string; detail: string | null; tone: string }>) ?? [];

  return (
    <div className="space-y-4">
      <Panel title="Your move">
        {details.map((x, i) => (
          <div key={i} className="flex justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span style={{ color: "var(--color-text-lo)" }}>{x.label}</span>
            <span className="font-medium">{String(x.value)}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Your services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span className="font-medium capitalize">{s.service}</span>
            <StateBadge state={s.status === "Scheduled" ? "verified" : "transit"} subtle />
          </div>
        ))}
      </Panel>

      {needsYou.length > 0 && (
        <Panel title="Needs your attention">
          <ul className="space-y-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            {needsYou.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </Panel>
      )}

      {timeline.length > 0 && (
        <Panel title="Your move so far">
          <ol className="space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                  style={{
                    background: t.tone === "done" ? "var(--color-state-verified)" : "var(--color-ground-3)",
                    color: t.tone === "done" ? "white" : "var(--color-text-mid)",
                  }}
                >
                  {t.tone === "done" ? "✓" : "·"}
                </span>
                <div>
                  <div className="text-sm font-medium">{t.headline}</div>
                  {t.detail && <div className="text-xs" style={{ color: "var(--color-text-lo)" }}>{t.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            Built asynchronously from domain events by the outbox projector — already in
            customer language. The system&rsquo;s internal states never reach this list.
          </p>
        </Panel>
      )}

      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This is everything the customer sees. No provider account numbers, no internal
        error states, no concierge notes, no AI prompts. A lost provider response reads
        simply as &ldquo;In progress&rdquo; — the ambiguity is handled internally.
      </p>
    </div>
  );
}

function PartnerView({ d }: { d: Record<string, unknown> }) {
  if (!d.attributed) {
    return (
      <Panel title="No attributed engagement">
        <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{String(d.message)}</p>
      </Panel>
    );
  }
  const progress = (d.progress as { servicesRequested: number; servicesScheduled: number }) ?? { servicesRequested: 0, servicesScheduled: 0 };
  return (
    <div className="space-y-4">
      <Panel title={`Referral ${String(d.reference)}`}>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Engagement</span>
          <span className="font-medium">{String(d.engagement)}</span>
        </div>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Move date</span>
          <span className="font-medium">{String(d.moveDate)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span style={{ color: "var(--color-text-lo)" }}>Services scheduled</span>
          <span className="font-medium">{progress.servicesScheduled} of {progress.servicesRequested}</span>
        </div>
      </Panel>
      <Panel title="Attribution">
        <div className="flex items-center gap-2 text-sm">
          <StateBadge state="verified" subtle />
          <span style={{ color: "var(--color-text-mid)" }}>{String(d.attributionStatus)}</span>
        </div>
      </Panel>
      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This partner sees only their attributed engagement. No customer PII beyond the move
        date, no provider account numbers, no other partner&rsquo;s pipeline, no internal notes.
      </p>
    </div>
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

function Stat({ label, value, tone }: { label: string; value: number; tone: "verified" | "conflict" }) {
  const color = tone === "conflict" ? "var(--color-state-conflict)" : "var(--color-state-verified)";
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{label}</div>
    </div>
  );
}
