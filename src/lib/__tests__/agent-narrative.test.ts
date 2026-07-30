import { describe, it, expect } from "vitest";

import type { AgentRun, AgentStepRecord } from "../agent/case-agent";
import {
  caseKindFor,
  evidenceFor,
  evidenceStateFor,
  decisionFor,
  customerDraftFor,
  stagesFor,
  stageLabel,
  fieldName,
  conflictDetailFor,
  providerDetailFor,
  auditTrailFor,
  consentDetailFor,
} from "../agent/narrative";

/**
 * The layer between a run and what a reader is told.
 *
 * `case-agent.test.ts` proves the agent reaches the right conclusion. This file
 * proves the page cannot overstate it. Those are different failures: the first
 * is the system doing the wrong thing, the second is the system doing the right
 * thing and describing it as something better.
 *
 * Every case here is a literal run object, so each assertion is about the
 * derivation and nothing else — no database, no fetch, no ordering luck.
 */

const step = (over: Partial<AgentStepRecord> & { tool: string }): AgentStepRecord => ({
  seq: 1,
  authority: "read_only",
  outcome: "ok",
  note: null,
  durationMs: 4,
  observation: null,
  ...over,
});

const run = (over: Partial<AgentRun>): AgentRun => ({
  id: "r1",
  state: "completed",
  goal: "next_safe_action",
  proposal: null,
  refusal: null,
  summary: "",
  steps: [],
  ...over,
});

const UNKNOWN_RUN = run({
  state: "awaiting_approval",
  proposal: {
    tool: "request_provider_reconciliation",
    args: { submissionId: "s1" },
    why: "…",
  },
  refusal: { tool: "submit_provider_enrollment", reason: "…" },
  steps: [
    step({ tool: "get_move_record", observation: { verified: [1, 2], openConflicts: [] } }),
    step({
      tool: "get_provider_operation",
      observation: [{ id: "s1", state: "unknown", service_type: "electric" }],
    }),
    step({ tool: "get_audit_history", observation: [{ event_type: "provider.submitted" }] }),
    step({
      tool: "get_consent_status",
      observation: [
        { granted: true, purpose: "service_setup", channel: "customer_form", consent_text_version: "v2", occurred_at: "2026-07-27T10:00:00Z" },
      ],
    }),
    step({
      tool: "submit_provider_enrollment",
      authority: "forbidden",
      outcome: "refused",
      observation: null,
      note: "Submitting again while the outcome is unknown risks a second household enrolment.",
    }),
  ],
});

const CONFLICT_RUN = run({
  refusal: { tool: "merge_canonical_record", reason: "…" },
  steps: [
    step({
      tool: "get_move_record",
      observation: { verified: [1], openConflicts: ["move.date"] },
    }),
    step({ tool: "get_provider_operation", observation: [{ id: "s2", state: "confirmed" }] }),
    step({
      tool: "list_field_conflicts",
      /*
        The server shape, not a convenient one. `conflictsFor` returns
        `{ move, conflicts }`, and the first version of this fixture was a bare
        array — which let a reader in `narrative.ts` that treated the
        observation as rows pass every test here while returning nothing on a
        real run. The fixture now mirrors the tool, and the eval suite pins the
        two together against the database.
      */
      observation: {
        move: { id: "m1", reference: "MR-1", state: "conflict_pending", version: 2 },
        conflicts: [
          {
            fieldPath: "move.date",
            candidates: [
              { value: "2026-08-14", channel: "partner_api", verification: "unverified", recordedAt: "2026-07-27T10:00:00Z" },
              { value: "2026-08-16", channel: "customer_form", verification: "customer_confirmed", recordedAt: "2026-07-28T09:00:00Z" },
            ],
          },
        ],
      },
    }),
    step({ tool: "get_consent_status", observation: [{ granted: true }] }),
    step({
      tool: "merge_canonical_record",
      authority: "forbidden",
      outcome: "refused",
      observation: null,
      note: "Selecting the surviving value is a human decision.",
    }),
  ],
});

const SETTLED_RUN = run({
  steps: [
    step({ tool: "get_move_record", observation: { verified: [1, 2, 3], openConflicts: [] } }),
    step({ tool: "get_provider_operation", observation: [{ id: "s3", state: "confirmed" }] }),
  ],
});

describe("the case is classified from evidence, not from prose", () => {
  it("separates the three healthy shapes", () => {
    expect(caseKindFor(UNKNOWN_RUN)).toBe("provider_unknown");
    expect(caseKindFor(CONFLICT_RUN)).toBe("field_conflict");
    expect(caseKindFor(SETTLED_RUN)).toBe("settled");
  });

  it("reads the observations rather than the summary string", () => {
    /*
      The summary is prose the planner wrote. Deriving the page's structure from
      it would mean a wording change silently altering what a reader is shown —
      and would let a run that *says* it is settled render as settled while its
      observations hold an unknown provider outcome.
    */
    const lying = run({
      ...UNKNOWN_RUN,
      summary: "Nothing requires action. No unknown provider outcomes, no open conflicts.",
    });
    expect(caseKindFor(lying)).toBe("provider_unknown");
  });

  it("treats a failed read as unreadable, outranking anything else present", () => {
    const blind = run({
      state: "failed",
      steps: [
        step({ tool: "get_move_record", observation: { verified: [], openConflicts: [] } }),
        step({ tool: "get_provider_operation", outcome: "error", observation: null }),
      ],
    });
    expect(caseKindFor(blind)).toBe("unreadable");
  });

  it("does not let a proposal make an unreadable case look actionable", () => {
    // The dangerous combination: the provider read failed, but a proposal is
    // still attached to the run. Structure must follow the failure.
    const blindWithProposal = run({
      state: "failed",
      proposal: { tool: "request_provider_reconciliation", args: {}, why: "…" },
      steps: [step({ tool: "get_provider_operation", outcome: "error", observation: null })],
    });
    expect(caseKindFor(blindWithProposal)).toBe("unreadable");
    expect(decisionFor(blindWithProposal).recommendation).toBeNull();
  });
});

describe("evidence is only what came back", () => {
  it("builds a claim for each returned observation", () => {
    const items = evidenceFor(UNKNOWN_RUN);
    const sources = items.map((i) => i.source);
    expect(sources).toContain("Canonical move record");
    expect(sources).toContain("Provider operations");
    expect(sources).toContain("Audit history");
    expect(sources).toContain("Consent record");
  });

  it("contributes nothing for a refused step", () => {
    /*
      The refused submission is the most visible step in the run, and it
      established no fact. If it produced an evidence row, the page would credit
      the agent with knowing something because it tried something.
    */
    const payloads = evidenceFor(UNKNOWN_RUN).map((i) => JSON.stringify(i.payload));
    expect(payloads.join(" ")).not.toContain("submit_provider_enrollment");
    expect(evidenceFor(run({ steps: [
      step({ tool: "get_move_record", outcome: "refused", observation: null }),
    ] }))).toEqual([]);
  });

  it("says an unknown outcome proves neither success nor failure", () => {
    const claim = evidenceFor(UNKNOWN_RUN).find((i) => i.source === "Provider operations")!.claim;
    expect(claim).toMatch(/response was lost/i);
    // Both halves must be present. Stating only one is how "unknown" collapses
    // into whichever outcome the reader already expected.
    expect(claim).toMatch(/no evidence proves the order was created/i);
    expect(claim).toMatch(/none proves it was not/i);
  });
});

describe("evidence state never flatters the case", () => {
  it("calls a conflict conflicting, even though every read succeeded", () => {
    // The retrieval was healthy. What it retrieved was a contradiction, and
    // reporting "fully supported" would describe the fetch rather than the case.
    expect(CONFLICT_RUN.steps.every((s) => s.outcome !== "error")).toBe(true);
    expect(evidenceStateFor(CONFLICT_RUN)).toBe("conflicting");
  });

  it("calls an unknown provider outcome partially supported", () => {
    expect(evidenceStateFor(UNKNOWN_RUN)).toBe("partially_supported");
  });

  it("calls a failed read insufficient", () => {
    expect(
      evidenceStateFor(
        run({ steps: [step({ tool: "get_move_record", outcome: "error", observation: null })] }),
      ),
    ).toBe("insufficient");
  });

  it("only calls a settled case fully supported when something was actually read", () => {
    expect(evidenceStateFor(SETTLED_RUN)).toBe("fully_supported");
    expect(evidenceStateFor(run({ steps: [] }))).toBe("insufficient");
  });
});

describe("the decision package stops where the evidence does", () => {
  it("recommends reconciliation for an unknown outcome and never a resubmission", () => {
    const d = decisionFor(UNKNOWN_RUN);
    expect(d.recommendation).toMatch(/ask the provider what order already exists/i);
    expect(d.recommendation).not.toMatch(/submit|resubmit|retry|send again/i);
    expect(d.why).toMatch(/never creates one/i);
  });

  it("offers no recommendation for a conflict, because the merge is not the agent's", () => {
    const d = decisionFor(CONFLICT_RUN);
    expect(d.recommendation).toBeNull();
    expect(d.authorityBoundary).toMatch(/named person/i);
  });

  it("refuses to reassure when the case could not be read", () => {
    /*
      The sentence this whole module exists to prevent. An agent that cannot see
      a case and reports calm has converted a failure into a reassurance, and
      reassurance is what stops anyone looking.
    */
    const d = decisionFor(run({ state: "failed", steps: [] }));
    expect(d.recommendation).toBeNull();
    expect(d.situation).toMatch(/could not be read/i);
    expect(d.authorityBoundary).toMatch(/an unread case is not a quiet one/i);
    expect(d.situation).not.toMatch(/nothing requires action|no action needed/i);
  });

  it("states a refusal as what did not happen to the business", () => {
    expect(decisionFor(UNKNOWN_RUN).refusedInBusinessTerms).toMatch(/no second order was sent/i);
    expect(decisionFor(CONFLICT_RUN).refusedInBusinessTerms).toMatch(
      /the move record was not changed/i,
    );
    // The tool name belongs in the technical layer, not in the sentence a
    // non-engineer reads first.
    expect(decisionFor(CONFLICT_RUN).refusedInBusinessTerms).not.toContain("merge_canonical_record");
  });

  it("keeps the same shape when there is nothing to report", () => {
    const d = decisionFor(SETTLED_RUN);
    expect(d.recommendation).toBeNull();
    expect(d.situation).toBeTruthy();
    expect(d.authorityBoundary).toBeTruthy();
  });
});

describe("the customer draft commits to nothing the evidence does not hold", () => {
  it("communicates uncertainty without inventing either outcome", () => {
    const draft = customerDraftFor(UNKNOWN_RUN)!;
    expect(draft).not.toBeNull();

    // The two sentences that must never appear on a case whose defining
    // property is that nobody knows what the provider did.
    expect(draft.body).not.toMatch(/is (now )?(active|confirmed|complete|set up|scheduled)/i);
    expect(draft.body).not.toMatch(/(has|have) been (confirmed|activated|completed)/i);
    expect(draft.body).not.toMatch(/failed|did not go through|unsuccessful/i);

    // And it must explain the restraint rather than going quiet about it.
    expect(draft.body).toMatch(/not sending another request/i);
    expect(draft.withheld.length).toBeGreaterThan(0);
    expect(draft.basedOn.length).toBeGreaterThan(0);
  });

  it("never quotes the disputed values back to the customer", () => {
    const draft = customerDraftFor(CONFLICT_RUN)!;
    expect(draft.body).toMatch(/confirm the right one/i);
    expect(draft.withheld.join(" ")).toMatch(/not quoted/i);
  });

  it("offers no draft for a settled case, and none for an unreadable one", () => {
    expect(customerDraftFor(SETTLED_RUN)).toBeNull();
    /*
      The unreadable case is the important half. It is exactly where a
      reassuring "we're on it" would be most damaging and most tempting, so the
      module declines to produce one at all.
    */
    expect(customerDraftFor(run({ state: "failed", steps: [] }))).toBeNull();
  });
});

describe("the depth extractors read the stored observations, and nothing else", () => {
  it("returns the competing values with their channels and verification", () => {
    const detail = conflictDetailFor(CONFLICT_RUN);
    expect(detail).toHaveLength(1);
    expect(detail[0]!.field).toBe("Date");
    expect(detail[0]!.fieldPath).toBe("move.date");

    const values = detail[0]!.candidates.map((c) => c.value);
    expect(values).toEqual(["2026-08-14", "2026-08-16"]);
    // Channel grammar is storage; the reader gets language.
    expect(detail[0]!.candidates[0]!.channel).toBe("partner api");
    expect(detail[0]!.candidates[1]!.verification).toBe("customer confirmed");
  });

  it("returns nothing when the conflicts step is absent or refused", () => {
    expect(conflictDetailFor(UNKNOWN_RUN)).toEqual([]);
    expect(
      conflictDetailFor(
        run({ steps: [step({ tool: "list_field_conflicts", outcome: "refused", observation: null })] }),
      ),
    ).toEqual([]);
  });

  it("surfaces the operation identity reconciliation depends on", () => {
    const withKey = run({
      steps: [
        step({
          tool: "get_provider_operation",
          observation: [
            {
              id: "s1",
              state: "unknown",
              service_type: "electric",
              provider_name: "Reliant",
              operation_key: "op-7f3a",
              provider_order_id: null,
              error_category: "timeout",
            },
          ],
        }),
      ],
    });
    const ops = providerDetailFor(withKey);
    expect(ops).toHaveLength(1);
    /*
      The load-bearing field. Reconciliation looks the order up by the identity
      the original request carried; a detail view that dropped it would leave
      the safe path claiming to work by magic.
    */
    expect(ops[0]!.operationKey).toBe("op-7f3a");
    expect(ops[0]!.state).toBe("unknown");
    expect(ops[0]!.provider).toBe("Reliant");
  });

  it("gives known audit events business names and leaves unknown ones visibly raw", () => {
    const history = run({
      steps: [
        step({
          tool: "get_audit_history",
          observation: [
            { event_type: "provider.retry.blocked", actor: "system", occurred_at: "2026-07-28T10:00:00Z" },
            { event_type: "some.future.event", actor: "system", occurred_at: "2026-07-28T11:00:00Z" },
          ],
        }),
      ],
    });
    const trail = auditTrailFor(history);
    expect(trail[0]!.label).toMatch(/blind retry was refused/i);
    // An event the map does not know must stay recognisably technical rather
    // than being flattened into something friendly and wrong.
    expect(trail[1]!.label).toBe("some.future.event");
  });

  it("reports consent verbatim, including the wording version", () => {
    const consent = consentDetailFor(UNKNOWN_RUN);
    expect(consent).toHaveLength(1);
    expect(consent[0]!.granted).toBe(true);
    expect(consent[0]!.purpose).toBe("service setup");
  });

  it("humanizes field paths without inventing words", () => {
    expect(fieldName("move.date")).toBe("Date");
    expect(fieldName("customer.phone")).toBe("Phone");
    expect(fieldName("service_address")).toBe("Service address");
  });
});

describe("stages read as work, with the tool underneath", () => {
  it("gives every registry tool a business label that is not the tool name", () => {
    for (const tool of [
      "get_move_record",
      "get_provider_operation",
      "list_field_conflicts",
      "get_audit_history",
      "get_consent_status",
      "submit_provider_enrollment",
      "merge_canonical_record",
    ]) {
      const label = stageLabel(tool);
      expect(label).not.toBe(tool);
      expect(label).not.toContain("_");
    }
  });

  it("carries the registry's own refusal wording through unparaphrased", () => {
    const refused = stagesFor(UNKNOWN_RUN).find((s) => s.state === "refused")!;
    expect(refused.note).toContain("second household enrolment");
    expect(refused.authority).toBe("forbidden");
  });

  it("maps outcomes to states without inventing a success", () => {
    const stages = stagesFor(
      run({
        steps: [
          step({ tool: "get_move_record", outcome: "ok" }),
          step({ tool: "get_provider_operation", outcome: "error" }),
          step({ tool: "merge_canonical_record", outcome: "refused" }),
        ],
      }),
    );
    expect(stages.map((s) => s.state)).toEqual(["completed", "failed", "refused"]);
  });
});
