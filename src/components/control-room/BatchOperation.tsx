"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { SAMPLE_BATCH_CSV, SAMPLE_BATCH_FILENAME, sampleTokens, BATCH_STAGES } from "@/lib/sample-batch";
import type { BatchResult } from "@/lib/control-room";

/**
 * Five rows entering the system, and where each one actually landed.
 *
 * The upload already worked and already returned the four counts. What it did
 * not do was let anyone watch: the rows were invisible before submission and
 * the outcome was a small line of text, so the single most demonstrable thing
 * on this page — a partner batch that partly fails and stays survivable — read
 * as a form post.
 *
 * Every count below is `rows.accepted`, `rows.quarantined`, `rows.replayed`,
 * `rows.unmappable` from the response. Every token routes by its own returned
 * `status`. Nothing is hardcoded to four-and-one, because a batch that always
 * produced four-and-one would be a fixture pretending to be a pipeline.
 *
 * The stages shown during execution map to real work in the endpoint — see
 * `BATCH_STAGES`. They are revealed on a timer while one request is in flight,
 * which is honest about pacing and not about outcome: no result is shown before
 * the response lands.
 */

type Phase = "idle" | "running" | "done" | "failed";

const STATUS_TONE: Record<string, Accent> = {
  created: "verified",
  attached: "verified",
  collapsed: "verified",
  replayed: "internet",
  quarantined: "conflict",
  key_conflict: "conflict",
};

export function BatchOperation({
  onLanded,
  actor,
}: {
  /** Called once the server has confirmed, so the page can re-read everything. */
  onLanded: (result: BatchResult) => void;
  actor: string;
}) {
  const still = useStillness();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const tokens = sampleTokens();

  const run = useCallback(async () => {
    setPhase("running");
    setProblem(null);
    setResult(null);
    setShowEvidence(false);
    setStage(0);

    // Pacing only. The request is already in flight; these do not gate it.
    const ticker = still
      ? null
      : setInterval(() => setStage((s) => Math.min(s + 1, BATCH_STAGES.length - 1)), 320);

    try {
      const body = new FormData();
      body.append("file", new File([new Blob([SAMPLE_BATCH_CSV], { type: "text/csv" })], SAMPLE_BATCH_FILENAME));

      const res = await fetch("/api/v1/upload/csv", { method: "POST", headers: { "X-Actor": actor }, body });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        setProblem(json.error ?? `The server returned ${res.status}.`);
        setPhase("failed");
        return;
      }

      const parsed = json as BatchResult;
      setStage(BATCH_STAGES.length - 1);
      setResult(parsed);
      setPhase("done");
      onLanded(parsed);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
      setPhase("failed");
    } finally {
      if (ticker) clearInterval(ticker);
    }
  }, [actor, onLanded, still]);

  /** Where each token ended up, from its own returned status. */
  const statusFor = (line: number) => result?.results.find((r) => r.line === line)?.status ?? null;

  return (
    <section aria-labelledby="batch-heading" className="min-w-0 rounded-2xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="batch-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
          Process a synthetic partner batch
        </h2>
        <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
          csv_upload · lowest trust tier
        </span>
      </div>

      {/* ---------- the rows, before anything happens ---------- */}
      <ul className="mt-4 grid min-w-0 gap-2 sm:grid-cols-5">
        {tokens.map((t) => {
          const status = statusFor(t.line);
          const tone: Accent = status ? (STATUS_TONE[status] ?? "conflict") : "internet";
          return (
            <motion.li
              key={t.line}
              layout={!still}
              className="min-w-0 rounded-xl border p-3"
              style={{
                borderColor: status ? accentColor(tone, 0.55) : "rgba(255,255,255,0.12)",
                background: status ? accentColor(tone, 0.07) : "transparent",
              }}
            >
              <p className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                row {t.line}
              </p>
              <p className="mt-0.5 truncate text-[13px] font-semibold text-white/90">{t.label}</p>
              <p className="mt-0.5 truncate text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                {t.services.join(" · ") || "no services"}
              </p>
              {/*
                The row's own returned status, not a colour standing in for one.
                A token with no status has not been submitted yet, and says so
                by staying neutral rather than by looking ready.
              */}
              {status && (
                <p className="mt-1.5 font-mono text-[10px]" style={{ color: accentInk(tone) }}>
                  {status}
                </p>
              )}
            </motion.li>
          );
        })}
      </ul>

      {/* ---------- stages, while one request is in flight ---------- */}
      {phase === "running" && (
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-live="polite">
          {BATCH_STAGES.map((s, i) => (
            <li
              key={s.key}
              className="rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: i <= stage ? accentColor("internet", 0.5) : "rgba(255,255,255,0.1)",
                color: i <= stage ? accentInk("internet") : "var(--color-text-lo)",
              }}
            >
              {s.label}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void run()}
          disabled={phase === "running"}
          className="inline-flex min-h-11 items-center rounded-full px-5 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-60"
          style={{ background: accentColor("verified", 1) }}
        >
          {phase === "running" ? "Processing…" : phase === "done" ? "Process it again" : "Process the sample partner batch"}
        </button>

        {result && (
          <button
            onClick={() => setShowEvidence((v) => !v)}
            aria-expanded={showEvidence}
            aria-controls="batch-evidence"
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-wide"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "var(--color-text-mid)" }}
          >
            {showEvidence ? "Hide batch evidence" : "Inspect batch evidence"}
          </button>
        )}
      </div>

      {/* ---------- the four counts, as returned ---------- */}
      <div aria-live="polite" aria-busy={phase === "running"} className="min-w-0">
        <AnimatePresence mode="wait">
          {phase === "failed" && (
            <motion.p
              key="failed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 font-mono text-xs"
              style={{ color: accentInk("failed") }}
            >
              {problem}
            </motion.p>
          )}

          {phase === "done" && result && (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: still ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: still ? 0 : 0.25 }}
              className="mt-4 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {(
                [
                  ["Accepted", result.rows.accepted, "verified"],
                  ["Held for review", result.rows.quarantined, "conflict"],
                  ["Replayed", result.rows.replayed, "internet"],
                  ["Unmappable", result.rows.unmappable, "failed"],
                ] as Array<[string, number, Accent]>
              ).map(([label, value, tone]) => (
                <div
                  key={label}
                  className="min-w-0 rounded-xl border p-3"
                  style={{ borderColor: accentColor(tone, value > 0 ? 0.45 : 0.15), background: value > 0 ? accentColor(tone, 0.06) : "transparent" }}
                >
                  <p className="font-mono text-2xl font-semibold" style={{ color: value > 0 ? accentInk(tone) : "var(--color-text-lo)" }}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--color-text-lo)" }}>
                    {label}
                  </p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Outside the live region: raw rows are read, never announced. */}
      {showEvidence && result && (
        <div id="batch-evidence" className="mt-3 min-w-0" aria-live="off">
          <pre
            className="overflow-x-auto rounded p-3 font-mono text-[11px] leading-relaxed"
            style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}
          >
            {JSON.stringify(result.results, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
