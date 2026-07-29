"use client";

import { convergePath, lineProps, nodeProps, LINE, type LineState } from "./vocabulary";

/**
 * One contested field, drawn as sources converging on a single canonical value.
 *
 * This is the composition the Handoff Constellation was designed for and the
 * one place it had never been used. The resolution workspace listed candidates
 * as radio buttons: correct, and it showed a *list of options* where the product
 * is about *many sources becoming one record*.
 *
 * Every mark is bound to real data from `/api/v1/moves/:id/conflicts`:
 *
 *   each source node   one `field_versions` row, labelled with its channel
 *   solid cyan strand  the candidate currently selected — the one that would
 *                      become canonical if the merge were approved now
 *   amber dashed       a competing value; amber because a conflict needs
 *                      judgement and is not a failure
 *   dormant grey       a candidate that agrees with the selection in value but
 *                      arrived on another channel — present, not competing
 *   hollow node        a candidate · filled node the selection
 *
 * The right-hand node is deliberately hollow until something is selected. An
 * unresolved conflict has no canonical value, and drawing one would be the
 * screen asserting a state the database does not hold.
 */

export interface ConflictCandidate {
  value: unknown;
  channel: string;
  verification: string;
}

/**
 * How far the selection has actually got.
 *
 * The distinction this encodes is the whole correction. `selecting` is a click
 * in a browser; `submitting` is a request in flight; `committed` is a value the
 * API has accepted, Postgres has written, and a re-read has returned. Only the
 * last of those may be drawn as verified, because `#0087B5` means verified in
 * this system and a local click is not evidence of anything.
 *
 * A 401, 403, 409 or network failure returns the phase to `selecting`, so a
 * refused merge visibly un-claims the value rather than leaving the screen
 * asserting something the database never accepted.
 */
export type SelectionPhase = "selecting" | "submitting" | "committed";

const W = 620;
const ROW = 34;
/*
  The strand begins to the right of the value it carries.

  The first version started the path at the source node and wrote the value just
  after it, so every line ran straight through its own label and struck it out.
  Text and strand now occupy separate columns: channel, then value, then the
  node the strand leaves from.
*/
const CHANNEL_X = 96;
const VALUE_X = 104;
const SOURCE_X = 252;
const CANON_X = 470;

const label = (v: unknown) =>
  typeof v === "string" ? v.replace(/^"|"$/g, "") : JSON.stringify(v);

/**
 * What the canonical node says, and it never overstates.
 *
 * "Proposed" is the honest word for a click. "Canonical" is reserved for a
 * value the API accepted and a re-read returned — the only point at which the
 * database and the screen agree.
 */
const CANON_LABEL: Record<
  "empty" | "selecting" | "submitting" | "committed",
  { title: string; detail: string }
> = {
  empty: { title: "Unresolved", detail: "no value selected" },
  selecting: { title: "Proposed", detail: "not yet submitted" },
  submitting: { title: "Submitting", detail: "awaiting the server" },
  committed: { title: "Canonical", detail: "committed and re-read" },
};

const canonState = (phase: SelectionPhase, chosen: boolean): LineState =>
  phase === "committed"
    ? "verified"
    : !chosen
      ? "conflicting"
      : phase === "submitting"
        ? "transit"
        : "proposed";

const channelName = (c: string) => c.replace(/_/g, " ");

export function ConflictConstellation({
  candidates,
  selected,
  fieldPath,
  phase = "selecting",
}: {
  candidates: ConflictCandidate[];
  selected: unknown;
  fieldPath: string;
  phase?: SelectionPhase;
}) {
  const height = Math.max(candidates.length * ROW + 24, 96);
  const midY = height / 2;
  const chosen = selected !== undefined;

  /*
    What the chosen strand is allowed to claim.

    Verified is reachable only from `committed`, which only the API can produce.
    In flight it is `transit`; before that it is `proposed`, which borrows the
    locked token because an uncommitted selection is exactly a thing waiting on
    authorization.
  */
  const chosenState =
    phase === "committed" ? "verified" : phase === "submitting" ? "transit" : "proposed";

  const distinct = new Set(candidates.map((c) => label(c.value))).size;
  /*
    The first row carrying the chosen value is the strand; any other row with
    the same value is corroboration, not competition, and is drawn dormant.
    Colouring a second agreeing source as though it were also "the choice"
    would double-count the evidence.
  */
  const chosenIndex = chosen
    ? candidates.findIndex((c) => label(c.value) === label(selected))
    : -1;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="mt-3 h-auto w-full"
      role="img"
      aria-label={
        !chosen
          ? `${fieldPath}: ${candidates.length} sources supplying ${distinct} distinct values, unresolved.`
          : phase === "committed"
            ? `${fieldPath}: "${label(selected)}" is canonical, committed and re-read from the database.`
            : phase === "submitting"
              ? `${fieldPath}: submitting "${label(selected)}" for approval.`
              : `${fieldPath}: "${label(selected)}" proposed, not yet submitted.`
      }
    >
      {candidates.map((candidate, i) => {
        const y = 16 + i * ROW;
        const carriesChosenValue = chosen && label(candidate.value) === label(selected);
        const isChosenStrand = i === chosenIndex;
        /*
          Three readings, and the middle one is the one screens usually get
          wrong. A candidate that agrees with the choice but arrived by another
          channel is not in conflict — it is corroboration — and painting it
          amber would invent a disagreement the data does not contain.
        */
        const state = isChosenStrand
          ? chosenState
          : carriesChosenValue || distinct === 1
            ? "dormant"
            : "conflicting";

        return (
          <g key={`${candidate.channel}-${i}`}>
            <text
              x={CHANNEL_X}
              y={y + 4}
              textAnchor="end"
              className="text-[11px]"
              style={{ fill: "var(--color-text-lo)" }}
            >
              {channelName(candidate.channel)}
            </text>
            <text
              x={VALUE_X}
              y={y + 4}
              className="font-mono text-[12px]"
              style={{
                fill: isChosenStrand ? "var(--color-text-hi)" : "var(--color-text-mid)",
              }}
            >
              {label(candidate.value)}
            </text>
            <path d={convergePath(SOURCE_X, y, CANON_X - 10, midY)} {...lineProps(state)} />
            <circle cx={SOURCE_X} cy={y} r={4.5} {...nodeProps(state, isChosenStrand)} />
          </g>
        );
      })}

      {/*
        The canonical node fills only when the database says so.

        It used to fill from `selected !== undefined` — from a click. That made
        the diagram announce a canonical value the server had never accepted,
        and it would have kept announcing it through a 403 or a 409. Filling is
        now reachable only from `committed`.
      */}
      <circle
        cx={CANON_X}
        cy={midY}
        r={9}
        {...nodeProps(
          phase === "committed" ? "verified" : chosen ? chosenState : "conflicting",
          phase === "committed",
        )}
      />
      <text
        x={CANON_X + 18}
        y={midY - 2}
        className="text-[11px] font-bold uppercase"
        style={{ fill: LINE[canonState(phase, chosen)].stroke, letterSpacing: "0.14em" }}
      >
        {CANON_LABEL[phase === "committed" ? "committed" : chosen ? phase : "empty"].title}
      </text>
      <text
        x={CANON_X + 18}
        y={midY + 13}
        className="text-[11px]"
        style={{ fill: "var(--color-text-lo)" }}
      >
        {CANON_LABEL[phase === "committed" ? "committed" : chosen ? phase : "empty"].detail}
      </text>
    </svg>
  );
}
