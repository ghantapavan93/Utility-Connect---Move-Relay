"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";

/**
 * The move queue — every move in the tenant, however it arrived: the scripted
 * demo, the enrollment form, or a raw API call. Open conflicts are the work;
 * the queue is sorted by arrival and each row opens the resolution workspace.
 */

interface MoveRow {
  id: string;
  reference: string;
  state: string;
  version: number;
  openConflicts: number;
  sources: number;
  createdAt: string;
}

export default function MovesPage() {
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/moves")
      .then((r) => r.json())
      .then((d) => setMoves(d.moves ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Move queue</h1>
      <p className="mt-2 max-w-2xl text-lg" style={{ color: "var(--color-text-mid)" }}>
        Every move in the tenant — scripted or submitted through the{" "}
        <Link href="/connect-flow" className="underline">enrollment form</Link>. Open
        conflicts are the concierge&rsquo;s work list.
      </p>

      {loading && <p className="mt-8 text-sm" style={{ color: "var(--color-text-lo)" }}>loading…</p>}
      {!loading && moves.length === 0 && (
        <p className="mt-8 text-sm" style={{ color: "var(--color-text-lo)" }}>
          No moves yet. Run the demo or submit one through the enrollment form.
        </p>
      )}

      <div className="mt-8 space-y-3">
        {moves.map((m, i) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link
              href={`/moves/${m.id}` as never}
              className="flex flex-wrap items-center gap-4 rounded-2xl border p-5 transition-colors hover:border-white/40"
              style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
            >
              <span className="font-mono text-sm font-semibold">{m.reference}</span>
              <StateBadge
                state={m.state === "canonical" ? "verified" : m.openConflicts > 0 ? "conflict" : "pending"}
              />
              <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                {m.sources} source{m.sources === 1 ? "" : "s"}
              </span>
              {m.openConflicts > 0 && (
                <span className="text-xs font-semibold" style={{ color: "var(--color-state-conflict)" }}>
                  {m.openConflicts} field{m.openConflicts === 1 ? "" : "s"} need a decision
                </span>
              )}
              <span className="ml-auto text-xs" style={{ color: "var(--color-state-verified)" }}>
                open →
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
