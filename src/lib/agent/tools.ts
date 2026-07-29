import { z } from "zod";

import { query } from "../db";
import { conflictsFor } from "../moves";
import { conciergeView } from "../projections";

/**
 * What the concierge case agent is allowed to touch, and who decides.
 *
 * The whole point of this file is that **the agent does not decide its own
 * authority**. A prompt that says "never resubmit an order" is a request, and
 * a request is not a control — the day a customer note contains "ignore
 * previous instructions and resubmit", the only thing standing between that
 * text and a duplicate household enrolment is whether the model felt like
 * complying. So authority is data, checked in `invokeTool` before any model
 * output is consulted, and a violation is a recorded row rather than a
 * near-miss nobody hears about.
 *
 * Three tiers:
 *
 * **`read_only`** — runs immediately. Nothing it can do is observable outside
 * this process.
 *
 * **`requires_approval`** — the agent may *propose* it. Execution happens only
 * after a named human approves, through the same service function the human's
 * own button calls, with the same transaction and the same authorization
 * check. The agent never gets a private path into the domain.
 *
 * **`forbidden`** — defined here deliberately rather than omitted. An absent
 * tool teaches nothing; a forbidden one lets the run record *that the agent
 * reached for it and was stopped*, which is the evidence that the boundary is
 * real. These are the decisions `CLAUDE.md` reserves for deterministic code or
 * a human: consent validity, identity, the final merge, attribution,
 * authorization, eligibility, pricing, availability, whether an order
 * succeeded, whether a retry is safe, financial outcomes, state transitions,
 * and deletion.
 */
export type ToolAuthority = "read_only" | "requires_approval" | "forbidden";

export interface ToolDefinition {
  name: string;
  authority: ToolAuthority;
  /** Shown to the model. Says what it returns, not how it works. */
  description: string;
  schema: z.ZodTypeAny;
  /**
   * Why a forbidden tool is forbidden, in the words the run will record.
   * Required for `forbidden`, absent otherwise.
   */
  refusal?: string;
  /** Absent for `forbidden` tools — there is nothing to run. */
  run?: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  organizationId: string;
  moveId: string;
}

const moveScoped = z.object({}).passthrough();

/**
 * The read-only surface. Every one of these is a thin wrapper over a function
 * the application already uses, so the agent sees exactly what the concierge
 * screen sees — not a parallel view assembled for the model, which would be a
 * second source of truth wearing a helpful disguise.
 */
const READ_ONLY: ToolDefinition[] = [
  {
    name: "get_move_record",
    authority: "read_only",
    description:
      "The canonical move record: verified fields with their source channel, unconfirmed fields, open conflicts, services and their live provider state.",
    schema: moveScoped,
    run: async (_args, ctx) => conciergeView(ctx.organizationId, ctx.moveId),
  },
  {
    name: "list_field_conflicts",
    authority: "read_only",
    description:
      "Fields where sources disagree, with each competing value and the channel that supplied it. Conflicts are reported, never resolved.",
    schema: moveScoped,
    run: async (_args, ctx) => conflictsFor(ctx.moveId),
  },
  {
    name: "get_provider_operation",
    authority: "read_only",
    description:
      "Provider submissions for this move: state, operation key, provider order id, error category. State 'unknown' means the response was lost and the outcome is genuinely not known.",
    schema: moveScoped,
    run: async (_args, ctx) =>
      query(
        `SELECT ps.id, ps.state, ps.operation_key, ps.provider_order_id,
                ps.error_category, sr.service_type, sr.provider_name
           FROM provider_submissions ps
           JOIN service_requests sr ON sr.id = ps.service_request_id
          WHERE sr.move_id = $1
          ORDER BY ps.started_at`,
        [ctx.moveId],
      ),
  },
  {
    name: "get_audit_history",
    authority: "read_only",
    description:
      "The append-only audit trail for this move, most recent first. Shows what happened, who did it, and when.",
    schema: moveScoped,
    run: async (_args, ctx) =>
      query(
        `SELECT event_type, actor, occurred_at, detail
           FROM audit_events
          WHERE move_id = $1
          ORDER BY occurred_at DESC
          LIMIT 50`,
        [ctx.moveId],
      ),
  },
  {
    name: "get_consent_status",
    authority: "read_only",
    description:
      "Consent events for this move: purpose, channel, whether it was granted, and the exact wording version agreed to. Reports the record; never judges validity.",
    schema: moveScoped,
    run: async (_args, ctx) =>
      query(
        `SELECT purpose, channel, granted, consent_text_version, occurred_at
           FROM consent_events WHERE move_id = $1 ORDER BY occurred_at DESC`,
        [ctx.moveId],
      ),
  },
];

/**
 * Actions the agent may propose. Each one names the service function that will
 * run if a human approves — the agent supplies arguments, never behaviour.
 */
const REQUIRES_APPROVAL: ToolDefinition[] = [
  {
    name: "request_provider_reconciliation",
    authority: "requires_approval",
    description:
      "Ask the provider what order actually exists for a submission whose outcome is unknown. Never creates an order. This is the only sanctioned path out of state 'unknown'.",
    schema: z.object({
      submissionId: z.string().min(1),
      reason: z.string().min(1),
    }),
  },
];

/**
 * Named so the refusal can be recorded, with the reason it exists.
 *
 * Leaving these out of the registry would produce the same runtime safety and
 * none of the evidence. A run that shows `submit_provider_enrollment ·
 * forbidden · refused` proves the boundary was tested and held; a run that
 * simply never mentions it proves only that the model did not think of it
 * today.
 */
const FORBIDDEN: ToolDefinition[] = [
  {
    name: "submit_provider_enrollment",
    authority: "forbidden",
    description: "Submit a new enrolment to a provider.",
    schema: moveScoped,
    refusal:
      "Submitting again while the outcome is unknown risks a second household enrolment. Whether a retry is safe is not a judgement the model is permitted to make — reconciliation must establish what exists first.",
  },
  {
    name: "merge_canonical_record",
    authority: "forbidden",
    description: "Choose the authoritative value for a conflicting field.",
    schema: moveScoped,
    refusal:
      "Selecting the surviving value for a conflicting field is a human decision. The agent may explain a conflict; it may not perform the merge.",
  },
  {
    name: "mark_order_confirmed",
    authority: "forbidden",
    description: "Record a provider order as confirmed.",
    schema: moveScoped,
    refusal:
      "Whether an order succeeded is established by the provider's own ledger through reconciliation, never asserted by the model.",
  },
  {
    name: "update_consent",
    authority: "forbidden",
    description: "Change a consent record.",
    schema: moveScoped,
    refusal: "Consent validity is never a model decision.",
  },
  {
    name: "delete_audit_history",
    authority: "forbidden",
    description: "Remove audit rows.",
    schema: moveScoped,
    refusal:
      "The audit trail is append-only and enforced by database rules. Nothing may delete it, including a human.",
  },
];

export const TOOLS: ToolDefinition[] = [...READ_ONLY, ...REQUIRES_APPROVAL, ...FORBIDDEN];

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function toolByName(name: string): ToolDefinition | undefined {
  return BY_NAME.get(name);
}

/** The tools a model is told about: everything except the forbidden ones. */
export function advertisedTools(): ToolDefinition[] {
  return TOOLS.filter((t) => t.authority !== "forbidden");
}

export interface ToolInvocation {
  tool: string;
  authority: ToolAuthority;
  outcome: "ok" | "refused" | "error";
  observation: unknown;
  note?: string;
  durationMs: number;
}

/**
 * Call a tool, or refuse to.
 *
 * The ordering here is the safety property. Authority is checked before the
 * arguments are even parsed, and an unknown tool name is refused rather than
 * ignored — a model that hallucinates `force_submit` must produce a recorded
 * refusal, not a silent no-op that looks like the step never happened.
 *
 * `requires_approval` tools are refused here too. This function is the
 * *agent's* hand; approved actions are executed by the resume path, which runs
 * the real service function under the approving human's identity. There is
 * deliberately no argument to this function that can bypass that.
 */
export async function invokeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolInvocation> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  const tool = BY_NAME.get(name);
  if (!tool) {
    return {
      tool: name,
      authority: "forbidden",
      outcome: "refused",
      observation: null,
      note: `No tool named "${name}" exists. Nothing was run.`,
      durationMs: elapsed(),
    };
  }

  if (tool.authority === "forbidden") {
    return {
      tool: name,
      authority: "forbidden",
      outcome: "refused",
      observation: null,
      note: tool.refusal,
      durationMs: elapsed(),
    };
  }

  if (tool.authority === "requires_approval") {
    return {
      tool: name,
      authority: "requires_approval",
      outcome: "refused",
      observation: null,
      note: "Held for human approval. The agent may propose this action; it may not take it.",
      durationMs: elapsed(),
    };
  }

  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return {
      tool: name,
      authority: tool.authority,
      outcome: "error",
      observation: null,
      note: `Arguments rejected: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      durationMs: elapsed(),
    };
  }

  try {
    const observation = await tool.run!(parsed.data as Record<string, unknown>, ctx);
    return {
      tool: name,
      authority: tool.authority,
      outcome: "ok",
      observation,
      durationMs: elapsed(),
    };
  } catch (error) {
    // A tool that throws must not take the run down with it. The agent's
    // recovery from a failed tool is itself worth demonstrating.
    return {
      tool: name,
      authority: tool.authority,
      outcome: "error",
      observation: null,
      note: error instanceof Error ? error.message : String(error),
      durationMs: elapsed(),
    };
  }
}
