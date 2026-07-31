"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

import { accentColor, accentInk, type Accent } from "@/lib/accents";
import { useStillness } from "@/lib/use-stillness";
import type { DecisionPackage as Decision, EvidenceItem, EvidenceState } from "@/lib/agent/narrative";

/**
 * The decision package: what the agent prepared, ready for a person.
 *
 * This is the page's centre of gravity, and its design constraint is the same
 * one `narrative.ts` enforces in code — the shape never flatters the case. A
 * run with a recommendation and a run with nothing to recommend render through
 * the same sections in the same order, because the cases worth reading
 * carefully are exactly the ones where the recommendation line says "none".
 *
 * ## Evidence is a claim you can open
 *
 * Each evidence row is a disclosure: the sentence a reader needs, and under it
 * the raw observation the sentence was derived from. The payload is rendered
 * inside the button's own region rather than a shared drawer so that opening
 * one claim never scrolls the reader away from the claim they opened.
 *
 * The `<pre>` blocks live outside any live region and are never announced —
 * a screen reader gets the claim, not the JSON.
 */

const EVIDENCE_META: Record<EvidenceState, { label: string; accent: Accent }> = {
  fully_supported: { label: "Fully supported by returned evidence", accent: "verified" },
  partially_supported: { label: "Partially supported", accent: "unknown" },
  conflicting: { label: "Conflicting evidence", accent: "conflict" },
  insufficient: { label: "Insufficient evidence", accent: "failed" },
};

function Row({ title, children, tone }: { title: string; children: React.ReactNode; tone?: Accent }) {
  return (
    <div className="min-w-0">
      <h4
        className="text-[10px] font-bold uppercase tracking-[0.18em]"
        style={{ color: tone ? accentInk(tone) : "var(--color-text-lo)" }}
      >
        {title}
      </h4>
      <div className="mt-1.5 text-sm leading-relaxed text-white/85">{children}</div>
    </div>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left"
        style={{
          borderColor: open ? accentColor("internet", 0.4) : "rgba(255,255,255,0.12)",
          background: open ? accentColor("internet", 0.05) : "rgba(255,255,255,0.02)",
        }}
      >
        <span className="min-w-0">
          <span className="block text-[13px] leading-snug text-white/85">{item.claim}</span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: accentInk("internet") }}>
            {item.source}
          </span>
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={`mt-1 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--color-text-lo)" }}
        />
      </button>
      {open && (
        <pre
          className="mt-1 max-h-56 overflow-auto rounded-lg border p-3 font-mono text-[10px] leading-relaxed"
          style={{
            borderColor: "rgba(255,255,255,0.1)",
            background: "rgba(0,0,0,0.35)",
            color: "var(--color-text-mid)",
          }}
        >
          {JSON.stringify(item.payload, null, 2)}
        </pre>
      )}
    </li>
  );
}

export function DecisionPackageCard({
  decision,
  evidence,
  executor,
}: {
  decision: Decision;
  evidence: EvidenceItem[];
  /** Shown only when the backend supplies one — never invented. */
  executor: string | null;
}) {
  const still = useStillness();
  const meta = EVIDENCE_META[decision.evidenceState];

  return (
    <motion.section
      aria-labelledby="decision-heading"
      initial={{ opacity: 0, y: still ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: still ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="cine-glass min-w-0 rounded-2xl p-5 sm:p-6"
      style={{
        borderColor: accentColor("security", 0.4),
        boxShadow: `0 18px 60px -30px ${accentColor("security", 0.5)}`,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id="decision-heading"
          className="text-[11px] font-bold uppercase tracking-[0.2em]"
          style={{ color: accentInk("security") }}
        >
          What the copilot prepared
        </h3>
        {/*
          The evidence state, always visible and never numeric. A percentage
          here would be a measurement nobody performed.
        */}
        <span
          className="rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
          style={{ borderColor: accentColor(meta.accent, 0.5), color: accentInk(meta.accent) }}
        >
          {meta.label}
        </span>
      </div>

      <div className="mt-5 space-y-5">
        <Row title="Situation">{decision.situation}</Row>

        {/*
          One voice per fact. The evidence rows below carry the same claims
          with their source and payload attached, so printing the observations
          list above them read every sentence twice. The bullets survive only
          for runs with no openable evidence — the unreadable case — where they
          are all there is.
        */}
        {evidence.length === 0 && decision.observations.length > 0 && (
          <Row title="What the evidence establishes">
            <ul className="list-none space-y-1">
              {decision.observations.map((o) => (
                <li key={o} className="flex gap-2">
                  <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: accentInk("internet") }} />
                  <span className="min-w-0">{o}</span>
                </li>
              ))}
            </ul>
          </Row>
        )}

        {evidence.length > 0 && (
          <Row title="Evidence considered — each item opens to its returned data">
            <ul className="list-none space-y-1.5">
              {evidence.map((item) => (
                <EvidenceRow key={`${item.source}-${item.claim}`} item={item} />
              ))}
            </ul>
          </Row>
        )}

        {/*
          The recommendation gets the loudest type on the card — or an explicit
          "none", styled identically, because "no action is the right action"
          is a conclusion, not an absence of one.
        */}
        <Row title="Recommended next action" tone="security">
          {decision.recommendation ? (
            <p className="text-base font-semibold leading-snug text-white">{decision.recommendation}</p>
          ) : (
            <p className="text-base font-semibold leading-snug text-white/75">
              None. {decision.authorityBoundary.split(".")[0]}.
            </p>
          )}
        </Row>

        {decision.why && <Row title="Why this is the safest available move">{decision.why}</Row>}

        {decision.businessConsequence && (
          <Row title="What this changes for the operation">{decision.businessConsequence}</Row>
        )}

        {decision.refusedInBusinessTerms && (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: accentColor("security", 0.45), background: accentColor("security", 0.08) }}
          >
            <h4 className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: accentInk("security") }}>
              What the copilot deliberately did not do
            </h4>
            <p className="mt-1.5 text-sm leading-relaxed text-white/90">{decision.refusedInBusinessTerms}</p>
          </div>
        )}

        <Row title="Authority boundary">{decision.authorityBoundary}</Row>

        {executor && (
          <Row title="Authorized executor">
            <span className="font-semibold text-white">{executor}</span>
          </Row>
        )}
      </div>
    </motion.section>
  );
}
