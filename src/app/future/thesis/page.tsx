"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
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
      className="min-w-0 rounded-2xl border"
      style={{
        borderColor: accentColor(accent, open ? 0.5 : 0.25),
        background: open ? accentColor(accent, 0.04) : "rgba(255,255,255,0.02)",
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
              href={capability.proof.href as never}
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

  const visible = useMemo(
    () => (role === "all" ? CAPABILITIES : CAPABILITIES.filter((c) => c.roles.includes(role))),
    [role],
  );

  return (
    <main className="mx-auto min-w-0 max-w-5xl px-6 py-14">
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
      <section aria-labelledby="role-heading" className="mt-12">
        <h2 id="role-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
          Read it as
        </h2>
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
              <h2 id={`h${h.horizon}-heading`} className="text-xl font-semibold tracking-tight text-white">
                Horizon {h.horizon} — {h.name}
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
      <section aria-labelledby="build-heading" className="mt-16 min-w-0 rounded-2xl border p-6" style={{ borderColor: accentColor("internet", 0.35), background: accentColor("internet", 0.04) }}>
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
        <ol className="mt-4 space-y-0 border-l" style={{ borderColor: "rgba(255,255,255,0.14)" }}>
          {ARCHITECTURE_STACK.map((layer) => (
            <li key={layer.layer} className="relative min-w-0 pb-4 pl-5 last:pb-0">
              <span
                aria-hidden
                className="absolute -left-[4px] top-[6px] h-2 w-2 rounded-full"
                style={{ background: layer.exists ? accentInk("verified") : accentColor("unknown", 0.9) }}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-semibold text-white/90">{layer.layer}</span>
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
          ))}
        </ol>
      </section>

      {/* ════════ What happens when AI is wrong ════════ */}
      <section aria-labelledby="fail-heading" className="mt-16 min-w-0">
        <h2 id="fail-heading" className="text-xl font-semibold tracking-tight text-white">
          What happens when AI is wrong
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          A failure matrix instead of a promise. Every row names what the interface must show and how
          the system contains it — the built rows are today&rsquo;s behaviour, the rest are the
          contract the roadmap is held to.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
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
              {FAILURE_MATRIX.map((f) => (
                <tr key={f.failure} className="border-b last:border-0" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <td className="p-3 font-semibold text-white/85">{f.failure}</td>
                  <td className="p-3" style={{ color: "var(--color-text-mid)" }}>{f.interfaceShows}</td>
                  <td className="p-3" style={{ color: "var(--color-text-mid)" }}>{f.systemResponse}</td>
                </tr>
              ))}
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
      <section className="mt-16 rounded-2xl border p-6" style={{ borderColor: accentColor("security", 0.35), background: accentColor("security", 0.04) }}>
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
    </main>
  );
}
