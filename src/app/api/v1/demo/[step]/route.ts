import { NextResponse } from "next/server";
import * as demo from "@/lib/demo-orchestrator";

/**
 * POST /api/v1/demo/:step
 *
 * Drives the scenario one step at a time. Each step performs real database work
 * and returns the resulting state. The frontend never fabricates progress — it
 * calls a step and renders whatever the system actually did.
 *
 * Versioned under /v1 deliberately: the demo contract is a public surface of this
 * proof of work, and versioning it is the same discipline the product preaches
 * for partner integrations.
 */

type Step =
  | "reset"
  | "ingest"
  | "detect"
  | "create_move"
  | "conflicts"
  | "merge"
  | "briefing"
  | "submit"
  | "retry"
  | "reconcile";

const handlers: Record<Step, (body: Record<string, unknown>) => Promise<unknown>> = {
  reset: () => demo.reset(),
  ingest: () => demo.ingest(),
  detect: () => demo.detectDuplicates(),
  create_move: () => demo.createMove(),
  conflicts: () => demo.getConflicts(),
  merge: (body) =>
    demo.approveMerge(
      (body.decisions as Array<{ fieldPath: string; value: unknown; reason: string }>) ?? defaultMerge(),
      (body.actor as string) ?? "human:concierge-7",
    ),
  briefing: () => demo.generateBriefing(),
  submit: (body) => demo.submitElectric((body.scenario as "ok" | "timeout_after_create") ?? "timeout_after_create"),
  retry: () => demo.attemptRetry(),
  reconcile: () => demo.runReconciliation(),
};

/** The canonical merge Maya's case calls for, if the client sends none. */
function defaultMerge() {
  return [
    {
      fieldPath: "move.date",
      value: "2026-08-16",
      reason: "Customer stated 16 Aug directly on the web form, three days after the partner feed.",
    },
    {
      fieldPath: "customer.phone",
      value: "469-555-0142",
      reason: "Two of three sources agree; the CSV differs by a single transposed digit.",
    },
  ];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ step: string }> },
) {
  const { step } = await params;
  const handler = handlers[step as Step];

  if (!handler) {
    return NextResponse.json(
      { error: `unknown step '${step}'`, validSteps: Object.keys(handlers) },
      { status: 404 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await handler(body);
    return NextResponse.json({ ok: true, step, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, step, error: err instanceof Error ? err.message : String(err) },
      { status: 409 },
    );
  }
}
