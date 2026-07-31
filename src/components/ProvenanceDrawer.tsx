"use client";

import { useCallback, useEffect, useState } from "react";
import { Drawer } from "vaul";
import { StateBadge } from "@/components/StateBadge";

/**
 * The provenance drawer — tap a field, see its life.
 *
 * Every version the field ever held, oldest first: which channel said it, how
 * it was verified, both clocks, and — for the canonical pick — the named human
 * and their written reason. This is the product thesis at the smallest
 * possible grain: one field, fully accountable.
 *
 * It also used to be the worst place in the app to fail. The read had no status
 * check and no catch, so a 500 landed in the same branch as a genuinely empty
 * history and the drawer said "No history for this field yet — run the demo
 * first": an instruction that would not have helped, given to someone whose
 * database had just stopped answering, by the component whose entire job is
 * proving where a value came from. Failed and empty are now different states,
 * and the failed one offers the read again instead of advice.
 */

interface Version {
  value: unknown;
  channel: string;
  verification: string;
  confidence: string;
  is_canonical: boolean;
  selected_by: string | null;
  selection_reason: string | null;
  valid_at: string | null;
  recorded_at: string;
}

export function ProvenanceDrawer({
  field,
  onClose,
}: {
  field: string | null;
  onClose: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const load = useCallback((f: string) => {
    setLoading(true);
    setReadError(null);
    fetch(`/api/v1/provenance?field=${encodeURIComponent(f)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => setVersions(d.versions ?? []))
      .catch((e) => {
        // Clear the list too: a stale history under a failure notice reads as
        // "here is the record, and also something went wrong", which invites
        // exactly the wrong conclusion about what is on screen.
        setVersions([]);
        setReadError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!field) return;
    load(field);
  }, [field, load]);

  return (
    <Drawer.Root open={field !== null} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.6)" }} />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl border-t outline-none"
          style={{ background: "var(--color-ground-1)", borderColor: "var(--color-ground-3)" }}
        >
          <div className="mx-auto max-w-2xl overflow-y-auto p-6" style={{ maxHeight: "80vh" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--color-ground-3)" }} aria-hidden />
            <Drawer.Title className="font-mono text-sm font-semibold" style={{ color: "var(--color-text-hi)" }}>
              {field}
            </Drawer.Title>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>
              Every value this field ever held. Nothing is deleted; the canonical pick is
              a choice on top of history, not a replacement of it.
            </p>

            {loading && <p className="mt-6 text-sm" style={{ color: "var(--color-text-lo)" }}>loading…</p>}

            <ol className="mt-5 space-y-3">
              {versions.map((v, i) => (
                <li
                  key={i}
                  className="rounded-xl border p-4"
                  style={{
                    borderColor: v.is_canonical ? "var(--color-state-verified)" : "var(--color-ground-3)",
                    background: v.is_canonical
                      ? "color-mix(in oklab, var(--color-state-verified) 8%, transparent)"
                      : "var(--color-ground-0)",
                  }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-base font-semibold" style={{ color: "var(--color-text-hi)" }}>
                      {typeof v.value === "string" ? v.value.replace(/^"|"$/g, "") : JSON.stringify(v.value)}
                    </span>
                    {v.is_canonical && <StateBadge state="verified" />}
                  </div>
                  <div className="mt-2 grid gap-1 text-xs" style={{ color: "var(--color-text-mid)" }}>
                    <span>via <b>{v.channel}</b> · verification <b>{v.verification}</b> · confidence {Number(v.confidence).toFixed(2)}</span>
                    <span style={{ color: "var(--color-text-lo)" }}>
                      recorded {new Date(v.recorded_at).toLocaleString()}
                      {v.valid_at && ` · valid from ${new Date(v.valid_at).toLocaleDateString()}`}
                    </span>
                    {v.selected_by && (
                      <span className="mt-1 rounded-lg border p-2" style={{ borderColor: "var(--color-ground-3)" }}>
                        chosen by <b>{v.selected_by}</b>
                        {v.selection_reason && <> — &ldquo;{v.selection_reason}&rdquo;</>}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {!loading && readError && (
              <div
                className="mt-6 rounded-xl border p-4"
                style={{
                  borderColor: "var(--color-state-failed)",
                  background: "rgba(229,72,77,0.06)",
                }}
              >
                <p className="text-sm font-semibold" style={{ color: "var(--color-state-failed)" }}>
                  This field&rsquo;s history could not be read.
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-lo)" }}>
                  {readError} — the versions still exist; this drawer just cannot see them, so it
                  shows nothing rather than an empty history.
                </p>
                <button
                  onClick={() => field && load(field)}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase tracking-wide"
                  style={{ borderColor: "rgba(255,255,255,0.3)", color: "var(--color-text-mid)" }}
                >
                  Read it again
                </button>
              </div>
            )}

            {!loading && !readError && versions.length === 0 && (
              <p className="mt-6 text-sm" style={{ color: "var(--color-text-lo)" }}>
                No history for this field yet — run the demo first.
              </p>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
