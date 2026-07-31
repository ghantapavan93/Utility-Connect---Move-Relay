"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";
import { asRoute } from "@/lib/routes";

/**
 * The move queue — every move in the tenant, however it arrived: the scripted
 * demo, the enrollment form, or a raw API call.
 *
 * A critique caught this page shipping three sins its siblings had already
 * paid to fix, which is its own lesson about hallways between designed rooms:
 *
 * **A failed read rendered as calm.** No `r.ok` check, no catch — a forced 500
 * rendered "No moves yet", the empty state, on the site whose dashboard
 * comments brag about fixing exactly this. Failed and empty are now different
 * states with different sentences.
 *
 * **A verified badge over open work.** The badge ternary gave `canonical`
 * precedence, so a row could wear "✓ Verified" beside "1 field needs a
 * decision". For the operator this is a work list — a contested field outranks
 * the record's overall state, so conflicts win the badge.
 *
 * **Arrival order posing as a work list.** The copy called open conflicts "the
 * concierge's work list" while sorting newest-first, which buries the oldest
 * unresolved decision. Contested moves now sort first, oldest contested at the
 * top, and the ordering is stated on screen instead of implied.
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

/** "3m ago" / "2h ago" — recognition needs a clock, not an ISO string. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MovesPage() {
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    fetch("/api/v1/moves")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setMoves(d.moves ?? []))
      .catch((e) => {
        setMoves([]);
        setLoadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /*
    The critique asked the right question: if this is a work list, why is a
    Verified row in it at all? Sorting contested-first was half an answer —
    the settled rows still shared the list, borrowing its urgency. So the
    queue is now two lists with two names. "Needs a decision" holds only
    contested moves, oldest decision on top, because the one that has waited
    longest is the most expensive to keep waiting. "Settled" holds the rest,
    newest first, because for them recency is the only interesting axis. A
    Verified row can no longer be *in* the work list, structurally.
  */
  const needsDecision = moves
    .filter((m) => m.openConflicts > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const settled = moves
    .filter((m) => m.openConflicts === 0)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const contested = needsDecision.length;

  return (
    <main className="relative min-h-dvh bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />

      <div className="relative mx-auto max-w-4xl px-6 py-14" style={{ zIndex: 1 }}>
        {/* The operator's context, not the visitor's — this queue belongs to the console. */}
        <Link
          href="/dashboard"
          className="inline-flex min-h-11 items-center text-sm"
          style={{ color: "var(--color-state-verified)" }}
        >
          ← Control room
        </Link>
        <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Move queue</h1>
          {!loading && !loadError && (
            <span className="text-sm" style={{ color: "var(--color-text-lo)" }}>
              {moves.length} move{moves.length === 1 ? "" : "s"}
              {contested > 0 ? ` · ${contested} need${contested === 1 ? "s" : ""} a decision` : ""}
            </span>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-lg" style={{ color: "var(--color-text-mid)" }}>
          Every move in the tenant — scripted or submitted through the{" "}
          <Link href="/connect-flow" className="underline underline-offset-4">
            enrollment form
          </Link>
          . The work list holds only contested moves; everything settled sits below it.
        </p>

        {loading && (
          <p className="mt-8 text-sm" style={{ color: "var(--color-text-lo)" }}>
            Loading…
          </p>
        )}

        {loadError && (
          <div
            className="mt-8 rounded-2xl border p-5"
            style={{ borderColor: "var(--color-state-failed)", background: "rgba(229,72,77,0.06)" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--color-state-failed)" }}>
              The queue could not be read.
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--color-text-lo)" }}>
              {loadError} — an unread queue is not an empty one, so no list is shown.
            </p>
            <button
              onClick={load}
              className="mt-3 inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-wide"
              style={{ borderColor: "rgba(255,255,255,0.3)", color: "var(--color-text-mid)" }}
            >
              Read it again
            </button>
          </div>
        )}

        {!loading && !loadError && moves.length === 0 && (
          <p className="mt-8 text-sm" style={{ color: "var(--color-text-lo)" }}>
            No moves yet.{" "}
            <Link href="/demo" className="underline underline-offset-4" style={{ color: "var(--color-state-verified)" }}>
              Run the demo
            </Link>{" "}
            or submit one through the enrollment form.
          </p>
        )}

        {!loading && !loadError && contested > 0 && (
          <section aria-labelledby="queue-work" className="mt-8">
            <h2
              id="queue-work"
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--color-state-conflict)" }}
            >
              Needs a decision · oldest first
            </h2>
            <div className="mt-3 space-y-3" data-section="work">
              {needsDecision.map((m, i) => (
                <Row key={m.id} m={m} i={i} />
              ))}
            </div>
          </section>
        )}

        {!loading && !loadError && settled.length > 0 && (
          <section aria-labelledby="queue-settled" className="mt-10">
            <h2
              id="queue-settled"
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--color-text-lo)" }}
            >
              Settled · newest first
            </h2>
            <div className="mt-3 space-y-3" data-section="settled">
              {settled.map((m, i) => (
                <Row key={m.id} m={m} i={i} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

/** One queue row — shared by both sections so they cannot drift apart. */
function Row({ m, i }: { m: MoveRow; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
              <Link
                href={asRoute(`/moves/${m.id}`)}
                className="cine-glass flex min-h-11 flex-wrap items-center gap-4 rounded-2xl p-5 transition-colors hover:border-white/40"
              >
                <span className="font-mono text-sm font-semibold">{m.reference}</span>
                {/*
                  Open work outranks settled state. A canonical move with a
                  contested field is, for the person reading this list, a
                  conflict — the badge saying "verified" while the row demands
                  a decision was the fastest way to teach an operator to stop
                  believing badges.
                */}
                <StateBadge
                  state={m.openConflicts > 0 ? "conflict" : m.state === "canonical" ? "verified" : "pending"}
                />
                <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                  {m.sources} source{m.sources === 1 ? "" : "s"}
                </span>
                {m.openConflicts > 0 && (
                  <span className="text-xs font-semibold" style={{ color: "var(--color-state-conflict)" }}>
                    {m.openConflicts} field{m.openConflicts === 1 ? " needs" : "s need"} a decision
                  </span>
                )}
                <span className="ml-auto flex items-baseline gap-3">
                  <span className="font-mono text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                    {ago(m.createdAt)}
                  </span>
                  {/* Navigation, not verification — it does not get the cyan. */}
                  <span className="text-xs" style={{ color: "var(--color-text-mid)" }}>
                    open →
                  </span>
                </span>
      </Link>
    </motion.div>
  );
}
