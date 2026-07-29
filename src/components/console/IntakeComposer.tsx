"use client";

import { useCallback, useRef, useState } from "react";

import {
  INTAKE_PRESETS,
  matchedExpectation,
  reusesKey,
  type IntakePreset,
} from "@/lib/intake-presets";

/**
 * The door into the system, on the operator console.
 *
 * Everything this fires is a real POST to `/api/v1/referrals`, carrying a real
 * `Idempotency-Key` and a real `X-Correlation-Id`, landing real rows. The panel
 * reports whatever came back — including when that disagrees with what the
 * preset promised, which is the only reason any of it is evidence.
 *
 * The key handling is the part worth reading. Replay and key-conflict cannot be
 * demonstrated by a form that mints a fresh key every time, so the previous
 * submission's key is held here and reused on demand. That is also exactly how
 * the failure happens in production: a client retries with the key it already
 * used, and the second request either carries the same body or it does not.
 */

interface Verdict {
  presetId: string;
  label: string;
  /** What the API actually said. */
  status: string;
  httpStatus: number;
  expected: string;
  matched: boolean;
  reference?: string;
  moveId?: string;
  correlationId: string;
  idempotencyKey: string;
  duplicate?: { ofReference: string; score: number; verdict: string } | null;
  conflictFields?: string[];
  issues?: Array<{ path: string; message: string }>;
  message: string;
}

export function IntakeComposer({ onLanded }: { onLanded: () => void }) {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  /*
    The last key this panel sent. Held in a ref rather than state because a
    preset fired twice in quick succession must see the key the previous call
    actually used, not the one from the last committed render.
  */
  const lastKey = useRef<string | null>(null);

  const fire = useCallback(
    async (preset: IntakePreset) => {
      setBusy(preset.id);
      const key =
        reusesKey(preset) && lastKey.current ? lastKey.current : crypto.randomUUID();
      const correlationId = crypto.randomUUID();

      try {
        const res = await fetch("/api/v1/referrals", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": key,
            "X-Correlation-Id": correlationId,
            // Writes need an actor. The console is a signed-in operator's
            // surface, so it says who it is rather than relying on the endpoint
            // being lenient.
            "X-Actor": "user:concierge-7",
          },
          body: JSON.stringify({ channel: preset.channel, payload: preset.payload }),
        });
        const json = await res.json();

        // Only remember keys that were actually accepted as new. Recording a
        // rejected key would make the next replay demonstrate nothing.
        if (!reusesKey(preset)) lastKey.current = key;

        const status = String(json.status ?? (res.ok ? "created" : "error"));
        const verdict: Verdict = {
          presetId: preset.id,
          label: preset.label,
          status,
          httpStatus: res.status,
          expected: preset.expect,
          matched: matchedExpectation(preset, status),
          reference: json.reference,
          moveId: json.moveId,
          correlationId: res.headers.get("x-correlation-id") ?? correlationId,
          idempotencyKey: key,
          duplicate: json.duplicate ?? null,
          conflictFields: json.conflictFields,
          issues: json.issues,
          message: json.message ?? json.error ?? "",
        };
        setVerdicts((v) => [verdict, ...v].slice(0, 8));
        setExpanded(preset.id);
        onLanded();
      } catch {
        setVerdicts((v) =>
          [
            {
              presetId: preset.id,
              label: preset.label,
              status: "network error",
              httpStatus: 0,
              expected: preset.expect,
              matched: false,
              correlationId,
              idempotencyKey: key,
              message: "The request never reached the server.",
            },
            ...v,
          ].slice(0, 8),
        );
      } finally {
        setBusy(null);
      }
    },
    [onLanded],
  );

  const runAll = useCallback(async () => {
    for (const p of INTAKE_PRESETS) {
      await fire(p);
      // A beat between calls, so a reviewer can watch each verdict land rather
      // than seeing seven appear at once.
      await new Promise((r) => setTimeout(r, 550));
    }
  }, [fire]);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Intake</h2>
          <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>
            Real requests to <code className="font-mono">POST /api/v1/referrals</code>. Each one
            lands rows you can open below.
          </p>
        </div>
        <button
          onClick={runAll}
          disabled={!!busy}
          className="min-h-11 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50"
          style={{ background: "var(--uc-cyan-fill)", color: "white" }}
        >
          {busy ? "Running…" : "▶ Walk the whole gauntlet"}
        </button>
      </div>

      <div className="mt-4 grid gap-2">
        {INTAKE_PRESETS.map((p) => {
          const verdict = verdicts.find((v) => v.presetId === p.id);
          const open = expanded === p.id;
          return (
            <div
              key={p.id}
              className="rounded-xl border"
              style={{
                borderColor: verdict
                  ? verdict.matched
                    ? "color-mix(in oklab, var(--color-state-recovered, #3da76a) 55%, transparent)"
                    : "var(--color-state-failed)"
                  : "var(--color-ground-3)",
                background: "var(--color-ground-0)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3 p-3">
                <button
                  onClick={() => fire(p)}
                  disabled={!!busy}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-xs font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--color-ground-3)" }}
                >
                  {busy === p.id ? "Running…" : p.action}
                </button>
                <button
                  onClick={() => setExpanded(open ? null : p.id)}
                  className="min-h-11 min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-sm font-medium">{p.label}</div>
                  <div className="truncate text-xs" style={{ color: "var(--color-text-lo)" }}>
                    {p.channel} · expects {p.expect}
                  </div>
                </button>
                {verdict && <StatusChip verdict={verdict} />}
              </div>

              {open && (
                <div
                  className="border-t px-3 py-3 text-xs leading-relaxed"
                  style={{ borderColor: "var(--color-ground-3)" }}
                >
                  <p style={{ color: "var(--color-text-mid)" }}>{p.demonstrates}</p>
                  <p className="mt-2" style={{ color: "var(--color-text-lo)" }}>
                    {p.why}
                  </p>
                  {verdict && <Evidence verdict={verdict} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The outcome, and whether it was the promised one.
 *
 * A mismatch is shown in red with both values rather than hidden. The usual
 * cause is benign — the tenant was reset, or the presets were fired out of
 * order, so "created" came back where "collapsed" was expected — but a panel
 * that silently relabelled the result would be unable to report the case where
 * something is genuinely wrong.
 */
function StatusChip({ verdict }: { verdict: Verdict }) {
  const good = verdict.matched;
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: good
          ? "color-mix(in oklab, var(--color-state-recovered, #3da76a) 18%, transparent)"
          : "color-mix(in oklab, var(--color-state-failed) 18%, transparent)",
        color: good ? "var(--color-state-recovered, #3da76a)" : "var(--color-state-failed)",
      }}
      title={
        good
          ? `${verdict.status} · HTTP ${verdict.httpStatus}`
          : `expected ${verdict.expected}, got ${verdict.status}`
      }
    >
      {good ? verdict.status : `${verdict.status} ≠ ${verdict.expected}`}
    </span>
  );
}

/** The rows and identifiers the request actually produced. */
function Evidence({ verdict }: { verdict: Verdict }) {
  return (
    <dl
      className="mt-3 grid gap-x-4 gap-y-1.5 rounded-lg p-3 font-mono text-[11px] sm:grid-cols-[auto_1fr]"
      style={{ background: "var(--color-ground-1)", color: "var(--color-text-mid)" }}
    >
      <Row k="http" v={String(verdict.httpStatus)} />
      <Row k="idempotency-key" v={verdict.idempotencyKey} />
      <Row k="correlation-id" v={verdict.correlationId} />
      {verdict.reference && <Row k="reference" v={verdict.reference} />}
      {verdict.duplicate && (
        <Row
          k="duplicate-of"
          v={`${verdict.duplicate.ofReference} · score ${verdict.duplicate.score.toFixed(2)} · ${verdict.duplicate.verdict}`}
        />
      )}
      {verdict.conflictFields?.length ? (
        <Row k="conflicts" v={verdict.conflictFields.join(", ")} />
      ) : null}
      {verdict.issues?.length
        ? verdict.issues.map((i, n) => <Row key={n} k={`issue[${n}]`} v={`${i.path}: ${i.message}`} />)
        : null}
      {verdict.message && <Row k="message" v={verdict.message} />}
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={{ color: "var(--color-text-lo)" }}>{k}</dt>
      <dd className="break-all">{v}</dd>
    </>
  );
}
