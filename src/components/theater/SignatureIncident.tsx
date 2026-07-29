"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import { postTheater } from "@/lib/theater-request";
import { HandoffCapsule, type CapsulePhase } from "./HandoffCapsule";

/**
 * The provider created the order. The reply disappeared.
 *
 * The six attacks each isolate one guarantee. This is the incident the whole
 * system was designed around, so it is staged rather than listed: a reviewer
 * watches our state and the provider's state disagree, watches a retry get
 * refused, and watches reconciliation close the gap by asking rather than
 * guessing.
 *
 * ## Three round trips, not one
 *
 * `submit`, `retry` and `reconcile` are separate calls because *when* each fact
 * becomes knowable is the subject. One call returning the finished story would
 * make this an animation of a failure rather than a failure.
 *
 * ## What the staggered reveal is and is not
 *
 * The submit response carries four facts at once — we are UNKNOWN, the provider
 * holds an order, so the request landed and the reply did not. Those are
 * revealed one at a time, because delivered as a block they read as a summary
 * and the reader never feels the gap open. Every one of them is a value the
 * server already returned. Nothing here predicts a result, and no stage lights
 * before the call that proves it has resolved — the distinction this entire
 * page exists to insist on.
 */

interface StageDef {
  key: string;
  label: string;
  /** Which call has to have returned before this may light. */
  from: "submit" | "retry" | "reconcile";
  accent: Accent;
  /** Shown beneath the track while this is the newest fact. */
  note?: string;
}

const STAGES: StageDef[] = [
  { key: "submitting", label: "Submitting", from: "submit", accent: "verified" },
  { key: "created", label: "Provider order created", from: "submit", accent: "verified" },
  { key: "lost", label: "Response lost", from: "submit", accent: "failed" },
  {
    key: "unknown",
    label: "Outcome unknown",
    from: "submit",
    accent: "conflict",
    note: "The provider may have completed the work. Move Relay does not yet have enough evidence to call it successful or failed.",
  },
  {
    key: "blocked",
    label: "Retry refused",
    from: "retry",
    accent: "conflict",
    note: "The first outcome is unknown. Resubmission could create a second order.",
  },
  { key: "reconciling", label: "Reconciling", from: "reconcile", accent: "security" },
  { key: "recovered", label: "Existing order recovered", from: "reconcile", accent: "recovered" },
  { key: "confirmed", label: "Confirmed", from: "reconcile", accent: "verified" },
];

interface StageResult {
  outcome: string;
  invariant: string;
  evidence: Record<string, unknown>;
}

const str = (v: unknown) => (typeof v === "string" ? v : null);

export function SignatureIncident() {
  const still = useStillness();
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<CapsulePhase>("idle");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Partial<Record<StageDef["from"], StageResult>>>({});
  const [error, setError] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);

  /** Reduced motion collapses the pacing, never the sequence. */
  const beat = useCallback(
    (ms: number) => new Promise((r) => setTimeout(r, still ? 0 : ms)),
    [still],
  );

  /*
    The same deadline and the same classification as the six attacks. A stage
    that hangs has to end as a named inconclusive rather than a spinner that
    never resolves — on a page about lost replies, the page losing its own
    reply and saying nothing would be the sharpest possible irony.
  */
  const post = useCallback(async (stage: string, body?: Record<string, unknown>) => {
    const res = await postTheater<StageResult & { runId: string }>(
      `/api/v1/theater/signature/${stage}`,
      { body },
    );
    if (!res.ok) {
      const e = new Error(res.failure.error);
      e.name = res.failure.reason;
      throw e;
    }
    return res.data;
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResults({});
    setRevealed(0);
    setShowEvidence(false);

    try {
      setPhase("submitting");
      const submit = await post("submit");
      setResults((r) => ({ ...r, submit }));

      /*
        Four facts from one response, paced out. The capsule only enters
        `unknown` once the fact that names it has been reached, so the drawing
        and the readouts can never be ahead of the server.
      */
      for (let i = 1; i <= 4; i++) {
        setRevealed(i);
        if (i === 3) setPhase("unknown");
        await beat(i === 4 ? 1500 : 700);
      }

      setPhase("retrying");
      await beat(600);
      const retry = await post("retry", { runId: submit.runId });
      setResults((r) => ({ ...r, retry }));
      setPhase("blocked");
      setRevealed(5);
      await beat(1600);

      setPhase("reconciling");
      setRevealed(6);
      const reconcile = await post("reconcile", { runId: submit.runId });
      await beat(900);
      setResults((r) => ({ ...r, reconcile }));
      setRevealed(7);
      await beat(700);
      setPhase("confirmed");
      setRevealed(8);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  }, [post, beat]);

  const submitEv = results.submit?.evidence ?? {};
  const retryEv = results.retry?.evidence ?? {};
  const reconcileEv = results.reconcile?.evidence ?? {};

  /* Readouts come only from returned evidence — never from `phase`. */
  const providerOrder = str(submitEv.providerHoldsOrder);
  const ourState = results.reconcile
    ? str(reconcileEv.finalState)
    : results.submit
      ? str(submitEv.ourState)
      : null;

  const newest = STAGES[revealed - 1];
  const done = revealed >= STAGES.length;

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8" aria-label="The signature incident">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{
          borderColor: accentColor(done ? "recovered" : phase === "idle" ? "conflict" : "failed", 0.4),
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <div className="border-b p-6 sm:p-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: accentInk("conflict") }}>
            The signature failure
          </p>
          <h2 className="mt-3 max-w-3xl text-[clamp(22px,3vw,38px)] font-semibold leading-[1.1] tracking-tight text-white">
            The provider created the order.{" "}
            <span style={{ color: accentInk("failed") }}>The reply disappeared.</span>
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            One electricity submission in the theater tenant, run against the real fulfilment services. Every state
            below is a value the server returned.
          </p>
        </div>

        {/*
          Our side, the wire, their side. A grid rather than one drawing, so the
          readouts wrap on a phone instead of scaling to nothing.
        */}
        <div className="grid items-center gap-4 p-6 sm:p-8 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,200px)]">
          <Side
            title="Move Relay"
            value={ourState ? ourState.toUpperCase() : "—"}
            accent={ourState === "reconciled" ? "verified" : ourState === "unknown" ? "conflict" : "verified"}
            dim={!ourState}
          />
          <HandoffCapsule phase={phase} />
          <Side
            title="Provider"
            value={providerOrder ?? "—"}
            caption={providerOrder ? "order created" : undefined}
            accent="verified"
            dim={!providerOrder}
          />
        </div>

        {/* The eight beats. `aria-live` because the sequence is the content. */}
        <div className="px-6 pb-2 sm:px-8">
          <ol className="flex flex-wrap gap-2" aria-live="polite" aria-busy={running}>
            {STAGES.map((s, i) => {
              const lit = i < revealed;
              return (
                <li
                  key={s.key}
                  className="rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-colors"
                  style={{
                    borderColor: lit ? accentColor(s.accent, 0.5) : "rgba(255,255,255,0.1)",
                    background: lit ? accentColor(s.accent, 0.1) : "transparent",
                    color: lit ? accentInk(s.accent) : "rgba(255,255,255,0.3)",
                  }}
                >
                  {s.label}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="min-h-[64px] px-6 py-4 sm:px-8">
          <AnimatePresence mode="wait">
            {newest?.note && (
              <motion.p
                key={newest.key}
                initial={{ opacity: 0, y: still ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: still ? 0 : 0.3 }}
                className="max-w-2xl text-sm leading-relaxed"
                style={{ color: accentInk(newest.accent) }}
              >
                {newest.note}
              </motion.p>
            )}
            {done && (
              <motion.p
                key="closing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: still ? 0 : 0.4 }}
                className="max-w-3xl text-sm leading-relaxed text-white/70"
              >
                The system did not recover because it guessed correctly. It recovered because it preserved enough
                identity to ask the provider safely.
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-wrap items-center gap-3 px-6 pb-6 sm:px-8 sm:pb-8">
          <button
            onClick={() => void run()}
            disabled={running}
            className="inline-flex min-h-11 items-center rounded-full px-6 text-sm font-bold uppercase tracking-wide transition-transform hover:-translate-y-px disabled:opacity-60"
            style={{ background: accentColor("conflict", 1), color: "#1a1207" }}
          >
            {running ? "Breaking…" : done ? "Break it again" : "Break the signature handoff"}
          </button>

          {(results.retry || results.reconcile) && (
            <button
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              className="inline-flex min-h-11 items-center rounded-full border px-5 text-xs font-semibold uppercase tracking-wide text-white/80"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              {showEvidence ? "Hide returned evidence" : "Inspect returned evidence"}
            </button>
          )}

          {typeof retryEv.duplicateOrdersCreated === "number" && (
            <span className="font-mono text-[11px]" style={{ color: accentInk("recovered") }}>
              duplicate orders created: {retryEv.duplicateOrdersCreated}
            </span>
          )}
        </div>

        {error && (
          <p className="px-6 pb-6 font-mono text-xs sm:px-8" style={{ color: accentInk("failed") }}>
            {error}
          </p>
        )}

        {showEvidence && (
          <div className="border-t px-6 py-5 sm:px-8" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
            {(["submit", "retry", "reconcile"] as const).map((k) =>
              results[k] ? (
                <div key={k} className="mb-4 min-w-0 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">{k}</p>
                  <p className="mt-1 text-xs text-white/70">{results[k]!.invariant}</p>
                  {/* `min-w-0` above; the pre scrolls itself rather than widening its column. */}
                  <pre
                    className="mt-2 overflow-x-auto rounded p-3 font-mono text-[11px] leading-relaxed"
                    style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}
                  >
                    {JSON.stringify(results[k]!.evidence, null, 2)}
                  </pre>
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Side({
  title,
  value,
  caption,
  accent,
  dim,
}: {
  title: string;
  value: string;
  caption?: string;
  accent: Accent;
  dim: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">{title}</p>
      <p
        className="mt-1 truncate font-mono text-lg font-semibold"
        style={{ color: dim ? "rgba(255,255,255,0.25)" : accentInk(accent) }}
      >
        {value}
      </p>
      {caption && <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">{caption}</p>}
    </div>
  );
}
