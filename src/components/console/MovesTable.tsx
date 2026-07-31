"use client";

import Link from "next/link";

import { StateBadge, type State } from "@/components/StateBadge";
import { asRoute } from "@/lib/routes";

/**
 * Every move in the tenant, read from the database.
 *
 * This replaced a hardcoded array of five invented customers — Sarah Johnson in
 * San Francisco, Michael Chen in Austin — with names and cities and service
 * lists that existed nowhere but that file. On a console whose entire argument
 * is that every value can be traced to a source, an invented cohort is not a
 * placeholder, it is the thing the product exists to prevent, printed on the
 * product's own front page.
 *
 * So the list is `GET /api/v1/moves` and nothing else. Empty is a legitimate
 * state and is shown as one: a tenant with no moves gets an invitation to send
 * a referral, not five imaginary ones.
 */

export interface MoveRow {
  id: string;
  reference: string;
  state: string;
  version: number;
  openConflicts: number;
  sources: number;
  createdAt: string;
}

/**
 * Move state to the constellation's visual vocabulary.
 *
 * `conflict_pending` is amber rather than red, per the design system: a
 * disagreement between two sources needs a person, and calling it a failure
 * would be both wrong and the reason nobody looks at the queue.
 */
function toneFor(state: string): State {
  if (state === "canonical") return "verified";
  if (state === "conflict_pending") return "conflict";
  if (state === "superseded") return "pending";
  return "transit";
}

export function MovesTable({
  moves,
  query,
  loading,
  selectedId,
  onSelect,
}: {
  moves: MoveRow[];
  query: string;
  loading: boolean;
  selectedId?: string | null;
  onSelect?: (m: MoveRow) => void;
}) {
  /*
    Filtered here rather than server-side. The tenant holds tens of moves, not
    millions, and a round trip per keystroke would make the box feel slower than
    the list is long. At a size where that stops being true this becomes a query
    parameter, and the shape of this component does not change.
  */
  const q = query.trim().toLowerCase();
  const shown = q
    ? moves.filter(
        (m) =>
          m.reference.toLowerCase().includes(q) ||
          m.state.toLowerCase().includes(q) ||
          m.id.toLowerCase().startsWith(q),
      )
    : moves;

  if (loading && !moves.length) {
    return <Empty>Reading the tenant…</Empty>;
  }

  if (!moves.length) {
    return (
      <Empty>
        No moves yet. Send a referral from the intake panel and this fills with real rows.
      </Empty>
    );
  }

  if (!shown.length) {
    return <Empty>Nothing matches “{query}”.</Empty>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--color-text-lo)" }}>
            {onSelect && <th className="pb-2 pr-3 font-bold sr-only">Selected</th>}
            <th className="pb-2 pr-3 font-bold">Reference</th>
            <th className="pb-2 pr-3 font-bold">State</th>
            <th className="pb-2 pr-3 text-right font-bold">Sources</th>
            <th className="pb-2 pr-3 text-right font-bold">Conflicts</th>
            <th className="pb-2 text-right font-bold">Ver.</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((m) => (
            <tr
              key={m.id}
              className="border-t transition-colors hover:bg-white/[0.03]"
              style={{
                borderColor: "var(--color-ground-3)",
                background:
                  selectedId === m.id
                    ? "color-mix(in oklab, var(--color-state-verified) 10%, transparent)"
                    : undefined,
              }}
            >
              {/*
                A radio rather than a whole-row click. The reference is already a
                link to the move's own page, and a row that both navigates and
                selects depending on where you land in it is a row that will do
                the wrong one.
              */}
              {onSelect && (
                <td className="pr-3">
                  {/*
                    The label carries the touch target, not the radio.

                    A 13px control is the right visual size and the wrong hit
                    area — the pointer target was a third of the 44px minimum on
                    a phone. Growing the input would produce an oversized radio;
                    wrapping it gives the full row height to the thumb and
                    leaves the control looking like a radio.
                  */}
                  <label className="flex min-h-11 cursor-pointer items-center pr-2">
                    <input
                      type="radio"
                      name="selected-move"
                      checked={selectedId === m.id}
                      onChange={() => onSelect(m)}
                      aria-label={`Drive fulfillment for ${m.reference}`}
                    />
                  </label>
                </td>
              )}
              <td className="py-2.5 pr-3">
                <Link href={asRoute(`/moves/${m.id}`)} className="font-mono text-xs hover:underline">
                  {m.reference}
                </Link>
                <div className="text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                  {new Date(m.createdAt).toLocaleString()}
                </div>
              </td>
              <td className="py-2.5 pr-3">
                <StateBadge state={toneFor(m.state)} subtle />
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums">{m.sources}</td>
              <td className="py-2.5 pr-3 text-right tabular-nums">
                {m.openConflicts > 0 ? (
                  <span style={{ color: "var(--color-state-conflict)" }}>{m.openConflicts}</span>
                ) : (
                  <span style={{ color: "var(--color-text-lo)" }}>0</span>
                )}
              </td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: "var(--color-text-lo)" }}>
                v{m.version}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-8 text-center text-xs" style={{ color: "var(--color-text-lo)" }}>
      {children}
    </p>
  );
}
