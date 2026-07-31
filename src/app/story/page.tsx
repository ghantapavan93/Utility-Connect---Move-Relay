"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LivingHome } from "@/components/living-home/LivingHome";
import { RouteDistinction } from "@/components/nav/RouteDistinction";

/**
 * The Living Move.
 *
 * Act I is the cinematic: one continuous 3D scene, scroll as the timeline, the
 * camera choreographed through seven chapters while the house itself acts the
 * story. Act II is the part no film can fake — the same failure, run LIVE
 * against the real backend, returning the rows.
 */
export default function StoryPage() {
  return (
    <main className="relative" style={{ background: "#0a0f15" }}>
      {/*
        The aurora joins after the film's own visuals end — it sits behind
        everything, and the LivingHome cinematic paints over it entirely, so
        the drift only becomes visible exactly where the page used to go flat:
        the live-run act and the closing.
      */}
      <div className="cine-aurora" aria-hidden />
      <div className="relative" style={{ zIndex: 1 }}>
      <LivingHome />
      {/*
        After the film, before the live run.

        The cinematic is the one thing on this site that asks for two minutes of
        uninterrupted attention, so nothing is placed above it. The moment it
        ends is exactly when a reviewer is deciding whether there is anything
        behind it — which is the moment to say that two other routes answer that
        question directly.
      */}
      <RouteDistinction />
      <FailureLive />
      <Closing />
      </div>
    </main>
  );
}

/**
 * The button drives the actual API through reset → ingest → merge → submit →
 * blocked retry → reconcile, and renders what the backend reports. The
 * cinematic showed the lights pausing; this is the machinery that paused them.
 */
function FailureLive() {
  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [beats, setBeats] = useState<Array<{ label: string; detail: string; tone: "warn" | "ok" | "info" | "failed" }>>([]);

  /*
    Every beat below is gated on the response that would make it true.

    The first version of this ran seven POSTs and narrated success over
    whatever came back: a failed reconcile printed "Reconciliation found ? —
    the order existed all all along" in the recovered green, and a dead server
    still ended on "One order. Never two." That is a story about checking
    outcomes, told by a component that did not check its own — the strongest
    false-calm anywhere in this repository, sitting on the page whose whole
    subject is refusing to guess.

    So `post` now reports failure, the sequence stops at the first step that
    did not happen, and the closing line renders only when the recovery it
    describes actually did.
  */
  const run = async () => {
    setPhase("running");
    setBeats([]);
    const post = async (s: string): Promise<{ ok: boolean; result?: Record<string, unknown> }> => {
      try {
        const res = await fetch(`/api/v1/demo/${s}`, { method: "POST" });
        const json = await res.json().catch(() => null);
        return { ok: res.ok && json?.ok === true, result: json?.result };
      } catch {
        return { ok: false };
      }
    };
    const add = (label: string, detail: string, tone: "warn" | "ok" | "info" | "failed") =>
      setBeats((b) => [...b, { label, detail, tone }]);
    const abort = (step: string) => {
      add(
        "The story stopped here",
        `The "${step}" step did not complete against the live backend. Nothing past this point is claimed, because it did not happen.`,
        "failed",
      );
      setPhase("done");
    };

    for (const s of ["reset", "ingest", "create_move", "merge"] as const) {
      if (!(await post(s)).ok) return abort(s);
    }
    add("The record is verified", "One canonical move, human-approved", "info");

    const submit = await post("submit");
    if (!submit.ok) return abort("submit");
    add(
      "The provider goes silent",
      `State: ${String(submit.result?.state ?? "unknown").toUpperCase()} — the order may or may not exist`,
      "warn",
    );

    const retry = await post("retry");
    if (!retry.ok) return abort("retry");
    if (retry.result?.blocked || retry.result?.deduplicated) {
      add("The easy mistake is refused", "Blind retry BLOCKED — no duplicate order created", "warn");
    } else {
      // The core invariant did not hold. That is a red alarm, not one
      // lowercase word.
      add(
        "The boundary did not hold",
        "The retry was NOT blocked. This should never happen — the audit trail for this run needs reading.",
        "failed",
      );
      setPhase("done");
      return;
    }

    const rec = await post("reconcile");
    const orderId = rec.result?.providerOrderId;
    if (!rec.ok || !orderId) return abort("reconcile");
    add("Ask, don't assume", `Reconciliation found ${String(orderId)} — the order existed all along`, "ok");
    add("The lights finish turning on", "One order. Never two. Every step in the audit trail.", "ok");

    setPhase("done");
  };

  return (
    <section className="flex min-h-screen flex-col justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mb-8 max-w-2xl text-center"
      >
        <div className="text-xs font-bold uppercase tracking-[0.3em]" style={{ color: "var(--color-state-conflict)" }}>
          Act II · Not a film
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          You just watched the lights pause.
          <br />
          Now make it happen for real.
        </h2>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>
          The button below runs the real backend — real database, real state machine,
          real audit rows. What comes back is what actually happened.
        </p>
      </motion.div>

      <div className="mx-auto w-full max-w-xl">
        {phase === "idle" && (
          <button
            onClick={run}
            className="mx-auto block rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--color-state-conflict)", color: "#1a1207" }}
          >
            Lose the provider&rsquo;s response — live
          </button>
        )}

        <div className="mt-6 space-y-3">
          {beats.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-start gap-3 rounded-xl border p-4"
              style={{
                borderColor:
                  b.tone === "failed"
                    ? "var(--color-state-failed)"
                    : b.tone === "warn"
                      ? "var(--color-state-conflict)"
                      : b.tone === "ok"
                        ? "var(--color-state-recovered)"
                        : "rgba(255,255,255,0.15)",
                background: b.tone === "failed" ? "rgba(229,72,77,0.08)" : "rgba(255,255,255,0.04)",
              }}
            >
              <span
                aria-hidden
                style={{
                  color:
                    b.tone === "failed"
                      ? "var(--color-state-failed)"
                      : b.tone === "warn"
                        ? "var(--color-state-conflict)"
                        : b.tone === "ok"
                          ? "var(--color-state-recovered)"
                          : "rgba(255,255,255,0.4)",
                }}
              >
                {b.tone === "failed" ? "✕" : b.tone === "warn" ? "⚠" : b.tone === "ok" ? "✓" : "·"}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{b.label}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{b.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {phase === "running" && (
          <p className="mt-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            running against the live database…
          </p>
        )}
        {phase === "done" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Everything above came back from the API just now. Open the demo&rsquo;s
            &ldquo;⚿ Reveal system&rdquo; panel to read the rows.
          </motion.p>
        )}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-6 pb-28 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-120px" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-2xl text-center"
      >
        <blockquote className="text-xl italic leading-relaxed text-white/85">
          Utility Connect doesn&rsquo;t only connect the home. It can become the layer that
          keeps the home, customer, partner, concierge, provider, and vendor relationship
          connected over time.
        </blockquote>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/demo" className="rounded-full px-6 py-3 text-sm font-semibold text-white" style={{ background: "var(--color-state-verified)" }}>
            Run the system yourself
          </Link>
          <Link href="/theater" className="rounded-full border px-6 py-3 text-sm font-semibold text-white" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
            Or try to break it
          </Link>
          <Link href="/connect-flow" className="rounded-full border px-6 py-3 text-sm font-semibold text-white" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
            Submit your own move
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
