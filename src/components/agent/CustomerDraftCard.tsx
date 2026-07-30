"use client";

import { useState } from "react";

import { accentColor, accentInk } from "@/lib/accents";
import type { CustomerDraft } from "@/lib/agent/narrative";

/**
 * A message to the customer, prepared and conspicuously not sent.
 *
 * This card is the commercially legible part of the copilot — the thing a
 * non-engineer immediately understands — and also the most dangerous surface
 * on the page, because a generated customer message is one plausible sentence
 * away from committing the business to an outcome nobody has established. So
 * the card shows its work on both sides: which observations the draft is built
 * from, and which commitments it deliberately withholds.
 *
 * ## Honest buttons
 *
 * There is no messaging integration in this repository, so there is no "Send".
 * Approve marks the draft reviewed *locally* and says so; Edit is a real
 * textarea; Discard removes it. Wiring a fake send that toasts "Sent!" would be
 * the exact kind of theatre the rest of this page exists to refuse.
 */

type DraftState = "draft" | "editing" | "approved" | "discarded";

export function CustomerDraftCard({ draft }: { draft: CustomerDraft }) {
  const [state, setState] = useState<DraftState>("draft");
  const [body, setBody] = useState(draft.body);

  if (state === "discarded") {
    return (
      <p
        className="rounded-xl border border-dashed p-4 text-[11px]"
        style={{ borderColor: "rgba(255,255,255,0.14)", color: "var(--color-text-lo)" }}
      >
        Draft discarded. Nothing was sent, and nothing was stored.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="draft-heading"
      className="min-w-0 rounded-2xl border p-5"
      style={{ borderColor: accentColor("internet", 0.3), background: accentColor("internet", 0.04) }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="draft-heading" className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: accentInk("internet") }}>
          Customer communication draft
        </h3>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{
            borderColor: accentColor(state === "approved" ? "verified" : "unknown", 0.5),
            color: accentInk(state === "approved" ? "verified" : "unknown"),
          }}
        >
          {state === "approved" ? "Reviewed locally · still not sent" : "Draft · not sent"}
        </span>
      </div>

      <p className="mt-3 text-[13px] font-semibold text-white/90">{draft.subject}</p>

      {state === "editing" ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          aria-label="Edit the customer draft"
          className="mt-2 w-full rounded-lg border bg-transparent p-3 text-sm leading-relaxed text-white/85 focus:outline-none focus-visible:ring-2"
          style={{ borderColor: accentColor("internet", 0.4) }}
        />
      ) : (
        <p className="mt-2 rounded-lg border p-3 text-sm leading-relaxed text-white/85" style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.25)" }}>
          {body}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk("verified") }}>
            Built from
          </h4>
          <ul className="mt-1 list-none space-y-0.5 text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            {draft.basedOn.map((b) => (
              <li key={b}>· {b}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <h4 className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk("security") }}>
            Deliberately withheld
          </h4>
          <ul className="mt-1 list-none space-y-0.5 text-[11px] leading-relaxed" style={{ color: "var(--color-text-mid)" }}>
            {draft.withheld.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {state === "editing" ? (
          <button
            type="button"
            onClick={() => setState("draft")}
            className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
            style={{ borderColor: accentColor("internet", 0.5), color: accentInk("internet") }}
          >
            Done editing
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setState("approved")}
              disabled={state === "approved"}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-[11px] font-bold uppercase tracking-wide text-white disabled:opacity-60"
              style={{ background: accentColor("verified", 0.9) }}
            >
              {state === "approved" ? "Reviewed" : "Approve draft"}
            </button>
            <button
              type="button"
              onClick={() => setState("editing")}
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
              style={{ borderColor: "rgba(255,255,255,0.25)", color: "var(--color-text-mid)" }}
            >
              Edit draft
            </button>
            <button
              type="button"
              onClick={() => setState("discarded")}
              className="inline-flex min-h-11 items-center rounded-full border px-4 text-[11px] font-bold uppercase tracking-wide"
              style={{ borderColor: "rgba(255,255,255,0.25)", color: "var(--color-text-mid)" }}
            >
              Discard
            </button>
          </>
        )}
      </div>

      {/*
        The boundary, on the card rather than in a footnote. No messaging
        integration exists, so approval is a local review state and the copy
        says exactly that.
      */}
      <p className="mt-3 border-t pt-3 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ borderColor: "rgba(255,255,255,0.08)", color: accentInk("security") }}>
        Prepared from case evidence. No messaging integration exists — nothing on this page can send it.
      </p>
    </section>
  );
}
