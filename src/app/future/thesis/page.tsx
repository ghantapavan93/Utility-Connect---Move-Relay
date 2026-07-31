"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { FilmGrain } from "@/components/cinematic";
import { useStillness } from "@/lib/use-stillness";
import { asRoute } from "@/lib/routes";
import {
  CAPABILITIES,
  HORIZONS,
  ARCHITECTURE_STACK,
  FAILURE_MATRIX,
  OBSERVABILITY_SIGNALS,
  BUILD_NEXT,
  ROLES,
  LABEL_META,
  type Capability,
  type Role,
  type RealityLabel,
} from "@/lib/future-thesis";

/**
 * /future/thesis — the working product thesis behind the cinematic roadmap.
 *
 * /future stays exactly what it is: the continuum, told as film. This page is
 * the layer underneath it for the reader who asks "and how would that actually
 * work" — four horizons, a role selector that reorganises the same roadmap
 * around one person's questions, a capability explorer whose every entry
 * carries its failure modes and the strongest reason NOT to build it, the
 * shared architecture with each layer marked as existing or roadmap, and a
 * failure matrix instead of a promise.
 *
 * The honesty rules are enforced in `future-thesis.test.ts`, not here: built
 * items must prove themselves at a live route, unbuilt items may not link
 * proof, and the three unbuilt architecture layers are pinned by name.
 */

const LABEL_ACCENT: Record<RealityLabel, Accent> = {
  built: "verified",
  validation: "internet",
  hypothesis: "unknown",
  expansion: "security",
};

function LabelChip({ label }: { label: RealityLabel }) {
  const accent = LABEL_ACCENT[label];
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
      style={{ borderColor: accentColor(accent, 0.5), color: accentInk(accent) }}
    >
      {LABEL_META[label].heading}
    </span>
  );
}

/**
 * One capability, explorable. Business view leads; the engineering view is the
 * same card flipped, not a different claim — AI responsibility, deterministic
 * responsibility, required data, observability.
 */
function CapabilityCard({ capability }: { capability: Capability }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"business" | "engineering">("business");
  const accent = LABEL_ACCENT[capability.label];

  return (
    <li
      className="cine-glass min-w-0 rounded-2xl transition-shadow"
      style={{
        borderColor: accentColor(accent, open ? 0.55 : 0.28),
        boxShadow: open ? `0 12px 40px -18px ${accentColor(accent, 0.45)}` : "none",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-start justify-between gap-3 p-4 text-left"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-white">{capability.title}</span>
          <span className="mt-1 block text-[12px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            {capability.problem}
          </span>
        </span>
        <LabelChip label={capability.label} />
      </button>

      {open && (
        <div className="min-w-0 border-t p-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          {/* The flip. Same capability, two altitudes, one truth. */}
          <div role="group" aria-label="View" className="flex gap-1">
            {(["business", "engineering"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className="min-h-11 rounded-full border px-4 text-[10px] font-bold uppercase tracking-[0.14em]"
                style={{
                  borderColor: view === v ? accentColor(accent, 0.6) : "rgba(255,255,255,0.15)",
                  color: view === v ? accentInk(accent) : "var(--color-text-lo)",
                  background: view === v ? accentColor(accent, 0.08) : "transparent",
                }}
              >
                {v === "business" ? "Business view" : "Engineering view"}
              </button>
            ))}
          </div>

          {view === "business" ? (
            <dl className="mt-4 space-y-3 text-[13px] leading-relaxed">
              <Row label="Real scenario">{capability.scenario}</Row>
              <Row label="Smallest experiment">{capability.smallestExperiment}</Row>
              <Row label="Success is measured by">
                <List items={capability.successMeasures} />
              </Row>
              <Row label="What happens when AI is wrong">
                <List items={capability.failureModes} />
              </Row>
              <Row label="The reason not to build it" tone="conflict">
                {capability.reasonNotToBuild}
              </Row>
            </dl>
          ) : (
            <dl className="mt-4 space-y-3 text-[13px] leading-relaxed">
              <Row label="AI may own">{capability.aiResponsibility}</Row>
              <Row label="Stays deterministic">{capability.deterministicResponsibility}</Row>
              <Row label="Required data">
                <List items={capability.requiredData} mono />
              </Row>
              <Row label="Observability">
                <List items={capability.observability} />
              </Row>
            </dl>
          )}

          {capability.proof && (
            <Link
              href={asRoute(capability.proof.href)}
              className="mt-4 inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
              style={{ borderColor: accentColor("verified", 0.5), color: accentInk("verified") }}
            >
              {capability.proof.label} →
            </Link>
          )}
        </div>
      )}
    </li>
  );
}

function Row({ label, children, tone }: { label: string; children: React.ReactNode; tone?: Accent }) {
  return (
    <div className="min-w-0">
      <dt
        className="text-[9px] font-bold uppercase tracking-[0.16em]"
        style={{ color: tone ? accentInk(tone) : "var(--color-text-lo)" }}
      >
        {label}
      </dt>
      <dd className="mt-1 text-white/80">{children}</dd>
    </div>
  );
}

function List({ items, mono }: { items: string[]; mono?: boolean }) {
  return (
    <ul className="list-none space-y-1">
      {items.map((item) => (
        <li key={item} className={mono ? "font-mono text-[11px]" : undefined}>
          · {item}
        </li>
      ))}
    </ul>
  );
}

export default function FutureThesis() {
  const still = useStillness();
  const [role, setRole] = useState<Role | "all">("all");
  /*
    The selected failure wires the two halves of the contract together: pick a
    row in the matrix and the architecture stack highlights the layers that
    contain it. Name-matched, and the names are pinned by test — a renamed
    layer goes red in the suite rather than quietly unwiring the highlight.
  */
  const [failure, setFailure] = useState<string | null>(null);
  /*
    Which horizon the reader is inside, watched rather than asked. The sticky
    bar is the one element that follows them through seventeen cards, so it is
    where "you are here" belongs — pips in the bar light as the matching
    section crosses the upper third of the viewport.
  */
  const [activeHorizon, setActiveHorizon] = useState<number | null>(null);
  useEffect(() => {
    /*
      Scroll geometry, not IntersectionObserver — deliberately. IO callbacks
      ride on rendering steps, so a backgrounded or non-composited tab never
      delivers them; this page was first verified in exactly such a state and
      the pips sat dark while the sections scrolled by. Reading rects on a
      throttled scroll listener costs four getBoundingClientRect calls and
      works whether or not the tab is painting.
    */
    const sections = HORIZONS.map((h) => ({
      horizon: h.horizon,
      el: document.getElementById(`h${h.horizon}-heading`)?.closest("section") ?? null,
    })).filter((x): x is { horizon: 0 | 1 | 2 | 3; el: HTMLElement } => x.el !== null);
    if (sections.length === 0) return;

    let pending = false;
    const read = () => {
      pending = false;
      const band = window.innerHeight * 0.3;
      let current: number | null = null;
      for (const { horizon, el } of sections) {
        const r = el.getBoundingClientRect();
        if (r.top <= band && r.bottom >= band * 0.5) current = horizon;
      }
      setActiveHorizon(current);
    };
    const onScroll = () => {
      if (pending) return;
      pending = true;
      setTimeout(read, 80);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
    // Re-measure when the role filter changes what is mounted.
  }, [role]);
  const containedLayers = useMemo(() => {
    const f = FAILURE_MATRIX.find((x) => x.failure === failure);
    return new Set(f?.containedBy ?? []);
  }, [failure]);

  const visible = useMemo(
    () => (role === "all" ? CAPABILITIES : CAPABILITIES.filter((c) => c.roles.includes(role))),
    [role],
  );

  return (
    <main className="relative min-h-dvh bg-[#04070b] text-white">
      {/*
        The same atmosphere the other cinematic pages carry — the drifting
        aurora and the grain — so the thesis reads as a member of the family
        rather than a document pasted into it. Both are reduced-motion and
        high-contrast gated in globals.css; nothing here needs to repeat that.
      */}
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="thesis" />

      <div className="relative mx-auto min-w-0 max-w-5xl px-6 py-14" style={{ zIndex: 1 }}>
      <Link href="/future" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the continuum
      </Link>

      {/* ════════ Opening ════════ */}
      <header className="mt-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: accentInk("security") }}>
          The product thesis · from utility concierge to move intelligence platform
        </p>
        <motion.h1
          initial={{ opacity: 0, y: still ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: still ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 max-w-3xl text-[clamp(28px,4.4vw,50px)] font-semibold leading-[1.06] tracking-tight text-white"
        >
          The move is today&rsquo;s product.
          <br />
          <span style={{ color: accentInk("internet") }}>The intelligence around it is the platform.</span>
        </motion.h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          Understand the move as a continuously changing operational object, then use governed AI to
          help every participant make the next correct decision. Not a chatbot — an operating layer:
          several role-specific experiences on one Move Record, one authorization model, one evidence
          system, one tool registry, one audit trail.
        </p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          Everything below carries a reality label, every built claim links to the live route that
          proves it, and each entry states the strongest reason <em>not</em> to build it. The labels
          are enforced by tests, not by intention.
        </p>
      </header>

      {/* ════════ Role selector ════════ */}
      {/*
        Sticky, and frosted for the one reason glass earns its keep here: the
        bar floats over drifting light and scrolling content, and the blur is
        what keeps its labels readable against both. Deco glass on a static
        card would be noise; this is glass doing a job.
      */}
      <section
        aria-labelledby="role-heading"
        className="cine-glass sticky top-0 z-20 -mx-6 mt-12 px-6 py-3"
        style={{ borderLeft: "none", borderRight: "none" }}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="role-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
            Read it as
          </h2>
          {/* You-are-here, derived from scroll position — never from clicks. */}
          <ol className="flex items-center gap-1.5" aria-label="Current horizon">
            {HORIZONS.map((h) => {
              const active = activeHorizon === h.horizon;
              return (
                <li key={h.horizon} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background: active ? accentInk("internet") : "rgba(255,255,255,0.22)",
                      boxShadow: active ? `0 0 8px ${accentColor("internet", 0.8)}` : "none",
                    }}
                  />
                  {active && (
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: accentInk("internet") }}>
                      {h.name}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <div role="group" aria-label="Role" className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setRole("all")}
            aria-pressed={role === "all"}
            className="min-h-11 rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
            style={{
              borderColor: role === "all" ? accentColor("internet", 0.6) : "rgba(255,255,255,0.15)",
              color: role === "all" ? accentInk("internet") : "var(--color-text-lo)",
            }}
          >
            Everyone
          </button>
          {ROLES.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => setRole(r.role)}
              aria-pressed={role === r.role}
              className="min-h-11 rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
              style={{
                borderColor: role === r.role ? accentColor("internet", 0.6) : "rgba(255,255,255,0.15)",
                color: role === r.role ? accentInk("internet") : "var(--color-text-lo)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        {role !== "all" && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            Showing the {visible.length} of {CAPABILITIES.length} capabilities that serve this role —
            the roadmap reorganised, not rewritten.
          </p>
        )}
      </section>

      {/* ════════ The four horizons ════════ */}
      {HORIZONS.map((h) => {
        const caps = visible.filter((c) => c.horizon === h.horizon);
        if (caps.length === 0) return null;
        const accent = LABEL_ACCENT[caps[0]!.label];
        return (
          <section key={h.horizon} aria-labelledby={`h${h.horizon}-heading`} className="mt-14 min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span
                aria-hidden
                className="font-mono text-4xl font-bold leading-none"
                style={{ color: accentColor(accent, 0.35) }}
              >
                {h.horizon}
              </span>
              <h2 id={`h${h.horizon}-heading`} className="text-2xl font-semibold tracking-tight text-white">
                {h.name}
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk(accent) }}>
                {h.labelHeading} · {h.window}
              </span>
            </div>
            <ul className="mt-4 list-none space-y-3">
              {caps.map((c) => (
                <CapabilityCard key={c.id} capability={c} />
              ))}
            </ul>
          </section>
        );
      })}

      {/* ════════ What gets built next ════════ */}
      <section
        aria-labelledby="build-heading"
        className="cine-glass mt-16 min-w-0 rounded-2xl p-6"
        style={{ borderColor: accentColor("internet", 0.4) }}
      >
        <h2 id="build-heading" className="text-xl font-semibold tracking-tight text-white">
          What gets built versus what gets shown
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          Any number of ideas may appear above as labelled hypotheses. Interactivity is the claim
          &ldquo;this works&rdquo;, and that claim is rationed: exactly three capabilities are
          committed as the next builds.
        </p>
        <ol className="mt-4 grid gap-3 md:grid-cols-3">
          {BUILD_NEXT.map((b, i) => (
            <li key={b.title} className="min-w-0 rounded-xl border p-4" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
              <span className="font-mono text-[11px]" style={{ color: accentInk("internet") }}>
                Build {i + 1}
              </span>
              <h3 className="mt-1 text-[14px] font-semibold text-white/90">{b.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                {b.proves}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ════════ The shared architecture ════════ */}
      <section aria-labelledby="arch-heading" className="mt-16 min-w-0">
        <h2 id="arch-heading" className="text-xl font-semibold tracking-tight text-white">
          One architecture under every horizon
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          Each layer is marked with what it is: running in this repository today, or roadmap. Ten of
          thirteen exist — the thesis is an extension, not a rebuild. MCP may appear as a controlled
          integration adapter at the tool boundary; authorization, scoping, validation and policy
          stay the application&rsquo;s.
        </p>
        {failure && (
          <p className="mt-3 max-w-2xl text-[12px]" style={{ color: accentInk("failed") }}>
            Showing where <span className="font-semibold">“{failure}”</span> is contained. The
            highlighted layers are where it dies.
          </p>
        )}
        <ol className="mt-4 space-y-0 border-l" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          {ARCHITECTURE_STACK.map((layer) => {
            const contains = containedLayers.has(layer.layer);
            const dimmed = failure !== null && !contains;
            return (
            <li
              key={layer.layer}
              /*
                No transition class: a CSSTransition was observed stuck
                "running" on these rows, holding computed opacity at 1 while
                the inline style said 0.35 — the dimming looked wired and never
                fired. The state change is instant instead, which reduced
                motion prefers anyway.
              */
              className="relative min-w-0 pb-4 pl-5 last:pb-0"
              style={{ opacity: dimmed ? 0.35 : 1 }}
            >
              <span
                aria-hidden
                className="absolute -left-[4px] top-[6px] h-2 w-2 rounded-full"
                style={{
                  background: contains
                    ? accentInk("failed")
                    : layer.exists
                      ? accentInk("verified")
                      : accentColor("unknown", 0.9),
                  boxShadow: contains ? `0 0 12px ${accentColor("failed", 0.7)}` : "none",
                }}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-semibold" style={{ color: contains ? accentInk("failed") : "rgba(255,255,255,0.9)" }}>{layer.layer}</span>
                {contains && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: accentInk("failed") }}>
                    contains it
                  </span>
                )}
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: layer.exists ? accentInk("verified") : accentInk("unknown") }}
                >
                  {layer.exists ? "exists" : "roadmap"}
                </span>
              </div>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-mid)" }}>
                {layer.detail}
              </p>
            </li>
            );
          })}
        </ol>
      </section>

      {/* ════════ What happens when AI is wrong ════════ */}
      <section aria-labelledby="fail-heading" className="mt-16 min-w-0">
        <h2 id="fail-heading" className="text-xl font-semibold tracking-tight text-white">
          What happens when AI is wrong
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          A failure matrix instead of a promise. Every row names what the interface must show and
          how the system contains it — the built rows are today&rsquo;s behaviour, the rest are the
          contract the roadmap is held to.{" "}
          <span className="text-white/80">
            Select a row and the architecture above shows the layers where that failure dies.
          </span>
        </p>
        <div className="cine-glass mt-4 overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-left text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                {["Failure", "The interface must show", "System response"].map((h) => (
                  <th key={h} className="p-3 text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAILURE_MATRIX.map((f) => {
                const selected = failure === f.failure;
                return (
                <tr
                  key={f.failure}
                  onClick={() => setFailure(selected ? null : f.failure)}
                  className="cursor-pointer border-b transition-colors last:border-0"
                  style={{
                    borderColor: "rgba(255,255,255,0.06)",
                    background: selected ? accentColor("failed", 0.08) : "transparent",
                  }}
                >
                  <td className="p-3 font-semibold" style={{ color: selected ? accentInk("failed") : "rgba(255,255,255,0.85)" }}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      className="min-h-11 text-left font-semibold"
                      onClick={(e) => { e.stopPropagation(); setFailure(selected ? null : f.failure); }}
                    >
                      {f.failure}
                    </button>
                    {selected && (
                      <span className="mt-1 flex flex-wrap gap-1">
                        {f.containedBy.map((l) => (
                          <span
                            key={l}
                            className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                            style={{ borderColor: accentColor("failed", 0.5), color: accentInk("failed") }}
                          >
                            {l}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="p-3" style={{ color: "var(--color-text-mid)" }}>{f.interfaceShows}</td>
                  <td className="p-3" style={{ color: "var(--color-text-mid)" }}>{f.systemResponse}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ════════ Observability ════════ */}
      <section aria-labelledby="obs-heading" className="mt-16 min-w-0">
        <h2 id="obs-heading" className="text-xl font-semibold tracking-tight text-white">
          The observability every AI run owes
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          OpenTelemetry&rsquo;s GenAI conventions now cover model requests, token usage, tool calls
          and execution attributes — a standards-based floor. Per run:
        </p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {OBSERVABILITY_SIGNALS.map((s) => (
            <div key={s.signal} className="min-w-0 border-l pl-3" style={{ borderColor: accentColor("internet", 0.3) }}>
              <dt className="text-[12px] font-semibold text-white/85">{s.signal}</dt>
              <dd className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>{s.why}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ════════ Closing ════════ */}
      <section
        className="cine-glass mt-16 rounded-2xl p-6"
        style={{
          borderColor: accentColor("security", 0.4),
          boxShadow: `0 20px 60px -30px ${accentColor("security", 0.5)}`,
        }}
      >
        <p className="max-w-2xl text-base font-semibold leading-relaxed text-white/90">
          The question is not which model sounds smartest.{" "}
          <span style={{ color: accentInk("security") }}>
            The question is which model can be trusted for this exact task, at this exact cost, under
            this exact policy.
          </span>
        </p>
        <p className="mt-3 max-w-2xl text-[12px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          Horizon 0 is running behind the links above. Everything else is labelled for what it is and
          waits on validation with the people who own the operation — which is how a thesis stays a
          thesis instead of quietly becoming a claim.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/agent"
            className="inline-flex min-h-11 items-center rounded-full px-5 text-[12px] font-bold uppercase tracking-wide text-white"
            style={{ background: accentColor("verified", 1) }}
          >
            See horizon 0 working
          </Link>
          <Link
            href="/future"
            className="inline-flex min-h-11 items-center rounded-full border px-5 text-[12px] font-bold uppercase tracking-wide"
            style={{ borderColor: "rgba(255,255,255,0.25)", color: "var(--color-text-mid)" }}
          >
            The continuum, as film
          </Link>
        </div>
      </section>
      </div>
    </main>
  );
}
