"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * One projected field, unfolded backwards into what produced it.
 *
 * The three panels answer *what* an audience receives. This answers *why this
 * value* — which is the question a reviewer actually has when they see a date
 * that differs from the one on the partner feed, and the question the whole
 * provenance model exists to answer.
 *
 * ## It is a projection, not a debug view
 *
 * The obvious version returns the whole history and lets the client decide what
 * to render, which would hand the customer the value her partner got wrong, the
 * channel it arrived on, and the name of the operator who overruled it. The
 * server decides instead, per audience, and this component renders whatever came
 * back — including the categories it was told are missing.
 *
 * So the concierge sees rejected values and the reasoning; Maya sees that her
 * date was supplied more than once and stands confirmed; the partner sees the
 * confirmed date and nothing about how it was chosen. Same endpoint, same gate.
 */

interface Step {
  source: string;
  recordedAt: string;
  canonical: boolean;
  value?: unknown;
}

interface Lineage {
  available: true;
  field: string;
  label: string;
  projectedValue: unknown;
  history: Step[];
  decision: { by: string; reason: string | null } | null;
  projectionRule: string;
  withheldFromThisView: string[];
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; lineage: Lineage }
  | { kind: "none"; detail: string }
  | { kind: "error"; detail: string };

export function FieldLineage({
  moveId,
  actor,
  field,
  onClose,
}: {
  moveId: string;
  actor: string;
  field: string;
  onClose: () => void;
}) {
  const still = useStillness();
  const [state, setState] = useState<State>({ kind: "idle" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/v1/moves/${moveId}/lineage?field=${encodeURIComponent(field)}`, {
        headers: { "x-actor": actor },
      });
      const body = await res.json();

      if (!res.ok) {
        setState({ kind: "error", detail: body.detail ?? `The server returned ${res.status}.` });
        return;
      }
      /*
        `available: false` is the same answer for a field that does not exist
        and one this audience may not trace. Rendering them differently here
        would rebuild the oracle the endpoint deliberately avoids.
      */
      if (body.available !== true) {
        setState({ kind: "none", detail: body.detail ?? "No lineage available for this field in this view." });
        return;
      }
      setState({ kind: "ready", lineage: body as Lineage });
    } catch (err) {
      setState({ kind: "error", detail: err instanceof Error ? err.message : String(err) });
    }
  }, [moveId, actor, field]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <motion.div
      initial={{ opacity: 0, height: still ? "auto" : 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: still ? "auto" : 0 }}
      transition={{ duration: still ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div
        className="mt-3 min-w-0 rounded-xl border p-4"
        style={{ borderColor: accentColor("security", 0.35), background: accentColor("security", 0.05) }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("security") }}>
            Where this value came from
          </p>
          <button
            onClick={onClose}
            className="inline-flex min-h-11 items-center text-[11px] font-semibold uppercase tracking-wide text-white/50 hover:text-white/80"
          >
            Close
          </button>
        </div>

        <div aria-live="polite" aria-busy={state.kind === "loading"} className="min-w-0">
          <AnimatePresence mode="wait">
            {state.kind === "loading" && (
              <motion.p key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-white/45">
                Asking the server…
              </motion.p>
            )}

            {state.kind === "none" && (
              <motion.p key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-white/55">
                {state.detail}
              </motion.p>
            )}

            {state.kind === "error" && (
              <motion.p
                key="e"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 font-mono text-xs"
                style={{ color: accentInk("failed") }}
              >
                {state.detail}
              </motion.p>
            )}

            {state.kind === "ready" && (
              <motion.div key="r" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
                <p className="mt-2 font-mono text-sm text-white/85">
                  {String(state.lineage.projectedValue)}
                </p>

                {/* Supplied this many times. The count is safe; the values may not be. */}
                <ol className="mt-3 space-y-1.5">
                  {state.lineage.history.map((h, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: accentColor(h.canonical ? "verified" : "conflict", 0.9) }}
                      />
                      <span className="font-mono text-white/60">{h.source}</span>
                      {h.value !== undefined && (
                        <span className="font-mono text-white/80">{String(h.value)}</span>
                      )}
                      <span className="text-white/30">{new Date(h.recordedAt).toLocaleDateString()}</span>
                      {h.canonical && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-[0.14em]"
                          style={{ color: accentInk("verified") }}
                        >
                          stands
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                {state.lineage.decision && (
                  <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Chosen by</p>
                    <p className="mt-0.5 font-mono text-xs text-white/75">{state.lineage.decision.by}</p>
                    {state.lineage.decision.reason && (
                      <p className="mt-1.5 text-xs leading-relaxed text-white/60">{state.lineage.decision.reason}</p>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-white/50">{state.lineage.projectionRule}</p>

                {/*
                  Categories, as the server sent them. Never a list of the
                  fields themselves — an explanation of what is missing that
                  named it would be the disclosure it is explaining away.
                */}
                {state.lineage.withheldFromThisView.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk("conflict") }}>
                      Withheld from this view
                    </p>
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {state.lineage.withheldFromThisView.map((c) => (
                        <li
                          key={c}
                          className="rounded-full border px-2 py-0.5 text-[10px] text-white/55"
                          style={{ borderColor: accentColor("conflict", 0.3) }}
                        >
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
