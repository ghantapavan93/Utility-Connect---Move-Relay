"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Drive a move's fulfillment from the console, in place.
 *
 * The button this replaces navigated to `/demo`, which runs one scripted
 * narrative against one hardcoded record. That was the honest thing to do while
 * no route would accept a move id — but it meant the operator console could
 * create moves it could not do anything with.
 *
 * Every action here is a real request against the move actually selected:
 * submit calls the provider simulator and persists the outcome, retry attempts
 * a second submission and is refused, reconcile asks the provider what it holds
 * and resolves the UNKNOWN. The order counter beside them is the point of the
 * whole sequence — it must reach one and stay there.
 */

interface ServiceRow {
  id: string;
  serviceType: string;
  providerName: string;
  submissionState: string | null;
  providerOrderId: string | null;
}

interface Step {
  action: string;
  ok: boolean;
  state?: string;
  blocked?: boolean;
  providerOrderId?: string | null;
  outcome?: string;
  message?: string;
  error?: string;
}

const ACTOR = { "X-Actor": "user:concierge-7", "content-type": "application/json" };

/** What the outcome means, in the vocabulary the rest of the site uses. */
function toneOf(step: Step): string {
  if (!step.ok) return "var(--color-state-failed)";
  if (step.blocked) return "var(--color-state-conflict)";
  if (step.state === "unknown") return "var(--color-state-conflict)";
  return "var(--color-state-recovered, #3da76a)";
}

export function WorkflowRunner({
  moveId,
  reference,
  onChanged,
}: {
  moveId: string | null;
  reference: string | null;
  onChanged: () => void;
}) {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!moveId) return setServices([]);
    const res = await fetch(`/api/v1/moves/${moveId}/fulfillment`, { headers: ACTOR });
    if (!res.ok) return setServices([]);
    const json = await res.json();
    setServices(json.services ?? []);
    setSelected((prev) =>
      prev && json.services?.some((s: ServiceRow) => s.id === prev)
        ? prev
        : (json.services?.[0]?.id ?? null),
    );
  }, [moveId]);

  useEffect(() => {
    setSteps([]);
    void loadServices();
  }, [loadServices]);

  const act = useCallback(
    async (action: "submit" | "retry" | "reconcile") => {
      if (!moveId || !selected) return null;
      setBusy(action);
      try {
        const res = await fetch(`/api/v1/moves/${moveId}/fulfillment`, {
          method: "POST",
          headers: ACTOR,
          body: JSON.stringify({ action, serviceRequestId: selected }),
        });
        const json = await res.json();
        const step: Step = { action, ok: res.ok && json.ok !== false, ...json };
        setSteps((s) => [...s, step]);
        await loadServices();
        onChanged();
        return step;
      } finally {
        setBusy(null);
      }
    },
    [moveId, selected, loadServices, onChanged],
  );

  /** Submit, refuse the retry, then recover. The whole argument, in order. */
  const runAll = useCallback(async () => {
    setSteps([]);
    if (!(await act("submit"))) return;
    await new Promise((r) => setTimeout(r, 700));
    await act("retry");
    await new Promise((r) => setTimeout(r, 700));
    await act("reconcile");
  }, [act]);

  const backfill = useCallback(async () => {
    if (!moveId) return;
    setBusy("backfill");
    try {
      await fetch(`/api/v1/moves/${moveId}/fulfillment`, { method: "PATCH", headers: ACTOR });
      await loadServices();
    } finally {
      setBusy(null);
    }
  }, [moveId, loadServices]);

  if (!moveId) {
    return (
      <Shell>
        <p className="py-6 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
          Select a move below to drive its fulfillment.
        </p>
      </Shell>
    );
  }

  return (
    <Shell reference={reference}>
      {services.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
            No provider operations yet.
          </p>
          {/*
            Moves ingested before services were materialised have their
            requested services recorded as field versions and nothing to act on.
            The repair is offered rather than run silently, because rewriting
            rows on a record someone is looking at should be a decision.
          */}
          <button
            onClick={backfill}
            disabled={!!busy}
            className="min-h-11 mt-3 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-ground-3)" }}
          >
            {busy === "backfill" ? "Creating…" : "Create requested service operations"}
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelected(s.id);
                  setSteps([]);
                }}
                className="inline-flex min-h-11 items-center rounded-lg border px-3 text-xs font-semibold"
                style={{
                  borderColor:
                    selected === s.id ? "var(--color-state-verified)" : "var(--color-ground-3)",
                  color: selected === s.id ? "var(--color-state-verified)" : "var(--color-text-mid)",
                }}
              >
                {s.serviceType}
                <span className="ml-1.5 font-normal" style={{ color: "var(--color-text-lo)" }}>
                  {s.providerName}
                </span>
                {s.submissionState && (
                  <span
                    className="ml-1.5 font-mono text-[10px]"
                    style={{
                      color:
                        s.submissionState === "unknown"
                          ? "var(--color-state-conflict)"
                          : "var(--color-state-recovered, #3da76a)",
                    }}
                  >
                    {s.submissionState}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={runAll}
              disabled={!!busy || !selected}
              className="min-h-11 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
              style={{ background: "var(--uc-cyan-fill)", color: "white" }}
            >
              {busy ? "Running…" : "▶ Submit · refuse the retry · recover"}
            </button>
            <Step3 label="Submit" onClick={() => act("submit")} busy={busy} />
            <Step3 label="Retry" onClick={() => act("retry")} busy={busy} />
            <Step3 label="Reconcile" onClick={() => act("reconcile")} busy={busy} />
          </div>

          {steps.length > 0 && (
            <ol className="mt-4 grid gap-2">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="rounded-lg border px-3 py-2"
                  style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: toneOf(s) }}>
                      {s.action}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--color-text-mid)" }}>
                      {s.state ?? s.outcome ?? (s.ok ? "ok" : "error")}
                      {s.blocked ? " · blocked" : ""}
                    </span>
                    {s.providerOrderId && (
                      <span className="font-mono text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                        order {s.providerOrderId}
                      </span>
                    )}
                  </div>
                  {(s.message || s.error) && (
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
                      {s.error ?? s.message}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </Shell>
  );
}

function Step3({
  label,
  onClick,
  busy,
}: {
  label: string;
  onClick: () => void;
  busy: string | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!!busy}
      className="min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40"
      style={{ borderColor: "var(--color-ground-3)" }}
    >
      {label}
    </button>
  );
}

function Shell({ reference, children }: { reference?: string | null; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Fulfillment</h2>
        {reference && (
          <span className="font-mono text-xs" style={{ color: "var(--color-text-lo)" }}>
            {reference}
          </span>
        )}
      </div>
      <p className="mb-4 text-xs" style={{ color: "var(--color-text-lo)" }}>
        Submit defaults to the lost-reply scenario. The retry after it must be refused, and
        reconciliation must find the order that already existed.
      </p>
      {children}
    </div>
  );
}
