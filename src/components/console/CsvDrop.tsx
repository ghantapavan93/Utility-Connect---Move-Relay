"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A real multipart upload for the lowest-trust channel.
 *
 * `POST /api/v1/upload/csv` has existed and had no way to reach it from the
 * product shell. Every row goes through the same `ingestReferral` gauntlet as
 * the partner API — no shortcut into the system, which is the point: a channel
 * that bypasses the pipeline to get its data in is a channel whose data nobody
 * can trust.
 *
 * The panel reports the split rather than a success message. A partner who
 * renamed a column gets a file that partially lands and a list of exactly which
 * lines did not, and that split is the interesting number — a upload that only
 * ever says "done" is how bad integrations survive for years.
 */

interface UploadReport {
  file: string;
  batchId: string;
  correlationId: string;
  headers: string[];
  rows: {
    total: number;
    accepted: number;
    quarantined: number;
    replayed: number;
    unmappable: number;
  };
  results: Array<{
    line: number;
    status: string;
    issues?: Array<{ path: string; message: string }>;
  }>;
  unmappable?: Array<{ line: number; reason: string }>;
  error?: string;
}

/**
 * A sample file, generated in the browser.
 *
 * Deliberately imperfect, and imperfect in the two different ways that matter.
 *
 * The header says `mobile` and `address` rather than `phone` and `to_address`,
 * and one date is written `10/05/2026`. All three are *tolerated*: the mapper
 * carries aliases per field and reads US-style M/D/YYYY, because rejecting a
 * file over a header name is the strictness that pushes partners back to email.
 * The last row is not tolerated — its email is missing an `@` — so it
 * quarantines with the exact path that failed.
 *
 * That split is the claim. A sample where everything succeeded would show a
 * tolerant importer and prove nothing about what happens when tolerance runs
 * out; one where everything failed would just look broken.
 *
 * An earlier version of this file described the `10/05/2026` row as one the
 * contract *refuses*. It does not — `normaliseDate` reads it as October 5th and
 * the row lands — so the sample claimed a quarantine that never happened, and
 * measured against the live endpoint it reported five accepted and zero held.
 */
const SAMPLE_CSV = `first_name,last_name,email,mobile,move_date,address,services,brokerage
Priya,Raman,priya.raman@example.com,469-555-0114,2026-09-18,88 Bishop Ave Apt 4B Dallas TX 75208,electric;internet,north-texas-realty
Tomas,Herrera,tomas.herrera@example.com,972-555-0166,2026-09-21,415 Comal St Richardson TX 75080,electric,north-texas-realty
Aisha,Bello,aisha.bello@example.com,214-555-0190,2026-10-02,2200 Live Oak St Unit 12 Dallas TX 75204,electric;internet;security,north-texas-realty
Wen,Zhao,wen.zhao@example.com,469-555-0177,10/05/2026,7 Legacy Dr Frisco TX 75034,internet,north-texas-realty
Marco,Silva,marco.silva.example.com,214-555-0155,2026-10-09,930 Cedar Springs Rd Dallas TX 75219,electric,north-texas-realty
`;

export function CsvDrop({ onLanded }: { onLanded: () => void }) {
  const [report, setReport] = useState<UploadReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/v1/upload/csv", {
          method: "POST",
          // Uploading is a write, so it carries an actor. The endpoint refuses
          // an anonymous one, and it is right to.
          headers: { "X-Actor": "user:concierge-7" },
          body: form,
        });
        const json = await res.json();
        setReport(res.ok ? json : { ...json, file: file.name, error: json.error });
        onLanded();
      } catch {
        setReport({
          file: file.name,
          error: "The upload never reached the server.",
        } as UploadReport);
      } finally {
        setBusy(false);
      }
    },
    [onLanded],
  );

  const uploadSample = useCallback(() => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    void upload(new File([blob], "north-texas-realty-batch.csv", { type: "text/csv" }));
  }, [upload]);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}
    >
      <h2 className="text-sm font-semibold">CSV batch</h2>
      <p className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>
        Lowest trust tier, 0.5. Same gauntlet as every other channel.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className="mt-4 rounded-xl border border-dashed p-5 text-center transition-colors"
        style={{
          borderColor: dragging ? "var(--color-state-verified)" : "var(--color-ground-3)",
          background: dragging ? "color-mix(in oklab, var(--color-state-verified) 8%, transparent)" : "transparent",
        }}
      >
        <p className="text-xs" style={{ color: "var(--color-text-mid)" }}>
          Drop a .csv here
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ borderColor: "var(--color-ground-3)" }}
          >
            Choose a file
          </button>
          <button
            onClick={uploadSample}
            disabled={busy}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--uc-cyan-fill)", color: "white" }}
          >
            {busy ? "Uploading…" : "Use a sample batch"}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
            // Cleared so choosing the same file twice fires again — which is
            // itself worth doing, since the second upload should replay.
            e.target.value = "";
          }}
        />
      </div>

      {report && <Report report={report} />}
    </div>
  );
}

function Report({ report }: { report: UploadReport }) {
  if (report.error) {
    return (
      <p className="mt-4 text-xs" style={{ color: "var(--color-state-failed)" }}>
        {report.file}: {report.error}
      </p>
    );
  }

  const held = report.results?.filter((r) => r.status === "quarantined") ?? [];

  return (
    <div className="mt-4 text-xs">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-mono" style={{ color: "var(--color-text-mid)" }}>
          {report.file}
        </span>
        <span style={{ color: "var(--color-text-lo)" }}>batch {report.batchId}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tally n={report.rows.accepted} label="accepted" tone="var(--color-state-verified)" />
        <Tally n={report.rows.quarantined} label="quarantined" tone="var(--color-state-conflict)" />
        <Tally n={report.rows.replayed} label="replayed" tone="var(--color-state-transit)" />
        <Tally n={report.rows.unmappable} label="unmappable" tone="var(--color-text-lo)" />
      </div>

      {/*
        The rows that did not land, with the paths that failed. This is the part
        a partner can act on, and the reason quarantine is a better answer than
        either dropping the row or forcing it through.
      */}
      {held.length > 0 && (
        <div className="mt-3 rounded-lg p-3" style={{ background: "var(--color-ground-0)" }}>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--color-state-conflict)" }}>
            Held for review
          </div>
          {held.map((r) => (
            <div key={r.line} className="font-mono text-[11px]" style={{ color: "var(--color-text-mid)" }}>
              line {r.line}
              {r.issues?.map((i, n) => (
                <span key={n} style={{ color: "var(--color-text-lo)" }}>
                  {" · "}
                  {i.path}: {i.message}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
        Upload the same file again and every row replays instead of duplicating. The keys are
        derived from the file's own bytes, not from the request.
      </p>
    </div>
  );
}

function Tally({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: "var(--color-ground-0)" }}>
      <div className="text-lg font-bold tabular-nums" style={{ color: tone }}>
        {n}
      </div>
      <div className="text-[10px]" style={{ color: "var(--color-text-lo)" }}>
        {label}
      </div>
    </div>
  );
}
