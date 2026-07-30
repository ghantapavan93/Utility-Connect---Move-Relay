"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { StateBadge } from "@/components/StateBadge";
import { ArrowDown, ArrowRight } from "lucide-react";
import { CineHero } from "@/components/cinematic/CineHero";
import { ChapterMarker, FilmGrain, MagneticLink, Pill, accentColor } from "@/components/cinematic";
import { accentInk, type Accent } from "@/lib/accents";
import { withheld, additional, shared, leafPaths } from "@/lib/projection-diff";
import { ProjectionRail } from "@/components/views/ProjectionRail";
import { AudienceLens, LensReadout, type LensState } from "@/components/views/AudienceLens";
import { ForbiddenView } from "@/components/views/ForbiddenView";
import { CompareViews } from "@/components/views/CompareViews";
import { FieldLineage } from "@/components/views/FieldLineage";

/**
 * Screens 5, 7, 8 — the same Move Record seen by three audiences.
 *
 * One toggle, three projections, all fetched from /api/v1/views. The point the
 * screen makes visually: identical underlying data, deliberately different
 * surfaces, and the differences are enforced on the server. Flip between tabs
 * and the provider's order id and the internal error category are simply not in
 * the customer's or the partner's payload.
 *
 * The page used to make that claim without showing it. Three panels that merely
 * look different prove nothing — a field can be present in a response and just
 * not rendered by that component, which is the exact bug this screen exists to
 * rule out. All three payloads are now fetched and compared, and the withheld
 * paths are read off the real responses.
 */

type Audience = "concierge" | "customer" | "partner";

const TABS: Array<{ key: Audience; label: string; blurb: string }> = [
  { key: "concierge", label: "Concierge", blurb: "The trusted operator. Full context, every source, every unknown." },
  { key: "customer", label: "Customer", blurb: "Their move, in plain terms. No internal machinery." },
  { key: "partner", label: "Partner", blurb: "Attributed engagement only. Nothing cross-partner, no provider internals." },
];

// The audience is not something the client asks for — it is a property of who
// the request says it is. Switching tabs switches actor, and the server decides
// what that actor may see by walking the relationship graph. A forged header is
// trivial here and that is stated plainly on the page: identity is a demo
// stand-in, the authorization decision behind it is not.
const ACTOR: Record<Audience, string> = {
  concierge: "user:concierge-7",
  customer: "user:maya-patel",
  partner: "user:ntr-agent",
};

interface MoveOption {
  id: string;
  reference: string;
  state: string;
  openConflicts: number;
}

export default function ViewsPage() {
  const [audience, setAudience] = useState<Audience>("concierge");
  const [all, setAll] = useState<Record<Audience, Record<string, unknown>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /*
    Which move is being read.

    This page could only ever show the scripted narrative move, because the
    endpoint behind it resolved that one by reference. So the screen that
    demonstrates audience isolation could not demonstrate it on a move a
    reviewer had just created in the console — with its own conflicts, its own
    provider timeout, and its own reasons for the three views to differ.
  */
  const [moves, setMoves] = useState<MoveOption[]>([]);
  const [moveId, setMoveId] = useState<string | null>(null);

  /*
    Direct entry.

    The page used to tell a reviewer to leave, run the nine-step console,
    remember to return, and reconstruct what had changed — a request most people
    decline, which meant the page's argument went unread. `views-seed` builds
    one complete move in its own tenant, so a link is enough.

    Deliberately not the demo orchestrator: that operates on `uc-demo`, whose
    reset deletes the organisation outright, so a load button wired to it would
    destroy the state of whoever had the console open.
  */
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedError, setSeedError] = useState<string | null>(null);

  const seed = useCallback(async () => {
    setSeeding(true);
    setSeedError(null);
    try {
      const res = await fetch("/api/v1/views/seed", { method: "POST" });
      const json = (await res.json()) as { ok?: boolean; moveId?: string; reference?: string; error?: string };
      if (!res.ok || !json.ok || !json.moveId) {
        setSeedError(json.error ?? `The server returned ${res.status}.`);
        return;
      }
      setSeeded(true);
      /*
        The seeded move is added to the selector directly, because it cannot
        arrive through the list.

        `/api/v1/moves` is scoped to the console's `uc-demo` organisation, and
        this move lives in `views-demo` — on purpose, so loading it cannot
        disturb whoever has the console open. Re-reading that list therefore
        returns everything except the record just created, and selecting from it
        silently landed on an unrelated move. The projections are fetched per
        move id, so the id is all this needs.
      */
      setMoves((prev) =>
        prev.some((m) => m.id === json.moveId)
          ? prev
          : [
              { id: json.moveId!, reference: json.reference ?? "MR-2026-0001", state: "canonical", openConflicts: 0 },
              ...prev,
            ],
      );
      setMoveId(json.moveId);
    } catch (err) {
      setSeedError(err instanceof Error ? err.message : String(err));
    } finally {
      setSeeding(false);
    }
  }, []);

  // Whether it already exists, so a returning reviewer is not told to load
  // something that is already there.
  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/views/seed");
      const json = (await res.json()) as { exists?: boolean; moveId?: string; reference?: string };
      setSeeded(json.exists === true);
      // Already seeded from an earlier visit: make it selectable and select it,
      // for the same reason as above — it is not in the console's move list.
      if (json.exists && json.moveId) {
        const id = json.moveId;
        setMoves((prev) =>
          prev.some((m) => m.id === id)
            ? prev
            : [{ id, reference: json.reference ?? "MR-2026-0001", state: "canonical", openConflicts: 0 }, ...prev],
        );
        setMoveId(id);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/v1/moves");
      const json = await res.json();
      const rows: MoveOption[] = json.moves ?? [];
      /*
        Merge, never replace, and never re-choose.

        This list is the console tenant's. The seeded Views move is not in it and
        never will be, so the previous version — which kept `prev` only when the
        list contained it — discarded a deliberate selection and silently landed
        on an unrelated move. Whichever effect resolves second used to win.
      */
      setMoves((prev) => [...prev, ...rows.filter((r) => !prev.some((p) => p.id === r.id))]);
      setMoveId((prev) => prev ?? rows[0]?.id ?? null);
    })();
  }, []);

  /**
   * Fetch all three projections, not just the one on screen.
   *
   * Comparing them is the only way to demonstrate an absence, and the
   * comparison has to be against responses this page actually received — a
   * hardcoded list of "fields the partner does not get" would keep reassuring a
   * reviewer long after a projection started leaking one.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    /*
      Falls back to `/api/v1/views` when no move is selected, which is the
      scripted move by reference. That keeps the page meaningful on a tenant
      where the demo has been run but nothing else has.
    */
    const url = moveId ? `/api/v1/moves/${moveId}/views` : "/api/v1/views";
    try {
      const entries = await Promise.all(
        (Object.keys(ACTOR) as Audience[]).map(async (a) => {
          const res = await fetch(url, { headers: { "x-actor": ACTOR[a] } });
          // A denial body is a legitimate payload here — the page renders it
          // as the demonstration. A body that fails to parse is not.
          return [a, (await res.json()) as Record<string, unknown>] as const;
        }),
      );
      setAll(Object.fromEntries(entries) as Record<Audience, Record<string, unknown>>);
    } catch {
      /*
        The old version had no failure branch: a thrown fetch left `loading`
        true and the panel said "Loading…" for ever — an unread comparison
        rendered as a patient one. This page's whole argument is that absences
        must be demonstrated from received responses, so a failure to receive
        any is a first-class state.
      */
      setLoadError("The three projections could not be fetched. No comparison below is current.");
    } finally {
      setLoading(false);
    }
  }, [moveId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  /** Which projected field is currently unfolded, if any. */
  const [lineageField, setLineageField] = useState<string | null>(null);

  const selectAudience = useCallback((i: number) => {
    const next = TABS[i]!.key;
    setAudience(next);
    // A lineage answer belongs to one actor. Leaving it open across a switch
    // would show the concierge's history under the customer's heading.
    setLineageField(null);
    tabRefs.current[i]?.focus();
  }, []);

  /**
   * Arrow keys move within the set; Tab leaves it.
   *
   * Derived from the focused element rather than from state. Roving tabindex
   * keeps the two in step, so reading state would be correct for every path a
   * user can take — and it would still make this handler depend on an invariant
   * enforced somewhere else.
   */
  const onTabKeyDown = useCallback((e: React.KeyboardEvent) => {
    const last = TABS.length - 1;
    const focused = tabRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    const from = focused >= 0 ? focused : TABS.findIndex((t) => t.key === audience);
    const next =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? from === last ? 0 : from + 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? from === 0 ? last : from - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    selectAudience(next);
  }, [audience, selectAudience]);

  const data = all?.[audience] ?? null;

  /*
    What the lens draws, counted from the payloads the server returned.

    `sent` is the number of leaf paths this audience actually received; `held`
    is how many the concierge baseline has that this one does not. Both come
    from `projection-diff`, so a projection that started leaking would move the
    numbers rather than leave the drawing asserting an absence that had stopped
    being true.
  */
  const lensState: LensState = loading
    ? { kind: "loading" }
    : data?.exists === true && all?.concierge?.exists === true
      ? {
          kind: "granted",
          audience,
          sent: leafPaths(data).length,
          held: withheld(all.concierge, data).length,
          via: String((data.authorization as { via?: string } | undefined)?.via ?? "unknown path"),
        }
      : { kind: "empty" };


  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#04070b] text-white">
      <div className="cine-aurora" aria-hidden />
      <FilmGrain id="views" />

      {/*
        The claim this page makes is a negative one, and negatives are hard to
        show: the partner does not receive the provider's order id, and the
        customer does not receive the internal error category. You cannot
        photograph an absence — so the page fetches all three projections and
        names the paths that are missing from the one on screen, computed from
        the responses rather than described in prose. Enforced on the server,
        which is the only place it counts.

        (The copy here previously cited an SSN and a provider account number.
        Neither field exists anywhere in this demo's data, so the page was
        claiming to withhold things it never had. The fields named above are the
        ones the payloads actually contain.)
      */}
      <CineHero
        image="/renders/living.webp"
        alt="The living room of the residence, looking through to the kitchen"
        accent="security"
        pills={
          <>
            <Pill accent="verified">One canonical record</Pill>
            <Pill accent="security">Relationship aware</Pill>
            <Pill accent="conflict">Synthetic data</Pill>
          </>
        }
        /*
          "One record. Three truths." was the page contradicting its own
          architecture.

          Move Relay has exactly one canonical truth; that is the entire point of
          a provenance-aware record, and the reason a canonical value cannot
          exist without the human who chose it. Three audiences do not hold three
          truths — they receive three authorized projections of one. The old
          headline described fragmented truth, which is the failure mode this
          system was built to prevent, printed as the page's largest sentence.
        */
        headline={
          <>
            One move.
            <br />
            <span style={{ color: accentColor("verified", 1) }}>Three safe views.</span>
          </>
        }
        sub="Maya, her concierge and her referring partner all need different information. Move Relay computes each view on the server, so restricted fields never reach the browser."
        actions={
          <>
            <button
              onClick={() => void seed()}
              disabled={seeding}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-7 text-sm font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: accentColor("verified", 1) }}
            >
              {seeding ? "Loading…" : seeded ? "Maya's move is loaded" : "Load Maya's synthetic move"}
              <ArrowDown className="h-4 w-4" />
            </button>
            <button
              onClick={() => panelRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border px-7 text-sm font-bold uppercase tracking-wide text-white/90"
              style={{ borderColor: "rgba(255,255,255,0.26)" }}
            >
              Inspect the payload <ArrowRight className="h-4 w-4" />
            </button>
          </>
        }
      />

      <ProjectionRail />

      <ChapterMarker n="01" label="The same move, three ways" />
      <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
        <h2 className="max-w-3xl text-[clamp(24px,3.4vw,44px)] font-semibold leading-[1.08] tracking-tight text-white">
          The safest field is{" "}
          <span style={{ color: accentColor("security", 1) }}>the one that never left the server</span>.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/60">
          Pick any move in the tenant, then switch between the three audiences below and read the
          payload. The difference is what is missing.
        </p>

        {/*
          Any move, not the scripted one.

          The three projections are only interesting when the record has
          something worth withholding, and the most convincing version of that
          is a move the reviewer created themselves a minute earlier in the
          console — not a fixture that could have been special-cased.
        */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-white/45">Move</span>
            <select
              value={moveId ?? ""}
              onChange={(e) => setMoveId(e.target.value || null)}
              className="rounded-lg border bg-transparent px-3 py-2 font-mono text-sm text-white"
              style={{ borderColor: "rgba(255,255,255,0.18)" }}
            >
              {moves.length === 0 && <option value="">no moves in this tenant</option>}
              {moves.map((m) => (
                <option key={m.id} value={m.id} className="bg-[#0b1116]">
                  {m.reference} · {m.state}
                  {m.openConflicts > 0 ? ` · ${m.openConflicts} open` : ""}
                </option>
              ))}
            </select>
          </label>
          <Link
            href="/dashboard"
            /*
              `py-3.5` gives this a 44px target and `-my-3.5` cancels it out of
              the flow, so nothing moves. As a bare line of text it was 16px —
              standalone, so the WCAG 2.5.8 inline exemption does not apply.
            */
            className="-my-3.5 inline-block py-3.5 text-xs font-semibold uppercase tracking-wide text-white/50 transition-colors hover:text-white/80"
          >
            Create one in the console →
          </Link>
        </div>
      </div>

      <WithheldBand audience={audience} all={all} loading={loading} />

      <div ref={panelRef} className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8">
      {/*
        The toggle is the instrument, so it is sized like one. Each tab carries
        the count of fields the server withholds from that audience, which turns
        three interchangeable-looking labels into a visible gradient of
        privilege before anything is clicked.
      */}
      {/*
        A tablist, not three buttons.

        Three controls that swap one shared panel is what a tablist is for: a
        keyboard user expects one tab stop and arrows within the set, and a
        screen reader expects to be told which of the three is showing. The
        selected cue is a bar and a weight change as well as colour, because
        selection carried by hue alone disappears for anyone who cannot
        separate those hues.
      */}
      <div
        role="tablist"
        aria-label="Which audience is asking"
        aria-orientation="horizontal"
        onKeyDown={onTabKeyDown}
        className="grid gap-2 sm:grid-cols-3"
      >
        {TABS.map((t, i) => {
          const active = audience === t.key;
          const count = all?.concierge?.exists === true ? withheld(all.concierge, all[t.key]).length : null;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`audience-tab-${t.key}`}
              aria-selected={active}
              aria-controls="audience-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => selectAudience(i)}
              className="flex min-h-11 items-start gap-2.5 rounded-xl border px-4 py-3 text-left transition-all"
              style={{
                borderColor: active ? accentColor("verified", 0.9) : "rgba(255,255,255,0.09)",
                background: active ? accentColor("verified", 0.14) : "rgba(255,255,255,0.02)",
              }}
            >
              <span
                aria-hidden
                className="w-[3px] shrink-0 self-stretch rounded-full"
                style={{ background: active ? accentColor("verified", 1) : "transparent" }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`text-base ${active ? "font-bold" : "font-medium"}`}
                    style={{ color: active ? accentColor("verified", 1) : "rgba(255,255,255,0.85)" }}
                  >
                    {t.label}
                  </span>
                  {count !== null && (
                    <span className="font-mono text-[11px] text-white/40">
                      {count === 0 ? "baseline" : `−${count}`}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-white/50">{t.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/*
        The lens. One record, one gate, and whichever fields this actor is
        entitled to — counted from the payloads the server actually returned,
        never from a number written here.
      */}
      <div className="mt-6 grid items-center gap-5 rounded-2xl border p-5 sm:p-6 lg:grid-cols-[minmax(0,150px)_minmax(0,1fr)]"
           style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" }}>
        <LensReadout state={lensState} />
        <div className="h-[190px] min-w-0">
          <AudienceLens state={lensState} />
        </div>
      </div>

      {/*
        What the projection says about itself, straight from the response.

        Every number here is the server's. The field count is computed from the
        payload it travels with, and the withheld list names categories rather
        than fields — a derived list would be a precise map of everything this
        audience may not see, attached to the response withholding it.
      */}
      {data?.exists === true && data.manifest ? (
        <div
          className="mt-3 min-w-0 rounded-xl border p-4"
          style={{ borderColor: "rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.02)" }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
            Projection manifest, as returned
          </p>
          <dl className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-3">
            {(() => {
              const m = data.manifest as {
                audience: string; relationship: string; moveVersion: number;
                policyVersion: string; includedFieldCount: number; withheldCategories: string[];
              };
              return [
                ["Audience", m.audience],
                ["Granted via", m.relationship],
                ["Move version", String(m.moveVersion)],
                ["Policy", m.policyVersion],
                ["Fields included", String(m.includedFieldCount)],
                ["Categories withheld", String(m.withheldCategories.length)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">{k}</dt>
                  <dd className="mt-0.5 break-all font-mono text-xs text-white/70">{v}</dd>
                </div>
              ));
            })()}
          </dl>
          {(data.manifest as { withheldCategories: string[] }).withheldCategories.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {(data.manifest as { withheldCategories: string[] }).withheldCategories.map((c) => (
                <li
                  key={c}
                  className="rounded-full border px-2 py-0.5 text-[10px] text-white/55"
                  style={{ borderColor: accentColor("conflict", 0.3) }}
                >
                  {c}
                </li>
              ))}
            </ul>
          )}

          {/*
            The microscope. Only fields this audience can actually trace are
            offered — asking about the others returns the same answer as asking
            about a field that does not exist, which is what stops the control
            from becoming a probe.
          */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
              Inspect field lineage
            </span>
            {["move.date", "move.to_address"].map((f) => (
              <button
                key={f}
                onClick={() => setLineageField(lineageField === f ? null : f)}
                aria-expanded={lineageField === f}
                className="inline-flex min-h-11 items-center rounded-full border px-3 font-mono text-[11px] text-white/70"
                style={{
                  borderColor: lineageField === f
                    ? accentColor("security", 0.6)
                    : "rgba(255,255,255,0.16)",
                  background: lineageField === f ? accentColor("security", 0.1) : "transparent",
                }}
              >
                {f}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {lineageField && moveId && (
              <FieldLineage
                key={`${audience}-${lineageField}`}
                moveId={moveId}
                actor={ACTOR[audience]}
                field={lineageField}
                onClose={() => setLineageField(null)}
              />
            )}
          </AnimatePresence>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={audience}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          id="audience-panel"
          role="tabpanel"
          aria-labelledby={`audience-tab-${audience}`}
          tabIndex={0}
          className="mt-6"
        >
          {loading && <p style={{ color: "var(--color-text-lo)" }}>Loading…</p>}
          {loadError && (
            <p
              className="rounded-xl border p-4 text-sm"
              style={{ borderColor: "var(--color-state-failed)", color: "var(--color-state-failed)" }}
            >
              {loadError}
            </p>
          )}

          {/*
            A denial is a result, and the most instructive one on this page.

            The three demo actors have relationships to the scripted move. On a
            move a reviewer created in the console, `user:maya-patel` is a
            different household entirely and has no path to it — so the server
            refuses, and showing that refusal *is* the demonstration. Rendering
            it as "no record yet" would have said the data was missing when what
            was missing was permission.
          */}
          {!loading && typeof data?.error === "string" && (
            <Panel title="Refused, before any projection ran">
              <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
                {(data.detail as string) ?? "This actor has no relationship to this move."}
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--color-text-lo)" }}>
                The three actors here are fixtures with relationships to the scripted move. Against
                a move you created yourself, a customer who is not this household — and a partner
                who did not refer it — have no path to it, and the graph says so before any field is
                read.
              </p>
            </Panel>
          )}

          {!loading && !data?.error && (data?.exists as boolean) === false && (
            <Panel title="No record yet">
              {/*
                An empty state that sends the reviewer somewhere else is a page
                that does not work from a link. The action is here, and it
                builds a real record on the server rather than showing a
                placeholder that looks like one.
              */}
              <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>
                Nothing to project yet. Load Maya&rsquo;s synthetic move and all three views appear.
              </p>
              <button
                onClick={() => void seed()}
                disabled={seeding}
                className="mt-3 inline-flex min-h-11 items-center rounded-full px-5 text-xs font-bold uppercase tracking-wide text-white transition-transform hover:-translate-y-px disabled:opacity-60"
                style={{ background: accentColor("verified", 1) }}
              >
                {seeding ? "Loading…" : "Load Maya's synthetic move"}
              </button>
              {seedError && (
                <p className="mt-2 font-mono text-xs" style={{ color: accentColor("failed", 1) }}>
                  {seedError}
                </p>
              )}
            </Panel>
          )}
          {!loading && data?.exists === true && audience === "concierge" && <ConciergeView d={data} />}
          {!loading && data?.exists === true && audience === "customer" && <CustomerView d={data} />}
          {!loading && data?.exists === true && audience === "partner" && <PartnerView d={data} />}
        </motion.div>
      </AnimatePresence>
      <CompareViews all={all} />

      <ForbiddenView moveId={moveId} />

      {/*
        The business meaning, last.

        Everything above is mechanism. This is the sentence a founder repeats
        afterwards, and it earns its place only because the mechanism above it
        is real — the same claim on an empty page would be a slogan.
      */}
      <section className="mx-auto max-w-[1400px] px-5 pb-24 sm:px-8" aria-label="Why this matters">
        <h2 className="max-w-3xl text-[clamp(22px,3vw,40px)] font-semibold leading-[1.08] tracking-tight text-white">
          The same data should not follow every person.
        </h2>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              title: "Customer trust",
              body: "Maya receives clarity without internal machinery or another party’s information.",
              tone: "solar" as const,
            },
            {
              title: "Partner confidentiality",
              body: "North Texas Realty sees the engagement it is attributed to, not another partner’s business.",
              tone: "internet" as const,
            },
            {
              title: "Operator effectiveness",
              body: "Jordan receives the context required to resolve the move, without that context reaching everyone else.",
              tone: "verified" as const,
            },
          ].map((c) => (
            <div
              key={c.title}
              className="min-w-0 rounded-2xl border p-5"
              style={{ borderColor: accentColor(c.tone, 0.3), background: accentColor(c.tone, 0.05) }}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: accentInk(c.tone) }}>
                {c.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{c.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[clamp(16px,2vw,24px)] font-semibold leading-snug tracking-tight text-white/85">
          One canonical record.
          <br />
          Three responsibilities.
          <br />
          <span style={{ color: accentColor("verified", 1) }}>No extra data.</span>
        </p>
      </section>


      </div>
    </main>
  );
}

/**
 * The fields the server did not send to this audience.
 *
 * This is the page's whole argument, and until now it was made only in prose.
 * The list is computed by comparing the concierge payload against the one on
 * screen, both fetched moments ago — so it reports the current behaviour of the
 * server rather than a description of it written at some point in the past. If a
 * projection ever started leaking a field, the field would drop out of this list
 * instead of the page carrying on asserting an absence that had stopped being
 * true.
 *
 * The concierge is described as the most-privileged projection, never as
 * "everything". No view in this system returns every column, and calling one a
 * superset would be a claim the code does not support — the customer's timeline
 * appears in no other payload.
 */
function WithheldBand({
  audience,
  all,
  loading,
}: {
  audience: Audience;
  all: Record<Audience, Record<string, unknown>> | null;
  loading: boolean;
}) {
  const ready = !!all && all.concierge?.exists === true;
  const missing = ready ? withheld(all.concierge, all[audience]) : [];
  const only = ready ? additional(all.concierge, all[audience]) : [];
  const common = ready ? shared([all.concierge, all.customer, all.partner]) : [];

  const isOperator = audience === "concierge";
  const accent: Accent = isOperator ? "verified" : "security";

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-8 sm:px-8">
      <div
        className="rounded-2xl border px-6 py-7 sm:px-9 sm:py-8"
        style={{
          borderColor: accentColor(accent, 0.45),
          background: `linear-gradient(120deg, ${accentColor(accent, 0.16)}, rgba(255,255,255,0.015) 60%)`,
        }}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
          Withheld from this audience
        </span>

        {!ready ? (
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            {loading
              ? "Reading all three projections…"
              : "No Move Record yet. Load Maya’s synthetic move above, and the three projections can be compared."}
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4">
              <span
                className="font-semibold leading-[0.95] tracking-tight"
                style={{ fontSize: "clamp(44px,8vw,96px)", color: accentColor(accent, 1) }}
              >
                {missing.length}
              </span>
              <span
                className="font-semibold leading-none tracking-tight text-white/35"
                style={{ fontSize: "clamp(18px,2.6vw,30px)" }}
              >
                field{missing.length === 1 ? "" : "s"} not sent
              </span>
            </div>

            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
              {isOperator
                ? "This is the most-privileged of the three projections — the baseline the other two are measured against. It is still not every column in the database."
                : `These paths are present in the concierge's response and absent from this one. Not hidden by CSS, not filtered in the browser — they were never in the payload.`}
            </p>

            {missing.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-1.5">
                {missing.map((p) => (
                  <li
                    key={p}
                    className="rounded-md border px-2 py-1 font-mono text-[11px]"
                    style={{
                      borderColor: accentColor(accent, 0.35),
                      background: accentColor(accent, 0.08),
                      color: accentColor(accent, 0.95),
                    }}
                  >
                    {p}
                  </li>
                ))}
              </ul>
            )}

            {only.length > 0 && (
              <div className="mt-5">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">
                  And {only.length} the concierge does not get
                </div>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {only.map((p) => (
                    <li
                      key={p}
                      className="rounded-md border border-white/12 bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-white/55"
                    >
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-5 font-mono text-[11px] text-white/40">
              {common.length} path{common.length === 1 ? "" : "s"} shared by all three · computed
              from the three responses this page just received
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ConciergeView({ d }: { d: Record<string, unknown> }) {
  const verified = (d.verified as Array<{ field: string; value: unknown; source: string; by: string | null }>) ?? [];
  const priority = (d.priority as { unknownsToReconcile: number; conflictsToResolve: number }) ?? { unknownsToReconcile: 0, conflictsToResolve: 0 };
  const services = (d.services as Array<Record<string, unknown>>) ?? [];
  const briefing = d.briefing as { claims?: Array<{ text: string; kind: string }>; openQuestions?: string[] } | null;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Conflicts to resolve" value={priority.conflictsToResolve} tone={priority.conflictsToResolve ? "conflict" : "verified"} />
        <Stat label="Unknown outcomes to reconcile" value={priority.unknownsToReconcile} tone={priority.unknownsToReconcile ? "conflict" : "verified"} />
      </div>

      {briefing?.claims && (
        <Panel title="Source-grounded briefing — every claim cites a record">
          <ul className="space-y-1.5 text-sm">
            {briefing.claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span aria-hidden style={{ color: c.kind === "conflict" ? "var(--color-state-conflict)" : c.kind === "unknown" ? "var(--color-state-pending)" : "var(--color-state-verified)" }}>
                  {c.kind === "conflict" ? "⚠" : c.kind === "unknown" ? "?" : "✓"}
                </span>
                <span style={{ color: "var(--color-text-mid)" }}>{c.text}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Verified facts">
        {/*
          The table scrolls itself.

          Field paths and values do not wrap usefully, so at 320px this pushed
          past the viewport and the page clips overflow — the source column of
          every row was simply unreachable. `min-w-0` is what lets the scroller
          work: without it the panel is floored at the table's min-content and
          widens instead.
        */}
        <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {verified.map((v, i) => (
              <tr key={i} className="border-t" style={{ borderColor: "var(--color-ground-3)" }}>
                <td className="py-1.5 font-mono text-xs">{v.field}</td>
                <td className="py-1.5">{String(v.value)}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.source}</td>
                <td className="py-1.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{v.by ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Panel>

      <Panel title="Services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="font-medium">{String(s.service_type)}</span>
            <span style={{ color: "var(--color-text-lo)" }}>{String(s.provider_name)}</span>
            <span className="font-mono text-xs" style={{ color: "var(--color-text-mid)" }}>{String(s.submission_state ?? "pending")}</span>
            {s.provider_order_id ? <span className="font-mono text-xs" style={{ color: "var(--color-text-lo)" }}>order {String(s.provider_order_id)}</span> : null}
          </div>
        ))}
      </Panel>
    </div>
  );
}

function CustomerView({ d }: { d: Record<string, unknown> }) {
  const details = (d.details as Array<{ label: string; value: unknown }>) ?? [];
  const services = (d.services as Array<{ service: string; status: string }>) ?? [];
  const needsYou = (d.needsYou as string[]) ?? [];
  const timeline = (d.timeline as Array<{ headline: string; detail: string | null; tone: string }>) ?? [];

  return (
    <div className="space-y-4">
      <Panel title="Your move">
        {details.map((x, i) => (
          <div key={i} className="flex justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span style={{ color: "var(--color-text-lo)" }}>{x.label}</span>
            <span className="font-medium">{String(x.value)}</span>
          </div>
        ))}
      </Panel>

      <Panel title="Your services">
        {services.map((s, i) => (
          <div key={i} className="flex items-center justify-between border-t py-2 text-sm first:border-0" style={{ borderColor: "var(--color-ground-3)" }}>
            <span className="font-medium capitalize">{s.service}</span>
            <StateBadge state={s.status === "Scheduled" ? "verified" : "transit"} subtle />
          </div>
        ))}
      </Panel>

      {needsYou.length > 0 && (
        <Panel title="Needs your attention">
          <ul className="space-y-1 text-sm" style={{ color: "var(--color-text-mid)" }}>
            {needsYou.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        </Panel>
      )}

      {timeline.length > 0 && (
        <Panel title="Your move so far">
          <ol className="space-y-3">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                  style={{
                    background: t.tone === "done" ? "var(--color-state-verified)" : "var(--color-ground-3)",
                    color: t.tone === "done" ? "white" : "var(--color-text-mid)",
                  }}
                >
                  {t.tone === "done" ? "✓" : "·"}
                </span>
                <div>
                  <div className="text-sm font-medium">{t.headline}</div>
                  {t.detail && <div className="text-xs" style={{ color: "var(--color-text-lo)" }}>{t.detail}</div>}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[11px]" style={{ color: "var(--color-text-lo)" }}>
            Built asynchronously from domain events by the outbox projector — already in
            customer language. The system&rsquo;s internal states never reach this list.
          </p>
        </Panel>
      )}

      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This is everything the customer sees. No provider account numbers, no internal
        error states, no concierge notes, no AI prompts. A lost provider response reads
        simply as &ldquo;In progress&rdquo; — the ambiguity is handled internally.
      </p>
    </div>
  );
}

function PartnerView({ d }: { d: Record<string, unknown> }) {
  if (!d.attributed) {
    return (
      <Panel title="No attributed engagement">
        <p className="text-sm" style={{ color: "var(--color-text-mid)" }}>{String(d.message)}</p>
      </Panel>
    );
  }
  const progress = (d.progress as { servicesRequested: number; servicesScheduled: number }) ?? { servicesRequested: 0, servicesScheduled: 0 };
  return (
    <div className="space-y-4">
      <Panel title={`Referral ${String(d.reference)}`}>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Engagement</span>
          <span className="font-medium">{String(d.engagement)}</span>
        </div>
        <div className="flex justify-between border-b py-2 text-sm" style={{ borderColor: "var(--color-ground-3)" }}>
          <span style={{ color: "var(--color-text-lo)" }}>Move date</span>
          <span className="font-medium">{String(d.moveDate)}</span>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <span style={{ color: "var(--color-text-lo)" }}>Services scheduled</span>
          <span className="font-medium">{progress.servicesScheduled} of {progress.servicesRequested}</span>
        </div>
      </Panel>
      <Panel title="Attribution">
        <div className="flex items-center gap-2 text-sm">
          <StateBadge state="verified" subtle />
          <span style={{ color: "var(--color-text-mid)" }}>{String(d.attributionStatus)}</span>
        </div>
      </Panel>
      <p className="text-xs" style={{ color: "var(--color-text-lo)" }}>
        This partner sees only their attributed engagement. No customer PII beyond the move
        date, no provider account numbers, no other partner&rsquo;s pipeline, no internal notes.
      </p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "verified" | "conflict" }) {
  const color = tone === "conflict" ? "var(--color-state-conflict)" : "var(--color-state-verified)";
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--color-ground-3)", background: "var(--color-ground-1)" }}>
      <div className="text-2xl font-semibold" style={{ color }}>{value}</div>
      <div className="mt-0.5 text-xs" style={{ color: "var(--color-text-lo)" }}>{label}</div>
    </div>
  );
}
