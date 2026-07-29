"use client";

import { accentColor, accentInk, type Accent } from "@/lib/accents";

/**
 * One canonical fact, three renderings of it.
 *
 * Switching between audiences shows each in turn and asks the reader to hold
 * the previous one in their head. That is the part most people do not do, and
 * without it the page's claim stays abstract: three panels that look different
 * prove nothing about whether they describe the same thing.
 *
 * Side by side, the claim becomes checkable. `Move date August 16` is one fact.
 * The operator sees it with the history that produced it, Maya sees the date,
 * the partner sees it because their referral relates to it. Nobody is looking
 * at a different date.
 *
 * ## Read from the payloads, never written here
 *
 * Every cell below is pulled out of the three responses the page already holds.
 * A hardcoded comparison would agree with the projections by coincidence and go
 * on agreeing after one of them changed — which is exactly the failure this
 * page exists to argue against, committed by the page's own summary of itself.
 */

type Payload = Record<string, unknown> | null | undefined;

const TONE: Record<"concierge" | "customer" | "partner", Accent> = {
  concierge: "verified",
  customer: "solar",
  partner: "internet",
};

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Pull `move.date` out of whichever shape this audience received it in. */
function moveDateFor(audience: "concierge" | "customer" | "partner", p: Payload): string | null {
  if (!p || p.exists !== true) return null;

  if (audience === "concierge") {
    const verified = (p.verified ?? []) as Array<{ field: string; value: unknown }>;
    return str(verified.find((v) => v.field === "move.date")?.value);
  }
  if (audience === "customer") {
    const details = (p.details ?? []) as Array<{ label: string; value: unknown }>;
    return str(details.find((d) => d.label === "Move date")?.value);
  }
  return str(p.moveDate);
}

/** Who chose the surviving value. Concierge only, by construction. */
function decidedBy(p: Payload): string | null {
  if (!p || p.exists !== true) return null;
  const verified = (p.verified ?? []) as Array<{ field: string; by?: string | null }>;
  return str(verified.find((v) => v.field === "move.date")?.by ?? null);
}

/** How the electricity submission reads to each audience. */
function electricFor(audience: "concierge" | "customer" | "partner", p: Payload): string | null {
  if (!p || p.exists !== true) return null;

  if (audience === "concierge") {
    const rows = (p.services ?? []) as Array<{
      service_type: string;
      submission_state: string | null;
      provider_order_id: string | null;
    }>;
    const e = rows.find((r) => r.service_type === "electric");
    if (!e) return null;
    return e.provider_order_id ? `${e.provider_order_id} · ${e.submission_state}` : (e.submission_state ?? null);
  }
  if (audience === "customer") {
    const rows = (p.services ?? []) as Array<{ service: string; status: string }>;
    return rows.find((r) => r.service === "electric")?.status ?? null;
  }
  const progress = p.progress as { servicesScheduled?: number; servicesRequested?: number } | undefined;
  if (!progress) return null;
  return `${progress.servicesScheduled ?? 0} of ${progress.servicesRequested ?? 0} scheduled`;
}

interface Row {
  fact: string;
  note: string;
  cells: Array<{ audience: "concierge" | "customer" | "partner"; value: string | null; caption?: string | null }>;
}

export function CompareViews({
  all,
}: {
  all: Record<"concierge" | "customer" | "partner", Record<string, unknown>> | null;
}) {
  const ready = all?.concierge?.exists === true;
  if (!ready) return null;

  const rows: Row[] = [
    {
      fact: "Move date",
      note: "One value, chosen once. Three ways of being told it.",
      cells: [
        { audience: "concierge", value: moveDateFor("concierge", all.concierge), caption: decidedBy(all.concierge) },
        { audience: "customer", value: moveDateFor("customer", all.customer), caption: "confirmed" },
        { audience: "partner", value: moveDateFor("partner", all.partner), caption: "where the referral relates" },
      ],
    },
    {
      fact: "Electricity",
      note: "The same submission, after a lost reply and a reconciliation.",
      cells: [
        { audience: "concierge", value: electricFor("concierge", all.concierge), caption: "recovered order" },
        { audience: "customer", value: electricFor("customer", all.customer), caption: "plain language" },
        { audience: "partner", value: electricFor("partner", all.partner), caption: "coarse progress" },
      ],
    },
  ];

  return (
    <section className="mx-auto max-w-[1400px] px-5 pb-16 sm:px-8" aria-label="Compare the views">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">Compare the views</p>
      <h3 className="mt-3 max-w-3xl text-[clamp(20px,2.6vw,32px)] font-semibold leading-[1.12] tracking-tight text-white">
        The same fact, told three ways. Never three different facts.
      </h3>

      <div className="mt-6 space-y-4">
        {rows.map((row) => (
          <div
            key={row.fact}
            className="min-w-0 rounded-2xl border p-5 sm:p-6"
            style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-sm font-bold text-white/90">{row.fact}</span>
              <span className="text-xs text-white/45">{row.note}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {row.cells.map((cell) => (
                <div
                  key={cell.audience}
                  className="min-w-0 rounded-xl border p-4"
                  style={{
                    borderColor: accentColor(TONE[cell.audience], 0.32),
                    background: accentColor(TONE[cell.audience], 0.05),
                  }}
                >
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: accentInk(TONE[cell.audience]) }}
                  >
                    {cell.audience}
                  </p>
                  {/*
                    A dash where the audience received nothing. Not an empty
                    cell, and not a borrowed value from the column beside it —
                    the absence is the finding.
                  */}
                  <p className="mt-1.5 break-words font-mono text-sm text-white/85">{cell.value ?? "—"}</p>
                  {cell.caption && (
                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/35">{cell.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
