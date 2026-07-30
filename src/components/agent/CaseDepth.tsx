"use client";

import { useState } from "react";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import type {
  ConflictDetail,
  ProviderOperationDetail,
  AuditEntry,
  ConsentDetail,
} from "@/lib/agent/narrative";

/**
 * The depth layer: the disagreement itself, the identity itself, the history
 * itself.
 *
 * The decision package states conclusions — "sources disagree", "the outcome
 * is unknown". These components show the material those sentences were formed
 * from, read from the same stored observations the agent reasoned over. The
 * distinction matters because a reviewer weighing the copilot's judgement
 * needs the same evidence the copilot had, not a summary of it: the two dates
 * side by side with their channels, the operation key reconciliation will use,
 * the events that already happened in the order they happened.
 */

const VERIFICATION_ACCENT: Record<string, Accent> = {
  "customer confirmed": "verified",
  "human approved": "verified",
  "system validated": "internet",
  unverified: "unknown",
};

/** The competing values, side by side, each wearing its provenance. */
export function ConflictValues({ conflicts }: { conflicts: ConflictDetail[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div className="min-w-0 space-y-3">
      {conflicts.map((conflict) => (
        <div key={conflict.fieldPath} className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
            {conflict.field} — {conflict.candidates.length} competing values
            <span className="ml-2 font-mono normal-case tracking-normal">{conflict.fieldPath}</span>
          </p>
          <div className="mt-1.5 grid min-w-0 gap-2 sm:grid-cols-2">
            {conflict.candidates.map((cand, i) => {
              const accent = VERIFICATION_ACCENT[cand.verification] ?? "unknown";
              return (
                <div
                  key={`${cand.channel}-${i}`}
                  className="min-w-0 rounded-lg border p-3"
                  style={{ borderColor: accentColor(accent, 0.4), background: accentColor(accent, 0.05) }}
                >
                  {/* The value is the loudest thing — it is what a person weighs. */}
                  <p className="break-words text-base font-semibold text-white">{cand.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: accentInk(accent) }}>
                    {cand.channel} · {cand.verification}
                  </p>
                  {cand.recordedAt && (
                    <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                      recorded {new Date(cand.recordedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** The provider operations, with the identity the safe path depends on. */
export function ProviderIdentity({ operations }: { operations: ProviderOperationDetail[] }) {
  if (operations.length === 0) return null;
  return (
    <ul className="min-w-0 space-y-2">
      {operations.map((op, i) => {
        const accent: Accent =
          op.state === "unknown" ? "unknown" : op.state === "confirmed" ? "verified" : "internet";
        return (
          <li
            key={`${op.service}-${i}`}
            className="min-w-0 rounded-lg border p-3"
            style={{ borderColor: accentColor(accent, 0.4), background: accentColor(accent, 0.05) }}
          >
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[13px] font-semibold capitalize text-white">{op.service}</span>
              {op.provider && (
                <span className="text-[11px]" style={{ color: "var(--color-text-mid)" }}>
                  via {op.provider}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-[0.13em]" style={{ color: accentInk(accent) }}>
                {op.state}
              </span>
            </div>
            {/*
              The identity, always shown for an unknown outcome. It is why
              "ask the provider what exists" can find an order without creating
              one — hiding it would make the safe path look like magic.
            */}
            {op.operationKey && (
              <p className="mt-1.5 font-mono text-[10px]" style={{ color: "var(--color-text-mid)" }}>
                operation identity: {op.operationKey}
              </p>
            )}
            {op.orderId && (
              <p className="mt-0.5 font-mono text-[10px]" style={{ color: accentInk("verified") }}>
                provider order: {op.orderId}
              </p>
            )}
            {op.errorCategory && (
              <p className="mt-0.5 font-mono text-[10px]" style={{ color: accentInk("unknown") }}>
                last error: {op.errorCategory}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * What the customer agreed to.
 *
 * The demo tenant records consent per purpose per channel — four purposes
 * across three channels is twelve rows — and the first version printed all of
 * them as a wall of near-identical lines that drowned the case panel. Twelve
 * lines saying "Granted" carry exactly two facts a reader needs up front: how
 * many, and whether any were *not* granted. So the summary leads, the refusals
 * (the rows that change decisions) always render individually, and the full
 * verbatim list sits behind a real disclosure rather than being deleted.
 */
export function ConsentLine({ consent }: { consent: ConsentDetail[] }) {
  const [expanded, setExpanded] = useState(false);
  if (consent.length === 0) return null;

  const granted = consent.filter((c) => c.granted);
  const denied = consent.filter((c) => !c.granted);
  const wordings = [...new Set(consent.map((c) => c.wordingVersion))];
  const purposes = [...new Set(consent.map((c) => c.purpose))];
  const compact = consent.length > 4 && !expanded;

  const line = (c: ConsentDetail, i: number) => (
    <li key={`${c.purpose}-${c.channel}-${i}`} className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
      <span style={{ color: accentInk(c.granted ? "verified" : "failed") }}>
        {c.granted ? "Granted" : "Not granted"}
      </span>
      {" · "}
      {c.purpose} via {c.channel}, wording {c.wordingVersion}
    </li>
  );

  return (
    <div className="min-w-0">
      {compact ? (
        <>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            <span style={{ color: accentInk(denied.length === 0 ? "verified" : "conflict") }}>
              {granted.length} of {consent.length} granted
            </span>
            {" · "}
            {purposes.length} purpose{purposes.length === 1 ? "" : "s"}, wording{" "}
            {wordings.join(", ")}
          </p>
          {/* A refusal is never allowed to hide inside an aggregate. */}
          {denied.length > 0 && <ul className="mt-1 space-y-0.5">{denied.map(line)}</ul>}
        </>
      ) : (
        <ul className="space-y-0.5">{consent.map(line)}</ul>
      )}
      {consent.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accentInk("internet") }}
        >
          {expanded ? "Show the summary" : `Show each of the ${consent.length} records`}
        </button>
      )}
    </div>
  );
}

/**
 * The move's own history, as the run read it.
 *
 * Six entries by default and the rest behind a real count — an audit trail
 * truncated silently would be the one place on this page where "what you see
 * is what was read" quietly stopped being true.
 */
export function AuditTimeline({ trail }: { trail: AuditEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (trail.length === 0) return null;

  const shown = expanded ? trail : trail.slice(0, 6);

  return (
    <div className="min-w-0">
      <ol className="min-w-0 space-y-0 border-l" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        {shown.map((entry, i) => (
          <li key={`${entry.event}-${i}`} className="relative min-w-0 pb-3 pl-4 last:pb-0">
            <span
              aria-hidden
              className="absolute -left-[3.5px] top-[7px] h-[7px] w-[7px] rounded-full"
              style={{
                background:
                  entry.event.includes("blocked") || entry.event.includes("unknown")
                    ? accentInk("unknown")
                    : entry.event.includes("confirmed") || entry.event.includes("reconcil")
                      ? accentInk("verified")
                      : "rgba(255,255,255,0.35)",
              }}
            />
            <p className="text-[12px] leading-snug text-white/85">{entry.label}</p>
            <p className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
              {entry.event} · {entry.actor}
              {entry.at ? ` · ${new Date(entry.at).toLocaleString()}` : ""}
            </p>
          </li>
        ))}
      </ol>
      {trail.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-2 inline-flex min-h-11 items-center text-[10px] font-bold uppercase tracking-[0.14em]"
          style={{ color: accentInk("internet") }}
        >
          {expanded ? "Show fewer" : `Show all ${trail.length} events the run read`}
        </button>
      )}
    </div>
  );
}
