"use client";

import { accentColor, accentInk } from "@/lib/accents";
import { unsafeLastWriteWins } from "@/lib/theater-baseline";

/**
 * The same scenario, without the guarantee.
 *
 * The builder proves an invariant held. It cannot show what its absence would
 * cost, because the backend has no path that lets an unsafe outcome through —
 * and adding one would be the most destructive change possible here. A demo
 * mode that disables a safeguard is the pattern this entire project argues
 * against, sitting in the same repository as the code that refuses to guess.
 *
 * So the left column is arithmetic, not a system. Fifteen lines of
 * last-write-wins with no imports, no connection, and no ability to reach
 * anything. See `theater-baseline.ts` and the test that keeps it that way.
 *
 * ## Why the labelling is this heavy
 *
 * A reader who scans headings must meet the word "simulated" before any result.
 * The two columns are deliberately asymmetric: only the right one carries a
 * verdict, evidence, or an inspect control, because only the right one ran.
 * Matching their chrome would imply matching authority.
 */
export function UnsafeBaseline() {
  const run = unsafeLastWriteWins();

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {/* -------- the simulation -------- */}
      <div
        className="min-w-0 rounded-xl border p-5"
        style={{ borderColor: accentColor("failed", 0.35), background: accentColor("failed", 0.04) }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ background: accentColor("failed", 0.16), color: accentInk("failed") }}
          >
            Unsafe reference simulation
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">not a backend · not evidence</span>
        </div>

        <h4 className="mt-3 text-sm font-semibold text-white/90">{run.title}</h4>
        <p className="mt-1 text-xs leading-relaxed text-white/55">{run.rule}</p>

        <ol className="mt-4 space-y-2">
          {run.steps.map((s, i) => (
            <li key={i} className="min-w-0 rounded-lg border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-white/80">{s.actor}</span>
                <span className="font-mono text-[11px] text-white/45">wrote {s.wrote}</span>
              </div>
              <p className="mt-1 font-mono text-[11px]" style={{ color: accentInk("failed") }}>
                record → {s.recordAfter}
                {!s.conflictSurfaced && " · no conflict recorded"}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed" style={{ color: accentInk("failed") }}>
          {run.consequence}
        </p>
      </div>

      {/* -------- what the live backend does instead -------- */}
      <div
        className="min-w-0 rounded-xl border p-5"
        style={{ borderColor: accentColor("verified", 0.35), background: accentColor("verified", 0.04) }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em]"
            style={{ background: accentColor("verified", 0.16), color: accentInk("verified") }}
          >
            Move Relay, live
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-white/35">run it above</span>
        </div>

        <h4 className="mt-3 text-sm font-semibold text-white/90">Optimistic version</h4>
        <p className="mt-1 text-xs leading-relaxed text-white/55">
          The update is conditional on the version that was read. A write made from a stale read matches no row.
        </p>

        {/*
          No numbers here. This column describes the mechanism; the result for a
          specific run belongs to the builder above, where it arrived from the
          server. Restating one here would be a second copy of a fact, free to
          drift from the run that produced it.
        */}
        <ol className="mt-4 space-y-2">
          {[
            { actor: "Concierge A", detail: "commits — version matches" },
            { actor: "Concierge B", detail: "updates 0 rows — surfaces as a conflict" },
          ].map((s) => (
            <li key={s.actor} className="min-w-0 rounded-lg border px-3 py-2" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-white/80">{s.actor}</span>
                <span className="font-mono text-[11px]" style={{ color: accentInk("verified") }}>
                  {s.detail}
                </span>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs leading-relaxed" style={{ color: accentInk("verified") }}>
          The correction survives. The losing write becomes something a person can see and resolve.
        </p>
      </div>
    </div>
  );
}
