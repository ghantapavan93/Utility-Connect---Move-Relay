"use client";

import { useState } from "react";

import type { FieldHistory, FieldVersion, MoveRecord } from "@/lib/move-record";
import { auditLabel } from "@/lib/agent/narrative";

/**
 * The record itself: provenance, sources, services, consent, audit.
 *
 * The workspace this sits beside resolves conflicts, and with none open it used
 * to say "No open conflicts" and offer a link away. That is the moment a
 * reviewer most wants to look at the record — a settled move is the finished
 * argument — and the screen had nothing to show them.
 *
 * Every value here is rendered with where it came from. That is the product
 * thesis and this is the only screen where it can be seen in full, so nothing
 * is summarised into a figure that cannot be opened.
 */

const fmt = (v: unknown) =>
  typeof v === "string" ? v : v === null || v === undefined ? "—" : JSON.stringify(v);

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

/** Trust tier to the colour vocabulary the rest of the system uses. */
function verificationTone(v: string): string {
  if (v === "customer_confirmed" || v === "human_approved") return "var(--color-state-verified)";
  if (v === "unverified") return "var(--color-text-lo)";
  return "var(--color-state-transit)";
}

export function RecordPanels({ record }: { record: MoveRecord }) {
  return (
    <div className="mt-8 grid gap-5">
      <Sources record={record} />
      <Fields fields={record.fields} />
      <Services record={record} />
      <Consent record={record} />
      <Audit record={record} />
    </div>
  );
}

function Panel({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint?: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && (
          <span className="text-xs tabular-nums" style={{ color: "var(--color-text-lo)" }}>
            {count}
          </span>
        )}
      </div>
      {hint && (
        <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

function Sources({ record }: { record: MoveRecord }) {
  return (
    <Panel
      title="Where this record came from"
      hint="One household, however many channels described it. The order is the order they arrived."
      count={record.sources.length}
    >
      <div className="flex flex-wrap gap-2">
        {record.sources.map((s) => (
          <div
            key={s.channel}
            className="rounded-xl border px-4 py-2.5"
            style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
          >
            <div className="font-mono text-xs font-semibold">{s.channel}</div>
            <div className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
              {s.fields} field{s.fields === 1 ? "" : "s"} · {when(s.firstSeen)}
            </div>
          </div>
        ))}
        {record.sources.length === 0 && <Empty>No sources recorded.</Empty>}
      </div>
    </Panel>
  );
}

/**
 * Every field, with its whole life.
 *
 * Collapsed to the current value by default and expandable to the full version
 * chain — because the answer to "what is her phone number" is one line, and the
 * answer to "why do you believe that" is a history. A screen that only ever
 * showed the history would bury the first question; one that only showed the
 * value would be every other CRM.
 */
function Fields({ fields }: { fields: FieldHistory[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel
      title="Fields, and why each value is believed"
      hint="A value with no canonical version has not been decided by a person yet. Open one to see every version it has held."
      count={fields.length}
    >
      <div className="grid gap-2">
        {fields.map((f) => {
          const current = f.canonical ?? f.versions[f.versions.length - 1];
          const expanded = open === f.fieldPath;
          return (
            <div
              key={f.fieldPath}
              className="rounded-xl border"
              style={{
                borderColor: f.contested ? "var(--color-state-conflict)" : "var(--color-ground-3)",
                background: "var(--color-ground-0)",
              }}
            >
              <button
                onClick={() => setOpen(expanded ? null : f.fieldPath)}
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-left"
                aria-expanded={expanded}
              >
                <span className="font-mono text-xs" style={{ color: "var(--color-text-lo)" }}>
                  {f.fieldPath}
                </span>
                <span className="text-sm font-semibold">{fmt(current?.value)}</span>
                {f.canonical ? (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: "var(--color-state-verified)" }}
                  >
                    canonical
                  </span>
                ) : f.contested ? (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: "var(--color-state-conflict)" }}
                  >
                    needs a person
                  </span>
                ) : null}
                <span className="ml-auto text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                  {f.versions.length} version{f.versions.length === 1 ? "" : "s"}
                </span>
              </button>

              {expanded && (
                <ol className="border-t px-3 py-3" style={{ borderColor: "var(--color-ground-3)" }}>
                  {f.versions.map((v) => (
                    <Version key={v.id} v={v} />
                  ))}
                </ol>
              )}
            </div>
          );
        })}
        {fields.length === 0 && <Empty>No fields recorded on this move.</Empty>}
      </div>
    </Panel>
  );
}

function Version({ v }: { v: FieldVersion }) {
  return (
    <li className="flex gap-3 py-2 text-xs">
      <span
        aria-hidden
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: verificationTone(v.verification) }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="font-mono font-semibold">{fmt(v.value)}</span>
          {v.isCanonical && (
            <span className="text-[10px] font-bold uppercase" style={{ color: "var(--color-state-verified)" }}>
              canonical
            </span>
          )}
        </div>
        <div className="mt-0.5" style={{ color: "var(--color-text-lo)" }}>
          {v.channel} · {v.verification} · confidence {Number(v.confidence).toFixed(2)}
        </div>
        {/*
          Both clocks, always. "When we learned it" and "when it was true" are
          different questions, and a record that collapses them cannot answer
          either one honestly — a move date corrected on Tuesday for a move that
          changed on Friday is two facts, not one.
        */}
        <div className="mt-0.5" style={{ color: "var(--color-text-lo)" }}>
          recorded {when(v.recordedAt)}
          {v.validAt ? ` · valid from ${when(v.validAt)}` : ""}
        </div>
        {v.selectedBy && (
          <div className="mt-1" style={{ color: "var(--color-state-verified)" }}>
            chosen by {v.selectedBy}
            {v.selectionReason ? ` — “${v.selectionReason}”` : ""}
          </div>
        )}
        {v.supersedesId && (
          <div className="mt-0.5" style={{ color: "var(--color-text-lo)" }}>
            supersedes an earlier version
          </div>
        )}
      </div>
    </li>
  );
}

function Services({ record }: { record: MoveRecord }) {
  return (
    <Panel
      title="Services and provider outcomes"
      hint="An unknown outcome means the order may exist. It is not a failure, and it is never retried blindly."
      count={record.services.length}
    >
      <div className="grid gap-2">
        {record.services.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border p-3"
            style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
          >
            <span className="text-sm font-semibold">{s.serviceType}</span>
            <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
              {s.providerName}
            </span>
            <span
              className="font-mono text-xs"
              style={{
                color:
                  s.submissionState === "unknown"
                    ? "var(--color-state-conflict)"
                    : s.submissionState
                      ? "var(--color-state-verified)"
                      : "var(--color-text-lo)",
              }}
            >
              {s.submissionState ?? "not submitted"}
            </span>
            {s.providerOrderId && (
              <span className="ml-auto font-mono text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                order {s.providerOrderId}
              </span>
            )}
            {/*
              The identity reconciliation looks the order up by. On an unknown
              outcome this is the whole safe path made visible; omitting it
              asks a reader to believe recovery works by magic.
            */}
            {s.operationKey && (
              <span className="w-full break-all font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                operation identity: {s.operationKey}
              </span>
            )}
          </div>
        ))}
        {record.services.length === 0 && (
          <Empty>No services requested. Drive fulfillment from the operator console.</Empty>
        )}
      </div>
    </Panel>
  );
}

function Consent({ record }: { record: MoveRecord }) {
  const [expanded, setExpanded] = useState(false);
  /*
    Four purposes across three channels is twelve near-identical rows, and a
    reader scanning a wall of "granted" learns exactly two things: the count,
    and whether anything was NOT granted. So past four records the summary
    leads, denials always render individually — a refusal may never hide
    inside an aggregate — and the verbatim list stays one disclosure away.
  */
  const denied = record.consent.filter((c) => !c.granted);
  const wordings = [...new Set(record.consent.map((c) => c.textVersion))];
  const compact = record.consent.length > 4 && !expanded;

  return (
    <Panel
      title="Consent"
      hint="Scope, channel and the exact wording version. “They agreed” is not an answer without “to what”."
      count={record.consent.length}
    >
      {compact && (
        <div className="mb-2">
          <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
            <span
              className="font-bold"
              style={{ color: denied.length === 0 ? "var(--color-state-verified)" : "var(--color-state-conflict)" }}
            >
              {record.consent.length - denied.length} of {record.consent.length} granted
            </span>
            {" · "}wording {wordings.join(", ")}
          </p>
          {denied.map((c, i) => (
            <p key={i} className="mt-1 text-xs" style={{ color: "var(--color-state-failed)" }}>
              not granted · {c.purpose} via {c.channel}
            </p>
          ))}
          <button
            onClick={() => setExpanded(true)}
            className="mt-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "var(--color-state-verified)" }}
          >
            Show each of the {record.consent.length} records
          </button>
        </div>
      )}
      <div className="grid gap-2" style={compact ? { display: "none" } : undefined}>
        {record.consent.map((c, i) => (
          <div
            key={i}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl border p-3 text-xs"
            style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-0)" }}
          >
            <span
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{
                color: c.granted ? "var(--color-state-verified)" : "var(--color-state-failed)",
              }}
            >
              {/* "Withdrawn" asserts a grant existed and was revoked — a
                  history this row does not record. "Not granted" is the fact. */}
              {c.granted ? "granted" : "not granted"}
            </span>
            <span className="font-mono">{c.purpose}</span>
            <span style={{ color: "var(--color-text-lo)" }}>via {c.channel}</span>
            <span className="font-mono" style={{ color: "var(--color-text-lo)" }}>
              {c.textVersion}
            </span>
            <span className="ml-auto" style={{ color: "var(--color-text-lo)" }}>
              {when(c.occurredAt)}
            </span>
          </div>
        ))}
        {record.consent.length === 0 && (
          <Empty>
            No consent on file. This move arrived through channels that do not capture it.
          </Empty>
        )}
      </div>
    </Panel>
  );
}

function Audit({ record }: { record: MoveRecord }) {
  return (
    <Panel
      title="Audit trail"
      hint="Append-only, and written in the same transaction as the change it describes. A correction is a new event, never an edit."
      count={record.audit.length}
    >
      <ol className="grid gap-2">
        {record.audit.map((a) => (
          <li key={a.id} className="min-w-0 text-xs">
            {/*
              The business sentence leads; the raw event type stays underneath
              as evidence. `provider.retry.blocked` printed as the headline was
              accurate and unreadable — and the same map the copilot uses keeps
              the two surfaces from drifting apart.
            */}
            <span
              className="font-medium"
              style={{
                color:
                  a.eventType.includes("blocked") || a.eventType.includes("unknown")
                    ? "var(--color-state-conflict)"
                    : "var(--color-text-hi)",
              }}
            >
              {auditLabel(a.eventType)}
            </span>
            <span className="mt-0.5 block font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
              {a.eventType} · {a.actor} · {when(a.occurredAt)}
            </span>
          </li>
        ))}
        {record.audit.length === 0 && <Empty>No audit events for this move.</Empty>}
      </ol>
    </Panel>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
      {children}
    </p>
  );
}
