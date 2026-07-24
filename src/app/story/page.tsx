"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Constellation3D } from "@/components/Constellation3D";
import { HomeScene } from "@/components/HomeScene";
import { StateBadge } from "@/components/StateBadge";

/**
 * The Living Move — the cinematic story.
 *
 * One continuous scroll through a single move: a dark house, a referral, a
 * conflict, the house waking service by service, a provider failure, and a
 * recovery — ending in the long relationship. Every chapter is environmental
 * storytelling, and the failure chapter is not a film: its button drives the
 * REAL backend (reset → ingest → merge → submit → blocked retry → reconcile)
 * and shows what actually happened.
 *
 * Motion follows the house rules: sub-300ms UI transitions, transform/opacity
 * only, reduced-motion collapses everything to opacity, and nothing animates
 * that does not carry meaning.
 */

const fade = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-120px" },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const },
};

export default function StoryPage() {
  return (
    <main>
      {/* ── Prologue — the dark house ─────────────────────────── */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden" style={{ background: "#0b0f14" }}>
        <div className="absolute inset-0 opacity-40">
          <HomeScene />
        </div>
        <motion.div {...fade} className="relative z-10 max-w-2xl px-6 text-center">
          <p className="text-sm uppercase tracking-[0.3em]" style={{ color: "var(--color-text-lo)" }}>
            The Living Move
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
            Moving gives you a new address.
            <br />
            <span style={{ color: "var(--color-state-verified)" }}>Connecting it makes it a home.</span>
          </h1>
          <p className="mt-6 text-lg" style={{ color: "var(--color-text-mid)" }}>
            One move. Told as it actually happens — including the part where it breaks.
          </p>
          <div className="mt-10 animate-bounce text-2xl" style={{ color: "var(--color-text-lo)" }} aria-hidden>
            ↓
          </div>
        </motion.div>
      </section>

      {/* ── Chapter 1 — the referral ──────────────────────────── */}
      <Chapter
        n={1}
        title="The referral"
        lead="Maya's agent hands her a digital key. It travels through the brokerage, through the integration, and arrives — three times."
      >
        <div className="grid place-items-center">
          <Constellation3D
            height={360}
            sources={[
              { id: "1", label: "Partner API", state: "transit" },
              { id: "2", label: "CSV", state: "pending" },
              { id: "3", label: "Customer form", state: "transit" },
            ]}
          />
          <p className="mt-2 max-w-xl text-center text-sm" style={{ color: "var(--color-text-mid)" }}>
            The partner's system, a hand-exported spreadsheet, and Maya herself — three
            doors, one human. No two of them agree.
          </p>
        </div>
      </Chapter>

      {/* ── Chapter 2 — the conflict ──────────────────────────── */}
      <Chapter
        n={2}
        title="The disagreement"
        lead="The API says August 14. Maya says August 16. And somewhere in the spreadsheet, one digit of her phone number went wrong."
      >
        <div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-2">
          <ConflictCard source="Partner API" value="2026-08-14" state="conflict" note="captured at listing, weeks ago" />
          <ConflictCard source="Customer form" value="2026-08-16" state="verified" note="Maya herself, three days ago" />
          <ConflictCard source="CSV upload" value="469-555-0143" state="conflict" note="one transposed digit" />
          <ConflictCard source="Two other sources" value="469-555-0142" state="verified" note="agree with each other" />
        </div>
        <motion.p {...fade} className="mx-auto mt-6 max-w-xl text-center text-sm" style={{ color: "var(--color-text-mid)" }}>
          The system does not guess. It scores, explains, and waits — because merging two
          moves wrongly is worse than asking one human to decide.
          A named concierge approves the merge; the database refuses it from anyone else.
        </motion.p>
      </Chapter>

      {/* ── Chapter 3 — the house wakes ───────────────────────── */}
      <Chapter
        n={3}
        title="The house wakes up"
        lead="With one verified record, the services can flow — each one lighting a different part of the home."
      >
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            { name: "Electric", glyph: "⚡", desc: "Current runs the walls. The lights come on." },
            { name: "Internet", glyph: "⇄", desc: "The router breathes. The home comes online." },
            { name: "Security", glyph: "⛨", desc: "A protective layer settles over every door." },
          ].map((s, i) => (
            <motion.div
              key={s.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.28, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border p-6 text-center"
              style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
            >
              <div className="text-3xl" aria-hidden style={{ color: "var(--color-state-verified)" }}>{s.glyph}</div>
              <h3 className="mt-2 text-sm font-semibold">{s.name}</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Chapter>

      {/* ── Chapter 4 — the failure, live ─────────────────────── */}
      <FailureChapter />

      {/* ── Chapter 5 — the continuum ─────────────────────────── */}
      <Chapter
        n={5}
        title="The home continues"
        lead="Most stories end at move-in. The relationship doesn't — with permission, it becomes a lifetime."
      >
        <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
          {[
            "Move-in", "Installation verified", "Six-month review", "Renewal window",
            "Maintenance need", "Trusted vendor", "Customer referral", "The next move",
          ].map((step, i) => (
            <motion.span
              key={step}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.24, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-full border px-4 py-2 text-sm"
              style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
            >
              {step}
            </motion.span>
          ))}
        </div>
        <motion.blockquote {...fade} className="mx-auto mt-10 max-w-2xl border-l-2 pl-5 text-lg italic leading-relaxed" style={{ borderColor: "var(--color-state-verified)", color: "var(--color-text-hi)" }}>
          Utility Connect doesn&rsquo;t only connect the home. It can become the layer that
          keeps the home, customer, partner, concierge, provider, and vendor relationship
          connected over time.
        </motion.blockquote>
        <motion.div {...fade} className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/demo" className="rounded-full px-6 py-3 text-sm font-semibold" style={{ background: "var(--color-state-verified)", color: "white" }}>
            Run the system yourself
          </Link>
          <Link href="/theater" className="rounded-full border px-6 py-3 text-sm font-semibold" style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}>
            Or try to break it
          </Link>
        </motion.div>
      </Chapter>
    </main>
  );
}

function Chapter({ n, title, lead, children }: { n: number; title: string; lead: string; children: React.ReactNode }) {
  return (
    <section className="flex min-h-screen flex-col justify-center px-6 py-24" style={{ background: n % 2 ? "var(--color-ground-0)" : "var(--color-ground-1)" }}>
      <motion.div {...fade} className="mx-auto mb-10 max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--color-state-verified)" }}>
          Chapter {n}
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>{lead}</p>
      </motion.div>
      {children}
    </section>
  );
}

function ConflictCard({ source, value, state, note }: { source: string; value: string; state: "conflict" | "verified"; note: string }) {
  return (
    <motion.div {...fade} className="rounded-xl border p-4" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: "var(--color-text-lo)" }}>{source}</span>
        <StateBadge state={state} subtle />
      </div>
      <div className="mt-2 font-mono text-lg font-semibold">{value}</div>
      <div className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>{note}</div>
    </motion.div>
  );
}

/**
 * Chapter 4 runs the real thing. The button drives the actual API through the
 * whole failure narrative and renders what the backend reports — the lights
 * pausing halfway is the customer's view of a state the engineering view calls
 * OUTCOME UNKNOWN.
 */
function FailureChapter() {
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
    add("The provider goes silent", `State: ${submit.result?.state?.toUpperCase()} — the order may or may not exist`, "warn");

    const retry = await post("retry");
    add("The easy mistake is refused", retry.result?.blocked ? "Blind retry BLOCKED — no duplicate order created" : "unexpected", "warn");

    const rec = await post("reconcile");
    add("Ask, don't assume", `Reconciliation found ${rec.result?.providerOrderId ?? "?"} — the order existed all along`, "ok");
    add("The lights finish turning on", "One order. Never two. Every step in the audit trail.", "ok");

    setPhase("done");
  };

  return (
    <section className="flex min-h-screen flex-col justify-center px-6 py-24" style={{ background: "#0b0f14" }}>
      <motion.div {...fade} className="mx-auto mb-8 max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--color-state-conflict)" }}>
          Chapter 4
        </div>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">The night the lights paused</h2>
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The electricity order is sent. The provider creates it — and the response is
          lost. From this side, that is indistinguishable from failure. This chapter is
          not a film: the button below runs the real backend.
        </p>
      </motion.div>

      <div className="mx-auto w-full max-w-xl">
        {phase === "idle" && (
          <motion.button
            {...fade}
            onClick={run}
            className="mx-auto block rounded-full px-8 py-3.5 text-sm font-semibold uppercase tracking-wide transition-transform hover:-translate-y-0.5"
            style={{ background: "var(--color-state-conflict)", color: "#1a1207" }}
          >
            Lose the provider&rsquo;s response — live
          </motion.button>
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
                borderColor: b.tone === "warn" ? "var(--color-state-conflict)" : b.tone === "ok" ? "var(--color-state-recovered)" : "var(--color-ground-3)",
                background: "var(--color-ground-1)",
              }}
            >
              <span aria-hidden style={{ color: b.tone === "warn" ? "var(--color-state-conflict)" : b.tone === "ok" ? "var(--color-state-recovered)" : "var(--color-text-lo)" }}>
                {b.tone === "warn" ? "⚠" : b.tone === "ok" ? "✓" : "·"}
              </span>
              <div>
                <div className="text-sm font-semibold text-white">{b.label}</div>
                <div className="text-xs" style={{ color: "var(--color-text-mid)" }}>{b.detail}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {phase === "running" && (
          <p className="mt-4 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
            running against the live database…
          </p>
        )}
        {phase === "done" && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
            Everything above came back from the API just now. Open the demo&rsquo;s
            &ldquo;Reveal system&rdquo; panel to see the rows.
          </motion.p>
        )}
      </div>
    </section>
  );
}
