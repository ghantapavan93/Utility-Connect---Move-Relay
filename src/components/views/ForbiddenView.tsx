"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { AudienceLens } from "./AudienceLens";

/**
 * An actor with no relationship to this move, asking anyway.
 *
 * The three audience panels demonstrate restraint — each receives less than the
 * one before it. None of them demonstrates refusal, because all three are
 * entitled to something. The interesting boundary is the one where nothing is
 * built at all, and until now a reviewer had to take that on trust.
 *
 * `user:rival-agent` is a real, recognised identity that owns no path to this
 * move. The 403 it receives comes from the same gate every other request goes
 * through, above the projection code — so nothing was constructed and no field
 * was read. The seed deliberately writes no tuple for it, and a test asserts
 * that absence, which is what makes this a refusal rather than a branch someone
 * wrote for the demo.
 *
 * ## Why this is styled as a success
 *
 * A red panel reading "403 Forbidden" tells a reviewer the page is broken. What
 * actually happened is the system working exactly as designed, so it is drawn
 * calm and amber: a boundary holding, not a fault. The one thing it must never
 * look like is an error the team has not noticed.
 */

interface Denial {
  error: string;
  actor: string;
  object: string;
  detail: string;
  relationship: string | null;
  projectionGenerated: boolean;
  returnedFields: number;
}

export function ForbiddenView({ moveId }: { moveId: string | null }) {
  const still = useStillness();
  const [state, setState] = useState<"idle" | "asking" | "refused" | "error">("idle");
  const [denial, setDenial] = useState<Denial | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const attempt = useCallback(async () => {
    if (!moveId) return;
    setState("asking");
    setProblem(null);
    setShowEvidence(false);

    try {
      const res = await fetch(`/api/v1/moves/${moveId}/views`, {
        headers: { "x-actor": "user:rival-agent" },
      });
      const body = (await res.json()) as Denial;

      /*
        A 403 is the expected answer and the only one this renders as a success.

        Anything else is reported as a problem rather than dressed up: a 200
        here would mean an unrelated actor had just been shown a projection,
        which is the worst outcome this page could have and must never be
        displayed as though the boundary held.
      */
      if (res.status === 403) {
        setDenial(body);
        setState("refused");
        return;
      }
      setProblem(
        res.status === 200
          ? "The server returned a projection to an unrelated actor. That is a breach, not a refusal."
          : `Expected a refusal, got ${res.status}.`,
      );
      setState("error");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }, [moveId]);

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8" aria-label="A forbidden view">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: accentColor(state === "refused" ? "conflict" : "verified", 0.32),
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="min-w-0">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ color: accentInk("conflict") }}
            >
              Try a forbidden view
            </p>
            <h3 className="mt-3 text-[clamp(20px,2.4vw,30px)] font-semibold leading-[1.12] tracking-tight text-white">
              Ask as someone with no reason to see this move.
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60">
              A rival brokerage that did not refer Maya, using the same endpoint the three audiences use. The
              relationship is checked before any view is built.
            </p>

            <button
              onClick={() => void attempt()}
              disabled={state === "asking" || !moveId}
              className="mt-5 inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ background: accentColor("conflict", 1), color: "#1a1207" }}
            >
              {state === "asking" ? "Asking…" : state === "refused" ? "Ask again" : "Try a forbidden view"}
            </button>
            {!moveId && (
              <p className="mt-2 text-xs text-white/40">Load Maya&rsquo;s move first, so there is something to refuse.</p>
            )}
          </div>

          <div className="min-w-0">
            <div className="h-[180px]">
              <AudienceLens state={state === "refused" ? { kind: "denied", actor: "user:rival-agent" } : state === "asking" ? { kind: "loading" } : { kind: "empty" }} />
            </div>
          </div>
        </div>

        {/* The answer. `aria-live` — the refusal is the content. */}
        <div className="px-6 pb-6 sm:px-8 sm:pb-8" aria-live="polite" aria-busy={state === "asking"}>
          <AnimatePresence mode="wait">
            {state === "refused" && denial && (
              <motion.div
                key="refused"
                initial={{ opacity: 0, y: still ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: still ? 0 : 0.3 }}
                className="min-w-0 rounded-xl border p-5"
                style={{ borderColor: accentColor("conflict", 0.45), background: accentColor("conflict", 0.06) }}
              >
                <p
                  className="text-[clamp(18px,2.2vw,26px)] font-semibold leading-tight tracking-tight"
                  style={{ color: accentInk("conflict") }}
                >
                  No relationship. No view.
                </p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/70">
                  This actor did not refer Maya&rsquo;s move and has no operational responsibility for it. No projection
                  was constructed and no restricted field was read.
                </p>
              </motion.div>
            )}

            {state === "error" && (
              <motion.p
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-mono text-sm"
                style={{ color: accentInk("failed") }}
              >
                {problem}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Outside the live region. Raw rows are read, never announced. */}
        {state === "refused" && denial && (
          <div className="border-t px-6 pb-6 sm:px-8 sm:pb-8" style={{ borderColor: "rgba(255,255,255,0.08)" }} aria-live="off">
            <button
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              aria-controls="denial-evidence"
              className="mt-5 inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide text-white/75"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              {showEvidence ? "Hide denial evidence" : "Inspect denial evidence"}
            </button>

            {showEvidence && (
              <div id="denial-evidence" className="mt-3 min-w-0">
                {/*
                  Every row is either what the caller supplied or a fact about
                  the refusal. No field name and no value from the record — a
                  denial that leaked the shape of what it withheld would be a
                  disclosure wearing a refusal's clothes.
                */}
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {[
                    ["Synthetic actor", denial.actor],
                    ["Requested object", denial.object],
                    ["Relationship result", denial.relationship ?? "none"],
                    ["Authorization decision", "denied"],
                    ["Projection generated", String(denial.projectionGenerated)],
                    ["Returned fields", String(denial.returnedFields)],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">{k}</dt>
                      <dd className="mt-0.5 break-all font-mono text-xs text-white/70">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs leading-relaxed text-white/45">{denial.detail}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
