"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * The Engineering View — "Reveal System".
 *
 * One toggle turns the demo from a polished flow into an inspectable system:
 * the raw payloads as stored, every provenance row, the idempotency and
 * fulfilment state, AI runs with their metrics, workflow histories, queue
 * depths, and the audit trail. All of it is fetched live from the same
 * database the demo just wrote — the reviewer sees rows, not summaries.
 */

type Tab = "raw" | "provenance" | "fulfilment" | "ai" | "workflows" | "audit";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "raw", label: "Raw payloads" },
  { key: "provenance", label: "Provenance" },
  { key: "fulfilment", label: "Fulfilment" },
  { key: "ai", label: "AI runs" },
  { key: "workflows", label: "Workflows" },
  { key: "audit", label: "Audit" },
];

export function EngineeringPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("raw");
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const reveal = useCallback(async () => {
    if (!open) {
      setLoading(true);
      const res = await fetch("/api/v1/engineering");
      setData(await res.json());
      setLoading(false);
    }
    setOpen((o) => !o);
  }, [open]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/engineering");
    setData(await res.json());
    setLoading(false);
  }, []);

  return (
    <div className="rounded-2xl border" style={{ borderColor: "var(--color-state-locked)", background: "var(--color-ground-1)" }}>
      <button
        onClick={reveal}
        className="flex w-full items-center justify-between px-5 py-3.5 text-sm font-semibold"
        style={{ color: "var(--color-state-locked)" }}
      >
        <span>⚿ {open ? "Hide" : "Reveal"} system — the rows behind the demo</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t px-5 py-4" style={{ borderColor: "var(--color-ground-3)" }}>
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition-colors"
                    style={{
                      borderColor: tab === t.key ? "var(--color-state-locked)" : "var(--color-ground-3)",
                      color: tab === t.key ? "var(--color-state-locked)" : "var(--color-text-mid)",
                      background: tab === t.key ? "color-mix(in oklab, var(--color-state-locked) 12%, transparent)" : "transparent",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
                <button onClick={refresh} className="ml-auto text-xs font-semibold" style={{ color: "var(--color-text-lo)" }}>
                  {loading ? "loading…" : "↻ refresh"}
                </button>
              </div>

              {data && (
                <>
                  <div className="mb-3 flex gap-4 text-xs" style={{ color: "var(--color-text-lo)" }}>
                    <span>outbox backlog: <b style={{ color: "var(--color-text-mid)" }}>{String((data.queues as Record<string, number>)?.outboxBacklog ?? 0)}</b></span>
                    <span>quarantine: <b style={{ color: "var(--color-text-mid)" }}>{String((data.queues as Record<string, number>)?.quarantineBacklog ?? 0)}</b></span>
                  </div>
                  <pre className="max-h-96 overflow-auto rounded-lg p-3 font-mono text-[11px] leading-relaxed" style={{ background: "var(--color-ground-0)", color: "var(--color-text-mid)" }}>
                    {JSON.stringify(pick(data, tab), null, 2)}
                  </pre>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function pick(data: Record<string, unknown>, tab: Tab): unknown {
  switch (tab) {
    case "raw": return data.rawSubmissions;
    case "provenance": return data.fieldVersions;
    case "fulfilment": return { submissions: data.fulfilment, reconciliation: data.reconciliation };
    case "ai": return data.aiRuns;
    case "workflows": return data.workflows;
    case "audit": return data.audit;
  }
}
