"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LivingMoveCinematic } from "@/components/LivingMoveCinematic";

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
    <main style={{ background: "#0a0f15" }}>
      <LivingMoveCinematic />
      <FailureLive />
      <Closing />
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
  const [beats, setBeats] = useState<Array<{ label: string; detail: string; tone: "warn" | "ok" | "info" }>>([]);

  const run = async () => {
    setPhase("running");
    setBeats([]);
    const post = (s: string) => fetch(`/api/v1/demo/${s}`, { method: "POST" }).then((r) => r.json());
    const add = (label: string, detail: string, tone: "warn" | "ok" | "info") =>
      setBeats((b) => [...b, { label, detail, tone }]);

    for (const s of ["reset", "ingest", "create_move", "merge"]) await post(s);
    add("The record is verified", "One canonical move, human-approved", "info");

    const submit = await post("submit");
    add("The provider goes silent", `State: ${String(submit.result?.state).toUpperCase()} — the order may or may not exist`, "warn");

    const retry = await post("retry");
    add("The easy mistake is refused", retry.result?.blocked ? "Blind retry BLOCKED — no duplicate order created" : "unexpected", "warn");

    const rec = await post("reconcile");
    add("Ask, don't assume", `Reconciliation found ${rec.result?.providerOrderId ?? "?"} — the order existed all along`, "ok");
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
                  b.tone === "warn" ? "var(--color-state-conflict)" : b.tone === "ok" ? "var(--color-state-recovered)" : "rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <span aria-hidden style={{ color: b.tone === "warn" ? "var(--color-state-conflict)" : b.tone === "ok" ? "var(--color-state-recovered)" : "rgba(255,255,255,0.4)" }}>
                {b.tone === "warn" ? "⚠" : b.tone === "ok" ? "✓" : "·"}
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
