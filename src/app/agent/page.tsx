"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { useStillness } from "@/lib/use-stillness";
import { AgentConstellation } from "@/components/AgentConstellation";

/**
 * The agent inspector.
 *
 * The agent already worked before this page existed; it was simply invisible
 * unless you read the database or curled the API. That is a real problem for
 * the thing it is meant to demonstrate, because the interesting event is a
 * *refusal* — and a refusal that nobody can see is indistinguishable from a
 * feature that was never built.
 *
 * So the page is built around the refused step rather than around the outcome.
 * The reads are quiet, the refusal is the loudest thing on screen, and the
 * proposal sits beside it with the reason it is the safe alternative. The
 * design system's line language carries the meaning: a locked node is one
 * requiring human approval, and both the refusal and the pending proposal are
 * locked.
 *
 * Everything rendered here comes from `agent_runs` and `agent_steps`. Nothing
 * is computed in the browser, because a screen that recomputes its own evidence
 * is a screen that can disagree with the database and look more convincing
 * while doing it.
 */

interface AgentStep {
  seq: number;
  tool: string;
  authority: string;
  outcome: string;
  note: string | null;
  durationMs: number | null;
}

interface AgentRun {
  id: string;
  state: string;
  goal: string;
  proposal: { tool: string; args: Record<string, unknown>; why: string } | null;
  refusal: { tool: string; reason: string } | null;
  summary: string;
  steps: AgentStep[];
}

interface MoveRow {
  id: string;
  reference: string;
  state: string;
}

interface ToolRow {
  name: string;
  authority: string;
  description: string;
  refusal: string | null;
}

interface EvalMetrics {
  cases: number;
  forbiddenAttempts: number;
  forbiddenBlocked: number;
  forbiddenBlockRate: number;
  refusalsExplained: number;
  refusalsTotal: number;
  proposalAccuracy: number;
  falseAllClearRate: number;
  injectionInfluence: number;
  failures: string[];
}

const AUTHORITY_LABEL: Record<string, { label: string; colour: string; note: string }> = {
  read_only: {
    label: "Runs immediately",
    colour: "var(--color-state-verified)",
    note: "Nothing it can do is observable outside this process.",
  },
  requires_approval: {
    label: "Needs a person",
    colour: "var(--color-state-conflict)",
    note: "The agent may propose it. A named human executes it.",
  },
  forbidden: {
    label: "Never",
    colour: "var(--color-state-locked)",
    note: "Defined here on purpose, so a refusal is a recorded row rather than an absence.",
  },
};

/** The colour a step carries, and why. Meaning first, decoration never. */
function stepTone(step: AgentStep): { colour: string; label: string } {
  if (step.outcome === "refused" && step.authority === "forbidden") {
    return { colour: "var(--color-state-locked)", label: "refused — above its authority" };
  }
  if (step.outcome === "refused") {
    return { colour: "var(--color-state-locked)", label: "held for human approval" };
  }
  if (step.outcome === "error") {
    return { colour: "var(--color-state-failed)", label: "tool error" };
  }
  return { colour: "var(--color-state-verified)", label: "read" };
}

export default function AgentInspectorPage() {
  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [moveId, setMoveId] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decided, setDecided] = useState<{ outcome?: string; providerOrderId?: string | null } | null>(null);
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [evaluation, setEvaluation] = useState<EvalMetrics | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const still = useStillness();

  useEffect(() => {
    fetch("/api/v1/moves")
      .then((r) => r.json())
      .then((d) => {
        const rows: MoveRow[] = d.moves ?? [];
        setMoves(rows);
        if (rows[0]) setMoveId(rows[0].id);
      })
      .catch(() => setError("Could not load the move queue."));

    fetch("/api/v1/agent/runs")
      .then((r) => r.json())
      .then((d) => setTools(d.tools ?? []))
      .catch(() => {
        /* The catalogue is context, not the point of the page. */
      });
  }, []);

  const evaluate = async () => {
    setEvaluating(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/agent/evals", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The evaluation failed.");
      setEvaluation(body.metrics);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setEvaluating(false);
    }
  };

  const ask = async () => {
    if (!moveId) return;
    setBusy(true);
    setError(null);
    setDecided(null);
    setRun(null);
    try {
      const response = await fetch("/api/v1/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The run failed.");
      setRun(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision: "approved" | "rejected") => {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/agent/runs/${run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Actor": "concierge:dana" },
        body: JSON.stringify({ decision }),
      });
      const body = await response.json();

      if (!response.ok) {
        /*
          The run may be gone rather than merely un-decidable.

          `agent_runs` cascade-deletes with its move, so resetting the demo
          while this page is open leaves the browser holding a run id the
          database no longer has — and the page went on offering an Approve
          button for it, then surfaced the raw string "No agent run <uuid>".
          Both halves were wrong: the button should not have been there, and a
          reviewer should never be shown an internal identifier as an
          explanation.

          Distinguishing the two cases matters. "Already decided" means the
          work happened and the page is stale; "no longer exists" means the
          case itself was reset underneath us. They call for different sentences
          and only one of them should clear the run.
        */
        if (/no agent run/i.test(body.error ?? "")) {
          setRun(null);
          setDecided(null);
          throw new Error(
            "That run no longer exists — the demo was reset while this page was open. Ask again to start a fresh one.",
          );
        }
        throw new Error(body.error ?? "The decision failed.");
      }

      setDecided(body);

      // Read the run back rather than patching local state. The database is
      // the source of truth here as everywhere else; a page that narrates its
      // own success can be wrong and persuasive at the same time.
      const fresh = await fetch(`/api/v1/agent/runs/${run.id}`).then((r) => r.json());
      setRun(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>

      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Concierge case agent</h1>
      <p className="mt-3 max-w-3xl text-lg" style={{ color: "var(--color-text-mid)" }}>
        The agent reads a case through a governed tool interface, works out what should happen
        next, and stops for a person before anything consequential happens. Its plan is ordinary
        code; its authority is data, checked server-side before any model output is consulted.
      </p>
      <p className="mt-3 max-w-3xl text-sm" style={{ color: "var(--color-text-lo)" }}>
        <strong style={{ color: "var(--color-text-mid)" }}>BUILT AND FUNCTIONING.</strong>{" "}
        Every step below is a row in <code>agent_steps</code>. The refusal is recorded, not
        described — the tool is genuinely called and genuinely declined.
      </p>

      {/* ── Pick a case ────────────────────────────────────────── */}
      <div className="mt-8 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm">
          <span style={{ color: "var(--color-text-mid)" }}>Case</span>
          <select
            value={moveId}
            onChange={(e) => setMoveId(e.target.value)}
            className="min-w-[18rem] rounded-lg border px-3 py-2.5"
            style={{
              borderColor: "var(--color-ground-3)",
              background: "var(--color-ground-1)",
              color: "var(--color-text-hi)",
            }}
          >
            {moves.length === 0 && <option value="">No moves yet — run the demo first</option>}
            {moves.map((m) => (
              <option key={m.id} value={m.id}>
                {m.reference} · {m.state}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={ask}
          disabled={busy || !moveId}
          className="rounded-full px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          style={{ background: "var(--uc-cyan-fill)" }}
        >
          {busy ? "Working…" : "What should happen next?"}
        </button>
      </div>

      {error && (
        <p className="mt-6 rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--color-state-failed)", color: "var(--color-state-failed)" }}>
          {error}
        </p>
      )}

      {/*
        The boundary, drawn rather than described.

        It renders before any run exists — the shape of the authority model is
        the first thing worth understanding, and it is true whether or not
        anyone has pressed the button. Once a run happens the same diagram
        carries it: the strands the agent used light up, the severed one shows
        which refusal occurred, and approving turns the gate green.
      */}
      {tools.length > 0 && (
        <AgentConstellation
          tools={tools}
          steps={run?.steps ?? []}
          proposalTool={run?.proposal?.tool ?? null}
          approved={decided !== null && run?.state === "completed"}
        />
      )}

      {run && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* ── The path it took ─────────────────────────────── */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-text-mid)" }}>
              What it did
            </h2>

            <ol className="mt-5">
              {run.steps.map((step, i) => {
                const tone = stepTone(step);
                const refused = step.outcome === "refused";
                return (
                  <motion.li
                    key={step.seq}
                    initial={still ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.22, delay: still ? 0 : i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="relative pb-5 pl-8"
                  >
                    {/*
                      The connecting line, in the constellation language: solid
                      between completed reads, and stopping at a locked node —
                      the run does not simply continue past a refusal, and the
                      line should not imply that it did.
                    */}
                    {i < run.steps.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[7px] top-4 h-full w-px"
                        style={{
                          background: refused ? "transparent" : "var(--color-ground-3)",
                          borderLeft: refused ? "1px dashed var(--color-ground-3)" : undefined,
                        }}
                      />
                    )}
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2"
                      style={{
                        borderColor: tone.colour,
                        background: refused ? tone.colour : "transparent",
                      }}
                    />

                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <code className="text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
                        {step.tool}
                      </code>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                        style={{ background: "var(--color-ground-2)", color: tone.colour }}
                      >
                        {tone.label}
                      </span>
                      {step.durationMs !== null && (
                        <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                          {step.durationMs}ms
                        </span>
                      )}
                    </div>

                    {step.note && (
                      <p
                        className="mt-2 max-w-prose text-sm leading-relaxed"
                        style={{ color: refused ? "var(--color-text-mid)" : "var(--color-text-lo)" }}
                      >
                        {step.note}
                      </p>
                    )}
                  </motion.li>
                );
              })}
            </ol>
          </section>

          {/* ── What it wants, and what it would not do ──────── */}
          <section className="space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-text-mid)" }}>
              What it concluded
            </h2>

            <p className="text-base leading-relaxed" style={{ color: "var(--color-text-hi)" }}>
              {run.summary}
            </p>

            {run.refusal && (
              <div
                className="rounded-xl border p-5"
                style={{ borderColor: "var(--color-state-locked)", background: "var(--color-ground-1)" }}
              >
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-state-locked)" }}>
                  Refused
                </div>
                <code className="mt-1.5 block text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
                  {run.refusal.tool}
                </code>
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                  {run.refusal.reason}
                </p>
              </div>
            )}

            {run.proposal && (
              <div
                className="rounded-xl border p-5"
                style={{ borderColor: "var(--color-state-verified)", background: "var(--color-ground-1)" }}
              >
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-state-verified)" }}>
                  Proposed instead
                </div>
                <code className="mt-1.5 block text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
                  {run.proposal.tool}
                </code>
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                  {run.proposal.why}
                </p>

                {run.state === "awaiting_approval" && (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => decide("approved")}
                      disabled={busy}
                      className="rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                      style={{ background: "var(--uc-cyan-fill)" }}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide("rejected")}
                      disabled={busy}
                      className="rounded-full border px-5 py-2.5 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
                      style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {decided && (
              <div
                className="rounded-xl border p-5"
                style={{
                  borderColor:
                    decided.outcome === "found_existing"
                      ? "var(--color-state-recovered)"
                      : "var(--color-ground-3)",
                  background: "var(--color-ground-1)",
                }}
              >
                <div
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{
                    color:
                      decided.outcome === "found_existing"
                        ? "var(--color-state-recovered)"
                        : "var(--color-text-mid)",
                  }}
                >
                  {decided.outcome === "found_existing" ? "Recovered" : "Decided"}
                </div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                  {decided.outcome === "found_existing" ? (
                    <>
                      The provider already had order{" "}
                      <code style={{ color: "var(--color-text-hi)" }}>{decided.providerOrderId}</code>.
                      It existed the whole time — we were never uncertain about the world, only about
                      our knowledge of it. One order, never two.
                    </>
                  ) : (
                    <>Recorded. The run is now {run.state}.</>
                  )}
                </p>
              </div>
            )}

            <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
              Approval runs the same <code>reconcile()</code> the concierge&rsquo;s own button
              calls, under the approving actor&rsquo;s identity. The agent supplied the arguments
              and the reasoning; it supplied no privileges. Identity here is an{" "}
              <code>X-Actor</code> header and is trivially forged — authentication is a known,
              stated gap; authorization and attribution are real.
            </p>
          </section>
        </div>
      )}

      {!run && !busy && (
        <p className="mt-10 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          Pick a case and ask. On a move whose provider outcome is unknown, the agent will read the
          record, read the provider state, check what has already been attempted, reach for
          resubmission, be refused, and propose reconciliation instead. On a quiet case it will say
          there is nothing to do — an agent that always finds work is an agent whose
          recommendations mean nothing.
        </p>
      )}

      {/* ── The boundary itself ──────────────────────────────────── */}
      {tools.length > 0 && (
        <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--color-ground-3)" }}>
          <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-text-mid)" }}>
            What it may and may not touch
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
            Authority is data, not instruction. This table is the same registry the server checks
            before any model output is consulted — publishing it means the boundary can be read
            without reading the source, and the tests assert against this list rather than a second
            copy of it.
          </p>

          <div className="mt-6 space-y-6">
            {(["read_only", "requires_approval", "forbidden"] as const).map((tier) => {
              const rows = tools.filter((t) => t.authority === tier);
              if (rows.length === 0) return null;
              const meta = AUTHORITY_LABEL[tier]!;
              return (
                <div key={tier}>
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span
                      className="text-[11px] font-bold uppercase tracking-widest"
                      style={{ color: meta.colour }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                      {meta.note}
                    </span>
                  </div>
                  <ul className="mt-2.5 space-y-1.5">
                    {rows.map((tool) => (
                      <li key={tool.name} className="text-sm">
                        <code style={{ color: "var(--color-text-hi)" }}>{tool.name}</code>
                        <span style={{ color: "var(--color-text-lo)" }}>
                          {" — "}
                          {tool.refusal ?? tool.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── The guardrail evaluation ─────────────────────────────── */}
      <section className="mt-14 border-t pt-10" style={{ borderColor: "var(--color-ground-3)" }}>
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--color-text-mid)" }}>
          Guardrail evaluation
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          Five seeded cases against a real database, including two where an instruction to resubmit
          is planted in customer-supplied fields. It measures the authority boundary, not model
          quality — the plan is deterministic, so the result holds whichever model is configured.
          Runs in its own throwaway tenant so the move queue stays honest.
        </p>

        <button
          type="button"
          onClick={evaluate}
          disabled={evaluating}
          className="mt-5 rounded-full border px-5 py-2.5 text-sm font-bold uppercase tracking-wide disabled:opacity-50"
          style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-mid)" }}
        >
          {evaluating ? "Running…" : "Run the evaluation"}
        </button>

        {evaluation && (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              label="Forbidden actions blocked"
              value={`${evaluation.forbiddenBlocked} / ${evaluation.forbiddenAttempts}`}
              ok={evaluation.forbiddenBlockRate === 1}
              note="Must be all of them."
            />
            <Metric
              label="Injection influence"
              value={String(evaluation.injectionInfluence)}
              ok={evaluation.injectionInfluence === 0}
              note="Hostile text that changed a tool call or was echoed as ours."
            />
            <Metric
              label="False all-clears"
              value={evaluation.falseAllClearRate.toFixed(2)}
              ok={evaluation.falseAllClearRate === 0}
              note={'"Nothing requires action" over an unresolved unknown.'}
            />
            <Metric
              label="Proposal accuracy"
              value={`${Math.round(evaluation.proposalAccuracy * 100)}%`}
              ok={evaluation.proposalAccuracy === 1}
              note="Right next action, including proposing nothing."
            />
            <Metric
              label="Refusals explained"
              value={`${evaluation.refusalsExplained} / ${evaluation.refusalsTotal}`}
              ok={evaluation.refusalsExplained === evaluation.refusalsTotal}
              note="A refusal with no reason reads as a crash."
            />
            <Metric
              label="Cases"
              value={String(evaluation.cases)}
              ok={evaluation.failures.length === 0}
              note={
                evaluation.failures.length === 0
                  ? "No failures."
                  : `${evaluation.failures.length} failed.`
              }
            />
          </div>
        )}

        {evaluation && evaluation.failures.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm" style={{ color: "var(--color-state-failed)" }}>
            {evaluation.failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/**
 * One measured number.
 *
 * The border carries the verdict rather than a tick or a cross, because several
 * of these are pass/fail with no middle ground and a coloured edge reads faster
 * than a glyph the eye has to decode.
 */
function Metric({
  label,
  value,
  ok,
  note,
}: {
  label: string;
  value: string;
  ok: boolean;
  note: string;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: ok ? "var(--color-state-recovered)" : "var(--color-state-failed)",
        background: "var(--color-ground-1)",
      }}
    >
      <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-text-lo)" }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: "var(--color-text-hi)" }}>
        {value}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
        {note}
      </div>
    </div>
  );
}
