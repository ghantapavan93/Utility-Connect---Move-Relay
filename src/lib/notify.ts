import { withTransaction } from "./db";
import { recordAudit } from "./audit";
import { canContact, type ConsentChannel, type ConsentPurpose } from "./consent";
import { log } from "./observability";

/**
 * Outbound notification, gated on consent.
 *
 * An audit classified the consent ledger PARTIAL for a precise reason: the
 * table was real, the writes were real, and `canContact` was a correct
 * deny-by-default, per-channel, per-purpose, versioned gate — with **zero
 * production callers**. Nothing in this system ever sent anything, so the gate
 * never fired once. A permission check that guards nothing is a permission
 * check nobody can trust, because it has never been exercised in anger.
 *
 * This module is the caller. It is the single door outbound messages leave by,
 * which is the only arrangement that makes the guarantee checkable: consent is
 * not consulted *usually*, or *where someone remembered* — it is consulted here
 * because there is nowhere else to go.
 *
 * ── What is simulated, and what is not ────────────────────────────────────
 *
 * No message is delivered anywhere. There is no email provider, no SMS gateway,
 * and no telephony, and adding one to a proof-of-work using synthetic customer
 * data would be irresponsible rather than impressive. The transport is a
 * function that records the attempt.
 *
 * Everything up to the transport is real: the consent lookup runs against the
 * ledger, the decision is deny-by-default, and **both outcomes are audited**.
 * A denial that leaves no trace is indistinguishable from a message nobody
 * tried to send, and the difference matters enormously to anyone later asking
 * why a customer was never told.
 */

export interface NotifyInput {
  organizationId: string;
  moveId: string;
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  /** Short, non-PII description of what would be sent. */
  template: string;
  actor?: string;
}

export interface NotifyResult {
  sent: boolean;
  reason: string;
  consentTextVersion?: string;
}

/** Where a permitted message would go. Swappable; never real in this project. */
export type Transport = (input: NotifyInput) => Promise<void>;

const recordOnly: Transport = async (input) => {
  log("info", {
    event: "notification.simulated",
    channel: input.channel,
    purpose: input.purpose,
    template: input.template,
  });
};

let transport: Transport = recordOnly;

/** For tests, and for the day a real provider exists. */
export function setTransport(t: Transport): void {
  transport = t;
}

/**
 * Attempt to contact a customer.
 *
 * Returns whether the message was sent and why. The caller is never given the
 * option of sending without asking — there is no `force`, and no path that
 * reaches `transport` without a granted decision above it.
 */
export async function notifyCustomer(input: NotifyInput): Promise<NotifyResult> {
  const decision = await canContact(input.moveId, input.channel, input.purpose);

  await withTransaction((c) =>
    recordAudit(c, {
      organizationId: input.organizationId,
      moveId: input.moveId,
      // Two distinct event types, because "we chose not to contact them" is a
      // materially different fact from "we contacted them" and collapsing the
      // pair into one event with a boolean makes the audit harder to read at
      // exactly the moment someone is reading it carefully.
      eventType: decision.allowed ? "notification.sent" : "notification.withheld",
      actor: input.actor ?? "system",
      detail: {
        channel: input.channel,
        purpose: input.purpose,
        template: input.template,
        reason: decision.reason,
        consentTextVersion: decision.consentTextVersion ?? null,
        // Stated on every row so nobody reading this trail later mistakes it
        // for evidence that a real message was delivered.
        delivery: "simulated — no external provider is contacted",
      },
    }),
  );

  if (!decision.allowed) {
    return { sent: false, reason: decision.reason };
  }

  await transport(input);
  return {
    sent: true,
    reason: decision.reason,
    consentTextVersion: decision.consentTextVersion,
  };
}

/**
 * Notify across several channels, honouring each one separately.
 *
 * Consent is per-channel by design: a customer may accept email and refuse SMS,
 * and a system that treats consent as one flag will cheerfully text someone who
 * only ever agreed to be emailed. Each channel gets its own decision and its
 * own audit row.
 */
export async function notifyAcross(
  base: Omit<NotifyInput, "channel">,
  channels: ConsentChannel[],
): Promise<Record<string, NotifyResult>> {
  const out: Record<string, NotifyResult> = {};
  for (const channel of channels) {
    out[channel] = await notifyCustomer({ ...base, channel });
  }
  return out;
}
