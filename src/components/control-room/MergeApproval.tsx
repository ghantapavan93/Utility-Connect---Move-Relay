"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";

/**
 * The one decision on this page that a person has to make.
 *
 * `GET /moves/:id/conflicts` and `POST /moves/:id/merge` were both built,
 * hardened and tested, and neither had a door. The console could show that two
 * sources disagreed and offered no way to settle it, so the lane that says
 * "authority required" pointed at nothing an operator could actually do.
 *
 * Nothing new was needed on the server. The conflict endpoint already returns
 * every candidate with its provenance and a deterministic recommendation; the
 * merge endpoint already takes the actor from the authenticated identity rather
 * than the body, refuses a stale version with 409, and relies on the schema's
 * `canonical_requires_actor` check to reject any canonical value that does not
 * name a human.
 *
 * ## What this control is careful about
 *
 * The recommendation is rendered as a suggestion and is never preselected. A
 * default that happened to be the recommendation would turn one click into an
 * approval of a machine's choice, which is the precise thing the never-automate
 * list exists to prevent — the operator would be committing a decision they had
 * not made.
 *
 * The reason is required. Not as form validation: the schema stores
 * `selection_reason` alongside the actor, and a canonical value whose
 * justification is blank is a decision nobody can review later.
 *
 * A 409 is rendered as its own outcome, not an error. Someone else resolved
 * this while it was open, and the honest response is to show what changed and
 * re-read — never to resubmit over them.
 */

interface Candidate {
  fieldPath: string;
  value: unknown;
  channel: string;
  verification: string;
  confidence: number;
  recordedAt: string;
}

interface Conflict {
  fieldPath: string;
  candidates: Candidate[];
  recommended: Candidate | null;
  reason: string;
}

interface ConflictsResponse {
  move: { id: string; reference: string; state: string; version: number };
  conflicts: Conflict[];
}

type Outcome =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "submitting" }
  | { kind: "committed"; version: number; fields: number }
  /** Someone else moved this record while the form was open. */
  | { kind: "stale"; currentVersion: number }
  | { kind: "failed"; detail: string };

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/^"|"$/g, "") : JSON.stringify(v));

export function MergeApproval({
  moveId,
  actor,
  onCommitted,
}: {
  moveId: string | null;
  actor: string;
  onCommitted: () => void;
}) {
  const still = useStillness();
  const [data, setData] = useState<ConflictsResponse | null>(null);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  /** fieldPath → the chosen candidate's value, as a string. Never defaulted. */
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!moveId) {
      setData(null);
      setOutcome({ kind: "idle" });
      return;
    }
    setOutcome({ kind: "loading" });
    setChoice({});
    setReason({});
    try {
      const res = await fetch(`/api/v1/moves/${moveId}/conflicts`);
      if (!res.ok) {
        setOutcome({ kind: "failed", detail: `The server returned ${res.status}.` });
        return;
      }
      setData((await res.json()) as ConflictsResponse);
      setOutcome({ kind: "ready" });
    } catch (err) {
      setOutcome({ kind: "failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }, [moveId]);

  useEffect(() => {
    void load();
  }, [load]);

  const conflicts = data?.conflicts ?? [];
  const decided = conflicts.filter((c) => choice[c.fieldPath] && reason[c.fieldPath]?.trim());
  const canCommit = decided.length > 0 && outcome.kind === "ready";

  const commit = useCallback(async () => {
    if (!moveId || !data) return;
    setOutcome({ kind: "submitting" });

    try {
      const res = await fetch(`/api/v1/moves/${moveId}/merge`, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Actor": actor },
        body: JSON.stringify({
          /*
            The version read with the conflicts, presented back. This is the
            whole optimistic-concurrency contract: if anything moved since, the
            server refuses rather than letting this overwrite it.
          */
          expectedVersion: data.move.version,
          decisions: decided.map((c) => ({
            fieldPath: c.fieldPath,
            value: choice[c.fieldPath],
            reason: reason[c.fieldPath]!.trim(),
          })),
        }),
      });
      const body = await res.json();

      if (res.status === 409) {
        setOutcome({ kind: "stale", currentVersion: body.currentVersion });
        return;
      }
      if (!res.ok || !body.ok) {
        setOutcome({ kind: "failed", detail: body.error ?? `The server returned ${res.status}.` });
        return;
      }

      setOutcome({ kind: "committed", version: body.version ?? data.move.version + 1, fields: decided.length });
      onCommitted();
    } catch (err) {
      setOutcome({ kind: "failed", detail: err instanceof Error ? err.message : String(err) });
    }
  }, [moveId, data, decided, choice, reason, actor, onCommitted]);

  if (!moveId) return null;

  return (
    <section
      aria-labelledby="merge-heading"
      data-merge-approval
      className="min-w-0 rounded-2xl border p-4 sm:p-5"
      style={{ borderColor: accentColor("security", 0.35), background: accentColor("security", 0.04) }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="merge-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accentInk("security") }}>
          Resolve the conflict
        </h2>
        {data && (
          <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
            {data.move.reference} · version {data.move.version}
          </span>
        )}
      </div>

      <div aria-live="polite" aria-busy={outcome.kind === "loading" || outcome.kind === "submitting"} className="min-w-0">
        <AnimatePresence mode="wait">
          {outcome.kind === "loading" && <Note key="l" text="Reading the contested fields…" />}

          {outcome.kind === "failed" && <Note key="f" text={outcome.detail} tone="failed" />}

          {/*
            A stale merge is a result, not a fault. Another operator committed
            while this was open, and the only safe response is to show what
            happened and re-read — resubmitting would be the silent overwrite
            the version check exists to prevent.
          */}
          {outcome.kind === "stale" && (
            <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
              <p className="text-sm font-semibold" style={{ color: accentInk("conflict") }}>
                Someone else resolved this first.
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                This move was at version {data?.move.version} when the conflicts were read and is now at version{" "}
                {outcome.currentVersion}. Nothing was written. Re-read it and decide against what stands now.
              </p>
              <button
                onClick={() => void load()}
                className="mt-3 inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: accentColor("conflict", 0.5), color: accentInk("conflict") }}
              >
                Re-read the conflicts
              </button>
            </motion.div>
          )}

          {outcome.kind === "committed" && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
              <p className="text-sm font-semibold" style={{ color: accentInk("recovered") }}>
                {outcome.fields === 1 ? "One field" : `${outcome.fields} fields`} now canonical at version {outcome.version}.
              </p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                Committed under {actor}, with the reason stored beside the value. The audit row records who chose it.
              </p>
              <button
                onClick={() => void load()}
                className="mt-3 inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "var(--color-text-mid)" }}
              >
                Re-read
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(outcome.kind === "ready" || outcome.kind === "submitting") && conflicts.length === 0 && (
        <Note text="No contested fields on this move." />
      )}

      {(outcome.kind === "ready" || outcome.kind === "submitting") &&
        conflicts.map((c) => (
          <fieldset key={c.fieldPath} className="mt-4 min-w-0 rounded-xl border p-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <legend className="px-1 font-mono text-xs" style={{ color: accentInk("conflict") }}>
              {c.fieldPath}
            </legend>

            <div className="space-y-1.5">
              {c.candidates.map((cand, i) => {
                const value = String(clean(cand.value));
                const isRecommended = c.recommended ? clean(c.recommended.value) === clean(cand.value) : false;
                return (
                  <label
                    key={`${c.fieldPath}-${i}`}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2"
                    style={{
                      borderColor: choice[c.fieldPath] === value ? accentColor("security", 0.6) : "rgba(255,255,255,0.1)",
                      background: choice[c.fieldPath] === value ? accentColor("security", 0.08) : "transparent",
                    }}
                  >
                    <input
                      type="radio"
                      name={`choice-${c.fieldPath}`}
                      /*
                        Never defaulted, including to the recommendation. A
                        preselected value turns one click into approval of a
                        choice the operator did not make.
                      */
                      checked={choice[c.fieldPath] === value}
                      onChange={() => setChoice((p) => ({ ...p, [c.fieldPath]: value }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-white/90">{value}</span>
                      <span className="block text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                        {cand.channel} · {cand.verification} · {new Date(cand.recordedAt).toLocaleDateString()}
                      </span>
                    </span>
                    {isRecommended && (
                      <span
                        className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                        style={{ borderColor: accentColor("internet", 0.5), color: accentInk("internet") }}
                      >
                        Suggested
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            {c.recommended && (
              <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                {c.reason} — a deterministic suggestion, not a decision.
              </p>
            )}

            <label className="mt-3 block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--color-text-lo)" }}>
                Why this value
              </span>
              <input
                value={reason[c.fieldPath] ?? ""}
                onChange={(e) => setReason((p) => ({ ...p, [c.fieldPath]: e.target.value }))}
                placeholder="Recorded beside the value, and reviewable later"
                className="mt-1 min-h-11 w-full rounded-lg border bg-transparent px-3 text-xs outline-none placeholder:text-[color:var(--color-text-lo)]"
                style={{ borderColor: "rgba(255,255,255,0.14)" }}
              />
            </label>
          </fieldset>
        ))}

      {(outcome.kind === "ready" || outcome.kind === "submitting") && conflicts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void commit()}
            disabled={outcome.kind === "submitting" || !canCommit}
            className="inline-flex min-h-11 items-center rounded-full px-5 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-50"
            style={{ background: accentColor("security", 1) }}
          >
            {outcome.kind === "submitting" ? "Committing…" : "Commit as concierge"}
          </button>
          {/*
            The reason a disabled control is disabled, next to it. A button that
            simply refuses to respond teaches nothing.
          */}
          <span className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            {decided.length === 0
              ? "Choose a value and give a reason for each field you are settling."
              : `${decided.length} of ${conflicts.length} ready to commit as ${actor}.`}
          </span>
        </div>
      )}

      <p
        className="mt-4 border-t pt-3 text-[10px] leading-relaxed"
        style={{ borderColor: "rgba(255,255,255,0.08)", color: accentInk("security") }}
      >
        AI may explain this conflict. It may not perform the merge. The schema refuses a canonical value that does not
        name the human who chose it.
      </p>
    </section>
  );
}

function Note({ text, tone }: { text: string; tone?: Accent }) {
  return (
    <p className="mt-3 text-xs" style={{ color: tone ? accentInk(tone) : "var(--color-text-lo)" }}>
      {text}
    </p>
  );
}
