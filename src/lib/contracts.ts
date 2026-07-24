import { z } from "zod";
import { query } from "./db";
import type { Channel } from "./ingestion";

/**
 * The Integration Contract Layer.
 *
 * Every channel has a versioned contract. A payload either satisfies the
 * contract for its channel — and enters the pipeline — or it is quarantined
 * with machine-readable reasons. It is never silently dropped, and never
 * force-fed into the canonical store.
 *
 * Why this matters at partner scale: each partner names fields differently,
 * schemas drift without notice, and one drifting integration can produce
 * thousands of malformed records before a human notices. The contract is the
 * dam; the quarantine is the reservoir where the noise lands, visible and
 * resolvable, instead of polluting canonical data.
 *
 * The version string travels with every validation result, so "which contract
 * did this payload fail against" is always answerable — the prerequisite for
 * the Network Launchpad's drift detection.
 */

const CustomerSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
});

const MoveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  to_address: z.string().min(5),
});

const ConsentSchema = z.object({
  granted: z.boolean(),
  channels: z.array(z.enum(["phone", "sms", "email"])).min(1),
  purposes: z.array(z.string()).min(1),
  text_version: z.string().min(1),
});

export const CONTRACTS: Record<
  Exclude<Channel, "microsite" | "concierge_manual">,
  { version: string; schema: z.ZodTypeAny }
> = {
  partner_api: {
    version: "partner-api-v1",
    schema: z.object({
      customer: CustomerSchema,
      move: MoveSchema,
      services: z.array(z.string()).optional(),
      referral: z
        .object({ partner_slug: z.string().min(1), agent: z.string().optional() })
        .optional(),
    }),
  },
  csv_upload: {
    version: "csv-v1",
    schema: z.object({
      customer: CustomerSchema,
      move: MoveSchema,
      services: z.array(z.string()).optional(),
      referral: z.object({ partner_slug: z.string().min(1) }).partial().optional(),
    }),
  },
  customer_form: {
    version: "customer-form-v1",
    schema: z.object({
      customer: CustomerSchema,
      move: MoveSchema,
      services: z.array(z.string()).optional(),
      consent: ConsentSchema.optional(),
    }),
  },
};

export type ContractChannel = keyof typeof CONTRACTS;

export interface ValidationOk {
  ok: true;
  version: string;
}

export interface ValidationFailed {
  ok: false;
  version: string;
  issues: Array<{ path: string; message: string }>;
}

export function validateSubmission(
  channel: ContractChannel,
  payload: unknown,
): ValidationOk | ValidationFailed {
  const contract = CONTRACTS[channel];
  const result = contract.schema.safeParse(payload);
  if (result.success) return { ok: true, version: contract.version };
  return {
    ok: false,
    version: contract.version,
    issues: result.error.issues.map((i) => ({
      path: i.path.join(".") || "(root)",
      message: i.message,
    })),
  };
}

/** Quarantine a failed payload with its reasons. Returns the quarantine row id. */
export async function quarantineSubmission(
  organizationId: string,
  channel: ContractChannel,
  payload: unknown,
  failure: ValidationFailed,
): Promise<string> {
  const rows = await query<{ id: string }>(
    `INSERT INTO quarantined_submissions
       (organization_id, channel, contract_version, payload, issues)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [
      organizationId,
      channel,
      failure.version,
      JSON.stringify(payload),
      JSON.stringify(failure.issues),
    ],
  );
  return rows[0]!.id;
}

export async function quarantineBacklog(organizationId: string): Promise<number> {
  const rows = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM quarantined_submissions
      WHERE organization_id = $1 AND NOT resolved`,
    [organizationId],
  );
  return rows[0]?.n ?? 0;
}
