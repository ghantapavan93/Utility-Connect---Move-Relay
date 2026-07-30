"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { IntakeComposer } from "@/components/console/IntakeComposer";
import { MovesTable, type MoveRow as TableRow } from "@/components/console/MovesTable";
import { WorkflowRunner } from "@/components/console/WorkflowRunner";
import { ControlRoomHero } from "@/components/control-room/ControlRoomHero";
import { DecisionLanes } from "@/components/control-room/DecisionLanes";
import { BatchOperation } from "@/components/control-room/BatchOperation";
import { DomainMap, type DomainMapData } from "@/components/control-room/DomainMap";
import { MergeApproval } from "@/components/control-room/MergeApproval";
import {
  headlineFor,
  lanesFor,
  metricsFor,
  shiftBriefFor,
  type BatchResult,
  type LoadState,
  type MoveRow,
  type ServiceRow,
  type Stats,
} from "@/lib/control-room";
import { accentColor, type Accent } from "@/lib/accents";
import { auditLabel, type AuditEntry } from "@/lib/agent/narrative";
import { AuditTimeline } from "@/components/agent/CaseDepth";

/**
 * The move operations control room.
 *
 * This was an operator console in the developer sense: intake controls at the
 * top, a metric strip, and a 3D graph whose five node states were hardcoded
 * literals. Everything on it worked and almost none of it answered the question
 * an operator actually arrives with — not "how many moves exist" but "what is
 * waiting for me, and why can the system not finish it".
 *
 * It now opens with a headline derived from returned rows, three decision lanes
 * separating what automation settled from what a named human must settle, and a
 * domain map drawn from the selected move's own projection rather than from an
 * array in this file.
 *
 * ## One read, one truth
 *
 * Every panel is fed from a single `refresh`. The panels are not independent —
 * a batch landing changes the move list, the counts, the lanes and the map
 * together — and refreshing them separately produced a console that briefly
 * disagreed with itself about how many moves existed.
 *
 * ## What it will not do
 *
 * There is no reset control. `demo.reset()` deletes the whole `uc-demo`
 * organisation, and this page shares that tenant with `/demo` and with every
 * other reviewer, so a public reset would let one visitor destroy another's
 * shift mid-run. The gap is real, and it is stated on the page.
 */

const ACTOR = "user:concierge-7";

interface ConciergeProjection {
  exists?: boolean;
  verified?: Array<{ field: string; source: string; by: string | null }>;
  unconfirmed?: Array<{ field: string; source: string }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [moves, setMoves] = useState<MoveRow[]>([]);
  /*
    Null = the read failed or has not run; [] = read fine, genuinely empty.
    Collapsing the two was how a thrown fetch became "Provider outcome
    unknown: 0" on the hero and three calm lanes underneath it.
  */
  const [services, setServices] = useState<ServiceRow[] | null>([]);
  /*
    The selected move's own history. The lanes summarise ("1 blind retry
    refused"); this is the openable material behind the summary, read from the
    same record endpoint the workspace uses. Null carries the same meaning as
    everywhere else on this page: not read is not the same fact as empty.
  */
  const [auditTrail, setAuditTrail] = useState<AuditEntry[] | null>(null);
  const [projection, setProjection] = useState<ConciergeProjection | null>(null);
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [load, setLoad] = useState<LoadState>("loading");
  const [selected, setSelected] = useState<MoveRow | null>(null);
  const [query, setQuery] = useState("");
  const [shiftNote, setShiftNote] = useState<string | null>(null);

  const lanesRef = useRef<HTMLDivElement>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const mergeRef = useRef<HTMLDivElement>(null);

  /**
   * Re-read everything the console shows.
   *
   * A failed request sets `failed` rather than leaving the previous state in
   * place. A console that still looks calm after the tenant became unreachable
   * is the most misleading thing this page could do, and it is exactly what a
   * `catch` that only logs produces.
   */
  const refresh = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([fetch("/api/v1/stats"), fetch("/api/v1/moves")]);
      if (!sRes.ok || !mRes.ok) {
        setLoad("failed");
        return;
      }
      const s = await sRes.json();
      const m = await mRes.json();

      const rows: MoveRow[] = m.moves ?? [];
      setStats(s.stats);
      setMoves(rows);
      setSelected((prev) => (prev && rows.some((r) => r.id === prev.id) ? prev : (rows[0] ?? null)));
      setLoad(s.hasData && rows.length > 0 ? "ready" : "empty");
    } catch {
      setLoad("failed");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * The selected move's operations and its concierge projection.
   *
   * The projection is what feeds the map: it already carries the real channel
   * names, the operator who committed each canonical value, and the provider
   * state — all behind the same authorization gate as every other read.
   * Assembling the graph from anything else would mean inventing it twice.
   */
  useEffect(() => {
    if (!selected) {
      setServices([]);
      setProjection(null);
      setAuditTrail(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [f, v, rec] = await Promise.all([
          fetch(`/api/v1/moves/${selected.id}/fulfillment`, { headers: { "X-Actor": ACTOR } }),
          fetch(`/api/v1/moves/${selected.id}/views`, { headers: { "x-actor": ACTOR } }),
          fetch(`/api/v1/moves/${selected.id}`, { headers: { "x-actor": ACTOR } }),
        ]);
        if (cancelled) return;

        if (f.ok) {
          const j = await f.json();
          setServices(
            (j.services ?? []).map(
              (r: { id: string; serviceType: string; submissionState: string | null; providerOrderId: string | null }) => ({
                id: r.id,
                serviceType: r.serviceType,
                state: r.submissionState,
                providerOrderId: r.providerOrderId,
              }),
            ),
          );
        } else {
          // A non-ok read is an unread list, not an empty one.
          setServices(null);
        }
        setProjection(v.ok ? ((await v.json()) as ConciergeProjection) : null);

        if (rec.ok) {
          const record = (await rec.json()) as {
            audit?: Array<{ eventType: string; actor: string; occurredAt: string }>;
          };
          setAuditTrail(
            (record.audit ?? []).map((a) => ({
              label: auditLabel(a.eventType),
              event: a.eventType,
              actor: a.actor,
              at: a.occurredAt ?? null,
            })),
          );
        } else {
          setAuditTrail(null);
        }
      } catch {
        if (!cancelled) {
          setServices(null);
          setProjection(null);
          setAuditTrail(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const headline = useMemo(
    () => headlineFor({ load, stats, moves, batch, services }),
    [load, stats, moves, batch, services],
  );
  const lanes = useMemo(
    () => lanesFor({ load, stats, moves, batch, services, selected }),
    [load, stats, moves, batch, services, selected],
  );
  const metrics = useMemo(() => metricsFor(stats, moves, services), [stats, moves, services]);
  const brief = useMemo(
    () => shiftBriefFor({ load, stats, moves, batch, services }),
    [load, stats, moves, batch, services],
  );

  /** The map, assembled from the projection rather than from a literal. */
  const mapData: DomainMapData = useMemo(() => {
    const fields = [...(projection?.verified ?? []), ...(projection?.unconfirmed ?? [])];
    const names = [...new Set(fields.map((f) => f.source))];
    const canonicalSources = new Set((projection?.verified ?? []).map((f) => f.source));

    return {
      reference: selected?.reference ?? null,
      channels: names.map((name) => ({
        name,
        committed: canonicalSources.has(name),
        contested: (selected?.openConflicts ?? 0) > 0 && !canonicalSources.has(name),
      })),
      operator: (projection?.verified ?? []).map((f) => f.by).find((b): b is string => !!b) ?? null,
      operations: (services ?? []).map((s) => ({
        serviceType: s.serviceType,
        state: s.state,
        orderId: s.providerOrderId ?? null,
      })),
      contestedFields: selected?.openConflicts ?? 0,
    };
  }, [projection, services, selected]);

  /**
   * The guided shift.
   *
   * Deliberately small: it points the reviewer at the batch and lets the real
   * operation carry the narrative. Orchestrating the full seventeen-step
   * sequence from here would need to reset the shared `uc-demo` tenant first,
   * and that reset is not safe to expose while two reviewers share it — so the
   * shift starts where the backend can genuinely take it.
   */
  const runShift = useCallback(() => {
    setShiftNote("Processing the synthetic partner batch. Watch the lanes, the metrics and the map change together.");
    batchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const onBatchLanded = useCallback(
    (result: BatchResult) => {
      setBatch(result);
      void refresh();
      setShiftNote(
        `${result.rows.accepted} accepted, ${result.rows.quarantined} held for review. Every panel below now reads from that same result.`,
      );
    },
    [refresh],
  );

  /**
   * Lane actions go to the control that performs them.
   *
   * `resolve-conflict` is the one item on this page that names a decision only
   * a person may take, and until the merge control existed its button led back
   * to the lane it came from — an authority notice pointing at nothing.
   */
  const onLaneAction = useCallback((id: string) => {
    const target =
      id === "review-quarantine" ? batchRef.current : id === "resolve-conflict" ? mergeRef.current : lanesRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="flex min-h-dvh">
      <AppSidebar />

      <div className="min-w-0 flex-1 overflow-x-hidden">
        <div
          className="sticky top-0 z-40 flex flex-wrap items-center gap-2 border-b px-4 py-2 sm:px-6"
          style={{
            borderColor: "var(--color-ground-3)",
            background: "color-mix(in oklab, var(--color-ground-0) 82%, transparent)",
            backdropFilter: "blur(12px)",
          }}
        >
          <label
            className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3"
            style={{ borderColor: "var(--color-ground-3)" }}
          >
            <span aria-hidden style={{ color: "var(--color-text-lo)" }}>⌕</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by reference, state, or id…"
              aria-label="Filter moves"
              className="min-h-11 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[color:var(--color-text-lo)]"
            />
          </label>
          <button
            onClick={() => void refresh()}
            className="inline-flex min-h-11 shrink-0 items-center rounded-lg border px-3 text-sm font-semibold"
            style={{ borderColor: "var(--color-ground-3)" }}
          >
            Refresh
          </button>
        </div>

        <main className="min-w-0 px-4 py-6 sm:px-6">
          <ControlRoomHero
            headline={headline}
            metrics={metrics}
            brief={brief}
            load={load}
            onStartShift={runShift}
            shiftRunning={false}
          />

          {shiftNote && (
            <p
              aria-live="polite"
              className="mt-4 rounded-xl border px-4 py-2.5 text-xs"
              style={{ borderColor: accentColor("internet", 0.35), color: "var(--color-text-mid)" }}
            >
              {shiftNote}
            </p>
          )}

          <div ref={lanesRef} className="mt-8 min-w-0">
            <DecisionLanes items={lanes} load={load} onAction={onLaneAction} />
          </div>

          <div ref={batchRef} className="mt-8 min-w-0">
            <BatchOperation actor={ACTOR} onLanded={onBatchLanded} />
          </div>

          {/* ---------------- the map, from the selected move's projection ---------------- */}
          <section aria-labelledby="map-heading" className="mt-8 min-w-0">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="map-heading"
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--color-text-lo)" }}
              >
                Handoff map
              </h2>
              <span className="font-mono text-[10px]" style={{ color: "var(--color-text-lo)" }}>
                {selected
                  ? `${mapData.channels.length} channels · ${mapData.operations.length} provider operations`
                  : "no move selected"}
              </span>
            </div>

            {/*
              Drawn wide, listed narrow. The map is the one element that cannot
              usefully shrink: a 900-unit viewBox in a 280px column renders its
              labels at four physical pixels, so a phone gets the same domain
              path as an ordered list instead of an unreadable picture.
            */}
            <div
              className="mt-3 hidden min-w-0 rounded-2xl border p-4 lg:block"
              style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
            >
              <div className="h-[300px] min-w-0">
                <DomainMap data={mapData} />

                {/* ── The history behind the counts ── */}
                <section aria-labelledby="dash-history" className="mt-6 min-w-0">
                  <h3
                    id="dash-history"
                    className="text-[11px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: "var(--color-text-lo)" }}
                  >
                    What already happened on {selected?.reference ?? "this move"}
                  </h3>
                  <div className="mt-3 max-w-2xl">
                    {auditTrail === null ? (
                      <p className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                        {selected
                          ? "The move's history could not be read — the counts above stand alone until it can."
                          : "Select a move to read its history."}
                      </p>
                    ) : auditTrail.length === 0 ? (
                      <p className="text-[11px]" style={{ color: "var(--color-text-lo)" }}>
                        No events recorded yet.
                      </p>
                    ) : (
                      <AuditTimeline trail={auditTrail} />
                    )}
                  </div>
                </section>
              </div>
            </div>

            <ol className="mt-3 space-y-2 lg:hidden">
              {mapData.channels.map((c) => (
                <PathStep key={c.name} label={c.name} kind="intake channel" tone={c.committed ? "verified" : "internet"} />
              ))}
              <PathStep
                label={mapData.reference ?? "no move selected"}
                kind="canonical move record"
                tone={mapData.contestedFields > 0 ? "conflict" : "verified"}
              />
              {mapData.operator && <PathStep label={mapData.operator} kind="decided by" tone="security" />}
              {mapData.operations.map((o) => (
                <PathStep
                  key={o.serviceType}
                  label={`${o.serviceType}${o.orderId ? ` · ${o.orderId}` : ""}`}
                  kind={o.state ?? "not submitted"}
                  tone={o.state === "unknown" ? "conflict" : o.state === "reconciled" ? "recovered" : "verified"}
                />
              ))}
            </ol>
          </section>

          {/* ---------------- queue and fulfilment ---------------- */}
          <div className="mt-8 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <section
              aria-labelledby="queue-heading"
              className="min-w-0 rounded-2xl border p-4 sm:p-5"
              style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
            >
              <h2
                id="queue-heading"
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--color-text-lo)" }}
              >
                Move queue
              </h2>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>
                Selecting a move re-reads its projection, so the map, the metrics and fulfilment all follow it.
              </p>
              <div className="mt-3 min-w-0">
                <MovesTable
                  moves={moves as unknown as TableRow[]}
                  query={query}
                  loading={load === "loading"}
                  selectedId={selected?.id ?? null}
                  onSelect={(row) => setSelected(row as unknown as MoveRow)}
                />
              </div>
            </section>

            <div className="min-w-0 space-y-4">
              {(selected?.openConflicts ?? 0) > 0 && (
                <div ref={mergeRef}>
                  <MergeApproval
                    moveId={selected?.id ?? null}
                    actor={ACTOR}
                    onCommitted={() => void refresh()}
                  />
                </div>
              )}
              <WorkflowRunner
                moveId={selected?.id ?? null}
                reference={selected?.reference ?? null}
                onChanged={() => void refresh()}
              />
            </div>
          </div>

          <div className="mt-8 min-w-0">
            <IntakeComposer onLanded={() => void refresh()} />
          </div>

          {/*
            The gap, stated on the page rather than only in a commit message.
            Every other surface in this project labels what it is; a console
            quietly sharing a tenant would be the one place that did not.
          */}
          <p className="mt-8 max-w-3xl text-[11px] leading-relaxed" style={{ color: "var(--color-text-lo)" }}>
            This console writes to one shared synthetic tenant. Two reviewers working at the same time will see each
            other&rsquo;s rows, and there is no reset control here because resetting deletes that tenant for everyone.
            Per-session isolation is not built.
          </p>
        </main>
      </div>
    </div>
  );
}

/** One step of the domain path, for screens too narrow to draw the map. */
function PathStep({ label, kind, tone }: { label: string; kind: string; tone: Accent }) {
  return (
    <li
      className="flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5"
      style={{ borderColor: accentColor(tone, 0.35) }}
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: accentColor(tone, 1) }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-xs text-white/85">{label}</span>
        <span className="block text-[10px] uppercase tracking-[0.14em]" style={{ color: "var(--color-text-lo)" }}>
          {kind}
        </span>
      </span>
    </li>
  );
}
