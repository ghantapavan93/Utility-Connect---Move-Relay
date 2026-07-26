"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EASE } from "@/lib/motion";
import { accentColor } from "@/lib/accents";

/**
 * Upload a real spreadsheet.
 *
 * `csv_upload` has been a first-class channel here from the start — versioned
 * contract, lowest trust tier, one of the three sources in the demo — with no
 * way to actually upload anything. This is that control.
 *
 * Rows go through the same `ingestReferral` pipeline as every other channel, so
 * what comes back is the honest result rather than a success toast: how many
 * landed, how many quarantined and why, and how many replayed because this file
 * has been seen before. The failures are the interesting part and they are not
 * hidden behind a summary.
 */

interface UploadResult {
  file: string;
  batchId: string;
  headers: string[];
  rows: { total: number; accepted: number; quarantined: number; replayed: number; unmappable: number };
  results: Array<{ line: number; status: string; issues?: Array<{ path: string; message: string }> }>;
  unmappable: Array<{ line: number; reason: string }>;
}

const SAMPLE = [
  "first_name,last_name,email,phone,move_date,to_address,services",
  'Maya,Patel,maya.patel@example.com,469-555-0143,2026-08-14,"1420 Windhaven Pkwy, Plano, TX 75093",electric',
  'Dev,Shah,dev.shah@example.com,469-555-0180,8/20/2026,"88 Legacy Dr, Frisco, TX",electric;internet',
  "Broken,Row,not-an-email,469-555-0199,next Tuesday,",
  "",
].join("\n");

export function CsvUpload({ actor = "user:concierge-7" }: { actor?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/v1/upload/csv", {
        method: "POST",
        body: form,
        headers: { "x-actor": actor },
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "upload failed");
        return;
      }
      setResult(json as UploadResult);
      const r = (json as UploadResult).rows;
      if (r.replayed > 0 && r.accepted === 0) {
        toast.success(`Seen before — ${r.replayed} rows replayed, nothing duplicated.`);
      } else if (r.quarantined > 0) {
        toast.warning(`${r.accepted} landed, ${r.quarantined} quarantined with reasons.`);
      } else {
        toast.success(`${r.accepted} referrals ingested.`);
      }
    } catch {
      toast.error("network error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cine-glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white/90">Upload a partner spreadsheet</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-white/55">
        A real file, through the same pipeline as every other channel — contract validation,
        idempotency, duplicate assessment, provenance. Upload the same file twice and the second
        one replays instead of creating a second set of referrals.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-50"
          style={{ background: accentColor("verified", 1) }}
        >
          {busy ? "ingesting…" : "Choose a CSV"}
        </button>
        <button
          onClick={() => void send(new File([SAMPLE], "sample-referrals.csv", { type: "text/csv" }))}
          disabled={busy}
          className="rounded-full border px-5 py-2 text-xs font-bold uppercase tracking-wide text-white/85 disabled:opacity-50"
          style={{ borderColor: "rgba(255,255,255,0.22)" }}
        >
          Use a sample with one bad row
        </button>
      </div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.batchId + result.rows.replayed}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24, ease: EASE.outQuart }}
            className="mt-4"
          >
            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wider">
              {(
                [
                  ["accepted", result.rows.accepted, "recovered"],
                  ["replayed", result.rows.replayed, "verified"],
                  ["quarantined", result.rows.quarantined, "conflict"],
                  ["unmappable", result.rows.unmappable, "unknown"],
                ] as const
              ).map(([label, n, tone]) => (
                <span
                  key={label}
                  className="rounded-full border px-2.5 py-1"
                  style={{
                    borderColor: accentColor(tone, n > 0 ? 0.45 : 0.15),
                    background: accentColor(tone, n > 0 ? 0.12 : 0.04),
                    color: accentColor(tone, n > 0 ? 1 : 0.4),
                  }}
                >
                  {n} {label}
                </span>
              ))}
            </div>

            <div className="mt-3 font-mono text-[10px] text-white/40">
              batch {result.batchId} · columns detected: {result.headers.join(", ")}
            </div>

            {/* The rows that did not land, with the reason. A quarantined row
                that does not say why is a row nobody will ever fix. */}
            {result.results.filter((r) => r.status === "quarantined").length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {result.results
                  .filter((r) => r.status === "quarantined")
                  .map((r) => (
                    <li
                      key={r.line}
                      className="rounded-lg border px-3 py-2 text-[11px]"
                      style={{
                        borderColor: accentColor("conflict", 0.3),
                        background: accentColor("conflict", 0.06),
                      }}
                    >
                      <span className="font-mono" style={{ color: accentColor("conflict", 1) }}>
                        line {r.line}
                      </span>
                      <span className="ml-2 text-white/65">
                        {r.issues?.map((i) => `${i.path}: ${i.message}`).join(" · ") ??
                          "failed contract"}
                      </span>
                    </li>
                  ))}
              </ul>
            )}

            {result.unmappable.map((u) => (
              <div key={u.line} className="mt-2 text-[11px] text-white/50">
                <span className="font-mono">line {u.line}</span> — {u.reason}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
