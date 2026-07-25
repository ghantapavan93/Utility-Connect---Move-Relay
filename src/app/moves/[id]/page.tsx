"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";

/**
 * The resolution workspace — any move's conflicts, resolved by a named human.
 *
 * Per field: every candidate with its provenance, the deterministic
 * recommendation preselected, and a required written reason. The merge posts
 * with the version this screen READ; if someone else merged meanwhile the API
 * answers 409 and the screen re-reads instead of overwriting. The optimistic
 * lock is a UX behaviour here, not only a schema fact.
 */

interface Candidate {
  fieldPath: string;
  value: unknown;
  channel: string;
  verification: string;
  confidence: number;
  recordedAt: string;
}

interface Conflict {
  fieldPath: string;
  candidates: Candidate[];
  recommended: Candidate | null;
  reason: string;
}

interface ConflictsResponse {
  move: { id: string; reference: string; state: string; version: number };
  conflicts: Conflict[];
}

const fmt = (v: unknown) =>
  typeof v === "string" ? v.replace(/^"|"$/g, "") : JSON.stringify(v);

export default function MoveWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ConflictsResponse | null>(null);
  const [choices, setChoices] = useState<Record<string, unknown>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [actor, setActor] = useState("human:concierge-7");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/v1/moves/${id}/conflicts`);
    if (!res.ok) return;
    const d = (await res.json()) as ConflictsResponse;
    setData(d);
    // Preselect the deterministic recommendation; the human can override.
    const pre: Record<string, unknown> = {};
    for (const c of d.conflicts) if (c.recommended) pre[c.fieldPath] = c.recommended.value;
    setChoices(pre);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!data) return;
    setBusy(true);
    setNotice(null);
    const decisions = data.conflicts
      .filter((c) => choices[c.fieldPath] !== undefined)
      .map((c) => ({
        fieldPath: c.fieldPath,
        value: choices[c.fieldPath],
        reason: reasons[c.fieldPath]?.trim() || "Selected in the resolution workspace.",
      }));

    const res = await fetch(`/api/v1/moves/${id}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actor, expectedVersion: data.move.version, decisions }),
    });
    const json = await res.json();
    setBusy(false);

    if (res.status === 409) {
      setNotice(
        `Someone merged this move while you were reading (now v${json.currentVersion}). Re-loaded — please review again.`,
      );
      await load();
      return;
    }
    if (!res.ok) {
      setNotice(json.error ?? "merge failed");
      return;
    }
    setNotice(`Merged as ${actor} — move is now v${json.newVersion}.`);
    await load();
  };

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-14">
        <p className="text-sm" style={{ color: "var(--color-text-lo)" }}>loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Link href="/moves" className="text-sm" style={{ color: "var(--color-state-verified)" }}>
        ← Move queue
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">{data.move.reference}</h1>
        <StateBadge state={data.move.state === "canonical" ? "verified" : data.conflicts.length ? "conflict" : "pending"} />
        <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>v{data.move.version}</span>
      </div>

      {notice && (
        <p className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: "var(--color-state-conflict)", color: "var(--color-text-mid)" }}>
          {notice}
        </p>
      )}

      {data.conflicts.length === 0 ? (
        <div className="mt-8 rounded-2xl border p-6" style={{ borderColor: "var(--color-state-verified)", background: "var(--color-ground-1)" }}>
          <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
            No open conflicts. Every disputed field has a human-approved canonical value.
          </p>
          <Link href="/views" className="mt-3 inline-block text-sm font-semibold" style={{ color: "var(--color-state-verified)" }}>
            See how each audience reads this move →
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-sm" style={{ color: "var(--color-text-mid)" }}>
            {data.conflicts.length} field{data.conflicts.length === 1 ? "" : "s"} where sources
            disagree. The recommendation is deterministic; the decision is yours, and it is
            recorded with your name and reason.
          </p>

          <div className="mt-6 space-y-5">
            {data.conflicts.map((c, i) => (
              <motion.fieldset
                key={c.fieldPath}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl border p-5"
                style={{ borderColor: "var(--color-state-conflict)", background: "var(--color-ground-1)" }}
              >
                <legend className="px-1 font-mono text-sm font-semibold">{c.fieldPath}</legend>
                <p className="mb-3 text-xs" style={{ color: "var(--color-text-lo)" }}>{c.reason}</p>

                <div className="space-y-2">
                  {c.candidates.map((cand, k) => {
                    const selected = choices[c.fieldPath] === cand.value;
                    return (
                      <label
                        key={k}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors"
                        style={{
                          borderColor: selected ? "var(--color-state-verified)" : "var(--color-ground-3)",
                          background: selected ? "color-mix(in oklab, var(--color-state-verified) 10%, transparent)" : "transparent",
                        }}
                      >
                        <input
                          type="radio"
                          name={c.fieldPath}
                          checked={selected}
                          onChange={() => setChoices((p) => ({ ...p, [c.fieldPath]: cand.value }))}
                          className="accent-current"
                          style={{ color: "var(--color-state-verified)" }}
                        />
                        <span className="font-mono text-sm font-semibold">{fmt(cand.value)}</span>
                        <span className="text-xs" style={{ color: "var(--color-text-lo)" }}>
                          {cand.channel} · {cand.verification} · {new Date(cand.recordedAt).toLocaleDateString()}
                        </span>
                        {c.recommended?.value === cand.value && (
                          <span className="ml-auto text-[10px] font-bold uppercase" style={{ color: "var(--color-state-verified)" }}>
                            recommended
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <input
                  placeholder="Why this value? (recorded with the merge)"
                  value={reasons[c.fieldPath] ?? ""}
                  onChange={(e) => setReasons((p) => ({ ...p, [c.fieldPath]: e.target.value }))}
                  className="mt-3 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
                  style={{ borderColor: "var(--color-ground-3)" }}
                />
              </motion.fieldset>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="rounded-lg border bg-transparent px-3 py-2 font-mono text-sm"
              style={{ borderColor: "var(--color-ground-3)" }}
              aria-label="Acting as"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ background: "var(--color-state-verified)" }}
            >
              {busy ? "merging…" : `Approve merge as ${actor.replace(/^human:/, "")}`}
            </button>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
            Posts with the version this screen read (v{data.move.version}). If someone merged
            meanwhile, the API answers 409 and this screen re-reads — no silent overwrite.
          </p>
        </>
      )}
    </main>
  );
}
