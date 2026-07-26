import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { parseCsv, mapRows } from "@/lib/csv";
import { ingestReferral } from "@/lib/intake";
import { demoConstants } from "@/lib/demo-orchestrator";
import { actorFrom } from "@/lib/actor";

/**
 * POST /api/v1/upload/csv
 *
 * A real multipart upload for the channel that never had one. `csv_upload` has
 * had a versioned contract and the lowest trust tier in this system since the
 * beginning, and no way to actually upload a CSV — the "CSV" in the demo was a
 * JSON object with a label on it.
 *
 * Every row goes through exactly the same `ingestReferral` path as the partner
 * API and the customer form: idempotency, contract validation, duplicate
 * assessment, provenance. Nothing about this endpoint is a shortcut into the
 * system, which is the point — a channel that bypasses the pipeline to get its
 * data in is a channel whose data nobody can trust.
 *
 * Rows that fail their contract are **quarantined with reasons**, not dropped
 * and not force-fed. A partner who renames a column gets a file that partially
 * lands and a list of exactly which lines did not, which is the behaviour that
 * makes drift survivable.
 */

const MAX_BYTES = 1_000_000;
const MAX_ROWS = 500;

export async function POST(request: Request) {
  // Uploading is a write, so it needs an actor. Reads were gated first; this is
  // the same rule applied to the more consequential direction.
  const actor = actorFrom(request);
  if (!actor) {
    return NextResponse.json(
      { error: "unauthenticated", detail: "Send an X-Actor header. Demo stand-in for a session." },
      { status: 401 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data with a `file` part" }, { status: 400 });
  }
  if (!file) {
    return NextResponse.json({ error: "no file supplied under `file`" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    // A bound, stated in the response. An unbounded upload endpoint is a
    // denial-of-service endpoint with extra steps.
    return NextResponse.json(
      { error: "file too large", limitBytes: MAX_BYTES, received: file.size },
      { status: 413 },
    );
  }

  const org = (
    await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = $1`, [
      demoConstants.ORG_SLUG,
    ])
  )[0];
  if (!org) {
    return NextResponse.json({ error: "run the demo reset first" }, { status: 409 });
  }

  const text = await file.text();
  const parsed = parseCsv(text);
  if (parsed.headers.length === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (parsed.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: "too many rows", limitRows: MAX_ROWS, received: parsed.rows.length },
      { status: 413 },
    );
  }

  const { mapped, rejected } = mapRows(parsed);

  // One correlation id per upload, so every row is traceable back to the single
  // act of uploading it — that is what makes the audit trail answer "where did
  // this come from" rather than merely "what happened".
  const correlationId = randomUUID();

  // The batch id is a hash of the file's contents, and that distinction is the
  // whole reason re-uploading works. A random id per request would mint fresh
  // idempotency keys every time, so the same spreadsheet sent twice would
  // create two sets of referrals — which is precisely the failure this channel
  // is supposed to demonstrate surviving. Same bytes, same keys, second upload
  // replays instead of duplicating.
  const batchId = createHash("sha256").update(text).digest("hex").slice(0, 12);

  const results: Array<{
    line: number;
    status: string;
    moveId?: string;
    quarantineId?: string;
    issues?: Array<{ path: string; message: string }>;
  }> = [];

  for (const row of mapped) {
    const outcome = await ingestReferral({
      organizationId: org.id,
      channel: "csv_upload",
      payload: row.payload,
      correlationId,
      // Line-scoped so re-uploading the same file is a no-op rather than a
      // second set of referrals — the exact scenario Failure Theater names.
      idempotencyKey: `csv:${batchId}:${row.line}`,
    });
    results.push({
      line: row.line,
      status: outcome.status,
      moveId: outcome.moveId,
      quarantineId: outcome.quarantineId,
      // The contract violations, per row, in the response. A quarantined row
      // that does not say why is a row nobody will ever fix.
      issues: outcome.issues,
    });
  }

  const counted = (s: string) => results.filter((r) => r.status === s).length;

  return NextResponse.json({
    ok: true,
    file: file.name,
    correlationId,
    batchId,
    headers: parsed.headers,
    rows: {
      total: parsed.rows.length,
      accepted: counted("created") + counted("attached") + counted("collapsed"),
      quarantined: counted("quarantined"),
      replayed: counted("replayed"),
      unmappable: rejected.length,
    },
    // Both lists travel back. A row that did not land is more interesting than
    // one that did, and silence about it is how bad integrations persist.
    results,
    unmappable: rejected,
  });
}
