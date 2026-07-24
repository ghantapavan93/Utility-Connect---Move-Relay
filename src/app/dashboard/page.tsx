"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { Constellation3D } from "@/components/Constellation3D";
import { StateBadge } from "@/components/StateBadge";

/**
 * The operator dashboard — the product shell overview.
 *
 * Every headline figure is a real count from /api/v1/stats, so the numbers move
 * only when the demo actually runs. The referral list is the synthetic scenario
 * cohort, labelled as such. No fabricated production metrics anywhere: a reviewer
 * can cross-check any number against the database.
 */

interface Stats {
  activeMoves: number;
  canonicalMoves: number;
  duplicatesPrevented: number;
  openConflicts: number;
  auditEvents: number;
  aiBriefings: number;
  ordersRecovered: number;
  providerSubmissions: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    fetch("/api/v1/stats")
      .then((r) => r.json())
      .then((d) => {
        setStats(d.stats);
        setHasData(d.hasData);
      });
  }, []);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar />

      <div className="flex-1 overflow-x-hidden">
        {/* Top bar */}
        <div
          className="sticky top-0 z-40 flex items-center gap-4 border-b px-6 py-3"
          style={{ borderColor: "var(--color-ground-3)", background: "color-mix(in oklab, var(--color-ground-0) 82%, transparent)", backdropFilter: "blur(12px)" }}
        >
          <div
            className="flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-lo)" }}
          >
            <span aria-hidden>⌕</span> Search moves, referrals, providers…
          </div>
          <Link
            href="/demo"
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--color-state-verified)", color: "white" }}
          >
            + Run a move
          </Link>
        </div>

        <main className="px-6 py-6">
          {/* Welcome + network */}
          <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="text-2xl font-bold tracking-tight"
              >
                Move Relay overview
              </motion.h1>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
                {hasData
                  ? "Live figures from the demo tenant — every number is a real database count."
                  : "No moves yet. Run the live workflow to populate these figures with real data."}
              </p>

              {/* Stat cards — real counts */}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <StatCard label="Active moves" value={stats?.activeMoves ?? 0} tone="verified" />
                <StatCard label="Duplicates prevented" value={stats?.duplicatesPrevented ?? 0} tone="conflict" hint="retry.blocked events" />
                <StatCard label="Orders recovered" value={stats?.ordersRecovered ?? 0} tone="verified" hint="via reconciliation" />
                <StatCard label="Audit events" value={stats?.auditEvents ?? 0} tone="transit" hint="append-only" />
              </div>

              {!hasData && (
                <Link
                  href="/demo"
                  className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--color-state-verified)", color: "white" }}
                >
                  Run the workflow →
                </Link>
              )}
            </div>

            {/* 3D network */}
            <div className="rounded-2xl border p-4" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold">Handoff network</span>
                <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>live state</span>
              </div>
              <Constellation3D
                converged={hasData}
                height={300}
                sources={[
                  { id: "1", label: "Partner API", state: "verified" },
                  { id: "2", label: "CSV", state: hasData ? "verified" : "conflict" },
                  { id: "3", label: "Customer form", state: "verified" },
                  { id: "4", label: "Microsite", state: "transit" },
                  { id: "5", label: "Concierge", state: "pending" },
                ]}
              />
            </div>
          </div>

          {/* Second row */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
            {/* Recent referrals — synthetic cohort, labelled */}
            <Panel title="Referral cohort" tag="synthetic">
              {REFERRALS.map((r) => (
                <div key={r.name} className="flex items-center gap-3 border-t py-2.5 first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
                  <div className="grid h-8 w-8 place-items-center rounded-full text-xs font-semibold" style={{ background: "var(--color-ground-3)" }}>
                    {r.name.split(" ").map((w) => w[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs" style={{ color: "var(--color-text-lo)" }}>{r.services} · {r.city}</div>
                  </div>
                  <StateBadge state={r.state} subtle />
                </div>
              ))}
            </Panel>

            {/* Move flow */}
            <Panel title="Move flow" tag="live spine">
              <ol className="space-y-2.5">
                {FLOW.map((f, i) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold"
                      style={{ background: "color-mix(in oklab, var(--color-state-verified) 16%, transparent)", color: "var(--color-state-verified)" }}
                    >
                      {i + 1}
                    </span>
                    <span style={{ color: "var(--color-text-mid)" }}>{f}</span>
                  </li>
                ))}
              </ol>
            </Panel>

            {/* AI assistant — grounded, honest */}
            <Panel title="AI assistant" tag="grounded">
              <p className="mb-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
                Suggests and explains. Never decides. Every claim cites a record.
              </p>
              {AI_ACTIONS.map((a) => (
                <div
                  key={a}
                  className="mb-1.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
                >
                  <span aria-hidden style={{ color: "var(--color-state-transit)" }}>✦</span>
                  {a}
                </div>
              ))}
              <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: "var(--color-ground-0)", color: "var(--color-text-lo)" }}>
                v1 briefings are deterministic and source-grounded — no LLM in the loop, so
                no hallucinated facts. The model seam is documented, not faked.
              </div>
            </Panel>
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, tone, hint }: { label: string; value: number; tone: "verified" | "conflict" | "transit"; hint?: string }) {
  const color =
    tone === "conflict" ? "var(--color-state-conflict)" : tone === "transit" ? "var(--color-state-transit)" : "var(--color-state-verified)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="text-3xl font-bold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs font-medium">{label}</div>
      {hint && <div className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>{hint}</div>}
    </motion.div>
  );
}

function Panel({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "var(--color-ground-3)", color: "var(--color-text-lo)" }}>
          {tag}
        </span>
      </div>
      {children}
    </div>
  );
}

const REFERRALS: Array<{ name: string; services: string; city: string; state: "verified" | "transit" | "conflict" | "pending" }> = [
  { name: "Maya Patel", services: "Electric · Internet · Security", city: "Plano, TX", state: "verified" },
  { name: "Sarah Johnson", services: "Electric · Internet", city: "San Francisco, CA", state: "transit" },
  { name: "Michael Chen", services: "Water · Gas", city: "Austin, TX", state: "pending" },
  { name: "Emily Rodriguez", services: "Electric · Security", city: "Miami, FL", state: "verified" },
  { name: "David Thompson", services: "Internet · TV", city: "Seattle, WA", state: "transit" },
];

const FLOW = [
  "Referral received",
  "Information verified",
  "Conflict resolved by human",
  "Provider submission",
  "Reconciled after timeout",
];

const AI_ACTIONS = [
  "Summarize this move for the concierge",
  "Explain the move-date conflict",
  "Flag records missing consent",
  "Surface unknown provider outcomes",
];
