"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useStillness } from "@/lib/use-stillness";
import { accentColor, accentInk, type Accent } from "@/lib/accents";
import type { AgentRun, AgentStepRecord } from "@/lib/agent/case-agent";
import type { AgentEvalMetrics } from "@/lib/agent/eval";
import {
  stagesFor,
  evidenceFor,
  decisionFor,
  customerDraftFor,
  caseKindFor,
  stageLabel,
  conflictDetailFor,
  providerDetailFor,
  auditTrailFor,
  consentDetailFor,
} from "@/lib/agent/narrative";
import { CaseRibbon, type CaseFacts } from "@/components/agent/CaseRibbon";
import { Investigation } from "@/components/agent/Investigation";
import { ControlBoundary } from "@/components/agent/ControlBoundary";
import { DecisionPackageCard } from "@/components/agent/DecisionPackage";
import { CustomerDraftCard } from "@/components/agent/CustomerDraftCard";
import { AuthorityMatrix, type RegistryTool } from "@/components/agent/AuthorityMatrix";
import { BreakTheAgent } from "@/components/agent/BreakTheAgent";
import {
  ConflictValues,
  ProviderIdentity,
  ConsentLine,
  AuditTimeline,
} from "@/components/agent/CaseDepth";

/**
 * The Move Operations Copilot.
 *
 * The protagonist of this page is the selected move, not the agent. A move
 * enters uncertainty — a lost provider response, two sources that disagree —
 * and the page shows a governed capability doing every part of the work it can
 * safely own: reconstructing the evidence, refusing the dangerous shortcut,
 * preparing a decision-ready package, and stopping at the line where authority,
 * not intelligence, is required.
 *
 * ## The rendering rule
 *
 * Everything below the hero is a function of server data. The run and its
 * steps come from `agent_runs`/`agent_steps`; the business language is derived
 * from stored observations by `narrative.ts`, which is pure and separately
 * tested; the authority matrix is the same registry the planner is checked
 * against; the adversarial lab renders per-case verdicts the evaluation
 * actually executed. The page holds no policy text of its own and no state the
 * database does not.
 *
 * ## Progressive disclosure
 *
 * Three altitudes, deliberately ordered: the business situation first (what is
 * this case, why does it matter), the operating surface second (what the
 * copilot did, what it prepared, what a person decides), and the technical
 * layer last (tool names inline as secondary evidence, raw payloads behind
 * explicit disclosure). A leader can stop after the first altitude and have
 * been told the truth.
 */

interface MoveRow {
  id: string;
  reference: string;
  state: string;
  openConflicts: number;
}

type EvalState = { metrics: AgentEvalMetrics | null; running: boolean };

/** A decided action, exactly as the backend reported it. */
interface DecisionResult {
  state: string;
  outcome?: string;
  providerOrderId?: string | null;
}

/** The actor this console decides as. Sent as X-Actor and displayed verbatim. */
const CONSOLE_ACTOR = "concierge:dana";

/** Pull a named field's value out of the concierge view, if the case has it. */
function fieldValue(
  view:
    | {
        verified?: Array<{ field: string; value: unknown }>;
        unconfirmed?: Array<{ field: string; value: unknown }>;
      }
    | undefined,
  path: string,
): string | null {
  const hit =
    view?.verified?.find((f) => f.field === path) ??
    view?.unconfirmed?.find((f) => f.field === path);
  return hit ? String(hit.value) : null;
}

export default function MoveOperationsCopilot() {
  const still = useStillness();

  const [moves, setMoves] = useState<MoveRow[]>([]);
  const [moveId, setMoveId] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [investigating, setInvestigating] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decided, setDecided] = useState<DecisionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<RegistryTool[]>([]);
  const [evaluation, setEvaluation] = useState<EvalState>({ metrics: null, running: false });
  const [rawOpen, setRawOpen] = useState(false);
  /* Cross-panel spotlight: hovering a stage lights its node in the boundary. */
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  /*
    Reload reconstructs, rather than forgets.

    The run id rides in the URL, so a refresh — or a link pasted to a colleague
    — rebuilds the whole surface from `agent_runs` instead of presenting a
    blank console that quietly implies nothing ever happened. The steps were
    persisted precisely so the reasoning could be read back later; a page that
    lost them on F5 would be storing evidence and refusing to show it.
  */
  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("run");
    if (runId) {
      fetch(`/api/v1/agent/runs/${runId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => {
          if (body) setRun(body);
        })
        .catch(() => {
          /* A stale link renders the pre-run page, which is the honest fallback. */
        });
    }

    fetch("/api/v1/moves")
      .then((r) => r.json())
      .then((body: { moves: MoveRow[] }) => {
        setMoves(body.moves ?? []);
        if (body.moves?.[0]) setMoveId(body.moves[0].id);
      })
      .catch(() => setError("Could not load the case list."));

    fetch("/api/v1/agent/runs")
      .then((r) => r.json())
      .then((body: { tools: RegistryTool[] }) => setTools(body.tools ?? []))
      .catch(() => {
        /* The matrix section renders its absence honestly. */
      });
  }, []);

  const selectCase = (id: string) => {
    setMoveId(id);
    // A new case invalidates everything derived from the old one. Keeping the
    // previous run on screen would caption one move with another's evidence —
    // and the URL must stop claiming the old run for the same reason.
    setRun(null);
    setDecided(null);
    setError(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
  };

  const investigate = useCallback(async () => {
    if (!moveId || investigating) return;
    setInvestigating(true);
    setError(null);
    setDecided(null);
    setRun(null);
    try {
      /*
        The investigation arrives as it happens. Each NDJSON step event is
        emitted after that step was persisted, so every stage the page draws
        already exists as a row — the stream is a live echo of the database,
        not a preview of it. The partial run carries only the steps so far;
        everything conclusive (the decision package, the contract, the draft)
        waits for the final `run` event, because a conclusion derived from
        half an investigation would be exactly the overstatement the
        narrative layer exists to prevent.
      */
      const response = await fetch("/api/v1/agent/runs?stream=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "The investigation failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: AgentRun | null = null;
      const liveSteps: AgentStepRecord[] = [];

      const handle = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as
          | { type: "step"; step: AgentStepRecord }
          | { type: "run"; run: AgentRun }
          | { type: "error"; error: string };
        if (event.type === "step") {
          liveSteps.push(event.step);
          setRun({
            id: "",
            state: "running",
            goal: "next_safe_action",
            proposal: null,
            refusal: null,
            summary: "",
            steps: [...liveSteps],
          });
        } else if (event.type === "run") {
          final = event.run;
        } else {
          throw new Error(event.error);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handle(line);
      }
      if (buffer.trim()) handle(buffer);

      /*
        The assertion is load-bearing, not decoration. `final` is written only
        inside the `handle` closure, which TypeScript's flow analysis does not
        track — so at this line it believes the value is still `null`, and the
        guard below would narrow a plainly-annotated const to `never`. Casting
        resets the analysis to what is actually true: the stream may or may not
        have delivered its closing event.
      */
      const completed = final as AgentRun | null;
      if (!completed) {
        // The stream ended without its closing event: an investigation that
        // did not complete, reported as one.
        throw new Error("The investigation ended before it finished. Nothing below is conclusive.");
      }
      setRun(completed);
      const url = new URL(window.location.href);
      url.searchParams.set("run", completed.id);
      window.history.replaceState(null, "", url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRun(null);
    } finally {
      setInvestigating(false);
    }
  }, [moveId, investigating]);

  const decide = useCallback(
    async (decision: "approved" | "rejected") => {
      if (!run || deciding) return;
      setDeciding(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/agent/runs/${run.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Actor": CONSOLE_ACTOR },
          body: JSON.stringify({ decision }),
        });
        const body = await response.json();

        if (!response.ok) {
          /*
            The run may be gone rather than merely un-decidable — the demo
            reset cascade-deletes agent runs with their move. The two cases
            need different sentences, and only one should clear the run.
          */
          if (/no agent run/i.test(body.error ?? "")) {
            setRun(null);
            setDecided(null);
            throw new Error(
              "That run no longer exists — the demo was reset while this page was open. Investigate again to start fresh.",
            );
          }
          throw new Error(body.error ?? "The decision failed.");
        }

        setDecided(body);
        // Read the run back rather than patching local state. A page that
        // narrates its own success can be wrong and persuasive at once.
        const fresh = await fetch(`/api/v1/agent/runs/${run.id}`).then((r) => r.json());
        setRun(fresh);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setDeciding(false);
      }
    },
    [run, deciding],
  );

  const runEvaluation = useCallback(async () => {
    if (evaluation.running) return;
    setEvaluation((s) => ({ ...s, running: true }));
    try {
      const response = await fetch("/api/v1/agent/evals", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The evaluation failed.");
      setEvaluation({ metrics: body.metrics, running: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEvaluation((s) => ({ ...s, running: false }));
    }
  }, [evaluation.running]);

  // ── Everything below derives from server data ─────────────────────────
  const selectedMove = moves.find((m) => m.id === moveId) ?? null;
  const stages = useMemo(() => (run ? stagesFor(run) : []), [run]);
  const decision = useMemo(() => (run ? decisionFor(run) : null), [run]);
  const evidence = useMemo(() => (run ? evidenceFor(run) : []), [run]);
  const draft = useMemo(() => (run ? customerDraftFor(run) : null), [run]);
  const kind = run ? caseKindFor(run) : null;
  // The depth layer: the material the conclusions were formed from.
  const conflictDetail = useMemo(() => (run ? conflictDetailFor(run) : []), [run]);
  const providerDetail = useMemo(() => (run ? providerDetailFor(run) : []), [run]);
  const auditTrail = useMemo(() => (run ? auditTrailFor(run) : []), [run]);
  const consentDetail = useMemo(() => (run ? consentDetailFor(run) : []), [run]);

  const attempted = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of run?.steps ?? []) map[s.tool] = s.outcome;
    return map;
  }, [run]);

  const facts: CaseFacts | null = useMemo(() => {
    if (!selectedMove) return null;
    const view = run?.steps.find((s) => s.tool === "get_move_record" && s.outcome === "ok")
      ?.observation as
      | {
          verified?: Array<{ field: string; value: unknown; by: string | null }>;
          unconfirmed?: Array<{ field: string; value: unknown }>;
          openConflicts?: string[];
          services?: Array<{ submission_state?: string | null }>;
        }
      | undefined;

    const services = view?.services ?? [];
    const unknowns = services.filter((s) => s.submission_state === "unknown").length;
    const canonicalBy = view?.verified?.find((f) => f.by)?.by ?? null;
    const conflicts = view?.openConflicts?.length ?? selectedMove.openConflicts;

    /*
      Pre-run, the ribbon knows only what the moves list carries: the conflict
      count. Everything else is null — rendered as "not yet read" — because a
      counted zero and an uncounted case are different facts, and the first
      version of this printed "no unknowns" on a case whose whole problem was
      an unknown outcome it had not read yet.
    */
    return {
      reference: selectedMove.reference,
      customer: fieldValue(view, "customer.name"),
      moveDate: fieldValue(view, "move.date"),
      openConflicts: conflicts,
      services: view ? services.length : null,
      unknownOutcomes: view ? unknowns : null,
      canonicalBy,
      objective: !view
        ? conflicts > 0
          ? "Sources disagree — a canonical value needs a named decision"
          : "Not yet investigated"
        : unknowns > 0
          ? "A provider outcome is unknown — establish what exists before anything else"
          : conflicts > 0
            ? "Sources disagree — a canonical value needs a named decision"
            : "No open question on this case",
    };
  }, [selectedMove, run]);

  const chip = (label: string, accent: Accent) => (
    <li
      key={label}
      className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]"
      style={{ borderColor: accentColor(accent, 0.4), color: accentInk(accent) }}
    >
      {label}
    </li>
  );

  return (
    <main className="relative min-h-dvh bg-[#04070b]">
      {/*
        The aurora, but no film grain: this is an operating surface, and grain
        belongs to the cinematic pages. The light is what the glass panels
        below diffuse — which is the specific job that earns them their blur.
      */}
      <div className="cine-aurora" aria-hidden />

      <div className="relative mx-auto min-w-0 max-w-6xl px-6 py-14" style={{ zIndex: 1 }}>
      <Link href="/demo" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Back to the demo
      </Link>

      {/* ════════════════ HERO ════════════════ */}
      <header className="mt-6 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: accentInk("security") }}>
          Move operations copilot
        </p>
        <h1 className="mt-3 max-w-3xl text-[clamp(30px,4.4vw,52px)] font-semibold leading-[1.05] tracking-tight text-white">
          From scattered evidence
          <br />
          <span style={{ color: accentInk("internet") }}>to the next safe action.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The copilot investigates the move, reconstructs what happened, explains the business
          risk, prepares the best next action — and stops only where authority, not intelligence,
          is required.
        </p>

        {/*
          Each chip is a checkable claim about this implementation. Tools and
          authority live in a server registry; every step is a persisted row;
          refusals come from policy checked before any model output; every
          record on the tenant is synthetic.
        */}
        <ul className="mt-5 flex flex-wrap gap-1.5">
          {chip("Built and functioning", "verified")}
          {chip("Server-owned tools", "internet")}
          {chip("Persisted agent steps", "internet")}
          {chip("Policy enforced", "security")}
          {chip("Synthetic case data", "conflict")}
        </ul>

        {/* ── Case selection + the persistent ribbon ── */}
        <div className="mt-8 flex flex-wrap items-end gap-3">
          <label className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
              Selected case
            </span>
            <select
              value={moveId}
              onChange={(e) => selectCase(e.target.value)}
              className="mt-1 min-h-11 rounded-lg border bg-transparent px-3 text-sm text-white focus:outline-none focus-visible:ring-2"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              {moves.length === 0 && <option value="">No moves yet — run the demo first</option>}
              {moves.map((m) => (
                <option key={m.id} value={m.id} style={{ color: "#111" }}>
                  {m.reference} · {m.state.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={investigate}
            disabled={!moveId || investigating}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-60"
            style={{ background: accentColor("verified", 1) }}
          >
            {investigating && <Loader2 size={14} className="animate-spin" aria-hidden />}
            {investigating ? "Investigating…" : "Investigate and prepare the next action"}
          </button>
        </div>

        {facts && (
          <div className="mt-4">
            <CaseRibbon facts={facts} />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border p-3 text-sm"
            style={{ borderColor: accentColor("failed", 0.5), color: accentInk("failed") }}
          >
            {error}
          </p>
        )}
      </header>

      {/* ════════════════ THE OPERATING ROOM ════════════════ */}
      <section aria-labelledby="room-heading" className="mt-14 min-w-0">
        <h2 id="room-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-lo)" }}>
          The operating room
        </h2>

        <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* ── Panel A: the case, in business language ── */}
          <div className="cine-glass min-w-0 rounded-2xl p-4">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("conflict") }}>
              The case
            </h3>
            {decision ? (
              <>
                <p className="mt-2 text-[15px] font-semibold leading-snug text-white">
                  {kind === "provider_unknown" && "A provider outcome is unknown"}
                  {kind === "field_conflict" && "Sources disagree about this move"}
                  {kind === "settled" && "Nothing is waiting on a decision"}
                  {kind === "unreadable" && "The case could not be read"}
                </p>
                {/*
                  Deliberately not `decision.situation` — the decision package
                  below opens with that exact paragraph, and reading the same
                  sentences twice on one screen teaches a reader to skim. This
                  panel's job is the material: the headline names the trouble,
                  the depth cards below show it.
                */}
                {/*
                  The disagreement itself, not a count of it. "Sources disagree"
                  is a conclusion; the two values side by side, each wearing its
                  channel and verification, is what a person actually weighs —
                  and it is read from the same stored observation the agent
                  reasoned over.
                */}
                {kind === "field_conflict" && conflictDetail.length > 0 && (
                  <div className="mt-3">
                    <ConflictValues conflicts={conflictDetail} />
                  </div>
                )}
                {kind === "provider_unknown" && providerDetail.length > 0 && (
                  <div className="mt-3">
                    <ProviderIdentity operations={providerDetail} />
                  </div>
                )}
                {consentDetail.length > 0 && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                      Consent on file
                    </p>
                    <div className="mt-1">
                      <ConsentLine consent={consentDetail} />
                    </div>
                  </div>
                )}
                {decision.businessConsequence && (
                  <p
                    className="mt-3 border-t pt-3 text-[12px] leading-relaxed"
                    style={{ borderColor: "rgba(255,255,255,0.08)", color: "var(--color-text-mid)" }}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--color-text-lo)" }}>
                      Why it matters ·{" "}
                    </span>
                    {decision.businessConsequence}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                {selectedMove
                  ? selectedMove.openConflicts > 0
                    ? `${selectedMove.reference} carries ${selectedMove.openConflicts} open conflict${selectedMove.openConflicts === 1 ? "" : "s"}. Investigate to see what the sources actually said.`
                    : `${selectedMove.reference} looks quiet from the list. The investigation reads the case itself.`
                  : "Select a case. The demo seeds one with a lost provider response and a field two sources disagree about."}
              </p>
            )}
          </div>

          {/* ── Panel B: the copilot at work ── */}
          <div className="cine-glass min-w-0 rounded-2xl p-4" style={{ borderColor: accentColor("internet", 0.3) }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("internet") }}>
              The copilot
            </h3>
            <div className="mt-2">
              <Investigation stages={stages} running={investigating} onHoverTool={setHoveredTool} />
            </div>
          </div>

          {/* ── Panel C: the boundary, drawn for this run ── */}
          <div className="cine-glass min-w-0 rounded-2xl p-4" style={{ borderColor: accentColor("security", 0.3) }}>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("security") }}>
              The control boundary
            </h3>
            <div className="mt-2">
              <ControlBoundary run={run} highlightTool={hoveredTool} />
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════ THE DECISION PACKAGE ════════════════ */}
      {run && run.state !== "running" && decision && (
        <section aria-labelledby="package-heading" className="mt-14 min-w-0">
          <h2 id="package-heading" className="sr-only">
            The prepared decision
          </h2>
          <DecisionPackageCard
            decision={decision}
            evidence={evidence}
            executor={run.state === "awaiting_approval" ? CONSOLE_ACTOR : null}
          />

          {/* ── The action contract, before anything crosses the line ── */}
          {run.state === "awaiting_approval" && run.proposal && (
            <motion.div
              initial={{ opacity: 0, y: still ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: still ? 0 : 0.3, delay: still ? 0 : 0.15 }}
              className="mt-4 min-w-0 rounded-2xl border p-5"
              style={{ borderColor: accentColor("conflict", 0.4), background: accentColor("conflict", 0.04) }}
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accentInk("conflict") }}>
                Action contract — read before approving
              </h3>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-2">
                {[
                  ["Action", stageLabel(run.proposal.tool)],
                  ["Technical operation", run.proposal.tool],
                  ["Target submission", String(run.proposal.args.submissionId ?? "—")],
                  ["Current state", "unknown — the response was lost"],
                  ["Predicted transition", "unknown → what the provider's ledger actually holds"],
                  ["Approving actor", CONSOLE_ACTOR],
                  ["Audit event on approval", "agent.proposal.approved"],
                  ["What it can never do", "create an order — reconciliation only reads"],
                ].map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                      {k}
                    </dt>
                    <dd className="mt-0.5 break-all font-medium text-white/85">{v}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => decide("approved")}
                  disabled={deciding}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-[12px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
                  style={{ background: accentColor("verified", 1) }}
                >
                  {deciding && <Loader2 size={13} className="animate-spin" aria-hidden />}
                  Approve — request reconciliation
                </button>
                <button
                  type="button"
                  onClick={() => decide("rejected")}
                  disabled={deciding}
                  className="inline-flex min-h-11 items-center rounded-full border px-5 text-[12px] font-bold uppercase tracking-wide disabled:opacity-60"
                  style={{ borderColor: "rgba(255,255,255,0.3)", color: "var(--color-text-mid)" }}
                >
                  Reject recommendation
                </button>
              </div>
              <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                Approval runs the same deterministic service the console's own button calls, as{" "}
                {CONSOLE_ACTOR}. Rejection is recorded to the audit trail — a human declining the
                machine is a fact worth keeping.
              </p>
            </motion.div>
          )}

          {/* ── The verified result: only what the server said back ── */}
          {decided && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: still ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: still ? 0 : 0.3 }}
              className="mt-4 min-w-0 rounded-2xl border p-5"
              style={{
                borderColor: accentColor(decided.state === "rejected" ? "unknown" : "recovered", 0.5),
                background: accentColor(decided.state === "rejected" ? "unknown" : "recovered", 0.06),
              }}
            >
              {decided.state === "rejected" ? (
                <>
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: accentInk("unknown") }}>
                    Recommendation rejected
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">
                    Nothing was executed and no domain record changed. The rejection itself was
                    written to the audit trail under {CONSOLE_ACTOR}.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: accentInk("recovered") }}>
                    {decided.outcome === "found_existing"
                      ? "The order was recovered. No duplicate was created."
                      : `Reconciliation completed: ${decided.outcome ?? "done"}`}
                  </h3>
                  <dl className="mt-3 grid gap-x-6 gap-y-2 text-[13px] sm:grid-cols-3">
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                        Provider's answer
                      </dt>
                      <dd className="mt-0.5 font-medium text-white/85">{decided.outcome ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                        Existing order
                      </dt>
                      <dd className="mt-0.5 font-mono font-medium text-white/85">
                        {decided.providerOrderId ?? "none found"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
                        Established by
                      </dt>
                      <dd className="mt-0.5 font-medium text-white/85">
                        the provider's ledger, not the model
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                    This card rendered after the backend confirmed. There is no optimistic version
                    of it.
                  </p>
                </>
              )}
            </motion.div>
          )}

          {/* ── The customer draft, where the evidence supports one ── */}
          {draft && (
            <div className="mt-4">
              <CustomerDraftCard draft={draft} />
            </div>
          )}
        </section>
      )}

      {/* ════════════════ THE MOVE'S OWN HISTORY ════════════════ */}
      {auditTrail.length > 0 && (
        <section aria-labelledby="history-heading" className="mt-14 min-w-0">
          <h2 id="history-heading" className="text-xl font-semibold tracking-tight text-white">
            What already happened on this move
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            The audit trail the copilot read before recommending anything — a recommendation made
            without the history is how the same mistake gets made twice. Newest first, exactly as
            stored.
          </p>
          <div className="mt-4 max-w-2xl">
            <AuditTimeline trail={auditTrail} />
          </div>
        </section>
      )}

      {/* ════════════════ THE OPERATING LICENCE ════════════════ */}
      <section aria-labelledby="licence-heading" className="mt-16 min-w-0">
        <h2 id="licence-heading" className="text-xl font-semibold tracking-tight text-white">
          The copilot's operating licence
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          Loaded from the same server registry the planner is checked against — there is no second
          copy of this policy to drift. Rows the current run touched are lit with what happened.
        </p>
        <div className="mt-4">
          {tools.length > 0 ? (
            <AuthorityMatrix tools={tools} attempted={attempted} />
          ) : (
            <p
              className="rounded-lg border border-dashed p-3 text-[11px]"
              style={{ borderColor: "rgba(255,255,255,0.14)", color: "var(--color-text-lo)" }}
            >
              The registry could not be loaded, so no licence is shown. A matrix drawn from memory
              would be documentation, not policy.
            </p>
          )}
        </div>
      </section>

      {/* ════════════════ BREAK THE AGENT ════════════════ */}
      <section aria-labelledby="break-heading" className="mt-16 min-w-0">
        <h2 id="break-heading" className="text-xl font-semibold tracking-tight text-white">
          Break the agent
        </h2>
        <div className="mt-3">
          <BreakTheAgent
            metrics={evaluation.metrics}
            running={evaluation.running}
            onRun={runEvaluation}
          />
        </div>
      </section>

      {/* ════════════════ WHAT CHANGES FOR THE OPERATION ════════════════ */}
      <section aria-labelledby="value-heading" className="mt-16 min-w-0">
        <h2 id="value-heading" className="text-xl font-semibold tracking-tight text-white">
          What changes for the operation
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The mechanism, not invented numbers. Both columns describe this build's actual behaviour.
        </p>
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
          <div className="min-w-0 rounded-2xl border p-5" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text-lo)" }}>
              Without the copilot
            </h3>
            <ul className="mt-3 list-none space-y-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
              {[
                "The operator opens several records and reconstructs the source history by hand",
                "Provider state is interpreted from raw rows",
                "Whether a retry is safe is judged under time pressure",
                "The customer explanation is drafted from scratch, case by case",
                "Two operators can reach two different answers to the same case",
              ].map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>
          <div
            className="min-w-0 rounded-2xl border p-5"
            style={{ borderColor: accentColor("verified", 0.35), background: accentColor("verified", 0.04) }}
          >
            <h3 className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("verified") }}>
              With the copilot
            </h3>
            <ul className="mt-3 list-none space-y-2 text-[13px] leading-relaxed text-white/85">
              {[
                "The evidence arrives assembled, each claim tied to the row it came from",
                "Disagreements are surfaced with the channels that produced them",
                "The unsafe shortcut is blocked by policy and the block is recorded",
                "The safe next action arrives as a decision-ready package",
                "The customer communication is drafted from evidence, held for review",
                "The consequential action still requires the named person it always did",
                "The completed outcome is verified against the backend before it is shown",
              ].map((s) => (
                <li key={s}>· {s}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ════════════════ FUTURE HYPOTHESIS ════════════════ */}
      <section
        aria-labelledby="future-heading"
        className="mt-16 min-w-0 rounded-2xl border p-6"
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <h2 id="future-heading" className="text-xl font-semibold tracking-tight text-white">
          From case copilot to operating intelligence
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
          The expansion path, labelled honestly. Only the first item exists.
        </p>
        <ol className="mt-5 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Move Operations Copilot",
              status: "Built and functioning",
              accent: "verified" as Accent,
              body: "Reads one move, reconstructs evidence, refuses unsafe shortcuts, prepares decisions, records every step.",
            },
            {
              title: "Concierge Shift Copilot",
              status: "Future hypothesis",
              accent: "unknown" as Accent,
              body: "Prioritises a day's cases, explains why each matters, surfaces stalled provider operations.",
            },
            {
              title: "Partner Intelligence",
              status: "Future hypothesis",
              accent: "unknown" as Accent,
              body: "Finds recurring intake problems and shows where partner handoffs create avoidable friction.",
            },
            {
              title: "Move Intelligence Center",
              status: "Future hypothesis",
              accent: "unknown" as Accent,
              body: "Connects service outcomes to partner and customer experience, with traceable evidence.",
            },
          ].map((item) => (
            <li key={item.title} className="min-w-0 rounded-xl border p-4" style={{ borderColor: accentColor(item.accent, 0.3) }}>
              <span
                className="rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]"
                style={{ borderColor: accentColor(item.accent, 0.5), color: accentInk(item.accent) }}
              >
                {item.status}
              </span>
              <h3 className="mt-2 text-[14px] font-semibold text-white/90">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
                {item.body}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
          The same governed pattern throughout: server-owned tools, policy checked before model
          output, persisted steps, named approval. Nothing in the future column is presented as
          available.
        </p>
      </section>

      {/* ════════════════ THE TECHNICAL DRAWER ════════════════ */}
      {run && (
        <section className="mt-12 min-w-0">
          <button
            type="button"
            onClick={() => setRawOpen((v) => !v)}
            aria-expanded={rawOpen}
            className="inline-flex min-h-11 items-center text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: accentInk("internet") }}
          >
            {rawOpen ? "Hide the raw run" : "Inspect the raw run — every step, verbatim"}
          </button>
          {rawOpen && (
            <pre
              className="mt-2 max-h-96 overflow-auto rounded-xl border p-4 font-mono text-[10px] leading-relaxed"
              style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.35)", color: "var(--color-text-mid)" }}
            >
              {JSON.stringify(run, null, 2)}
            </pre>
          )}
        </section>
      )}
      </div>
    </main>
  );
}
