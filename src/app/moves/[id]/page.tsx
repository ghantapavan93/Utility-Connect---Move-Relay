"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";
import { ConflictConstellation } from "@/components/constellation/ConflictConstellation";
import { RecordPanels } from "@/components/move/RecordPanels";
import { ParticleCanvas, type FieldPhase } from "@/components/ui/particle-canvas";
import { FilmGrain } from "@/components/cinematic";
import type { MoveRecord } from "@/lib/move-record";

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

/**
 * The identities a reviewer can merge as.
 *
 * Mirrors `DEMO_ACTORS` in `src/lib/actor.ts`, which cannot be imported here —
 * it pulls `next/server` for its denial responses and belongs on the server.
 * The duplication is two lines and is deliberate: the client offers a menu, the
 * server decides, and a subject typed or tampered with in the browser is
 * refused there rather than trusted here. `write-authz.test.ts` asserts the
 * decisions against the real graph, so this list cannot drift into meaning
 * anything on its own.
 */
const MERGE_ACTORS = [
  { subject: "user:concierge-7", label: "Concierge 7 — may merge" },
  { subject: "user:maya-patel", label: "Maya Patel (customer) — may not merge" },
  { subject: "user:ntr-agent", label: "North Texas Realty — may not merge" },
  { subject: "user:rival-agent", label: "Rival brokerage — no relationship" },
] as const;

export default function MoveWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ConflictsResponse | null>(null);
  const [record, setRecord] = useState<MoveRecord | null>(null);
  const [choices, setChoices] = useState<Record<string, unknown>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [actor, setActor] = useState("user:concierge-7");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /* Distinguishes "still fetching" from "fetched and failed" — the two states
     the old single-null `data` flattened into one eternal spinner. */
  const [loadError, setLoadError] = useState<string | null>(null);
  /* True only when the server said 401/403 — the one case the empty state may
     describe as an authorization decision. */
  const [recordDenied, setRecordDenied] = useState(false);

  const load = useCallback(async () => {
    /*
      Both reads together, and both re-read after a merge.

      They are two views of one record: the conflicts are what still needs a
      person, the record is everything the move knows. Fetching them separately
      would let the page show a field as resolved in one panel and contested in
      the other for as long as the second request took.

      The record read carries the chosen actor, because it is gated on the
      authorization graph — switching to Maya and seeing her own record load,
      then seeing the merge refused, is the demonstration.
    */
    let conflictsRes: Response, recordRes: Response;
    try {
      [conflictsRes, recordRes] = await Promise.all([
        fetch(`/api/v1/moves/${id}/conflicts`),
        fetch(`/api/v1/moves/${id}`, { headers: { "x-actor": actor } }),
      ]);
    } catch {
      setLoadError("The server could not be reached. Nothing on this page is current.");
      return;
    }

    /*
      A non-ok record read is not automatically a denial.

      The page used to collapse every failure to `record = null`, and the empty
      state below captioned null as "the selected actor has no path to this
      record" — so a 500 was rendered as an authorization statement about a
      person. Status decides the sentence: 401/403 really is the relationship
      gate speaking; anything else is a read that failed and must say so.
    */
    if (recordRes.ok) {
      setRecord((await recordRes.json()) as MoveRecord);
      setRecordDenied(false);
    } else {
      setRecord(null);
      setRecordDenied(recordRes.status === 401 || recordRes.status === 403);
    }

    if (!conflictsRes.ok) {
      /*
        Returning early here used to leave `data` null for ever, which rendered
        the permanent "loading…" screen — over a record that had loaded fine.
        An unreadable conflicts panel is a fact to display, not a spinner to
        hide behind.
      */
      setLoadError(`The conflicts could not be read (HTTP ${conflictsRes.status}).`);
      return;
    }
    setLoadError(null);
    const d = (await conflictsRes.json()) as ConflictsResponse;
    setData(d);
    // Preselect the deterministic recommendation; the human can override.
    const pre: Record<string, unknown> = {};
    for (const c of d.conflicts) if (c.recommended) pre[c.fieldPath] = c.recommended.value;
    setChoices(pre);
  }, [id, actor]);

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

    /*
      The actor travels in the header, not the body.

      It used to be a body field, which meant the merge was performed under
      whatever name the payload happened to carry — and the audit row recorded
      that name faithfully. Identity now comes from the request and is checked
      against the authorization graph before anything is written, so the name in
      `audit_events.actor` is the one the server authenticated rather than the
      one the client typed.
    */
    const res = await fetch(`/api/v1/moves/${id}/merge`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-actor": actor },
      body: JSON.stringify({ expectedVersion: data.move.version, decisions }),
    });
    const json = await res.json();
    setBusy(false);

    if (res.status === 401 || res.status === 403) {
      // A denial is not a failure to retry — it is a statement about who this
      // caller is. Showing the server's own reason is more use than "merge failed".
      setNotice(json.detail ?? json.error ?? "You may not merge this move.");
      return;
    }
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
      <main className="relative min-h-dvh bg-[#04070b] px-6 py-14 text-white">
        <div className="cine-aurora" aria-hidden />
        <ParticleCanvas phase="idle" />
        <div className="relative mx-auto max-w-4xl" style={{ zIndex: 1 }}>
          {loadError ? (
            /*
              Fetched and failed, which is not the same state as fetching. The
              old page kept the spinner for both, so a 500 from the conflicts
              route looked like a page that had merely not finished yet — for
              ever.
            */
            <div
              className="rounded-2xl border p-5"
              style={{ borderColor: "var(--color-state-failed)", background: "rgba(229,72,77,0.06)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--color-state-failed)" }}>
                This page could not be read.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--color-text-lo)" }}>
                {loadError} An unread page is not a quiet one — nothing below would have been
                trustworthy.
              </p>
              <button
                onClick={() => { setLoadError(null); void load(); }}
                className="mt-3 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                style={{ borderColor: "rgba(255,255,255,0.3)", color: "var(--color-text-mid)" }}
              >
                Read it again
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--color-text-lo)" }}>loading…</p>
          )}
        </div>
      </main>
    );
  }

  /**
   * What the field behind this record is saying.
   *
   * Same precedence the demo uses and the same reason: the provider submission
   * outranks everything, because an ambiguous outcome is the one state on this
   * page that changes what a person should do next. Open conflicts come second.
   * The field is reading this record rather than decorating it.
   */
  const submissionState = record?.services.find((s) => s.submissionState)?.submissionState;
  const fieldPhase: FieldPhase = submissionState === "unknown"
    ? "silence"
    : submissionState === "reconciled"
      ? "recovery"
      : data.conflicts.length > 0
        ? "judgement"
        : record
          ? "arrival"
          : "idle";

  return (
    <main className="relative min-h-dvh bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <ParticleCanvas phase={fieldPhase} />
      <FilmGrain id="move" />

      <div className="relative mx-auto max-w-4xl px-6 py-14" style={{ zIndex: 1 }}>
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
            No open conflicts. Every disputed field has a human-approved canonical value, and the
            record below shows which person chose each one and why.
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

                {/*
                  The same language as the hero and the agent page, applied to
                  the thing it was designed for: many sources becoming one
                  record. The radios below are the control; this is the state.
                  It redraws as the selection changes, so the reviewer sees the
                  strand they are about to make canonical before they commit it.
                */}
                <ConflictConstellation
                  candidates={c.candidates}
                  selected={choices[c.fieldPath]}
                  fieldPath={c.fieldPath}
                  /*
                    The phase comes from the request, never from the click.

                    A field still listed in `conflicts` is by definition not
                    canonical — the API only returns unresolved ones — so this
                    diagram can never legitimately show `committed`. Once a
                    merge succeeds the field leaves this list and the fieldset
                    disappears, which is the honest way for a screen to stop
                    claiming something: by no longer being there.
                  */
                  phase={busy ? "submitting" : "selecting"}
                />

                <div className="mt-4 space-y-2">
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
            {/*
              A chooser, not a text box.

              This used to be free text, and the merge ran under whatever was
              typed — which is precisely why the endpoint was worth attacking.
              The list is now the demo's real identities, and picking one that
              has no business merging is the fastest way to see the gate work:
              Maya can view her own move and is refused the merge, with the
              server's reason shown rather than a generic failure.
            */}
            <label className="flex items-center gap-2 text-sm">
              <span style={{ color: "var(--color-text-lo)" }}>Demo actor</span>
              <select
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="rounded-lg border bg-transparent px-3 py-2 font-mono text-sm"
                style={{ borderColor: "var(--color-ground-3)", color: "var(--color-text-hi)" }}
              >
                {MERGE_ACTORS.map((a) => (
                  <option key={a.subject} value={a.subject}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={submit}
              disabled={busy}
              className="rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-px disabled:opacity-50"
              style={{ background: "var(--color-state-verified)" }}
            >
              {busy ? "merging…" : "Approve merge"}
            </button>
          </div>
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-lo)" }}>
            Posts with the version this screen read (v{data.move.version}). If someone merged
            meanwhile, the API answers 409 and this screen re-reads — no silent overwrite. The
            actor travels in a header and is checked against the authorization graph before
            anything is written; only a concierge may select a surviving value.
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--color-text-lo)" }}>
            <strong style={{ color: "var(--color-text-mid)" }}>Demo actor, not a login.</strong>{" "}
            The chooser is a synthetic stand-in for a session and is trivially forged — there is no
            authentication here. What it demonstrates is the authorization decision behind it,
            which is real, server-side, and made before anything is written.
          </p>
        </>
      )}

      {/*
        The record, always — settled or not.

        The conflict workspace answers "what still needs me". This answers "what
        does this system actually know, and why does it believe it", which is
        the question the whole project exists to make answerable and which this
        screen previously could not address at all once the conflicts were gone.
      */}
      {record ? (
        <RecordPanels record={record} />
      ) : (
        <p
          className="mt-8 rounded-2xl border p-5 text-sm"
          style={{
            borderColor: recordDenied ? "var(--color-ground-3)" : "var(--color-state-failed)",
            color: "var(--color-text-lo)",
          }}
        >
          {/*
            Two different absences. A 401/403 is the relationship gate speaking,
            and saying so is the demonstration. Anything else is a read that
            failed — and captioning a 500 as "this actor has no path" would be
            the page inventing an authorization decision the server never made.
          */}
          {recordDenied
            ? "The selected actor has no path to this record, so none of it is readable to them."
            : "The record could not be read. This is a failed read, not a denial — nothing is known about this actor's access."}
        </p>
      )}
      </div>
    </main>
  );
}
