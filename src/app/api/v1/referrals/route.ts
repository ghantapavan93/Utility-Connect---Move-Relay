import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { query } from "@/lib/db";
import { ingestReferral } from "@/lib/intake";
import type { ContractChannel } from "@/lib/contracts";

/**
 * POST /api/v1/referrals
 *
 * The public intake endpoint — any payload, full gauntlet: idempotency,
 * contract validation with quarantine, exact-duplicate collapse, cross-move
 * deduplication, provenance persistence, and a domain event.
 *
 * API maturity headers:
 *   Idempotency-Key   — retries replay the stored response; a reused key with
 *                       a different body is refused with 409.
 *   X-Correlation-Id  — accepted if supplied, generated otherwise, echoed on
 *                       the response either way, and threaded through every
 *                       row this request touches.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  // Correlation ids are UUIDs internally (typed columns). Callers send
  // free-form strings, so: a UUID header is used as-is; anything else gets an
  // internal UUID, and the caller's value is echoed back separately so both
  // sides can join their logs. Never trust an external string to be your
  // primary key format.
  const clientCorrelation = request.headers.get("x-correlation-id");
  const correlationId =
    clientCorrelation && UUID_RE.test(clientCorrelation) ? clientCorrelation : randomUUID();
  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;

  let body: { channel?: string; payload?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return respond({ error: "invalid JSON body" }, 400, correlationId);
  }

  const channel = body.channel as ContractChannel;
  if (!["partner_api", "csv_upload", "customer_form"].includes(channel) || !body.payload) {
    return respond(
      { error: "body must be { channel: partner_api|csv_upload|customer_form, payload: {...} }" },
      400,
      correlationId,
    );
  }

  // Intake runs against the demo tenant, created on first use.
  const org =
    (await query<{ id: string }>(`SELECT id FROM organizations WHERE slug = 'uc-demo'`))[0] ??
    (
      await query<{ id: string }>(
        `INSERT INTO organizations (name, slug) VALUES ('Utility Connect (demo)','uc-demo')
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      )
    )[0]!;

  const result = await ingestReferral({
    organizationId: org.id,
    channel,
    payload: body.payload,
    correlationId,
    idempotencyKey,
  });

  return respond(result, result.httpStatus, correlationId, clientCorrelation);
}

function respond(
  body: unknown,
  status: number,
  correlationId: string,
  clientCorrelation?: string | null,
) {
  const headers: Record<string, string> = { "X-Correlation-Id": correlationId };
  if (clientCorrelation && clientCorrelation !== correlationId) {
    headers["X-Client-Correlation-Id"] = clientCorrelation;
  }
  return NextResponse.json(body, { status, headers });
}
