"use client";

import { accentColor, accentInk, type Accent } from "@/lib/accents";

/**
 * The case, always in view.
 *
 * Every panel below reasons about one move, so the move's vitals stay pinned
 * where the eye returns between sections. Each cell renders only when the
 * backend supplied the value — a ribbon that printed "Maya Patel" while a
 * different case was selected would be the page contradicting its own data, so
 * nothing here is hardcoded, including the customer's name.
 */

export interface CaseFacts {
  reference: string;
  /** From the record's own fields; null when the case has no name yet. */
  customer: string | null;
  moveDate: string | null;
  openConflicts: number;
  /**
   * Null until an investigation has read the case.
   *
   * The first version of this ribbon printed "Services 0 · no unknowns" before
   * any run existed, because the pre-run derivation had no view to count from
   * and zero is what counting nothing returns. On a case that actually held an
   * unknown provider outcome, that is a false reassurance delivered in the
   * page's most trusted position — the exact sentence this system exists to
   * refuse. Null renders as "not yet read", which is the true state.
   */
  services: number | null;
  unknownOutcomes: number | null;
  /** The actor who made canonical selections, when any field records one. */
  canonicalBy: string | null;
  /** One line naming what this case is waiting on. */
  objective: string;
}

export function CaseRibbon({ facts }: { facts: CaseFacts }) {
  const attention = facts.openConflicts > 0 || (facts.unknownOutcomes ?? 0) > 0;

  const cells: Array<{ label: string; value: string; accent?: Accent } | null> = [
    facts.customer ? { label: "Customer", value: facts.customer } : null,
    facts.moveDate ? { label: "Move date", value: facts.moveDate } : null,
    {
      label: "Open conflicts",
      value: String(facts.openConflicts),
      accent: facts.openConflicts > 0 ? "conflict" : undefined,
    },
    {
      label: "Services",
      value: facts.services === null ? "not yet read" : String(facts.services),
    },
    {
      label: "Provider outcome",
      value:
        facts.unknownOutcomes === null
          ? "not yet read"
          : facts.unknownOutcomes > 0
            ? `${facts.unknownOutcomes} unknown`
            : "no unknowns",
      accent: (facts.unknownOutcomes ?? 0) > 0 ? "unknown" : undefined,
    },
    facts.canonicalBy ? { label: "Canonical selections by", value: facts.canonicalBy } : null,
  ];

  return (
    <section
      aria-label={`Selected case ${facts.reference}`}
      className="min-w-0 rounded-2xl border p-4"
      style={{
        borderColor: accentColor(attention ? "conflict" : "verified", 0.35),
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-sm font-bold text-white">{facts.reference}</span>
        <span className="text-[11px] font-semibold" style={{ color: accentInk(attention ? "conflict" : "verified") }}>
          {facts.objective}
        </span>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {cells.filter(Boolean).map((cell) => (
          <div key={cell!.label} className="min-w-0">
            <dt className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--color-text-lo)" }}>
              {cell!.label}
            </dt>
            <dd
              className="mt-0.5 text-[13px] font-semibold"
              style={{ color: cell!.accent ? accentInk(cell!.accent) : "rgba(255,255,255,0.88)" }}
            >
              {cell!.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
